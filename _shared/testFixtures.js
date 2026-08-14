// 모든 프로젝트의 TC 자동화 테스트는 '@playwright/test' 대신 이 파일에서 test/expect를 가져와야 합니다.
// 목적: 브라우저 콘솔 에러(JS 예외) / 실패한 API 요청(4xx/5xx)을 모든 테스트에서 자동으로 감지하고,
//       감지되면 (어서션이 통과했더라도) 테스트를 실패 처리 + 스크린샷을 첨부합니다.
//
// 사용법 (TC/automation/tests/{module}.spec.js 에서, 항상 이 상대경로 고정):
//   const { test, expect } = require('../../../../_shared/testFixtures');

const base = require('@playwright/test');

const test = base.test.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[uncaught exception] ${err.message}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await use(page);

    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      const screenshotPath = testInfo.outputPath('console-error-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

      await testInfo.attach('console-network-errors', {
        body: JSON.stringify({ consoleErrors, failedRequests }, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('console-error-screenshot', {
        path: screenshotPath,
        contentType: 'image/png',
      });
      testInfo.annotations.push({
        type: 'console-error-detected',
        description: `콘솔 에러 ${consoleErrors.length}건 / 실패 요청 ${failedRequests.length}건`,
      });

      // 어서션은 통과했더라도, 콘솔/네트워크 에러가 있으면 조용히 넘어가지 않고 실패로 표시합니다.
      throw new Error(
        [
          '콘솔/네트워크 에러가 감지되어 실패 처리합니다.',
          consoleErrors.length ? `- 콘솔 에러:\n  ${consoleErrors.join('\n  ')}` : null,
          failedRequests.length ? `- 실패 요청:\n  ${failedRequests.join('\n  ')}` : null,
          `- 스크린샷: ${screenshotPath}`,
        ].filter(Boolean).join('\n')
      );
    }
  },
});

module.exports = { test, expect: base.expect };
