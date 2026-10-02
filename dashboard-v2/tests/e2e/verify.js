// 프로젝트 상세 화면 회귀 점검(렌더링·필터·모달·신규/기존 프로젝트 모드)
// 실행: node tests/e2e/verify.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
const fs = require('fs');
const os = require('os');
const path = require('path');
// 저장소 위치(D:\QA\tc-automation\dashboard-v2\tests\e2e) 기준으로 4000 저장소 루트를 계산
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROOT_POSIX = ROOT.replace(/\\/g, '/');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
const pw = fs.readFileSync(path.join(ROOT, 'dashboard', '.dashboard-password'), 'utf8').trim();
const out = os.tmpdir(); // 스크린샷은 저장소 밖 임시 폴더에
const checks = [];
const ok = (name, cond, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:4001/login');
  await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  await page.waitForSelector('#projectSelect option:nth-child(2)', { state: 'attached' });
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();

  // ① 기존 프로젝트
  {
    const { page, errors } = await login(browser);
    await page.selectOption('#projectSelect', '데모사이트');
    await page.waitForSelector('#pdKpis .pd-kpi');
    await page.waitForSelector('#pdDefectBody tbody tr');
    const rowsBefore = await page.locator('#pdModuleBody tbody tr').count();
    ok('모듈 표 행 렌더', rowsBefore > 0, `${rowsBefore}행`);
    ok('레일 표시(기존 프로젝트)', await page.locator('#pdRail').isVisible());
    ok('온보딩 카드 숨김', !(await page.locator('#pdOnboard').isVisible()));
    ok('확인필요 카드 표시', await page.locator('#pdAttention').isVisible());
    ok('"중단" 버튼 숨김', !(await page.locator('#btnChatCancel').isVisible()));
    const shortId = await page.locator('#pdDefectBody tbody tr td').first().innerText();
    ok('결함 ID 축약', /^DEF_\d+$/.test(shortId.trim()), shortId.trim());

    await page.click('[data-pd-act="filter-fail"] >> nth=0');
    await page.waitForTimeout(300);
    const rowsFail = await page.locator('#pdModuleBody tbody tr').count();
    ok('Fail 필터 → 모듈 행 감소', rowsFail > 0 && rowsFail < rowsBefore, `${rowsBefore}→${rowsFail}`);
    ok('필터 초기화 버튼 노출', await page.locator('#pdFReset').isVisible());
    await page.click('#pdFReset');
    ok('초기화 → 원복', (await page.locator('#pdModuleBody tbody tr').count()) === rowsBefore);

    await page.selectOption('#pdDSeverity', 'Critical');
    const sevRows = await page.locator('#pdDefectBody tbody tr').count();
    const sevText = await page.locator('#pdDefectBody tbody .pd-sev').allInnerTexts();
    ok('심각도=Critical → 결함 모두 Critical', sevRows > 0 && sevText.length === sevRows && sevText.every((t) => t.trim() === 'Critical'), sevRows + '건');
    await page.click('#pdFReset');

    await page.fill('#pdFSearch', '없는검색어zzz');
    ok('검색 결과 없음 문구', (await page.locator('#pdModuleBody').innerText()).includes('조건에 맞는 모듈이 없습니다'));
    await page.click('#pdFReset');

    await page.click('#pdBtnRun');
    ok('테스트 실행 모달 열림', await page.locator('#runModal').isVisible());
    await page.waitForTimeout(800);
    ok('실행 대상 미리보기 표시', (await page.locator('#tqPreview').innerText()).includes('실행 대상'), (await page.locator('#tqPreview').innerText()).slice(0, 60));
    await page.screenshot({ path: path.join(out, 'run-modal.png') });
    await page.click('#btnCloseRun');
    ok('모달 닫힘', !(await page.locator('#runModal').isVisible()));

    await page.click('#pdBtnExamples');
    ok('예시 질문 펼침', (await page.locator('.pd-example').count()) > 0);
    await page.click('.pd-example >> nth=0');
    ok('예시 → 입력창 채움', (await page.inputValue('#chatInput')).length > 0);

    await page.click('#btnManageProjectDetail');
    ok('관리 모달 열림(4000 UI 재사용)', await page.locator('#manageProjectModal').isVisible());
    await page.click('#btnCancelManageProject');

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, 'detail-fixed.png'), fullPage: true });
    ok('콘솔/페이지 오류 없음', errors.length === 0, JSON.stringify(errors));
  }

  // ② 신규 프로젝트 모양 — API 응답만 가짜로 대체(공유 데이터는 건드리지 않음)
  {
    const { page, errors } = await login(browser);
    const empty = {
      defects: { total: 0, counts: {}, severityCounts: {}, byModule: [] },
      results: { total: 0, executed: 0, pass: 0, fail: 0, na: 0, nt: 0, none: 0, p1: 0, p2: 0, p3: 0, byModule: [], timeline: [] },
      viewerFile: null, tcChangeHistory: [], tcPriorityByModule: [],
    };
    await page.route('**/api/*/kpi', (r) => r.fulfill({ json: empty }));
    await page.route('**/api/*/defects', (r) => r.fulfill({ json: { defects: [] } }));
    await page.route('**/api/*/results', (r) => r.fulfill({ json: { snapshots: [] } }));
    await page.route('**/api/*/meta', (r) => r.fulfill({ json: { project: '데모사이트', url: null, adminUrl: null, testType: null, hasPrd: false } }));
    await page.selectOption('#projectSelect', '데모사이트');
    await page.waitForSelector('#pdOnboard .pd-step');
    ok('[신규] 온보딩 카드 표시', await page.locator('#pdOnboard').isVisible());
    ok('[신규] 확인필요 카드 숨김', !(await page.locator('#pdAttention').isVisible()));
    ok('[신규] 레일 숨김', !(await page.locator('#pdRail').isVisible()));
    ok('[신규] 배지 "프로젝트 생성됨"', (await page.locator('#pdStatusBadge').innerText()).includes('프로젝트 생성됨'));
    ok('[신규] URL 미설정 표시', (await page.locator('#pdMeta').innerText()).includes('미설정'));
    await page.click('#pdOnboard [data-pd-act="analyze"]');
    ok('[신규] URL 없으면 사이트 분석 → 관리 모달', await page.locator('#manageProjectModal').isVisible());
    await page.click('#btnCancelManageProject');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, 'detail-new.png'), fullPage: true });
    ok('[신규] 콘솔/페이지 오류 없음', errors.filter((e) => !e.includes('404')).length === 0, JSON.stringify(errors));
  }

  await browser.close();
  console.log(checks.join('\n'));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
