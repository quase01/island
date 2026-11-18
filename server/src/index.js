/* 정답 질주 섬 · 같이 하기 방 서버 (Cloudflare Worker + Durable Object)
 *
 * 방 하나 = Durable Object 하나. 접속은 웹소켓:  wss://<worker>/room/<방이름>?peer=<내 아이디>
 *   방이름: lobby (열린 방 목록) · dash-1234 (경기 방)
 *
 * 주고받는 메시지 (JSON)
 *   서버 → 나   { t: 'hello', peer, peers: [{ peer, p }] }   처음 접속했을 때 방 사람들과 각자 상태
 *   나 → 서버   { t: 'p', d: {...} }                        내 상태 일부를 덮어쓰기 (presence)
 *   서버 → 남   { t: 'p', peer, d: {...} }                  누군가의 상태가 바뀜 (새로 들어온 사람은 d = {})
 *   서버 → 남   { t: 'x', peer }                            누군가 나감
 *
 * 게임 로직은 전혀 모른다. 같은 방 사람들에게 상태를 전해 주기만 한다.
 */
const MAX_PEERS = 40;          // 경기 방 하나 최대 인원
const MAX_LOBBY = 400;         // 로비(열린 방 목록)는 처음 화면에 있는 모두가 붙으니 넉넉하게
const MAX_MSG = 32 * 1024;     // 메시지 하나 최대 크기 (방장이 보내는 경기 상태가 가장 큼)
const ROOM_RE = /^(lobby|dash-\d{4,6})$/;
const PEER_RE = /^[a-z0-9]{8,24}$/;

function originOk(req, env) {
  const allow = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allow.length) return true;
  const o = req.headers.get('Origin') || '';
  return allow.some((a) => (a.startsWith('*.') ? o.endsWith(a.slice(1)) && o.startsWith('https://') : o === a));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (!m) return new Response('island room server', { status: url.pathname === '/' ? 200 : 404 });
    const name = decodeURIComponent(m[1]);
    if (!ROOM_RE.test(name)) return new Response('bad room', { status: 400 });
    if (!PEER_RE.test(url.searchParams.get('peer') || '')) return new Response('bad peer', { status: 400 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (!originOk(req, env)) return new Response('origin not allowed', { status: 403 });
    return env.ROOM.get(env.ROOM.idFromName(name)).fetch(req);
  },
};

export class Room {
  constructor(state) {
    this.state = state;
    this.pres = new Map();   // peer → 상태 (메모리에만. 잠들었다 깨면 비지만, 접속자들이 곧 다시 보낸다)
  }

  sockets() { return this.state.getWebSockets(); }
  peerOf(ws) { const a = ws.deserializeAttachment(); return a && a.peer; }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) { /* 이미 끊긴 연결 */ } }
  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const ws of this.sockets()) if (ws !== except) { try { ws.send(s); } catch (e) {} }
  }

  async fetch(req) {
    const url = new URL(req.url), peer = url.searchParams.get('peer');
    const cap = url.pathname === '/room/lobby' ? MAX_LOBBY : MAX_PEERS;
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ peer: peer });

    /* 같은 아이디로 다시 접속하면(새로고침·재연결) 예전 연결은 닫는다 */
    for (const ws of this.sockets()) if (ws !== server && this.peerOf(ws) === peer) { try { ws.close(4000, 'replaced'); } catch (e) {} }
    const others = this.sockets().filter((ws) => ws !== server && this.peerOf(ws) !== peer);
    if (others.length >= cap) { server.close(4001, 'limit_reached'); return new Response(null, { status: 101, webSocket: client }); }

    const peers = [];
    for (const ws of others) { const p = this.peerOf(ws); if (p) peers.push({ peer: p, p: this.pres.get(p) || {} }); }
    this.pres.set(peer, this.pres.get(peer) || {});
    this.send(server, { t: 'hello', peer: peer, peers: peers });
    this.broadcast({ t: 'p', peer: peer, d: {} }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_MSG) return;
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (!m || m.t !== 'p' || !m.d || typeof m.d !== 'object' || Array.isArray(m.d)) return;
    const peer = this.peerOf(ws); if (!peer) return;
    this.pres.set(peer, Object.assign(this.pres.get(peer) || {}, m.d));
    this.broadcast({ t: 'p', peer: peer, d: m.d }, ws);
  }

  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) {
    const peer = this.peerOf(ws); if (!peer) return;
    if (this.sockets().some((o) => o !== ws && this.peerOf(o) === peer)) return;   // 새 연결로 바뀐 경우
    this.pres.delete(peer);
    this.broadcast({ t: 'x', peer: peer }, ws);
  }
}
