# tc-automation 프로젝트 온보딩 가이드

이커머스 QA TC(테스트케이스) 자동 생성/실행/결함관리 시스템의 작업 환경 안내입니다.
Claude Code를 처음 열거나, 다른 사람(다른 Claude 계정 포함)이 이 작업을 이어받을 때 참고하세요.

> **2026-08-24부터 Slack bot(`@큐돌이`) 사용을 종료했습니다.** QA 자동화(TC 생성/테스트 실행/결함조회)
> 자체는 계속하되, 인터페이스가 **① 터미널/IDE의 Claude Code 직접 세션**과 **② 로컬 웹 대시보드
> (`dashboard/`, 상시 구동 중)** 두 가지로 바뀌었습니다. Slack 관련 내용은 이 문서 맨 아래 참고용
>섹션에만 남겨뒀습니다.

---

## 1. 프로젝트 구조 한눈에 보기

```
D:\tc-automation\                 <- 이 프로젝트 전체의 루트이자 유일한 git 저장소
├── agents-config\                <- 규칙/스킬 원본 (AGENTS.md, SKILL.md, role-definition.md)
├── dashboard\                    <- 로컬 웹 대시보드 (Express, 상시 구동, 아래 3번 참조)
├── slack-bridge\                 <- Slack 연동 서버 — 2026-08-24부로 미사용 (일일 Notion 보고만 예외적으로 유지, 8번 참조)
├── _template\                    <- 신규 프로젝트 온보딩용 빈 폴더 틀
├── _reference\                   <- 프로젝트 공통 참조 문서 (특정 프로젝트 내용 아님)
├── project\                      <- 프로젝트별 산출물 전용 폴더
│   └── {프로젝트명}\              <- Policy/SB/Requirements/Analysis/TC 5개 표준 서브폴더
└── CLAUDE.md                     <- Claude Code가 세션 시작 시 자동으로 읽는 진입점 (AGENTS.md/SKILL.md를 @import)
```

- **AGENTS.md**(`agents-config\AGENTS.md`)와 **SKILL.md**(`agents-config\skills\qa-test-case-generator\SKILL.md`)가
  Claude가 따르는 모든 QA 규칙의 원본입니다. `CLAUDE.md`가 이 둘을 `@agents-config/...` 문법으로 불러오므로,
  **이 저장소 폴더 안에서 Claude Code를 열기만 하면** 별도 설명 없이 동일한 규칙으로 동작합니다 — 계정과 무관합니다.
- 모든 산출물(TC 데이터, 뷰어 HTML, PRD, 결함 기록, 규칙 파일, 대시보드 코드)이 **`tc-automation` 저장소
  하나**로 git 커밋되고 GitHub(`github.com/13ongdal-create/tc-automation`)에 push됩니다. 대화가 끊기거나
  PC가 꺼져도 파일과 이력은 그대로 보존됩니다.
- **현재 등록된 프로젝트**: `project\` 아래 폴더 목록이 최신 기준입니다(이 문서에 하드코딩하지 않음 —
  프로젝트는 계속 추가/삭제될 수 있음). 2026-08-27 기준 TOP ONLINE / TOPMALL / 데모사이트 3개가 있습니다.

---

## 2. PC 재부팅 후 이어서 작업하기

**작업 자체는 파일(git 저장소)에 있으므로 재부팅해도 사라지지 않습니다.**

### 방법 A — 이전 대화를 그대로 이어가기
```powershell
cd D:\tc-automation
claude --continue     # 가장 최근 대화를 이어감
claude --resume       # 여러 대화 중 고를 때
```

### 방법 B — 새 대화로 시작 (그래도 규칙은 동일하게 적용됨)
같은 폴더(`D:\tc-automation`)에서 `claude`만 실행해도 `CLAUDE.md`가 AGENTS.md/SKILL.md를 자동으로
불러와 동일한 규칙으로 동작합니다. 예전 대화 맥락이 필요하면 "데모사이트 프로젝트 이어서 진행해줘"처럼
프로젝트명을 알려주면 됩니다 — 실제 데이터는 `project\데모사이트\TC\` 등에 그대로 있습니다.

### 방법 C — 대시보드에서 채팅 패널 사용
아래 3번을 참고해 대시보드(`https://localhost:4000`)를 열고, 프로젝트 상세 화면의
"💬 사이트분석 · TC 생성" 패널에서 자연어로 요청합니다. 내부적으로 헤드리스 `claude` CLI를
같은 규칙(AGENTS.md/SKILL.md)으로 실행합니다.

---

## 3. 로컬 웹 대시보드 (현재 주 인터페이스)

- URL: 로컬 `https://localhost:4000`, 같은 네트워크의 다른 사람은 `https://{LAN IP}:4000`
  (`Get-NetIPAddress`로 확인). 자체서명 인증서라 브라우저 첫 접속 시 보안 경고가 뜨는데
  "고급" → "계속 진행"으로 넘어가면 됩니다.
- **로그인 필수**: 공유 비밀번호는 `dashboard\.dashboard-password`(git 비대상)에 있습니다. 비밀번호를
  모르면 이 PC에서 직접 확인하거나 새로 발급(`DASHBOARD_PASSWORD` 환경변수로 지정)해야 합니다 —
  대시보드 자체는 git에 있지만 비밀번호는 git에 없다는 점에 유의하세요(4번 표 참조).
- **Windows Scheduled Task(`qa-automation-dashboard`)로 상시 구동됩니다.** LogonType은 **S4U**(로그온
  여부와 무관하게 실행, 2026-08-27부터)이며 크래시 시 자동 재시작(최대 999회, 1분 간격)됩니다. 평소엔
  직접 `npm start`를 실행할 필요가 없고, 실행하면 오히려 포트(4000) 충돌이 납니다.
- **재시작이 필요할 때**(백엔드 코드 `dashboard/server.js`·`dashboard/lib/*.js`를 고친 경우만 — 정적
  파일 `dashboard/public/*`은 저장 즉시 반영되어 재시작 불필요):
  1. `Get-NetTCPConnection -LocalPort 4000 -State Listen`으로 현재 PID 확인
  2. `schtasks /End /TN qa-automation-dashboard` 시도 → 그래도 같은 PID가 계속 떠 있으면(Task
     Scheduler 기록과 실제 프로세스가 어긋난 경우) **작업 관리자에서 그 PID의 `node.exe`를 직접
     "작업 끝내기"**
  3. `schtasks /Run /TN qa-automation-dashboard`로 재기동
  - S4U로 바뀐 뒤로는 `taskkill`/`Stop-ScheduledTask`/CIM `Terminate`가 비관리자 세션에서 전부 Access
    Denied가 날 수 있습니다(세션 0 격리) — 위 순서를 따르세요. 자세한 배경은 `CLAUDE.md`의
    "Environment gotchas" 참조.

---

## 4. 다른 Claude 계정으로 작업 이관하기

**먼저 어떤 상황인지부터 구분하세요 — 결과가 완전히 다릅니다.**

- **① 같은 PC에서 Claude Code 로그인 계정만 바꾸는 경우**: 아무것도 안 바뀝니다. 대시보드
  (`qa-automation-dashboard`)와 일일 Notion 보고(`tc-automation-daily-report`)는 이 PC의 Windows
  작업 스케줄러에 등록되어 있고 이 PC에 설치된 `claude` CLI를 그대로 실행하므로, 대화형 세션에
  어떤 Claude 계정으로 로그인하는지와 무관하게 계속 똑같이 동작합니다.
- **② 이 온보딩 문서만 들고 진짜 다른 환경(다른 PC 등)에서 새로 시작하는 경우**: 아래 표의
  "예" 항목들은 자동으로 따라오지 않습니다 — 특히 **Windows 작업 스케줄러 등록 자체와 Notion
  MCP 커넥터 인증**은 git으로 옮겨지지 않는 이 PC/이 계정 고유 상태라서, 대시보드 상시구동과
  일일 보고를 그대로 재현하려면 아래 표의 방법대로 새 환경에서 직접 설정해야 합니다.

| 구성요소 | 계정/PC에 종속? | 이관 방법 |
|---|---|---|
| AGENTS.md/SKILL.md, TC 데이터, 뷰어, 대시보드 코드 | 아니오 (git) | GitHub 저장소 `tc-automation`에 새 계정을 협업자로 추가 → `git clone` 후 그 폴더에서 Claude Code 실행 |
| 대시보드 공유 비밀번호(`dashboard/.dashboard-password`) | 예 (이 PC 로컬, git 비대상) | 새 환경에서는 최초 실행 시 자동 재생성되거나, `DASHBOARD_PASSWORD` 환경변수로 직접 지정 |
| 테스트 계정 정보(`project\{프로젝트명}\TC\testAccounts.json`) | 예 (git 비대상, 자격증명이라 의도적 제외) | 별도로 안전하게 전달 필요 — git에는 없음 |
| 이 세션에서 쌓인 자동 메모리(피드백/선호도, `~/.claude/projects/.../memory/`) | 예 (이 PC·이 계정 로컬) | git에는 없음. **이 온보딩 문서 + AGENTS.md/SKILL.md가 그 역할을 대신합니다** — 중요한 결정/정책은 항상 이 문서들에 반영하고, 개인 메모리에만 남기지 않는 것이 원칙 |
| 대화 이력 자체 | 예 (이 PC/이 계정 로컬) | 다른 계정에서 그대로 열 수 없음 — 다만 git + 이 문서만 있으면 이어가는 데 문제 없음 |
| **Windows 작업 스케줄러 등록**(`qa-automation-dashboard`, `tc-automation-daily-report`) | **예 (이 PC의 OS 상태, git과 무관)** | git clone만으로는 안 따라옴 — 새 PC에서 `schtasks /create`로 직접 재등록 필요(대시보드는 3번, 일일 보고는 8번 참조) |
| **일일 Notion 보고가 쓰는 `claude` CLI의 Notion MCP 커넥터 인증** | **예 (그 컴퓨터에 설치된 claude CLI 자체의 연동 설정, 파일/토큰 형태 아님)** | 새 계정이 (a) 대상 Notion 워크스페이스에 멤버로 초대되고 (b) 자기 Claude 설정에서 Notion 커넥터를 직접 연결해야 동일하게 동작(6번 참조) |
| 노션 접근 권한(사람 대 노션 워크스페이스) | 예 | 새 계정을 해당 노션 워크스페이스에 멤버로 초대 필요 (6번 참조) |
| 발행된 뷰어 Artifact 링크 | 예 (기본 비공개) | 공유 메뉴로 공개 전환, 또는 새 세션에서 로컬 HTML을 다시 발행(파일은 git에 있어 재발행 가능) |

**핵심**: GitHub 저장소 접근 권한만 주면, AGENTS.md/SKILL.md가 규칙을 그대로 재현해주기 때문에 새
계정에게 처음부터 다시 설명할 필요가 거의 없습니다. 다만 위 표에서 "계정에 종속"으로 표시된 항목
(비밀번호, 테스트 계정, 개인 메모리, 노션 권한)은 git으로 자동 이관되지 않으니 별도로 챙겨야 합니다.

---

## 5. 지금 무엇을 하고 있었는지 빠르게 파악하려면

- `git log --oneline -20` — 최근 커밋 메시지가 곧 최근 작업 요약입니다(이 저장소는 커밋 메시지를
  "무엇을·왜"까지 담아 작성하는 컨벤션을 따릅니다).
- `project\{프로젝트명}\TC\{모듈}.json`의 `meta.changeHistory` — 그 모듈 TC의 버전별 변경 요약.
- `project\{프로젝트명}\TC\defects.json` — 결함 현황(상태별로 그룹).
- 대시보드 홈(`https://localhost:4000`) — 프로젝트별 KPI/수행현황/결함현황을 한눈에.
- 노션 워크스페이스의 `🧪 [자동화] TC 생성 자동화` 위키 — "📋 현재 구축 현황 요약"과 각 프로젝트의
  "📘 Claude QA 자동화" 페이지 "업데이트 이력" 표(6번 참조).

---

## 6. 참고 — 노션(Notion) 구조

- 위키 DB: `🧪 [자동화] TC 생성 자동화`
- 프로젝트 페이지 하위에 3종류 서브페이지: **PRD**(관찰 기반 요약), **TC 버전 이력**(모듈별 요약
  인덱스 + 테스트결과/결함현황 표), **TC 목록 (모듈별)** N개(뷰어 링크 + Git 원본 + 상세 버전 이력).
- 규칙/스킬 변경 이력을 요약하는 별도 페이지: **📘 Claude QA 자동화 (규칙/스킬/워크플로우)** — 최신
  "최근 변경" 섹션 1개 + "업데이트 이력" 표(버전별 요약)로 관리(2026-08-27부터 과거 "최근 변경"
  섹션 누적 방지, 최신 1건만 유지).
- 자세한 규칙은 `agents-config\AGENTS.md` 17-7항 참조.

---

## 7. Slack 대신 터미널/IDE·대시보드로 요청하는 방법

Slack bot(`@큐돌이`) 사용을 종료하면서, 예전에 Slack 슬래시커맨드로 하던 일들은 터미널/IDE
세션이나 대시보드 채팅 패널에서 자연어로 직접 요청하면 됩니다. AGENTS.md/SKILL.md 규칙은
인터페이스와 무관하게 동일하게 적용됩니다.

| 예전 Slack 방식 | 지금 요청하는 방법 |
|---|---|
| `/tc-generate 프로젝트=데모사이트 ...` | "데모사이트 프로젝트 {모듈/기능}에 대해 TC 생성해줘" |
| (자동화 코드 실행을 Slack 스레드에서 요청) | "{프로젝트명} {모듈} 테스트 실행해줘" / "테스트 수행해줘" |
| `/tc-defects 프로젝트=데모사이트` | "데모사이트 결함 현황 보여줘" |
| Slack 스레드에서 "DEF_001 담당자를 홍길동으로 지정해줘" | 같은 문구 그대로 요청 (동작 동일, AGENTS.md 20-4항) |
| Slack이 실패 스크린샷을 스레드에 자동 첨부 | 실패 보고 시 Claude가 `Read` 도구로 스크린샷을 직접 열어 응답에 보여줌 (AGENTS.md 19항) |

---

## 8. 참고 — Slack 브릿지 (2026-08-24부로 미사용, 일일 보고 예외)

Slack 봇 자체(`@큐돌이` 대화형 응답)는 완전히 종료했습니다. **단, 평일 10시 Notion 정기 현황 보고만은
`slack-bridge/src/dailyReportStandalone.js`가 Windows Scheduled Task(`tc-automation-daily-report`)로
독립 실행됩니다** (Slack 의존성 없이 같은 Notion 동기화 로직만 재사용 — `@slack/bolt`/`app.start()` 관여
없음). 이 스케줄 작업은 `Get-ScheduledTask -TaskName tc-automation-daily-report`로 확인/제어합니다.

**이 스케줄 작업은 git으로 옮겨지지 않습니다** — 이 PC의 Windows 작업 스케줄러에만 등록된 OS 상태라서,
저장소를 새 PC에 clone해도 자동으로 따라오지 않습니다(4번 표 참조). 새 환경에서 똑같이 매일 아침
보고를 받으려면 그 PC의 작업 스케줄러(`taskschd.msc`)에서 직접 재등록해야 합니다:
- **동작**: `node.exe` 실행, 인수 `src\dailyReportStandalone.js`, 시작 위치는 그 PC의 `slack-bridge\` 경로
- **트리거**: 매주 반복, 월~금, 오전 10:00
- **보안 옵션**: "사용자가 로그온했는지 여부에 관계없이 실행"(S4U) + "암호를 저장하지 않습니다" 체크
  (대시보드와 동일한 이유 — 3번 참조)
- 그리고 그 PC에 설치된 `claude` CLI가 대상 Notion 워크스페이스에 접근 가능해야 합니다(4번 표의
  "Notion MCP 커넥터 인증" 참조) — 이게 안 되어 있으면 스케줄은 정상 실행되어도 Notion 갱신 단계에서
  실패합니다.

그 외 대화형 봇 인프라(`slack-bridge/src/index.js` 등)는 코드/자동시작 스크립트를 삭제하지 않고
보존만 하고 있으며, 재사용하려면 `agents-config\AGENTS.md`의 과거 버전이나 git 이력을 참고하세요.
