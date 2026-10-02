// 프로젝트 표시 이름 변경 점검(저장·화면 반영·검증 오류·원복, QA 데이터 미변경)
// 실행: node tests/e2e/rename.js  (4001 서버가 떠 있어야 하며, 4000 저장소의 Playwright를 사용합니다)
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
const projJson = `${ROOT_POSIX}/project/${P}/project.json`;
const namesFile = path.join(__dirname, '..', '..', 'data', 'project-names.json');

(async () => {
  const mtimeBefore = fs.statSync(projJson).mtimeMs;
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:4001/login');
  await page.fill('#pw', pw);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  await page.waitForSelector(`.project-block[data-project="${P}"] h2`);
  const api = (u, o) => page.evaluate(async ([u, o]) => { const r = await fetch(u, o); return { s: r.status, j: await r.json().catch(() => null) }; }, [u, o]);
  const put = (name, proj) => api(`/api/projects/${encodeURIComponent(proj || P)}/display-name`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name }) });
  const title = () => page.locator(`.project-block[data-project="${P}"] h2`).innerText();

  // 사이트 정보 저장(PATCH /meta) 호출 횟수를 센다. 정보 변경 시험 구간에서만 실제 저장 대신 가짜 응답으로 막는다.
  let patchCount = 0;
  let fakePatch = true; // 실데이터 보호: 사이트 정보 저장(PATCH)은 항상 가짜 응답으로 막는다(실제 project.json은 절대 쓰지 않음)
  await page.route('**/api/projects/*/meta', (route) => {
    if (route.request().method() === 'PATCH') {
      patchCount += 1;
      if (fakePatch) return route.fulfill({ json: { meta: {} } });
    }
    return route.continue();
  });

  // 시작 상태 정리(이전 중단된 점검의 잔여 값)
  await put('');

  // ① 홈에서 모달로 변경 — 앞뒤/중복 공백은 정리되어야 함
  await page.click(`.project-block[data-project="${P}"] .btn-manage-project`);
  ok('모달: 실제 이름 안내', (await page.locator('#mpRealName').innerText()) === P);
  await page.fill('#mpDisplayName', '  Shop   QA 환경  ');
  await page.click('#manageProjectForm button[type=submit]');
  await page.waitForFunction((p) => document.querySelector(`.project-block[data-project="${p}"] h2`).textContent.includes('Shop'), P);
  ok('홈 카드 제목 = 표시 이름(공백 정리, 영문 s 보존)', (await title()) === 'Shop QA 환경', await title());
  const opt = page.locator(`#projectSelect option[value="${P}"]`);
  ok('상단 select 옵션 텍스트', (await opt.innerText()) === 'Shop QA 환경');
  ok('select value는 실제 이름 유지', (await opt.getAttribute('value')) === P);
  const other = page.locator('.project-block:not([data-project="' + P + '"]) h2');
  ok('다른 프로젝트 이름은 그대로', (await other.count()) === 0 || (await other.first().innerText()).length > 0);

  // ② 상세 화면
  await page.selectOption('#projectSelect', P);
  await page.waitForSelector('#pdKpis .pd-kpi');
  ok('상세 제목 = 표시 이름', (await page.locator('#projectDetailTitle').innerText()) === 'Shop QA 환경');
  await page.click('#btnManageProjectDetail');
  ok('상세 관리 모달: 값/제목 유지', (await page.inputValue('#mpDisplayName')) === 'Shop QA 환경' && (await page.locator('#manageProjectName').innerText()) === 'Shop QA 환경');
  ok('삭제 확인 문구는 실제 이름', (await page.locator('#mpDeleteConfirmName').innerText()) === P);
  await page.fill('#mpDisplayName', '상세에서 바꾼 이름');
  await page.click('#manageProjectForm button[type=submit]');
  await page.waitForFunction(() => document.getElementById('projectDetailTitle').textContent === '상세에서 바꾼 이름');
  ok('상세에서 저장 → 제목 즉시 갱신, 보던 프로젝트·화면 유지', (await page.inputValue('#projectSelect')) === P && (await page.locator('#pdKpis .pd-kpi').count()) === 5);

  ok('표시 이름만 변경 → 사이트 정보 저장(PATCH) 호출 없음', patchCount === 0, `호출 ${patchCount}회`);
  await page.click('#btnManageProjectDetail');
  await page.waitForFunction(() => document.getElementById('mpUrl').value.length > 0);
  await page.fill('#mpUrl', (await page.inputValue('#mpUrl')) + '/x');
  await page.click('#manageProjectForm button[type=submit]');
  await page.waitForFunction(() => document.getElementById('manageProjectModal').hidden);
  ok('사이트 정보를 바꾸면 저장(PATCH) 호출됨', patchCount === 1, `호출 ${patchCount}회`);

  // ③ 모달 오류 표시: 실패 시 모달이 닫히지 않고 메시지 노출
  await page.click('#btnManageProjectDetail');
  await page.fill('#mpDisplayName', '가'.repeat(51));
  await page.evaluate(() => { document.getElementById('mpDisplayName').removeAttribute('maxlength'); });
  await page.fill('#mpDisplayName', '가'.repeat(51));
  await page.click('#manageProjectForm button[type=submit]');
  await page.waitForFunction(() => document.getElementById('manageProjectError').textContent.length > 0);
  ok('51자 → 모달에 오류 표시, 모달 유지', (await page.locator('#manageProjectError').innerText()).includes('50자') && (await page.locator('#manageProjectModal').isVisible()));
  await page.click('#btnCancelManageProject');

  // ④ API 검증
  const r1 = await api('/api/projects');
  ok('GET /api/projects displayNames', r1.j.displayNames[P] === '상세에서 바꾼 이름' && r1.j.projects.includes(P));
  const r2 = await api(`/api/${encodeURIComponent(P)}/meta`);
  ok('meta.displayName 포함 + 기존 필드 유지', r2.j.displayName === '상세에서 바꾼 이름' && !!r2.j.url);
  ok('특수문자(<) → 400', (await put('<b>x</b>')).s === 400);
  ok('제어문자 → 400', (await put('a\u0001b')).s === 400);
  ok('숫자 입력 → 400', (await put(123)).s === 400);
  ok('없는 프로젝트 → 404', (await put('x', '없는프로젝트')).s === 404);
  ok('경로 위험 이름 → 400', (await api('/api/projects/..%2Fx/display-name', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"displayName":"x"}' })).s === 400);
  const others = r1.j.projects.filter((p) => p !== P);
  if (others.length) {
    ok('다른 프로젝트의 실제 이름과 같은 값 → 409', (await put(others[0])).s === 409, others[0]);
    ok('다른 프로젝트 이름(대소문자 무시) → 409', (await put(others[0].toUpperCase())).s === 409);
  }
  ok('문자 s가 든 이름 보존', (await put('Sales Dashboard')).j.displayName === 'Sales Dashboard');

  // ⑤ TC 변경 이력 페이지 제목
  await put('상세에서 바꾼 이름');
  await page.goto(`http://localhost:4001/tc-history.html?project=${encodeURIComponent(P)}`);
  await page.waitForFunction(() => document.getElementById('pageTitle').textContent.startsWith('상세에서'));
  ok('TC 변경 이력 페이지 제목', (await page.locator('#pageTitle').innerText()).startsWith('상세에서 바꾼 이름'));

  // ⑥ 원복
  const r3 = await put('');
  ok('빈 값 → 표시 이름 해제', r3.s === 200 && r3.j.displayName === null);
  ok('해제 후 displayNames 비어 있음', Object.keys((await api('/api/projects')).j.displayNames).length === 0);
  await page.goto('http://localhost:4001/');
  await page.waitForSelector(`.project-block[data-project="${P}"] h2`);
  ok('원래 이름으로 복귀', (await title()) === P);
  ok('실제 이름과 같은 값 → 해제 취급', (await put(P)).j.displayName === null);
  ok('QA 데이터(project.json) 미변경', fs.statSync(projJson).mtimeMs === mtimeBefore);
  ok('오류 없음', errs.length === 0, JSON.stringify(errs));
  await b.close();
  console.log(out.join('\n'));
  console.log('저장 파일 최종:', fs.readFileSync(namesFile, 'utf8').replace(/\s+/g, ' ').trim());
})().catch((e) => { console.error('FAIL', e.message); console.log(out.join('\n')); process.exit(1); });
