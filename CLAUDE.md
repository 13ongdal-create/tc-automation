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
│                           Inactive since 2026-08-24 (terminal/IDE is the interface now) but not deleted.
├── dashboard/               Local web app (Express) for the same workflow: KPI cards, defect
│                            list/edit, execution history. See dashboard section below.
├── _reference/              Shared docs (pipeline design, policy glossary) — not project-specific
├── _template/               Empty scaffold (Policy/SB/Requirements/Analysis/TC) new projects are copied from
├── _shared/testFixtures.js  Playwright fixture every project's automation imports (see below)
├── backup/                  Local-only safety snapshot of agents-config, gitignored
└── {프로젝트명}/             One folder per QA project (e.g. 데모사이트, TOPMALL), each independent:
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
PW_RUN_ID={프로젝트명} npx playwright test --config="D:/tc-automation/playwright.config.js" {프로젝트명}/TC/automation/tests/{모듈}.spec.js
# single test or feature within a module:
... {모듈}.spec.js --grep "TC_PD_058|기능명"
```

`PW_RUN_ID` namespaces report/output paths under `_scratch/` so concurrent runs across projects don't
collide. Results land in `_scratch/playwright-report/{PW_RUN_ID}/results.json` (gitignored — parse it,
then hand-copy screenshots/console logs into `{프로젝트명}/TC/defects/` for anything kept permanently).

**Dashboard** (local web UI at `http://localhost:4000`):

```bash
cd dashboard && npm install && npm start   # or: npm run dev (auto-restart)
```

**slack-bridge** (inactive, kept for reference — do not start unless the user explicitly asks to resume
Slack usage): `cd slack-bridge && npm start`. Needs `.env` (see `slack-bridge/README.md`).

## Tech stack

- **Root**: Node.js + `@playwright/test`, no build step — the "app" is TC data (JSON/HTML) plus scripts.
- **dashboard/**: Express + `ws`, vanilla JS/CSS frontend (no framework, no bundler) — reuses
  `slack-bridge`'s `defectStore.js`/`claudeRunner.js` logic (ported into `dashboard/lib/`) for zero-token
  defect edits and Claude-session-backed TC generation.
- **slack-bridge/**: `@slack/bolt` (Socket Mode, no public URL needed), spawns the `claude` CLI headlessly.

## Key conventions (detail in AGENTS.md)

- TC IDs: `TC_{모듈코드}_{3자리숫자}` (module codes: PD, MB, CO, PR, OP, CS, MY, etc. — AGENTS.md/SKILL.md §5).
- Result values: `Pass / Fail / Blocked / N/A / N/T` — `N/T` means blocked by an already-known defect, not
  a failure of the TC itself (AGENTS.md §20-7).
- Every canonical TC/JSON file bump: copy the pre-edit version to `legacy/` first, then increment
  `meta.version` and append to `meta.changeHistory` — never overwrite history in place.
- `git add` must be scoped to one project/tool path at a time (`git add "데모사이트"`, `git add dashboard`,
  `git add agents-config`) — never `git add -A`/`git add .`. `git push` always needs a fresh confirmation
  even when commits are pre-approved.
- Automation test files import from the shared fixture, always via this exact relative path:
  `require('../../../../_shared/testFixtures')` — it auto-fails a test on any console error or 4xx/5xx
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
