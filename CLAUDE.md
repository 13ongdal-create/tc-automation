# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`tc-automation` is a QA test-case (TC) generation, execution, and defect-management system for e-commerce
projects ("큐돌이"). It is not a single application — it's a workspace containing (a) per-project QA data
(TC definitions, HTML viewers, Playwright automation, defect records) and (b) two small Node.js tools that
operate on that data. As of 2026-08-24 everything lives in this one repo
(`github.com/13ongdal-create/tc-automation`) — `agents-config/` and `slack-bridge/` were merged in via
`git subtree` from their own formerly-separate repos, so `git log -- agents-config` / `-- slack-bridge`
still shows their full prior history.

## Rules (loaded automatically)

The actual behavioral rules for generating/reviewing TCs, running automation, and managing defects live in:

@agents-config/AGENTS.md
@agents-config/skills/qa-test-case-generator/SKILL.md

Everything below is orientation for the code/tooling in this repo; AGENTS.md/SKILL.md govern QA content
and process (TC schema, Phase 0-8 workflow, defect lifecycle, Notion sync, etc.) and take precedence.

## Repository layout

```
tc-automation/
├── agents-config/          Rules above (AGENTS.md, SKILL.md) + role-definition.md reference
├── slack-bridge/           Slack bot that used to trigger TC generation/tests/defect queries.
<!-- [수정 전 2026-08-25] "Inactive since 2026-08-24 (terminal/IDE is the interface now) but not deleted."
│                           한 줄뿐이었음 — 이후 daily Notion report만 별도 standalone 스크립트로 분리해
│                           Windows Scheduled Task로 계속 돌아가고 있다는 사실이 반영되지 않은 상태였음. -->
│                           Inactive since 2026-08-24 (interactive bot; terminal/IDE is the interface now)
│                           but not deleted. Exception: the daily Notion report runs independently via
│                           `slack-bridge/src/dailyReportStandalone.js` on a Windows Scheduled Task
│                           (`tc-automation-daily-report`, weekdays 10:00 KST) — this does NOT start the
│                           interactive Slack bot (no `@slack/bolt`/`app.start()` involved).
├── dashboard/               Local web app (Express) for the same workflow: KPI cards, defect
│                            list/edit, execution history. See dashboard section below.
├── _reference/              Shared docs (pipeline design, policy glossary) — not project-specific
├── _template/               Empty scaffold (Policy/SB/Requirements/Analysis/TC) new projects are copied from
├── _shared/testFixtures.js  Playwright fixture every project's automation imports (see below)
├── backup/                  Local-only safety snapshot of agents-config, gitignored
└── project/                 All QA project folders live here (2026-08-25 — separated from the
                              tooling/shared folders above for clarity)
    └── {프로젝트명}/         One folder per QA project (e.g. 데모사이트, TOPMALL), each independent:
        ├── project.json
        ├── Policy/ SB/ Requirements/ Analysis/
        └── TC/
            ├── {모듈코드}.json / .html      Canonical TC data + generated viewer, one pair per module
            ├── defects.json                 Defect records for the whole project
            ├── defects/                     Defect screenshots + console logs
            ├── legacy/                      Superseded versions of the files above (never overwritten in place)
            ├── results/                     Dated Pass/Fail snapshots from test runs
            └── automation/tests/*.spec.js   Playwright specs, one per module
```

Projects are isolated by design — never pull policy/TC content from one project into another.

## Commands

**Run QA automation tests** (from anywhere, not just the repo root — always pass `--config` with an
absolute path rather than `cd`-ing first):

```bash
PW_RUN_ID={프로젝트명} npx playwright test --config="D:/QA/tc-automation/playwright.config.js" project/{프로젝트명}/TC/automation/tests/{모듈}.spec.js
# single test or feature within a module:
... {모듈}.spec.js --grep "TC_PD_058|기능명"
```

`PW_RUN_ID` namespaces report/output paths under `_scratch/` so concurrent runs across projects don't
collide. Results land in `_scratch/playwright-report/{PW_RUN_ID}/results.json` (gitignored — parse it,
then hand-copy screenshots/console logs into `project/{프로젝트명}/TC/defects/` for anything kept permanently).

<!-- [수정 전 2026-08-26] "**Dashboard** (local web UI at `http://localhost:4000`):
```bash
cd dashboard && npm install && npm start   # or: npm run dev (auto-restart)
```"
아래로 교체 — 이후 로그인/HTTPS/사내망 공유/상시구동(Windows Scheduled Task) 추가되어
단순 `npm start` 안내만으로는 실제 운영 방식과 맞지 않게 됨. -->
**Dashboard** ("QA Automation" — Express 웹 UI, port 4000, `dashboard/certs/{key,cert}.pem`이 있으면
HTTPS로 자동 구동):

<!-- [수정 전 2026-08-27] "Windows Scheduled Task(`qa-automation-dashboard`)로 상시 구동됩니다 — 사용자
`3top` 로그온 시 자동 시작, 크래시 시 자동 재시작(최대 999회, 1분 간격). 평소엔 직접 실행할 필요 없음.
확인/제어는 PowerShell `Get-ScheduledTask -TaskName qa-automation-dashboard` / `Start-ScheduledTask` /
`Stop-ScheduledTask`로 — `npm start`를 직접 실행하면 같은 포트(4000)에서 충돌합니다." LogonType이
Interactive였던 시절 안내. 로그온 세션에 프로세스가 붙어있어, 터미널/IDE 세션에서 다른 명령을 실행할
때마다 콘솔 종료 신호가 전파되어 대시보드가 함께 죽는 문제(cmd 창이 매번 깜빡이는 증상 포함)가
반복 발생 — 2026-08-27 사용자 요청으로 LogonType을 S4U(로그온 여부 무관 실행)로 변경해 근본 해결. -->
- **Windows Scheduled Task(`qa-automation-dashboard`)로 상시 구동됩니다** — LogonType **S4U**(로그온
  여부와 관계없이 실행, 2026-08-27부터), Windows 부팅 시 자동 시작, 크래시 시 자동 재시작(최대 999회,
  1분 간격). 평소엔 직접 실행할 필요 없음. `npm start`를 직접 실행하면 같은 포트(4000)에서 충돌합니다.
  - **재시작 시 주의**: S4U로 바뀐 뒤로는 `taskkill`/`Stop-ScheduledTask`/CIM `Terminate` 전부 비관리자
    세션에서 Access Denied가 나며 안 먹힙니다(세션 0으로 격리되어 있어 일반 사용자 권한으로는 종료 불가).
    `schtasks /End /TN qa-automation-dashboard`도 "SUCCESS"라고만 뜨고 실제로는 프로세스를 못 죽이는
    경우가 있습니다(Task Scheduler의 실행 기록과 실제 orphan 프로세스가 어긋난 것으로 추정) — 이 경우
    **작업 관리자에서 해당 PID의 `node.exe`를 직접 "작업 끝내기"**해야 합니다. 확인은
    `Get-NetTCPConnection -LocalPort 4000 -State Listen`으로 PID를 알아낸 뒤 진행하고, 종료 후
    `schtasks /Run /TN qa-automation-dashboard`로 재기동합니다. `dashboard/public/*`(정적 파일: HTML/CSS/
    프론트 JS)만 수정한 경우는 애초에 재시작이 필요 없습니다 — Express가 요청마다 디스크에서 새로
    읽으므로 저장 즉시 반영됩니다. 재시작이 필요한 건 `dashboard/server.js`·`dashboard/lib/*.js`(백엔드,
    require 시점에 캐시됨)를 고친 경우뿐입니다.
- 접속: 로컬 `https://localhost:4000`, 같은 네트워크의 다른 사람은 `https://{LAN IP}:4000`
  (`Get-NetIPAddress`로 확인 가능). 자체서명 인증서라 브라우저 첫 접속 시 보안 경고가 뜹니다 —
  "고급" → "계속 진행"으로 넘어가면 됩니다.
- **로그인 필수**: 채팅 패널이 헤드리스로 `claude` CLI를 실행해 파일 쓰기/커밋까지 하므로, 공유
  비밀번호(세션 쿠키 + WebSocket 동일 검증) 없이는 아무 라우트도 접근할 수 없습니다. 비밀번호는
  최초 실행 시 `dashboard/.dashboard-password`(git 비대상)에 자동 생성되거나, `DASHBOARD_PASSWORD`
  환경변수로 직접 지정 가능합니다.
  <!-- [추가 2026-08-27] 사내망 밖(재택/협력사) 접근 범위 확장을 검토하며 추가 — 공유 비밀번호
  1개만으로는 무차별 대입에 취약해 최소 방어선을 먼저 마련. 확장 자체(Tailscale 등)는 2026-08-27
  현재 보류 상태이며, 이 제한은 사내망 접근에도 그대로 유효하므로 별개로 유지. -->
  **로그인 시도 제한**(2026-08-27 추가): 같은 IP에서 15분 내 5회 비밀번호 실패 시 15분간 로그인
  자체가 차단됩니다(`dashboard/lib/auth.js`, `429` 응답) — 비밀번호가 맞아도 잠금 중엔 안 풀립니다.
  재택/협력사 등 사내망 밖에서 접속하게 할 계획이면 반드시 **Tailscale 등 사설망으로 접근 범위를
  제한**하고 이 대시보드를 그대로 인터넷에 포트포워딩하지 않는 것을 권장합니다(공유 비밀번호 1개 +
  헤드리스 `claude` CLI의 파일쓰기/git커밋 권한 조합은 완전 공개 노출에는 부적합).
- HTTPS 인증서 재발급(예: LAN IP 변경 시)은 `bash dashboard/scripts/gen-cert.sh`. 인증서가 없으면
  서버가 자동으로 평문 HTTP로 폴백합니다.
- 수동/개발 실행(스케줄 작업이 중지되어 있을 때만, 로컬 수정 테스트 등):
  ```bash
  cd dashboard && npm install && npm start   # or: npm run dev (auto-restart)
  ```

<!-- [수정 전 2026-08-25] "slack-bridge (inactive, kept for reference — do not start unless the user
explicitly asks to resume Slack usage): `cd slack-bridge && npm start`. Needs `.env` (see
`slack-bridge/README.md`)." 한 문단뿐이었음 — daily report standalone 스크립트/스케줄 작업 존재가 문서화되지
않았었음. -->
**slack-bridge (interactive bot)** — inactive, kept for reference — do not start unless the user explicitly
asks to resume Slack usage: `cd slack-bridge && npm start`. Needs `.env` (see `slack-bridge/README.md`).

**slack-bridge (daily Notion report only)** — this part IS active and runs unattended: a Windows Scheduled
Task (`tc-automation-daily-report`) executes `node src/dailyReportStandalone.js` from `slack-bridge/` on
weekdays at 10:00 KST. It only calls the same Notion-sync logic `dailyReport.js` already used (no Slack
dependency) — do not conflate this with "resuming the Slack bot." Check/modify it with
`Get-ScheduledTask -TaskName tc-automation-daily-report` (PowerShell), not by starting `npm start`.

## Tech stack

- **Root**: Node.js + `@playwright/test`, no build step — the "app" is TC data (JSON/HTML) plus scripts.
- **dashboard/**: Express + `ws`, vanilla JS/CSS frontend (no framework, no bundler) — reuses
  `slack-bridge`'s `defectStore.js`/`claudeRunner.js` logic (ported into `dashboard/lib/`) for zero-token
  defect edits and Claude-session-backed TC generation.
- **slack-bridge/**: `@slack/bolt` (Socket Mode, no public URL needed), spawns the `claude` CLI headlessly.

## Key conventions (detail in AGENTS.md)

- TC IDs: `TC_{모듈코드}_{3자리숫자}` (module codes: PD, MB, CO, PR, OP, CS, MY, etc. — AGENTS.md/SKILL.md §5).
<!-- [수정 전 2026-08-27] "Result values: `Pass / Fail / Blocked / N/A / N/T` — `N/T` means blocked by an
already-known defect, not a failure of the TC itself (AGENTS.md §20-7)." Blocked retired 2026-08-27 —
its definition overlapped with N/A closely enough to cause confusion, so it was folded into N/A
(AGENTS.md §10 "실행결과 값 정의" table has full definitions). No project data ever used "Blocked",
so no data migration was needed. -->
- Result values: `Pass / Fail / N/A / N/T` — full definitions in AGENTS.md §10 ("실행결과 값 정의"); `N/T`
  means blocked by an already-known defect, not a failure of the TC itself (AGENTS.md §20-7).
- Every canonical TC/JSON file bump: copy the pre-edit version to `legacy/` first, then increment
  `meta.version` and append to `meta.changeHistory` — never overwrite history in place.
- `git add` must be scoped to one project/tool path at a time (`git add "project/데모사이트"`, `git add dashboard`,
  `git add agents-config`) — never `git add -A`/`git add .`. `git push` always needs a fresh confirmation
  even when commits are pre-approved.
- Automation test files import from the shared fixture, always via this exact relative path:
  `require('../../../../../_shared/testFixtures')` — it auto-fails a test on any console error or 4xx/5xx
  response even if assertions passed, and captures screenshot + console/network log together on failure.

## Environment gotchas

- **Windows + Git Bash**: passing a `/d/...`-style path *inside* a quoted `node -e "..."` string is
  unreliable (MSYS's auto path-conversion doesn't always trigger there) and fails with a confusing
  `Cannot find module` pointing at a mangled path. Use `D:/...` forward-slash form in those cases instead.
- **`playwright.config.js` sets `locale: 'ko-KR'`** — this is load-bearing, not incidental: it once
  surfaced a real server-side defect (Admin login 500s only under a Korean browser locale). Don't drop it
  when touching the config, and remember live-environment automation failures can be genuine locale- or
  data-dependent bugs, not flaky tests — confirm root cause before assuming "just retry".
- Don't hardcode specific product IDs, exact catalog counts, or prices in automation against a live URL —
  the catalog changes underneath you. Navigate to "the first available item in category X" and assert
  structure/format instead (AGENTS.md §20-8).
<!-- [추가 2026-08-26] 대시보드 상시구동(Windows Scheduled Task) 구성 중 실측으로 발견한 항목. -->
- **Windows: a `claude` CLI subprocess can take the whole dashboard server down with it.** `dashboard/lib/claudeRunner.js`
  spawns `claude` (a `.cmd` shim → Node internally routes it through `cmd.exe`) for the chat panel. On this
  machine, when that subprocess finished, it emitted a console-wide Ctrl+C that killed every process sharing
  the console — including the parent Express server — even though they're unrelated processes. Symptom: the
  dashboard vanishes (port 4000 stops listening) right after a chat response completes, with a bare `^C` as
  the last line in `dashboard/logs/out.log`, no stack trace. Fixed in `server.js` by having the server ignore
  `SIGINT`/`SIGBREAK` on `win32` (it should only ever be stopped via `taskkill`/`Stop-ScheduledTask`) — don't
  remove that handler when touching `server.js`.
