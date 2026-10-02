// 공통 코드 규칙 점검(TC 중요도 P1~P3 vs 결함 심각도 Critical/Major/Minor 표기·색·필터 분리)
// 실행: node tests/e2e/codes.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
const fs = require('fs');
const path = require('path');
const os = require('os');
// 저장소 위치(D:\QA\tc-automation\dashboard-v2\tests\e2e) 기준으로 4000 저장소 루트를 계산
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOT_POSIX = ROOT.replace(/\\/g, '/');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const pw = fs.readFileSync(path.join(ROOT, 'dashboard', '.dashboard-password'), 'utf8').trim();
const out = [];
const ok = (n, c, x) => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4001/login'); await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  await page.waitForSelector('#projectSelect option:nth-child(2)', { state: 'attached' });
  await page.waitForSelector('.project-block[data-project="데모사이트"] .donut-total');

  // ── 홈 ──
  const cards = page.locator('.project-block[data-project="데모사이트"] .pb-chart-card');
  const homeTcLegend = (await cards.nth(1).locator('.ds-label').allInnerTexts()).join('|').replace(/\s+/g, ' ');
  ok('[홈] TC 분포 범례 = P1/P2/P3 (핵심/주요/일반)', /P1 \(핵심\).*P2 \(주요\).*P3 \(일반\)/.test(homeTcLegend), homeTcLegend);
  const sectionTitles = (await page.locator('.project-block[data-project="데모사이트"] .pb-chart-title').allInnerTexts()).join('|');
  ok('[홈] 카드 제목 구분(TC 중요도별 / 결함 심각도별)', sectionTitles.includes('TC 중요도별 분포') && sectionTitles.includes('결함 심각도별 분포'), sectionTitles);
  const defectCard = page.locator('.project-block[data-project="데모사이트"] .pb-chart-card', { hasText: '결함 심각도별 분포' });
  const homeSevLegend = (await defectCard.locator('.ds-label').allInnerTexts()).join('|').replace(/\s+/g, ' ');
  const homeSevCounts = (await defectCard.locator('.ds-count').allInnerTexts());
  ok('[홈] 결함 범례 = Critical/Major/Minor', /Critical \(치명\).*Major \(주요\).*Minor \(경미\)/.test(homeSevLegend), homeSevLegend);
  ok('[홈] 결함 심각도 건수가 0이 아님(저장 코드 정상 해석)', homeSevCounts.slice(0, 3).some((t) => Number(t) > 0), homeSevCounts.slice(0, 3).join('/'));
  const modHeader = (await page.locator('.project-block[data-project="데모사이트"] table', { hasText: '신규' }).last().locator('thead th').evaluateAll((ns) => ns.map((n) => n.textContent))).join('|'); // CSS 대문자 변환과 무관하게 원문 비교
  ok('[홈] 모듈별 결함 표 헤더 Critical/Major/Minor', modHeader.includes('Critical|Major|Minor'), modHeader);
  const sw = await cards.nth(1).locator('.legend-swatch').evaluateAll((ns) => ns.map((n) => n.style.background));
  ok('[홈] TC 분포 색이 결함 상태색(빨강/주황)과 다름', sw.length === 3 && !sw.some((c) => /var\(--bad\)|var\(--warn\)/.test(c)), sw.join(' '));

  // ── 상세 ──
  await page.selectOption('#projectSelect', '데모사이트'); await page.waitForSelector('#pdDefectBody tbody tr');
  const legend = (await page.locator('#pdPriorityBody .pd-lg-row').allInnerTexts()).join('|').replace(/\s+/g, ' ');
  ok('[상세] TC 분포 범례 = P1 (핵심)…', /P1 \(핵심\).*P2 \(주요\).*P3 \(일반\)/.test(legend), legend);
  ok('[상세] 카드 제목 "TC 중요도 분포"', (await page.locator('#pdPriority h2').innerText()).includes('TC 중요도 분포'));
  const sevCells = await page.locator('#pdDefectBody tbody .pd-sev').allInnerTexts();
  ok('[상세] 결함 표 심각도 = Critical/Major/Minor만', sevCells.length > 0 && sevCells.every((t) => ['Critical', 'Major', 'Minor'].includes(t.trim())), [...new Set(sevCells)].join('/'));
  ok('[상세] 결함 표 헤더 "심각도"', (await page.locator('#pdDefectBody thead').innerText()).includes('심각도'));
  const kpiCrit = Number((await page.locator('#pdKpis .pd-kpi', { hasText: 'Critical 결함' }).locator('.pd-kpi-value').innerText()).trim());
  const expectCrit = await page.evaluate(() => PD.defects.filter((d) => normSeverity(d.severity) === 'Critical' && d.status !== '완료').length);
  ok('[상세] Critical 결함 KPI = 미해결 Critical 건수', kpiCrit === expectCrit && kpiCrit > 0, `KPI ${kpiCrit} / 실제 ${expectCrit}`);
  const before = await page.locator('#pdDefectBody tbody tr').count();
  await page.click('#pdFPrio button[data-v="P1"]');
  ok('[상세] TC 중요도=P1 → 결함 목록은 변하지 않음', (await page.locator('#pdDefectBody tbody tr').count()) === before);
  ok('[상세] TC 중요도=P1 → 분포 도넛 흐림 2구간', (await page.locator('#pdPriorityBody .pd-lg-row.is-dim').count()) === 2);
  await page.click('#pdFReset');
  await page.selectOption('#pdDStatus', '__open'); await page.selectOption('#pdDSeverity', 'Critical');
  const tile = await page.locator('#pdDefectBody tbody tr').count();
  ok('[상세] 심각도=Critical + 미해결 → KPI 건수와 일치', tile === expectCrit, `${tile}건`);
  await page.click('#pdFReset');
  await page.click('[data-pd-act="defects-critical"] >> nth=0');
  ok('[상세] "결함 보기" → 심각도 Critical + 미해결 적용', (await page.inputValue('#pdDSeverity')) === 'Critical' && (await page.inputValue('#pdDStatus')) === '__open');
  await page.click('#pdFHelpBtn');
  const help = await page.locator('#pdFHelp').innerText();
  ok('[상세] 필터 정의에 용어 정의(핵심/치명) 포함', help.includes('P1 핵심') && help.includes('Critical 치명'));
  await page.click('#pdBtnRun');
  ok('[실행큐] 필터 라벨 "TC 중요도"', (await page.locator('label[for="tqPriority"]').innerText()).includes('TC 중요도'));
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await b.close();
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
