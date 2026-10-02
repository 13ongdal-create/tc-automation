// 홈 Dashboard와 프로젝트 상세의 수행현황 숫자 일치 점검
// 실행: node tests/e2e/consist.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
const fs = require('fs');
const path = require('path');
const os = require('os');
// 저장소 위치(D:\QA\tc-automation\dashboard-v2\tests\e2e) 기준으로 4000 저장소 루트를 계산
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOT_POSIX = ROOT.replace(/\\/g, '/');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const pw = fs.readFileSync(path.join(ROOT, 'dashboard', '.dashboard-password'), 'utf8').trim();
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4001/login'); await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  await page.waitForSelector('#projectSelect option:nth-child(2)', { state: 'attached' });
  await page.waitForSelector('.project-block[data-project="데모사이트"] .donut-total');
  const txt = (sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim());
  const home = {
    평균수행율: await txt('#homeKpiExecRate'),
    전체Pass: await txt('#homeKpiPass'),
    전체Fail: await txt('#homeKpiFail'),
    수행율도넛: await txt('.project-block .pb-chart-card .donut-center'),
    우선순위도넛_전체TC: (await page.locator('.project-block[data-project="데모사이트"] .pb-chart-card').nth(1).locator('.donut-total').innerText()).trim(),
    우선순위: (await page.locator('.project-block[data-project="데모사이트"] .pb-chart-card').nth(1).locator('.ds-count').allInnerTexts()).join('/'),
    수행율범례: (await page.locator('.project-block[data-project="데모사이트"] .pb-chart-card').first().locator('.ds-label, .ds-count').allInnerTexts()).join(' ').replace(/\s+/g, ' '),
  };
  console.log('HOME  ', JSON.stringify(home));
  await page.selectOption('#projectSelect', '데모사이트'); await page.waitForSelector('#pdKpis .pd-kpi');
  const k = await page.$$eval('#pdKpis .pd-kpi', (ns) => ns.map((n) => n.querySelector('.pd-kpi-label').textContent + '=' + n.querySelector('.pd-kpi-value').textContent + '(' + n.querySelector('.pd-kpi-sub').textContent.trim() + ')'));
  const detail = {
    KPI: k,
    우선순위: (await page.locator('#pdPriorityBody .pd-lg-row b').allInnerTexts()).join('/'),
    도넛합계: (await page.locator('#pdPriorityBody .donut-total').innerText()).trim(),
    타일: (await page.locator('#pdPriorityBody .pd-mini-tile b').allInnerTexts()).join('/'),
  };
  console.log('DETAIL', JSON.stringify(detail));
  console.log('errors:', errs);
  await b.close();
})();
