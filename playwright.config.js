// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// 프로젝트별 자동화 테스트는 {프로젝트명}/TC/automation/tests/ 아래에 둡니다.
// 여러 프로젝트가 동시에(Slack에서 서로 다른 스레드로) 자동화 테스트를 실행할 수 있으므로,
// 리포트/산출물 경로는 PW_RUN_ID(보통 프로젝트명)로 네임스페이스합니다 - 미지정 시 'default'.
// 실행 예: PW_RUN_ID=ABC마트 npx playwright test ABC마트/TC/automation/tests/장바구니.spec.js
const RUN_ID = process.env.PW_RUN_ID || 'default';

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/TC/automation/tests/**/*.spec.js',
  timeout: 30 * 1000,
  fullyParallel: false,
  outputDir: `_scratch/test-results/${RUN_ID}`,
  reporter: [
    ['html', { outputFolder: `_scratch/playwright-report/${RUN_ID}`, open: 'never' }],
    ['json', { outputFile: `_scratch/playwright-report/${RUN_ID}/results.json` }],
    ['list'],
  ],
  use: {
    headless: true,
    // 대시보드 "단계 재생(녹화)" 모드(PW_RECORD=1)에서는 성공/실패와 무관하게 영상+트레이스를 남깁니다.
    screenshot: process.env.PW_RECORD === '1' ? 'on' : 'only-on-failure',
    // 디스크 절약: 녹화 모드에서는 용량이 큰 트레이스를 끄고(영상+스크린샷만), 해상도도 낮춥니다.
    trace: process.env.PW_RECORD === '1' ? 'off' : 'retain-on-failure',
    video: process.env.PW_RECORD === '1' ? { mode: 'on', size: { width: 800, height: 450 } } : 'off',
    // [수정 전 2026-09-30] locale: 'ko-KR' 전역 고정 — 2026-08-19 당시 locale 미지정 시 한국어 사이트가
    // 영어로 표시되는 현상을 발견해 고정했었음. 그러나 이 전역 고정이 Admin 로그인 API의 간헐적
    // 결함(DEF_데모사이트_011, ko-KR Accept-Language일 때 서버가 500 반환)을 매번 트리거해, DEF_011과
    // 무관한 Admin 연동 TC 40여 건이 함께 타임아웃/재시도(최대 3회×8~10초)로 지연되는 부작용이 있었음.
    // 재검증 결과(2026-09-30) locale 미지정 상태에서도 Front/Admin 모두 한국어 UI가 정상 렌더링됨을
    // 확인(사이트 쪽 변경 또는 최초 발견 당시의 일시적 현상으로 추정) — 전역 고정을 해제하고, DEF_011
    // 자체를 추적하는 전용 회귀 테스트에서만 locale을 'ko-KR'로 개별 지정하도록 분리함
    // (CO.spec.js의 "[DEF_011회귀]" 테스트 참조, browser.newContext({ locale: 'ko-KR' })로 격리).
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
