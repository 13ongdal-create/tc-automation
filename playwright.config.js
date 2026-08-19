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
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // locale 미지정 시 브라우저 기본 로케일(en-US 등)로 렌더링되어 한국어 사이트가 영어로 표시되는
    // 경우가 있어 명시적으로 고정 (2026-08-19, 데모사이트 상품상세 테스트에서 발견)
    locale: 'ko-KR',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
