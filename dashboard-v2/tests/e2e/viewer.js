// TC 뷰어 결함현황 탭 필터 주입 점검(모듈/심각도/상태/검색, 뷰어 파일 미수정)
// 실행: node tests/e2e/viewer.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
const fs = require('fs');
const path = require('path');
const os = require('os');
// 저장소 위치(D:\QA\tc-automation\dashboard-v2\tests\e2e) 기준으로 4000 저장소 루트를 계산
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOT_POSIX = ROOT.replace(/\\/g, '/');
const crypto = require('crypto');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const pw = fs.readFileSync(path.join(ROOT, 'dashboard', '.dashboard-password'), 'utf8').trim();
const out = [];
const ok = (n, c, x) => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${x ? ' — ' + x : ''}`);
const P = '데모사이트';
const FILE = `${ROOT_POSIX}/project/${P}/TC/${P}_TC_전체.html`;
const sha = () => crypto.createHash('sha256').update(fs.readFileSync(FILE)).digest('hex');
const URL = `http://localhost:4001/project-files/${encodeURIComponent(P)}/TC/${encodeURIComponent(P + '_TC_전체.html')}#${encodeURIComponent('결함현황')}`;

(async () => {
  const before = sha();
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4001/login');
  await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  const api = (u) => page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, t: await r.text() }; }, u);

  // 주입 대상/비대상
  const base = `/project-files/${encodeURIComponent(P)}/TC/`;
  const full = await api(base + encodeURIComponent(P + '_TC_전체.html'));
  ok('전체 뷰어 → 필터 스크립트 주입', full.s === 200 && full.t.includes('/viewer-defect-filters.js'));
  ok('주입 위치: </body> 직전 1회', (full.t.match(/viewer-defect-filters\.js/g) || []).length === 1 && full.t.lastIndexOf('viewer-defect-filters.js') < full.t.lastIndexOf('</body>'));
  const pd = await api(base + encodeURIComponent(P + '_TC_PD.html'));
  ok('모듈 뷰어(PD): 결함 탭 유무에 따라 처리', pd.s === 200, pd.t.includes('id="defectPanel"') ? '결함 탭 있음 → 주입' : '결함 탭 없음 → 미주입');
  ok('결함 탭 없는 페이지는 미주입', pd.t.includes('id="defectPanel"') === pd.t.includes('viewer-defect-filters.js'));
  const res = await api(base + 'results/index.html');
  ok('results 페이지는 미주입', res.s === 200 && !res.t.includes('viewer-defect-filters.js'));
  ok('경로 우회 시도 차단(주입 없음/404)', !(await api(base + '..%2F..%2Fx_TC_.html')).t.includes('viewer-defect-filters.js'));
  ok('필터 스크립트 파일 제공', (await api('/viewer-defect-filters.js')).s === 200);

  // 뷰어 화면
  await page.goto(URL);
  await page.waitForSelector('#defFModule');
  await page.waitForSelector('#defectBody tr[data-defid]');
  await page.waitForFunction(() => document.querySelector('#defFModule option:nth-child(2)') && document.querySelector('#defFModule option:nth-child(2)').textContent.includes('·'));
  ok('툴바에 컨트롤 4종(모듈/심각도/상태/검색)', (await page.locator('#defectPanel .toolbar select').count()) === 3 && (await page.locator('#defectPanel .toolbar #defFSearch').count()) === 1);
  const total = await page.evaluate(() => DEFECT_DATA.length);
  ok('초기 건수 문구(기존과 동일 형식)', (await page.locator('#defectFilteredCount').innerText()) === `${total}건 표시 중 (전체 ${total}건)`, await page.locator('#defectFilteredCount').innerText());
  const rowsInit = await page.locator('#defectBody tr[data-defid]:visible').count();
  ok('초기 표시 행 = 전체', rowsInit === total, `${rowsInit}/${total}`);
  const badges = await page.locator('#defectBody tr[data-defid] td:nth-child(3) .badge').allInnerTexts();
  ok('심각도 표기 = Critical/Major/Minor (P1~P3 없음)', badges.length === total && badges.every((t) => ['Critical', 'Major', 'Minor'].includes(t.trim())), [...new Set(badges)].join('/'));
  const modOpts = await page.locator('#defFModule option').allInnerTexts();
  ok('모듈 옵션에 이름 표시(코드 · 이름)', modOpts.some((t) => /^PD · /.test(t)), modOpts.join(' | '));
  const statusOpts = await page.locator('#defFStatus option').allInnerTexts();
  ok('상태 옵션에 건수 표시', statusOpts[0].includes(`(${total})`) && statusOpts.length === 7, statusOpts.slice(0, 3).join(' | '));
  await page.screenshot({ path: path.join(os.tmpdir(), 'viewer-filters.png'), clip: { x: 0, y: 150, width: 1500, height: 260 } });

  // 심각도
  const expCritical = await page.evaluate(() => DEFECT_DATA.filter((d) => ({ P1: 'Critical' }[d.severity] || d.severity) === 'Critical').length);
  await page.selectOption('#defFSeverity', 'Critical');
  const critRows = await page.locator('#defectBody tr[data-defid]:visible').count();
  ok('심각도=Critical → 해당 결함만', critRows === expCritical && critRows > 0 && (await page.locator('#defectFilteredCount').innerText()) === `${critRows}건 표시 중 (전체 ${total}건)`, `${critRows}건`);
  ok('필터 초기화 버튼 노출', await page.locator('#defFReset').isVisible());

  // 모듈 (TC ID의 모듈코드 기준)
  await page.selectOption('#defFSeverity', '');
  const expCO = await page.evaluate(() => DEFECT_DATA.filter((d) => /^TC_CO_/.test(d.tcId)).length);
  await page.selectOption('#defFModule', 'CO');
  const coRows = await page.locator('#defectBody tr[data-defid]:visible').count();
  ok('모듈=CO → TC_CO_ 결함만', coRows === expCO && coRows > 0, `${coRows}건`);
  const coTcs = await page.locator('#defectBody tr[data-defid]:visible .defect-tc-link').allInnerTexts();
  ok('표시된 결함의 관련 TC가 모두 CO', coTcs.every((t) => t.startsWith('TC_CO_')));

  // 상태 (뷰어의 상태 버튼과 연동)
  await page.selectOption('#defFModule', '');
  await page.selectOption('#defFStatus', '신규');
  const expNew = await page.evaluate(() => DEFECT_DATA.filter((d) => d.status === '신규').length);
  ok('상태=신규 → 상태 버튼도 함께 선택', (await page.locator('#defectFilterPills .tab-btn.active').innerText()).startsWith('신규') && (await page.locator('#defectBody tr[data-defid]:visible').count()) === expNew, `${expNew}건`);
  ok('상태 셀렉트가 선택값 유지', (await page.inputValue('#defFStatus')) === '신규');
  // 뷰어의 상태 버튼을 직접 눌러도 셀렉트가 따라감
  await page.click('#defectFilterPills [data-status="완료"]');
  ok('상태 버튼 클릭 → 셀렉트 동기화', (await page.inputValue('#defFStatus')) === '완료');
  await page.selectOption('#defFStatus', '');

  // 검색
  const q = await page.evaluate(() => { const d = DEFECT_DATA.find((x) => x.actualResult); return (d.actualResult || '').slice(0, 6); });
  const expQ = await page.evaluate((q) => DEFECT_DATA.filter((d) => [d.defectId, d.summary, d.module, d.tcId, d.testEnv, d.testSteps, d.actualResult, d.expectedResult].join(' ').toLowerCase().includes(q.toLowerCase())).length, q);
  await page.fill('#defFSearch', q);
  ok('검색(상세내용 포함)', (await page.locator('#defectBody tr[data-defid]:visible').count()) === expQ && expQ > 0, `"${q}" → ${expQ}건`);
  await page.fill('#defFSearch', 'zzzz없는검색어');
  ok('결과 없음 → 안내 행 + 건수 0', (await page.locator('#defectBody .def-f-empty').count()) === 1 && (await page.locator('#defectFilteredCount').innerText()).startsWith('0건'));
  await page.fill('#defFSearch', '');
  ok('검색어 지움 → 안내 행 제거', (await page.locator('#defectBody .def-f-empty').count()) === 0);

  // 필터 조합 + 뷰어 기능 유지
  await page.selectOption('#defFSeverity', 'Major');
  await page.selectOption('#defFStatus', '신규');
  const combo = await page.locator('#defectBody tr[data-defid]:visible').count();
  const expCombo = await page.evaluate(() => DEFECT_DATA.filter((d) => ({ P2: 'Major' }[d.severity] || d.severity) === 'Major' && d.status === '신규').length);
  ok('심각도+상태 조합(AND)', combo === expCombo, `${combo}건`);
  if (combo > 0) {
    await page.locator('#defectBody tr[data-defid]:visible select.defect-status-select').first().selectOption('처리중');
    ok('행 상태 편집 후에도 필터 유지(행이 빠짐)', (await page.locator('#defectBody tr[data-defid]:visible').count()) === combo - 1);
  }
  await page.click('#defFReset');
  ok('필터 초기화 → 전체 복원', (await page.locator('#defectBody tr[data-defid]:visible').count()) === total && (await page.inputValue('#defFSeverity')) === '' && (await page.inputValue('#defFStatus')) === '');
  await page.locator('#defectBody tr[data-defid]').first().click({ position: { x: 5, y: 5 } });
  ok('행 클릭 → 상세 모달(기존 기능 유지)', await page.locator('#defectModalOverlay').isVisible());
  await page.keyboard.press('Escape');

  ok('파일 자체는 수정되지 않음(해시 동일)', sha() === before);
  const own = errs.filter((e) => !/xlsx|XLSX|sheetjs/i.test(e));
  ok('페이지 오류 없음', own.length === 0, JSON.stringify(own));
  await b.close();
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAIL', e.message); console.log(out.join('\n')); process.exit(1); });
