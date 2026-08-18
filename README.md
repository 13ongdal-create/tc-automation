# tc-automation Slack Bridge (옵션 B)

Slack `#tc-automation` 채널에서 TC 생성/수정/컨펌 요청을 받아, 로컬 Claude Code CLI(`claude`)를 headless로 실행하고
결과를 다시 Slack 스레드로 돌려주는 브릿지 서버입니다. Socket Mode를 사용하므로 **공개 URL/터널이 필요 없습니다** —
지금은 이 PC에서 실행하고, 나중에 서버로 옮겨도 `.env`만 그대로 옮기면 동일하게 동작합니다.

전체 설계 배경은 `../tc-automation/_reference/PIPELINE.md` 참조.

---

## 1. 사전 준비

- Node.js 18 이상
- Claude Code CLI (`claude`)가 PATH에 있는지 확인: `where claude`
- Slack App 생성 완료 (수동 설정 7단계 완료 상태): Bot Token Scopes, Socket Mode, `/tc-generate` 슬래시 커맨드,
  Event Subscriptions(`message.channels`, `message.groups`), `#tc-automation` 채널에 봇 초대까지 완료
- **[추가] `files:write` 스코프**: 콘솔 에러 발생 시 스크린샷을 Slack에 첨부하려면 필요합니다.
  1. Slack API 앱 페이지 → **OAuth & Permissions** → Bot Token Scopes에 `files:write` 추가
  2. 페이지 상단 **Reinstall to bong** 클릭 (스코프 변경은 재설치해야 반영됨)
  3. Bot Token(`xoxb-...`)이 재발급되므로 `.env`의 `SLACK_BOT_TOKEN`을 새 값으로 교체 후 서버 재시작
- **[추가] `/tc-defects` 슬래시 커맨드**: 결함 현황 조회/관리 전용 명령입니다.
  1. Slack API 앱 페이지 → **Slash Commands** → **Create New Command**
  2. Command: `/tc-defects`, Request URL: (Socket Mode라 미사용, 임시로 `https://example.com/tc-defects`), Usage Hint: `프로젝트=ABC마트`
- **[추가] 자연어(멘션) 요청을 위한 `app_mentions:read` 스코프 + `app_mention` 이벤트**:
  1. **OAuth & Permissions** → Bot Token Scopes에 `app_mentions:read` 추가 → 상단 **Reinstall to bong** (Bot Token 재발급됨, `.env` 교체)
  2. **Event Subscriptions** → "Subscribe to bot events"에 `app_mention` 추가 → Save Changes

## 2. 설치

```bash
cd "slack-bridge"
npm install
copy .env.example .env
```

`.env`에 Slack에서 발급받은 3개 값을 채웁니다.

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

`TC_AUTOMATION_ROOT`, `CLAUDE_WORKDIR`는 기본값(이 저장소 경로)을 그대로 두면 됩니다.

## 3. 실행

```bash
npm start
```

콘솔에 `tc-automation slack-bridge 가 실행 중입니다 (Socket Mode).`가 뜨면 준비 완료입니다.

## 4. 사용법 (Slack에서)

```
/tc-generate 프로젝트=ABC마트 모듈=장바구니 목표건수=50
```

URL을 추가하면 정책서 대신(또는 함께) 실제 화면을 Playwright로 관찰해 근거로 삼고, 승인 시 자동화 테스트까지 실행합니다:

```
/tc-generate 프로젝트=ABC마트 모듈=장바구니 URL=https://abc-mart.example.com/cart
```

1. 봇이 스레드를 열고 Phase 1~3(근거 확보, 계정 매트릭스, 시나리오 검토표)까지 진행한 결과를 올립니다.
2. 같은 스레드에 답장으로 수정 요청 가능: `우선순위 재조정해줘`, `쿠폰 관련 케이스 더 추가해줘` 등 자유 텍스트.
3. 승인: 스레드에 `승인`이라고 답장 → 다음 Phase 진행, 최종 단계에서는 실제로 `tc-automation` 저장소에 git commit/push까지 수행합니다.
   URL 기반 요청이었다면 Playwright 자동화 테스트도 함께 실행되고, 콘솔 에러/실패 요청이 감지된 TC는 스크린샷과 함께 스레드에 첨부됩니다.
4. 반려: `반려: 사유` 형식으로 답장 → 사유를 반영해 재작성합니다.
5. 중단: 진행 중(생성/자동화 테스트 실행 등)에 `중단` / `취소` / `그만` / `stop` / `cancel` 이라고 답장 → 실행 중인 프로세스를 트리 전체(하위 git/playwright 포함) 강제 종료하고 중단 안내 메시지를 남깁니다. 이후 같은 스레드에 새 요청을 이어서 입력할 수 있습니다.
6. 진행 상태 확인: 처리 중에 `상태` / `진행상황` / `progress` 라고 답장하면 **그 자리에서 즉시** 지금 어떤 작업(예: `Read: Policy/...docx`, `Bash: npx playwright test ...`) 중인지 알려줍니다. Claude를 다시 호출하지 않고 이미 실행 중인 프로세스의 스트리밍 출력에서 뽑아오는 것이라 **토큰을 추가로 쓰지 않습니다**. (v0.2부터: 예전처럼 몇 분마다 자동으로 "처리 중" 알림을 올리던 방식은 스레드가 알림으로 도배되는 문제가 있어 제거하고, 필요할 때 물어보는 방식으로 바꿨습니다.)

**결함 현황 조회/관리**는 별도 명령으로 진행합니다:

```
/tc-defects 프로젝트=ABC마트
```

새 스레드가 열리고 `{프로젝트명}/TC/defects.json` 기준 상태별 결함 현황을 요약해줍니다 — **이 조회는 Claude를 호출하지 않고
코드로 직접 집계하므로 즉시 응답하고 토큰을 쓰지 않습니다.** 같은 스레드에 `DEF_ABC마트_001 담당자를 홍길동으로 지정해줘`,
`DEF_ABC마트_001 완료 처리해줘`, `DEF_ABC마트_001 이슈링크 https://... 로 등록해줘` 같은 정형화된 요청도 `src/defectFastPath.js`가
Claude 없이 바로 처리합니다 (토큰 미사용). 이 패턴에 안 걸리는 자유 형식 질문("이 결함 원인이 뭐야?" 등)만 그때 처음으로 Claude
세션이 시작됩니다 (AGENTS.md 20항 참조).

**슬래시 커맨드 없이 멘션만으로도** 새 요청을 시작할 수 있습니다 (TC 생성인지 결함 조회인지는 Claude가 문장을 보고 스스로 판단합니다):

```
@큐돌이 ABC마트 장바구니 모듈 TC 30건 정도 만들어줘
@큐돌이 ABC마트 결함 현황 좀 보여줘
```

프로젝트명이 빠져 있으면 진행하지 않고 먼저 되물어봅니다. (채널의 일반 대화에는 반응하지 않도록, 새 요청은 **멘션이 있을 때만** 시작되고, 이미 열린 스레드 안 답장은 멘션 없이도 계속 이어집니다.)

## 5. 알려진 제약 / TODO (v0.1, PoC 단계)

- **세션 이어가기 방식**: 스레드 하나 = `claude --resume <session_id>` 하나로 매핑합니다. 이 저장소 환경(claude CLI
  2.1.229)에서는 `--output-format json` 응답에 `session_id`가 정상적으로 포함되고 `--resume`으로 이어가는 것도
  실제 테스트로 검증했습니다. 다른 버전에서 문제가 생기면 `claude -p "hello" --output-format json`을 직접 실행해
  스키마를 다시 확인하세요.
- **Git 명령은 반드시 절대경로와 함께**: `.agents/.claude/settings.json`의 허용 패턴이 `tc-automation` 경로가 명시된
  명령만 승인하도록 되어 있습니다. `src/index.js`의 프롬프트 템플릿에 이미 절대경로(`TC_AUTOMATION_ROOT`)를 포함시켜
  두었으니, 프롬프트 템플릿을 수정할 때 이 부분을 빠뜨리지 마세요 — 경로 없이 "tc-automation 저장소에서" 정도로만
  지시하면 Claude가 `find`로 경로를 탐색하려다 권한 거부를 만나 포기하는 경우가 있었습니다.
- **승인 UX가 텍스트 기반**입니다 (버튼 아님). 안정화되면 Block Kit 버튼으로 교체 예정 (`PIPELINE.md` 5장 로드맵 참고).
- **프롬프트 이스케이프**: Slack 메시지를 그대로 CLI 인자로 넘기는 방식이라, 따옴표/특수문자가 많은 메시지는
  깨질 수 있습니다. 문제가 생기면 `src/claudeRunner.js`의 인자 전달 방식(현재 `shell:true` + `JSON.stringify`)을
  더 견고하게(stdin으로 프롬프트 전달 등) 바꿔야 합니다.
- **권한**: 이 브릿지가 실행하는 `claude` CLI는 `.agents/.claude/settings.json`에 정의된 허용 목록(Read 전체,
  `tc-automation/` 하위 Write/Edit, git/node/pandoc 일부 명령)만 승인 없이 수행합니다. 새로운 도구/명령이 필요하면
  이 파일에 패턴을 추가해야 합니다.
- **동시 실행**: 서로 다른 스레드(=서로 다른 요청)는 동시에 처리됩니다. 같은 스레드 안에서만 순차 처리가
  강제됩니다. 프로젝트 간 git 커밋 충돌/자동화 테스트 리포트 경로 충돌은 AGENTS.md 18/19항 규칙(프로젝트 단위
  `git add`, `PW_RUN_ID` 네임스페이스)으로 방지하고 있습니다.
- 첫 실행 전에 **터미널에서 먼저 한 번 수동으로** `/tc-generate` 흐름을 흉내내는 프롬프트를 직접 `claude -p`로
  실행해보고, 권한 프롬프트 없이 git commit까지 끝까지 도는지 확인하세요.

## 6. 오류 알림 (Slack Incoming Webhook)

스레드 안에서 발생하는 개별 요청 오류는 이미 해당 스레드에 바로 보고됩니다. 아래는 **그 외의, 스레드에 보고될 곳이
없는 경우**만을 위한 추가 안전망입니다 — 알림 빈도를 최소화하기 위해 실제 문제가 되는 경우에만 보냅니다:

- 브릿지 서버 자체가 예기치 않게 죽는 경우 (`uncaughtException`/`unhandledRejection`)
- claude CLI가 스스로 `is_error`로 응답한 경우
- Slack 연결이 15분 이상 끊긴 경우, 그리고 복구됐을 때 (5.-6. 참조)

서버가 정상 시작/재시작될 때는 알림을 보내지 않습니다 (개발 중 재시작마다 알림이 쌓이는 걸 피하기 위함).

1. Slack API 앱 페이지 → **Incoming Webhooks** → 활성화 → **Add New Webhook to Workspace** → 알림 받을 채널 선택
2. 발급된 Webhook URL을 `.env`의 `SLACK_ERROR_WEBHOOK_URL`에 설정
3. (선택) 알림에 스레드 바로가기 링크를 포함하려면 `SLACK_WORKSPACE_DOMAIN`도 설정 (워크스페이스 URL의 서브도메인)
4. 서버 재시작 — 이후 위 상황이 실제로 발생할 때만 알림이 옵니다

설정하지 않으면 이 알림 기능은 조용히 비활성화되며, 기존 스레드 내 오류 보고 방식만 계속 동작합니다.

## 7. 나중에 서버로 옮길 때

Socket Mode라 별도 코드 변경 없이 `.env`만 새 서버로 옮기면 됩니다. 단, `claude` CLI 로그인 상태(계정 인증)와
git remote push 권한(SSH key 또는 credential)은 새 서버에도 별도로 설정해야 합니다.
