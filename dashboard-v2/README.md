# QA Automation 대시보드 v2 (포트 4001)

4000 포트 대시보드(`../dashboard`)를 기반으로, **프로젝트 상세 화면만 새 UI로** 만든 별도 앱입니다.
홈·로그인·모달 등 나머지 화면은 4000의 UI를 그대로 복사해 씁니다. 4000 소스는 수정하지 않습니다.

- 위치: `D:\QA\tc-automation\dashboard-v2` (이 폴더는 **독립 git 저장소**, 브랜치 `qa-dashboard-v2`, 원격 없음)
- 접속: `http://localhost:4001` · 로그인 비밀번호는 4000과 같음(`../dashboard/.dashboard-password`)

## 4000과의 관계
| | 4000 | 4001 (이 앱) |
|---|---|---|
| 코드 | `../dashboard` | 이 폴더 |
| 데이터(TC·결과·결함) | `../project/*` | **같은 폴더를 공유** (읽기/쓰기) |
| 백엔드 로직 | 자체 `lib/*.js` | 4000의 `lib/*.js`를 **읽기 전용으로 불러옴** (`lib/legacy.js`) |
| 쿠키 | `qa_session` | `qa_session_v2` (같은 호스트라 이름이 같으면 서로 로그아웃시킴) |

- `lib/legacy.js`는 `LEGACY_DASHBOARD_DIR` → 옆 폴더 `../dashboard` → `D:/QA/tc-automation/dashboard` 순으로 4000 lib를 찾습니다.
- 4000의 lib가 바뀌면 4001도 영향을 받습니다(반대는 없음).
- ⚠ 같은 프로젝트의 **테스트 실행·TC 업로드를 4000과 동시에 하지 마세요.** 결과 파일을 서로 덮어쓸 수 있습니다(서버 상태가 프로세스별이라 서로 보이지 않음).
- ⚠ 이 폴더는 4000 저장소(`D:\QA\tc-automation`, 공개 GitHub) 안에 있는 **중첩 저장소**입니다. 4000 쪽에서 `git add .` / `git add -A`를 하면 안 됩니다(4000 CLAUDE.md의 규칙과 동일 — 경로를 지정해서 add).
- ⚠ `D:\QA\tc-automation`에서 이 저장소의 브랜치로 `checkout`하지 마세요(이 저장소에는 project 데이터가 없음).

## 실행
```bash
npm install          # 최초 1회 (express, ws)
npm start            # 수동 실행 — 상시 구동 작업이 켜져 있으면 포트가 충돌하므로 먼저 중지
```
상시 구동은 Windows 작업 스케줄러 `qa-automation-dashboard-v2`(사용자 로그온 시 시작)가 담당합니다.
- 실행기: `scripts/start-hidden.vbs` — 콘솔 창 없이 서버를 띄우고, 서버가 종료되면 5초 뒤(시작 10초 안에 죽으면 30초 뒤) 스스로 다시 띄웁니다.
- 상태: `Get-ScheduledTask qa-automation-dashboard-v2` · 중지: `Stop-ScheduledTask …` · 시작: `Start-ScheduledTask …`
- 로그: `logs/out.log`
- `public/*`(정적 파일)만 고치면 재시작 없이 바로 반영됩니다. `server.js`·`lib/*`를 고쳤을 때만 재시작이 필요합니다.
- 작업 경로를 바꿨다면 `Set-ScheduledTask`로 실행기 경로를 다시 지정해야 합니다.

## 구조
```
server.js                  Express + WebSocket 서버 (4000 server.js와 같은 프로토콜 + 4001 전용 API)
lib/legacy.js              4000 lib 로더
public/
  index.html app.js styles.css login.html tc-history.*   4000 UI 복사본(홈·모달 등) + 일부 수정
  project-detail.js/.css    프로젝트 상세 화면(신규 UI) 렌더링·필터
  project-detail-tclist.js  "실패 TC 보기" TC 목록 창
  viewer-defect-filters.js  TC 뷰어 결함현황 탭 필터(서버가 뷰어를 내려줄 때 주입)
scripts/start-hidden.vbs   작업 스케줄러용 숨김 실행기 + 감시 루프
tests/e2e/                 Playwright 점검 스크립트
data/                      런타임 상태(프로젝트 표시 이름) — git 제외
logs/                      서버 로그 — git 제외
```

## 4001에서 달라진 동작
- **집계 기준**: TC 정본(`project/*/TC/*_TC_{모듈}.json`)의 현재 `result`를 기준으로 합계를 냅니다. 홈·상세·TC 뷰어 숫자가 같습니다.
  실행 이력과 날짜별 진척율만 그 시점 기록(스냅샷, `TC/results/*.json`)입니다.
- **공통 코드 규칙**: TC 중요도 `P1/P2/P3`(핵심/주요/일반), 결함 심각도 `Critical/Major/Minor`(치명/주요/경미). 과거 `P1~P3`로 저장된 결함은 읽을 때 정규화하고, 4001 테스트 실행 후 저장 값도 새 코드로 맞춥니다.
- **프로젝트 표시 이름**: 프로젝트 관리(⚙)에서 변경. 실제 폴더/파일명/결함 ID는 그대로이고 `data/project-names.json`에만 저장됩니다(4000에서는 원래 이름).
- **TC 뷰어 필터**: 서버가 `…/TC/{프로젝트}_TC_*.html`(결함현황 탭이 있는 뷰어)을 내려줄 때 필터 스크립트를 덧붙입니다. **뷰어 파일 자체는 수정하지 않습니다**(뷰어를 다시 생성해도 유지).
- **실패 TC 보기**: 실행결과별 TC 단위 목록(`GET /api/:project/tcs?result=Fail|none|Pass|N/A|N/T`).
- **사이트 정보 저장 보호**: 프로젝트 관리 모달은 정보를 다 불러오기 전에는 저장할 수 없고, 값이 실제로 바뀐 경우에만 `project.json`을 씁니다.

## 점검(E2E)
4001이 떠 있는 상태에서 실행합니다. 4000 저장소 루트의 Playwright를 사용합니다.
```bash
node tests/e2e/verify.js     # 상세 화면 회귀
node tests/e2e/codes.js      # 공통 코드 규칙(TC 중요도 vs 결함 심각도)
node tests/e2e/consist.js    # 홈 ↔ 상세 숫자 일치
node tests/e2e/rename.js     # 프로젝트 표시 이름
node tests/e2e/tclist.js     # 실패 TC 목록
node tests/e2e/viewer.js     # TC 뷰어 결함 필터
```
- ⚠ 점검은 **실제 QA 데이터를 읽습니다.** 쓰기 요청은 쓰지 않도록 작성돼 있습니다(사이트 정보 저장은 가짜 응답으로 가로챔, 표시 이름은 점검 끝에 원복). 새 점검을 추가할 때도 실데이터를 쓰는 요청은 반드시 가로채세요.
  (과거 점검 중 모달을 열자마자 저장해 `project.json`의 URL 등이 지워진 사고가 있었고, 위 보호 장치는 그 재발 방지입니다.)
- 점검 스크린샷은 저장소가 아니라 임시 폴더(`os.tmpdir()`)에 저장됩니다.
