// 일일 현황 보고 단독 실행 스크립트 (2026-08-25 추가).
//
// 큐돌이 Slack 봇(Socket Mode 연결, 대화형 명령어, 결함관리 fast-path 등 index.js가 담당하는
// 모든 것)은 2026-08-24 결정대로 계속 비활성 상태입니다. 이 스크립트는 Slack에 전혀 연결하지
// 않고, dailyReport.js의 로직(Claude 헤드리스 세션으로 두 노션 페이지를 갱신)만 단독으로 1회
// 실행한 뒤 종료합니다 — index.js를 통해 Slack 연결이 먼저 성공해야만 dailyReport.start()가
// 호출되던 기존 결합을 끊기 위해 만들었습니다.
//
// 반복 실행은 이 프로세스를 상주시키는 대신(node-cron), Windows 작업 스케줄러가 평일 10:00(KST)에
// 이 스크립트를 매번 새로 실행하는 방식으로 처리합니다 — 재부팅/크래시에 더 안전합니다.
require('dotenv').config();
const { runDailyReport } = require('./dailyReport');

runDailyReport().then(() => {
  console.log('[dailyReportStandalone] 실행 종료');
  process.exit(0);
});
