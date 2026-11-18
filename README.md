# 정답 질주 섬

친구들과 함께 겨루는 3판 퀴즈 레이스 게임 (three.js r128).

- 판마다 룰렛으로 게임(정답 문 레이스 · OX 섬 서바이벌 · 색깔 발판 대결)과 과목(수학 · 과학 · 사회 · 영어)을 뽑아요.
- 세 번째 판은 결승(점수 2배).
- 캐릭터는 블렌더로 만든 오리지널 너구리예요.

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` | 게임 전체 (한 파일) |
| `raccoon.json` | 게임이 불러오는 너구리 모델 (glTF JSON, 데이터 포함) |
| `raccoon.glb` | 같은 너구리 모델 (glTF 바이너리) |
| `character.glb` | 처음 만든 곰 캐릭터 모델 |
| `character.blend` | 두 캐릭터의 블렌더 원본 |

## 실행

`.json` 모델을 불러오려면 웹 서버로 열어야 해요 (파일을 바로 열면 예전 기본 캐릭터가 나와요).

```bash
python -m http.server 5190
```

브라우저에서 `http://localhost:5190` 을 열어요.

## 같이 하기 (멀티플레이)

- claude.ai 아티팩트로 열면 claude.ai 의 방 기능을 써요.
- 그 밖(예: https://island-8pt.pages.dev)에서는 `server/` 의 방 서버(Cloudflare Worker + Durable Object)에 웹소켓으로 붙어요.
  주소는 `index.html` 의 `ROOM_SERVER` 에 있어요 (`wss://island-room.quase01.workers.dev`).
- 방 서버는 `server/wrangler.toml` 의 `ALLOWED_ORIGINS` 에 적힌 주소에서 연 게임만 받아요. 게임을 다른 주소에 올리면 여기에 추가해야 해요.

방 서버 고치고 다시 올리기 (`server` 폴더에서, PowerShell 이면 `npx` 대신 `npx.cmd`):

```bash
npx wrangler deploy
```

로컬 시험: `npx wrangler dev --port 8787` 로 서버를 띄우고 게임을 `http://localhost:5190/?server=ws://localhost:8787` 로 열어요.
