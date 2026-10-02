// "실패 TC 보기" TC 목록 점검(TC 정본 기준 건수·필터·정렬·결함 연결)
// 실행: node tests/e2e/tclist.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
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
const P = '데모사이트';
const TC = `${ROOT_POSIX}/project/${P}/TC`;

// 기대값: TC 정본 파일에서 직접 계산
const exp = { Fail: [], none: [], Pass: [] };
for (const m of ['PD', 'PR', 'MB', 'OP', 'CO', 'MY', 'CS']) {
  const d = JSON.parse(fs.readFileSync(`${TC}/${P}_TC_${m}.json`, 'utf8'));
  d.items.forEach((i) => {
    if (i.result === 'Fail') exp.Fail.push(i.tcId);
    else if (i.result === 'Pass') exp.Pass.push(i.tcId);
    else if (!i.result) exp.none.push(i.tcId);
  });
}
const defects = JSON.parse(fs.readFileSync(`${TC}/defects.json`, 'utf8'));
const linked = new Set(defects.map((d) => d.tcId));
const expUntriaged = exp.Fail.filter((id) => !linked.has(id)).length;

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4001/login');
  await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  await page.waitForSelector('#projectSelect option:nth-child(2)', { state: 'attached' });
  const api = (u) => page.evaluate(async (u) => { const r = await fetch(u); return { s: r.status, j: await r.json().catch(() => null) }; }, u);

  // API
  const aFail = await api(`/api/${encodeURIComponent(P)}/tcs?result=Fail`);
  ok('API Fail 건수 = 정본(TC 뷰어와 동일 집합)', aFail.j.count === exp.Fail.length && aFail.j.items.every((i) => exp.Fail.includes(i.tcId)), `${aFail.j.count}건 / 기대 ${exp.Fail.length}`);
  ok('API 기본값(result 생략) = Fail', (await api(`/api/${encodeURIComponent(P)}/tcs`)).j.count === exp.Fail.length);
  ok('API none 건수', (await api(`/api/${encodeURIComponent(P)}/tcs?result=none`)).j.count === exp.none.length, `${exp.none.length}`);
  ok('API 잘못된 result → 400', (await api(`/api/${encodeURIComponent(P)}/tcs?result=zzz`)).s === 400);
  ok('API 경로 위험 프로젝트 → 400', (await api('/api/..%2Fx/tcs')).s === 400);
  const sev = new Set(aFail.j.items.flatMap((i) => i.defects.map((d) => d.severity)));
  ok('API 결함 심각도 = 새 코드', [...sev].every((s) => ['Critical', 'Major', 'Minor'].includes(s)), [...sev].join('/'));
  const prios = aFail.j.items.map((i) => ({ P1: 1, P2: 2, P3: 3 }[i.priority] || 9));
  ok('API 정렬: 중요도 P1→P3', prios.every((v, i) => i === 0 || prios[i - 1] <= v));

  // 화면
  await page.selectOption('#projectSelect', P);
  await page.waitForSelector('#pdAttention .pd-attn-tile');
  const failKpi = Number((await page.locator('#pdKpis .pd-kpi', { hasText: 'Fail' }).locator('.pd-kpi-value').innerText()).trim());

  await page.click('#pdAttention [data-pd-act="view-tcs-fail"] >> nth=0'); // "실패 TC 보기" 버튼
  await page.waitForSelector('#tcListBody tbody tr');
  ok('실패 TC 보기 → TC 목록 창 열림', await page.locator('#tcListModal').isVisible());
  ok('제목 "실패 TC"', (await page.locator('#tcListTitle').innerText()) === '실패 TC');
  ok('건수 = KPI Fail', (await page.locator('#tcListCount').innerText()).trim() === `${failKpi}건` && failKpi === exp.Fail.length, await page.locator('#tcListCount').innerText());
  const ids = await page.locator('#tcListBody tbody .pd-tl-id').allInnerTexts();
  ok('표시된 행은 모두 실제 Fail TC', ids.length > 0 && ids.every((id) => exp.Fail.includes(id.trim())), `${ids.length}행`);
  ok('"더보기" 페이지네이션(30건 단위)', ids.length === Math.min(30, exp.Fail.length));
  const untriaged = (await api(`/api/${encodeURIComponent(P)}/tcs?result=Fail`)).j.items.filter((i) => !i.defects.length).length;
  ok('결함 미등록 건수 일치', untriaged === expUntriaged, `${untriaged}건`);
  ok('"결함 미등록" 배지 표시', untriaged === 0 || (await page.locator('#tcListBody .pd-untriaged').count()) > 0);
  ok('연결 결함 칩(ID·심각도·상태) 표시', (await page.locator('#tcListBody .pd-chip .pd-sev').count()) > 0);
  const headers = (await page.locator('#tcListBody thead th').allInnerTexts()).join('|');
  ok('열 구성', headers === 'TC ID|모듈|분류|테스트 항목|TC 중요도|최근 실행|연결 결함', headers);
  const runs = await page.locator('#tcListBody tbody td.pd-mono.pd-muted').allInnerTexts();
  ok('최근 실행일 형식(YYYY-MM-DD) 표시', runs.some((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.trim())), runs.slice(0, 3).join(','));
  await page.locator('#tcListModal .modal-box').screenshot({ path: path.join(os.tmpdir(), 'tclist.png') });

  // 필터
  await page.selectOption('#tcListModule', 'CO');
  const coRows = await page.locator('#tcListBody tbody tr').count();
  ok('모듈=CO → CO의 Fail 12건', coRows === 12 && (await page.locator('#tcListCount').innerText()).includes('12건'), `${coRows}행`);
  await page.selectOption('#tcListModule', '');
  await page.selectOption('#tcListPrio', 'P1');
  const p1 = await page.locator('#tcListBody tbody .pd-tcp').allInnerTexts();
  ok('TC 중요도=P1 → 모두 P1 (핵심)', p1.length > 0 && p1.every((t) => t.trim() === 'P1 (핵심)'), `${p1.length}건`);
  await page.selectOption('#tcListPrio', '');
  await page.fill('#tcListSearch', 'zzzz없는검색어');
  ok('검색 결과 없음 문구', (await page.locator('#tcListBody').innerText()).includes('조건에 맞는 TC가 없습니다'));
  await page.fill('#tcListSearch', '');

  // 실행 결과 전환
  await page.selectOption('#tcListResult', 'none');
  await page.waitForFunction(() => document.getElementById('tcListTitle').textContent === '미수행 TC');
  await page.waitForFunction(() => document.getElementById('tcListCount').textContent.length > 0);
  ok('결과=미수행 → 건수', (await page.locator('#tcListCount').innerText()).trim() === `${exp.none.length}건`, await page.locator('#tcListCount').innerText());
  ok('미수행 목록은 실행일·결함 열 없음', !(await page.locator('#tcListBody thead').innerText()).includes('연결 결함'));
  await page.selectOption('#tcListResult', 'Pass');
  await page.waitForFunction(() => document.getElementById('tcListTitle').textContent === 'Pass TC');
  await page.waitForFunction(() => document.getElementById('tcListCount').textContent.length > 0);
  ok('결과=Pass → 건수', (await page.locator('#tcListCount').innerText()).trim() === `${exp.Pass.length}건`);

  // 닫기
  await page.keyboard.press('Escape');
  ok('Esc로 닫힘', !(await page.locator('#tcListModal').isVisible()));

  // 타일 동작 분리 확인
  await page.click('#pdAttention .pd-attn-tile:has-text("최근 실패 모듈")');
  ok('"최근 실패 모듈" 타일 → 모듈 표만 필터(창 안 열림)', !(await page.locator('#tcListModal').isVisible()) && (await page.locator('#pdFResult button.active').getAttribute('data-v')) === 'fail');
  await page.click('#pdFReset');
  await page.click('#pdAttention .pd-attn-tile:has-text("미수행 TC")');
  await page.waitForSelector('#tcListBody tbody tr');
  ok('"미수행 TC" 타일 → 미수행 TC 목록', (await page.locator('#tcListTitle').innerText()) === '미수행 TC');
  await page.click('#btnCloseTcList');
  await page.click('#pdAttention .pd-attn-tile:has-text("실패 TC")');
  await page.waitForSelector('#tcListBody tbody tr');
  ok('"실패 TC" 타일 → 실패 TC 목록(결함 보기와 다른 동작)', (await page.locator('#tcListTitle').innerText()) === '실패 TC' && !(await page.locator('#pdDefects').evaluate((n) => n.classList.contains('x'))));
  await page.click('#btnCloseTcList');
  await page.click('#pdAttention [data-pd-act="defects-critical"] >> nth=0');
  ok('"결함 보기"는 여전히 결함 카드 필터', (await page.inputValue('#pdDSeverity')) === 'Critical' && !(await page.locator('#tcListModal').isVisible()));

  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await b.close();
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAIL', e.message); console.log(out.join('\n')); process.exit(1); });
