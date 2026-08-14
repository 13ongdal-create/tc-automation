// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// 프로젝트별 자동화 테스트는 {프로젝트명}/TC/automation/tests/ 아래에 둡니다.
module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/TC/automation/tests/**/*.spec.js',
  timeout: 30 * 1000,
  fullyParallel: false,
  reporter: [
    ['html', { outputFolder: '_scratch/playwright-report', open: 'never' }],
    ['json', { outputFile: '_scratch/playwright-report/results.json' }],
    ['list'],
  ],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
