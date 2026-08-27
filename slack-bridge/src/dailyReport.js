// 평일(월~금) 오전 10시(KST) 자동 현황 보고 — 사용자가 종료를 요청하기 전까지 무기한 실행됩니다.
// 이 실행은 "관찰 + 노션 기록"만 수행하며, 코드 수정/커밋/자동화 테스트 실행은 하지 않습니다.
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const claudeRunner = require('./claudeRunner');

// [수정 2026-08-27] 하드코딩된 'D:/tc-automation' 대신 이 파일 위치(slack-bridge/src/) 기준
// 상대 경로로 계산 — dashboard/lib의 동일 수정과 같은 이유(포터빌리티).
const TC_AUTOMATION_ROOT = process.env.TC_AUTOMATION_ROOT || path.resolve(__dirname, '..', '..');
const STATE_PATH = path.join(__dirname, '..', 'data', 'dailyReportState.json');
const PENDING_PATH = path.join(__dirname, '..', 'data', 'dailyReportPending.txt');

const QUEOLDI_PAGE = 'https://app.notion.com/p/3c2f3310e03181cc9af4c2835c061331';
const CLAUDE_QA_PAGE = 'https://app.notion.com/p/3c2f3310e03181899203c5b3917e0294';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/** 사용자가 남긴 특별 요청사항을 한 번 읽고 파일을 비웁니다 (다음 실행에 중복 반영 방지). */
function takePendingNotes() {
  try {
    const text = fs.readFileSync(PENDING_PATH, 'utf8').trim();
    if (text) fs.writeFileSync(PENDING_PATH, '', 'utf8');
    return text;
  } catch {
    return '';
  }
}

function buildDailyReportPrompt() {
  const state = loadState();
  const since = state.lastRunAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const pending = takePendingNotes();
  const today = new Date().toISOString().slice(0, 10);

  return [
    `오늘(${today}) 평일 정기 현황 보고를 작성해주세요.`,
    `**이 실행은 "관찰 + 노션 기록"만 수행합니다 — 코드 수정, git commit/push, 자동화 테스트 실행은 하지 않습니다.**`,
    `"${TC_AUTOMATION_ROOT}" 저장소(2026-08-24부터 agents-config/slack-bridge를 git subtree로 포함한 단일 저장소)에서, 경로 범위를 나눠 \`git log --since="${since}" --oneline -- <path>\`로 그 이후 변경사항을 확인하세요: (a) \`-- slack-bridge\`, (b) \`-- agents-config\`.`,
    `변경사항을 두 갈래로 분류하세요: (a) 큐돌이 봇/인프라 관련(slack-bridge 코드, 권한 설정, 배포 등) → "${QUEOLDI_PAGE}" 페이지, (b) TC 생성/테스트/결함관리 규칙·스킬·워크플로우 관련(AGENTS.md/SKILL.md/role-definition.md) → "${CLAUDE_QA_PAGE}" 페이지.`,
    `각 페이지를 notion-fetch로 먼저 읽고, 변경사항이 있으면 관련 섹션(구현 현황/규칙 구조/리스크 등)을 갱신하세요. 그다음 반드시 두 페이지 모두의 "업데이트 이력" 표에 오늘 날짜로 새 행을 추가하세요 — 변경사항이 없었다면 "변경사항 없음 — 안정적으로 운영 중"으로 기록합니다 (평일 매일 기록이 원칙이며, 변경 유무와 무관하게 두 페이지 다 기록합니다).`,
    pending
      ? `사용자가 남긴 추가 요청사항이 있습니다 — 이번 보고에 반드시 반영하세요:\n"""${pending}"""`
      : null,
    `작업 완료 후 결과를 간단히 요약해 응답해주세요.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function runDailyReport() {
  const prompt = buildDailyReportPrompt();
  const startedAt = new Date().toISOString();
  try {
    const result = await claudeRunner.startSession(prompt, {
      allowedTools: ['mcp__claude_ai_Notion__notion-fetch', 'mcp__claude_ai_Notion__notion-update-page'],
    });
    saveState({ lastRunAt: startedAt, lastResultOk: !result.isError });
    console.log(`[dailyReport] ${startedAt} 완료 (isError=${result.isError})`);
  } catch (err) {
    console.error(`[dailyReport] ${startedAt} 실패:`, err.message);
  }
}

function start() {
  if (process.env.DAILY_REPORT_ENABLED === 'false') {
    console.log('[dailyReport] DAILY_REPORT_ENABLED=false — 비활성화됨');
    return;
  }
  cron.schedule('0 10 * * 1-5', runDailyReport, { timezone: 'Asia/Seoul' });
  console.log('[dailyReport] 평일 10:00(KST) 자동 현황 보고 예약됨 (종료 요청 전까지 무기한)');
}

module.exports = { start, runDailyReport, buildDailyReportPrompt };
