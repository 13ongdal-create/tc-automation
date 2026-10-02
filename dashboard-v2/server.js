const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const {
  defectStore, resultsStore, projectStore, tcStore, claudeRunner, chatSessions,
  auth, testQueue, testRunner, resultsProcessor, tcUpload, gitOps,
} = require('./lib/legacy');

// 채팅 패널이 spawn하는 claude CLI가 종료될 때 콘솔 전체로 Ctrl+C를 보내 이 서버까지 죽이는
// Windows 이슈(4000 대시보드 CLAUDE.md "Environment gotchas" 참조)가 이 서버에도 동일하게 적용됨.
if (process.platform === 'win32') {
  process.on('SIGINT', () => {});
  process.on('SIGBREAK', () => {});
}

const PORT = process.env.PORT || 4001;
// 4000 대시보드와 쿠키 이름이 같으면 안 됩니다 — 쿠키는 포트가 아니라 호스트 단위로 공유되므로
// 같은 이름을 쓰면 한쪽에 로그인할 때마다 다른 쪽 세션 쿠키를 덮어써 서로 로그아웃시킵니다.
const SESSION_COOKIE = 'qa_session_v2';
const app = express();
const httpServer = http.createServer(app);

app.use(express.json({ limit: '20mb' }));

// ── 로그인 (4000과 같은 공유 비밀번호) ─────────────────────────────────────
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login', '/api/health', '/styles.css']);

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'qa-dashboard-v2', port: Number(PORT) }));

app.get('/login', (req, res) => {
  const token = auth.getCookie(req.headers.cookie, SESSION_COOKIE);
  if (auth.isValidSession(token)) {
    const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/';
    return res.redirect(next);
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const limit = auth.checkLoginRateLimit(ip);
  if (!limit.allowed) {
    const retryMin = Math.ceil(limit.retryAfterMs / 60000);
    return res.status(429).json({ error: `로그인 시도가 너무 많습니다. ${retryMin}분 후 다시 시도해주세요.` });
  }
  const { password } = req.body || {};
  if (!auth.verifyPassword(password)) {
    auth.recordLoginFailure(ip);
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
  auth.recordLoginSuccess(ip);
  const token = auth.createSession();
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  auth.destroySession(auth.getCookie(req.headers.cookie, SESSION_COOKIE));
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const token = auth.getCookie(req.headers.cookie, SESSION_COOKIE);
  if (auth.isValidSession(token)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: '로그인이 필요합니다.' });
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
});

app.use(express.static(path.join(__dirname, 'public')));

// 프로젝트명이 경로로 쓰이므로(project/{name}) '..'나 구분자가 섞인 값은 라우트 진입 전에 차단.
app.param('project', (req, res, next, value) => {
  if (!/^[^\\/.][^\\/]*$/.test(value)) return res.status(400).json({ error: '잘못된 프로젝트명입니다.' });
  next();
});

// 프로젝트 폴더 정적 서빙(TC 뷰어·스크린샷·결과 스냅샷). 실제 계정 자격증명 파일은 차단.
const BLOCKED_PROJECT_FILES = new Set(['testAccounts.json']);
// TC 뷰어(project/{프로젝트}/TC/{프로젝트}_TC_*.html)는 4000과 공유하는 생성 산출물이라 파일은 수정하지 않고,
// 4001이 내려줄 때만 "결함현황" 필터 스크립트를 덧붙입니다(뷰어를 다시 생성해도 필터가 유지됨).
// 결함현황 탭(id="defectPanel")이 있는 뷰어에만 적용하고, TC 폴더 바로 아래 파일로 한정합니다(legacy/results 제외).
const VIEWER_FILTER_TAG = '<script src="/viewer-defect-filters.js"></script>';
const VIEWER_PATH_RE = /^\/TC\/[^/]+_TC_[^/]+\.html$/;

function serveViewerWithFilters(req, res, next) {
  let rel;
  try { rel = decodeURIComponent(req.path); } catch { return next(); }
  const root = path.join(defectStore.PROJECTS_ROOT, req.params.project);
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) return next();
  fs.readFile(file, 'utf8', (err, html) => {
    if (err || !html.includes('id="defectPanel"')) return next(); // 없거나 결함 탭이 없는 뷰어 → 일반 정적 서빙
    const at = html.lastIndexOf('</body>');
    const out = at >= 0 ? html.slice(0, at) + VIEWER_FILTER_TAG + html.slice(at) : html + VIEWER_FILTER_TAG;
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.send(out);
  });
}

app.use('/project-files/:project', (req, res, next) => {
  if (BLOCKED_PROJECT_FILES.has(path.basename(req.path))) {
    return res.status(403).json({ error: '접근할 수 없는 파일입니다.' });
  }
  if (req.method === 'GET' && VIEWER_PATH_RE.test(req.path)) return serveViewerWithFilters(req, res, next);
  express.static(path.join(defectStore.PROJECTS_ROOT, req.params.project))(req, res, next);
});
app.use('/replays/:project', (req, res, next) => {
  express.static(path.join(testRunner.REPLAYS_ROOT, req.params.project))(req, res, next);
});

// ── 프로젝트 표시 이름 ─────────────────────────────────────────────────────
// 프로젝트의 실제 이름은 폴더명·파일명 339개·결함 ID(DEF_{이름}_001)·JSON/HTML 내용에 박혀 있고 4000 대시보드와
// 데이터를 공유하므로, 실제 이름은 바꾸지 않고 4001 화면에 보이는 "표시 이름"만 별도로 저장합니다.
// 4001 전용 파일(data/project-names.json)에만 쓰므로 4000·QA 데이터·git에 영향이 없습니다.
const NAMES_FILE = path.join(__dirname, 'data', 'project-names.json');
const DISPLAY_NAME_MAX = 50;

function readDisplayNames() {
  try {
    const obj = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function writeDisplayNames(obj) {
  fs.mkdirSync(path.dirname(NAMES_FILE), { recursive: true });
  const tmp = `${NAMES_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, NAMES_FILE);
}

/** 존재하는 프로젝트의 표시 이름만(삭제된 프로젝트의 찌꺼기 항목은 제외) */
function displayNamesFor(projects) {
  const all = readDisplayNames();
  return Object.fromEntries(projects.filter((p) => typeof all[p] === 'string' && all[p]).map((p) => [p, all[p]]));
}

const normName = (v) => String(v).normalize('NFC').trim().toLowerCase();

// ── 프로젝트 / 집계 ────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  const projects = projectStore.listProjects();
  res.json({ projects, displayNames: displayNamesFor(projects) });
});

// 표시 이름 변경. 빈 값(또는 실제 이름과 같은 값)이면 표시 이름을 해제해 원래 이름으로 되돌립니다.
app.put('/api/projects/:project/display-name', (req, res) => {
  const { project } = req.params;
  const projects = projectStore.listProjects();
  if (!projects.includes(project)) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

  const raw = (req.body || {}).displayName;
  if (raw != null && typeof raw !== 'string') return res.status(400).json({ error: '표시 이름은 문자열이어야 합니다.' });
  const value = (raw || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (value.length > DISPLAY_NAME_MAX) return res.status(400).json({ error: `표시 이름은 ${DISPLAY_NAME_MAX}자 이내여야 합니다.` });
  if (/[\u0000-\u001f\u007f<>]/.test(value)) return res.status(400).json({ error: '표시 이름에 사용할 수 없는 문자가 있습니다.' });

  const names = readDisplayNames();
  if (!value || value === project) {
    delete names[project];
  } else {
    // 다른 프로젝트의 실제/표시 이름과 같으면 화면에서 구분할 수 없으므로 막습니다.
    const taken = projects.some((p) => p !== project && (normName(p) === normName(value) || normName(names[p] || '') === normName(value)));
    if (taken) return res.status(409).json({ error: '이미 다른 프로젝트가 쓰는 이름입니다.' });
    names[project] = value;
  }
  writeDisplayNames(names);
  res.json({ project, displayName: names[project] || null });
});

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/**
 * 프로젝트의 "현재 상태"는 모듈별 TC 정본(TC/{프로젝트}_TC_{모듈}.json)의 items[].result 입니다 —
 * TC 뷰어(HTML)의 통계표도 같은 값을 쓰므로, 4001의 모든 화면이 뷰어와 같은 숫자를 보이도록
 * 합계를 정본 기준으로 다시 계산합니다.
 * (실행 스냅샷 results/*.json은 "그 실행 시점"의 기록이라 모듈마다 날짜가 다르고, 이후 정본에서 바뀐
 *  결과·추가된 TC가 반영되지 않습니다. 예: 정본 Pass 85/Fail 29/미실행 114 vs 스냅샷 합 81/34/3)
 * - 결과 값 정의는 resultsStore와 동일: Pass / Fail / N/A(과거 Blocked 포함) / N/T / 그 외(빈 값)=미실행
 * - 정본이 없는 모듈(스냅샷만 있는 경우)은 스냅샷 값을 그대로 둡니다.
 * - timeline(날짜별 진척율)과 실행 이력은 그 시점 기록이라 스냅샷 기준으로 둡니다.
 */
function canonicalModuleStats(project) {
  return tcStore.readModuleFiles(project).map(({ moduleCode, moduleName, data }) => {
    const items = data.items || [];
    const c = { pass: 0, fail: 0, na: 0, nt: 0, p1: 0, p2: 0, p3: 0 };
    items.forEach((i) => {
      if (i.result === 'Pass') c.pass += 1;
      else if (i.result === 'Fail') c.fail += 1;
      else if (i.result === 'N/A' || i.result === 'Blocked') c.na += 1;
      else if (i.result === 'N/T') c.nt += 1;
      if (i.priority === 'P1') c.p1 += 1;
      else if (i.priority === 'P2') c.p2 += 1;
      else if (i.priority === 'P3') c.p3 += 1;
    });
    const total = items.length;
    const executed = c.pass + c.fail + c.na + c.nt;
    return {
      moduleCode, moduleName, total, ...c, executed, none: total - executed,
      execRate: pct(executed, total), passRate: pct(c.pass, executed), failRate: pct(c.fail, executed),
    };
  }).sort((x, y) => x.moduleCode.localeCompare(y.moduleCode));
}

function reconcileResults(resultSummary, canon) {
  if (!canon.length) return resultSummary;
  const seen = new Set(canon.map((m) => m.moduleCode));
  const byModule = canon.concat(resultSummary.byModule.filter((m) => !seen.has(m.moduleCode)));
  const sum = (key) => byModule.reduce((acc, m) => acc + (m[key] || 0), 0);
  const total = sum('total');
  const executed = sum('executed');
  return {
    ...resultSummary,
    total,
    executed,
    none: total - executed,
    pass: sum('pass'),
    fail: sum('fail'),
    na: sum('na'),
    nt: sum('nt'),
    p1: sum('p1'),
    p2: sum('p2'),
    p3: sum('p3'),
    byModule,
    reconciled: true,
  };
}

function buildKpi(project) {
  const defectSummary = defectStore.summary(project);
  if (defectSummary === null) return null;
  const tcPriorityByModule = tcStore.getPriorityByModule(project);
  const snapshotSummary = resultsStore.latestSummary(project);
  snapshotSummary.byModule = resultsStore.latestByModule(project);
  snapshotSummary.timeline = resultsStore.progressOverTime(project);
  return {
    defects: defectSummary,
    results: reconcileResults(snapshotSummary, canonicalModuleStats(project)),
    viewerFile: tcStore.findFullViewer(project),
    tcChangeHistory: tcStore.getChangeHistory(project),
    tcPriorityByModule,
  };
}

// 홈 화면용 — 프로젝트별 요청 N번 대신 한 번에 묶어서 내려줍니다.
app.get('/api/overview', (req, res) => {
  const rows = projectStore.listProjects().map((project) => {
    let kpi = null;
    let meta = null;
    let snapshots = [];
    try { kpi = buildKpi(project); } catch { /* 한 프로젝트 오류가 홈 전체를 막지 않게 */ }
    try { meta = projectStore.loadMeta(project); } catch { /* 위와 동일 */ }
    try { snapshots = resultsStore.listSnapshots(project); } catch { /* 위와 동일 */ }
    return { project, meta, kpi, snapshots };
  });
  res.json({ projects: rows });
});

app.get('/api/:project/meta', (req, res) => {
  const { project } = req.params;
  res.json({ ...projectStore.loadMeta(project), displayName: readDisplayNames()[project] || null });
});

app.get('/api/:project/kpi', (req, res) => {
  const kpi = buildKpi(req.params.project);
  if (!kpi) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  res.json(kpi);
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body || {};
  const reason = projectStore.validateProjectName(name);
  if (reason) return res.status(400).json({ error: reason });
  try {
    res.json({ project: projectStore.createProject(name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/projects/:project/meta', (req, res) => {
  try {
    res.json({ meta: projectStore.updateProjectMeta(req.params.project, req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/projects/:project', (req, res) => {
  try {
    res.json({ ok: true, ...projectStore.deleteProject(req.params.project, (req.body || {}).confirmName) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── git ───────────────────────────────────────────────────────────────────
app.get('/api/git/status', async (req, res) => {
  try {
    res.json(await gitOps.status());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AGENTS.md 18항: push는 자동 실행하지 않고 사용자가 버튼을 눌렀을 때만.
app.post('/api/git/push', async (req, res) => {
  try {
    res.json(await gitOps.push());
  } catch (err) {
    res.status(500).json({ error: (err.stderr || err.message || '').trim().slice(0, 1000) });
  }
});

// ── 결함 / 실행 이력 ───────────────────────────────────────────────────────
app.get('/api/:project/defects', (req, res) => {
  const defects = defectStore.load(req.params.project);
  if (defects === null) return res.status(404).json({ error: '프로젝트를 찾을 수 없거나 defects.json이 없습니다.' });
  res.json({ defects });
});

app.patch('/api/:project/defects/:defectId', async (req, res) => {
  const { field, value } = req.body || {};
  const ALLOWED_FIELDS = ['assignee', 'status', 'issueLink'];
  if (!ALLOWED_FIELDS.includes(field)) {
    return res.status(400).json({ error: `field는 ${ALLOWED_FIELDS.join('/')} 중 하나여야 합니다.` });
  }
  if (field === 'status' && !defectStore.STATUS_ORDER.includes(value)) {
    return res.status(400).json({ error: `status는 ${defectStore.STATUS_ORDER.join('/')} 중 하나여야 합니다.` });
  }
  const updated = await defectStore.updateField(req.params.project, req.params.defectId, field, value);
  if (!updated) return res.status(404).json({ error: '해당 결함을 찾을 수 없습니다.' });
  res.json({ defect: updated });
});

app.get('/api/:project/results', (req, res) => res.json({ snapshots: resultsStore.listSnapshots(req.params.project) }));

// ── 💬 채팅 + ▶ 테스트 실행 큐 (WebSocket) ─────────────────────────────────
// 아래 로직은 4000 server.js와 동일한 프로토콜을 유지합니다(메시지 type·필드 동일).
// 주의: activeRuns/testQueueRuns는 프로세스 메모리라 4000 서버와 서로 보이지 않습니다 — 같은 프로젝트를
// 양쪽 대시보드에서 동시에 실행하면 _scratch/playwright-report/{project}/results.json을 서로 덮어쓸 수 있음.
const activeRuns = new Map(); // "project::userKey" -> claudeRunner handle
const testQueueRuns = new Map(); // project -> { cancelled, currentHandle }

// 4000과 동일한 허용 도구 범위(AGENTS.md 16항: project/**, _scratch/** 한정).
const CHAT_ALLOWED_TOOLS = [
  'Write(project/**)',
  'Edit(project/**)',
  'Write(_scratch/**)',
  'Edit(_scratch/**)',
  'Bash(git add project/*)',
  'Bash(git commit *)',
  'Bash(node _scratch/**)',
  'Bash(npx playwright test *)',
];

// ── 공통 코드 규칙(2026-10-01) ─────────────────────────────────────────────
// TC 중요도 = P1/P2/P3 (핵심/주요/일반), 결함 심각도 = Critical/Major/Minor (치명/주요/경미).
// 두 개념이 같은 P1/P2/P3 문자열을 쓰면 혼선이 생겨 결함 쪽 저장 코드를 분리했습니다.
const LEGACY_SEVERITY = { P1: 'Critical', P2: 'Major', P3: 'Minor' };
const CODE_RULE_NOTE =
  '\n\n[공통 코드 규칙] TC의 priority(중요도)는 P1/P2/P3(핵심/주요/일반)로, 결함(defects.json)의 severity(심각도)는 ' +
  'Critical/Major/Minor(치명/주요/경미)로 기록하세요. 결함 severity에 P1/P2/P3를 쓰지 마세요.';

/**
 * 테스트 실행 큐의 결과 반영(4000 lib의 resultsProcessor)은 새 결함의 심각도 칸에 TC 중요도(P1~P3)를 그대로
 * 넣습니다. 4001에서 만들어진 결함이 새 규칙 코드로 저장되도록, 실행 후 남아있는 P1~P3 값을 Critical/Major/Minor로
 * 바꿔 저장합니다(과거 데이터도 같은 매핑 — defectStore.load가 읽을 때 하는 정규화와 동일).
 */
function normalizeStoredSeverity(project) {
  const file = path.join(defectStore.PROJECTS_ROOT, project, 'TC', 'defects.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return 0; }
  if (!Array.isArray(raw)) return 0;
  let changed = 0;
  const next = raw.map((d) => {
    const mapped = LEGACY_SEVERITY[d.severity];
    if (!mapped) return d;
    changed += 1;
    return { ...d, severity: mapped };
  });
  if (changed) defectStore.save(project, next);
  return changed;
}

const runKey = (project, userKey) => `${project}::${userKey || 'anonymous'}`;

function wsSend(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function wsBroadcast(userKey, payload) {
  wss.clients.forEach((client) => {
    if (client.userKey === userKey) wsSend(client, payload);
  });
}

function chatBusyForProject(project) {
  for (const key of activeRuns.keys()) if (key.startsWith(`${project}::`)) return true;
  return false;
}

const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws/chat',
  verifyClient: (info, cb) => {
    if (auth.isValidSession(auth.getCookie(info.req.headers.cookie, SESSION_COOKIE))) return cb(true);
    cb(false, 401, 'Unauthorized');
  },
});

async function runTestQueue(ws, msg) {
  const { project, scope, moduleCodes, tcIds, priority, system, status, record } = msg;
  if (!project || !scope) return wsSend(ws, { type: 'queueError', project, error: 'project와 scope가 필요합니다.' });
  if (testQueueRuns.has(project)) return wsSend(ws, { type: 'queueError', project, error: '이 프로젝트에서 이미 테스트 실행 큐가 진행 중입니다.' });
  if (chatBusyForProject(project)) return wsSend(ws, { type: 'queueError', project, error: '이 프로젝트의 채팅(큐돌이) 세션이 실행 중입니다. 완료 후 다시 시도해주세요.' });

  let plan;
  try {
    plan = testQueue.resolvePlan(project, scope, { moduleCodes, tcIds, priority, system, status });
  } catch (err) {
    return wsSend(ws, { type: 'queueError', project, error: err.message });
  }
  if (!plan.length) return wsSend(ws, { type: 'queueError', project, error: '실행할 대상 TC가 없습니다 (해당 범위에 자동화된 TC가 없습니다).' });

  const runState = { cancelled: false, currentHandle: null };
  testQueueRuns.set(project, runState);
  wsSend(ws, { type: 'queueAck', project, plan: plan.map((p) => ({ moduleCode: p.moduleCode, count: p.tcIds ? p.tcIds.length : null })) });

  if (record) {
    try { testRunner.pruneReplays(project); } catch { /* 정리 실패는 실행을 막지 않음 */ }
  }
  const replayRunId = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const totals = { executed: 0, pass: 0, fail: 0, na: 0, newDefects: [], reopenedDefects: [], stillFailingDefects: [], passedWithOpenDefect: [] };

  for (const step of plan) {
    if (runState.cancelled) break;
    wsSend(ws, { type: 'queueModuleStart', project, moduleCode: step.moduleCode });
    try {
      await testRunner.runSpec({
        project,
        specFile: step.specFile,
        tcIds: step.tcIds,
        record: !!record,
        onProcess: (h) => { runState.currentHandle = h; },
        onLog: (line) => wsSend(ws, { type: 'queueLog', project, moduleCode: step.moduleCode, line }),
      });
    } catch (err) {
      if (!err.cancelled) wsSend(ws, { type: 'queueLog', project, moduleCode: step.moduleCode, line: `[오류] ${err.message}` });
    }
    if (runState.cancelled) break;

    const resultsJson = testRunner.readResultsJson(project);
    if (!resultsJson) {
      wsSend(ws, { type: 'queueModuleDone', project, moduleCode: step.moduleCode, summary: null, error: '결과 파일을 읽지 못했습니다.' });
      continue;
    }
    const flat = testRunner.flattenResults(resultsJson);
    const relevant = step.tcIds ? flat.filter((f) => step.tcIds.includes(f.tcId)) : flat;
    if (record) {
      try {
        wsSend(ws, { type: 'queueReplay', project, moduleCode: step.moduleCode, items: testRunner.collectReplays(project, replayRunId, step.moduleCode, relevant) });
      } catch (err) {
        wsSend(ws, { type: 'queueLog', project, moduleCode: step.moduleCode, line: `[안내] 재생 파일 보존 실패: ${err.message}` });
      }
    }
    let moduleSummary;
    try {
      moduleSummary = resultsProcessor.applyModuleResults(project, step.moduleCode, relevant);
    } catch (err) {
      wsSend(ws, { type: 'queueModuleDone', project, moduleCode: step.moduleCode, summary: null, error: err.message });
      continue;
    }
    ['executed', 'pass', 'fail', 'na'].forEach((k) => { totals[k] += moduleSummary[k]; });
    ['newDefects', 'reopenedDefects', 'stillFailingDefects', 'passedWithOpenDefect'].forEach((k) => totals[k].push(...moduleSummary[k]));
    wsSend(ws, { type: 'queueModuleDone', project, moduleCode: step.moduleCode, summary: moduleSummary });
  }

  try { normalizeStoredSeverity(project); } catch { /* 정규화 실패는 실행 결과 반영을 막지 않음(읽을 때도 정규화됨) */ }
  try { resultsProcessor.writeResultsIndex(project); } catch { /* 데이터는 이미 반영됨 */ }
  let git;
  if (totals.executed > 0) {
    const summary = `테스트 실행 큐 결과 반영 (${totals.executed}건 실행 — Pass ${totals.pass}/Fail ${totals.fail}/N/A ${totals.na}` +
      (totals.newDefects.length ? `, 신규 결함 ${totals.newDefects.length}건` : '') + ')';
    git = await gitOps.commitPaths([`project/${project}`], `${project}: ${summary}`);
  }
  testQueueRuns.delete(project);
  wsSend(ws, { type: 'queueDone', project, cancelled: runState.cancelled, totals, git });
}

/** 채팅 한 턴 실행 — send(payload)로 결과를 흘려보냅니다(WS 직접 응답 / 사용자 전체 탭 브로드캐스트 공용). */
async function runChatTurn(project, userKey, text, send) {
  const rk = runKey(project, userKey);
  const session = chatSessions.ensure(project, userKey);
  const isFirst = !session.sessionId;
  chatSessions.appendMessage(project, userKey, 'user', text);
  send({ type: 'ack', project, text });

  const prompt = chatSessions.buildPrompt(project, text, isFirst) + CODE_RULE_NOTE;
  const callbacks = {
    onProcess: (handle) => activeRuns.set(rk, handle),
    onStatus: (statusText) => send({ type: 'status', project, text: statusText }),
    onIssue: (issueText) => send({ type: 'issue', project, text: issueText }),
    allowedTools: CHAT_ALLOWED_TOOLS,
  };
  try {
    const result = isFirst
      ? await claudeRunner.startSession(prompt, callbacks)
      : await claudeRunner.resumeSession(session.sessionId, prompt, callbacks);
    if (result.sessionId) chatSessions.setSessionId(project, userKey, result.sessionId);
    chatSessions.appendMessage(project, userKey, 'assistant', result.resultText);
    send({ type: 'result', project, text: result.resultText, isError: result.isError });
  } catch (err) {
    send({ type: 'error', project, error: err.cancelled ? '중단되었습니다.' : `실행 오류: ${err.message}` });
  } finally {
    activeRuns.delete(rk);
  }
}

wss.on('connection', (ws, req) => {
  ws.userKey = auth.getCookie(req.headers.cookie, SESSION_COOKIE);
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return wsSend(ws, { type: 'error', error: '잘못된 메시지 형식입니다.' }); }
    const userKey = ws.userKey;

    if (msg.type === 'cancel') {
      const handle = activeRuns.get(runKey(msg.project, userKey));
      if (handle) handle.cancel();
      return;
    }
    if (msg.type === 'cancelTests') {
      const run = testQueueRuns.get(msg.project);
      if (run) {
        run.cancelled = true;
        if (run.currentHandle) run.currentHandle.cancel();
      }
      return;
    }
    if (msg.type === 'runTests') return runTestQueue(ws, msg);

    if (msg.type !== 'message' || !msg.project || !msg.text || !msg.text.trim()) {
      return wsSend(ws, { type: 'error', error: 'project와 text가 필요합니다.' });
    }
    const { project } = msg;
    if (activeRuns.has(runKey(project, userKey))) {
      return wsSend(ws, { type: 'error', project, error: '이 프로젝트에서 이미 진행 중인 요청이 있습니다. 완료 후 다시 시도해주세요.' });
    }
    if (testQueueRuns.has(project)) {
      return wsSend(ws, { type: 'error', project, error: '이 프로젝트에서 테스트 실행 큐가 진행 중입니다. 완료 후 다시 시도해주세요.' });
    }
    await runChatTurn(project, userKey, msg.text.trim(), (p) => wsSend(ws, p));
  });
});

app.get('/api/:project/chat/history', (req, res) => {
  const token = auth.getCookie(req.headers.cookie, SESSION_COOKIE);
  const session = chatSessions.get(req.params.project, token);
  res.json({ messages: session ? session.messages : [], busy: activeRuns.has(runKey(req.params.project, token)) });
});

app.post('/api/:project/chat/reset', (req, res) => {
  chatSessions.reset(req.params.project, auth.getCookie(req.headers.cookie, SESSION_COOKIE));
  res.json({ ok: true });
});

// ── 실행결과별 TC 목록 ("실패 TC 보기" 등) ───────────────────────────────────
// 기준은 TC 정본(모듈별 JSON)의 현재 실행결과 — 합계(KPI)·TC 뷰어 통계와 같은 집합입니다.
const TC_RESULT_MATCH = {
  Fail: (r) => r === 'Fail',
  Pass: (r) => r === 'Pass',
  'N/A': (r) => r === 'N/A' || r === 'Blocked',
  'N/T': (r) => r === 'N/T',
  none: (r) => !r,
};
const PRIORITY_RANK = { P1: 1, P2: 2, P3: 3 };

/** TC별로 "마지막으로 결과가 기록된 실행일" — 실행 스냅샷(results/*_Result_YYYYMMDD.json)을 오래된 순으로 읽어 덮어씁니다. */
function lastRunByTc(project) {
  const dir = path.join(defectStore.PROJECTS_ROOT, project, 'TC', 'results');
  let files;
  try { files = fs.readdirSync(dir); } catch { return new Map(); }
  const snaps = files
    .map((f) => { const m = /_Result_(\d{8})\.json$/.exec(f); return m ? { f, date: m[1] } : null; })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = new Map();
  for (const { f, date } of snaps) {
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const fmt = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    for (const it of data.items || []) if (it.tcId && it.result) last.set(it.tcId, fmt);
  }
  return last;
}

app.get('/api/:project/tcs', (req, res) => {
  const { project } = req.params;
  const result = typeof req.query.result === 'string' ? req.query.result : 'Fail';
  const match = TC_RESULT_MATCH[result];
  if (!match) return res.status(400).json({ error: 'result는 Fail / Pass / N/A / N/T / none 중 하나여야 합니다.' });

  // 같은 원인의 결함은 1건이고 관련 TC가 여러 개(tcIds)일 수 있음 — tcIds가 없는 기존 레코드는 [tcId]로 간주
  const defectsByTc = new Map();
  (defectStore.load(project) || []).forEach((d) => {
    const info = { defectId: d.defectId, severity: LEGACY_SEVERITY[d.severity] || d.severity, status: d.status };
    (Array.isArray(d.tcIds) && d.tcIds.length ? d.tcIds : [d.tcId]).filter(Boolean).forEach((tcId) => {
      if (!defectsByTc.has(tcId)) defectsByTc.set(tcId, []);
      defectsByTc.get(tcId).push(info);
    });
  });
  const lastRun = result === 'none' ? new Map() : lastRunByTc(project);
  const tcDir = path.join(defectStore.PROJECTS_ROOT, project, 'TC');

  const items = [];
  for (const { moduleCode, moduleName, data } of tcStore.readModuleFiles(project)) {
    const viewer = `${project}_TC_${moduleCode}.html`;
    const viewerFile = fs.existsSync(path.join(tcDir, viewer)) ? viewer : null;
    for (const it of data.items || []) {
      if (!match(it.result)) continue;
      items.push({
        tcId: it.tcId, moduleCode, moduleName,
        majorCategory: it.majorCategory || '', midCategory: it.midCategory || '', minorCategory: it.minorCategory || '',
        item: it.item || '', priority: it.priority || '', system: it.system || '', result: it.result || '',
        defects: defectsByTc.get(it.tcId) || [], lastRun: lastRun.get(it.tcId) || null, viewerFile,
      });
    }
  }
  items.sort((a, b) =>
    (PRIORITY_RANK[a.priority] || 9) - (PRIORITY_RANK[b.priority] || 9) ||
    a.moduleCode.localeCompare(b.moduleCode) || String(a.tcId).localeCompare(String(b.tcId)));
  res.json({ result, count: items.length, items });
});

// ── 테스트 실행 큐 조회 / TC 업로드 / 첨부 ─────────────────────────────────
app.get('/api/:project/test-queue/modules', (req, res) => res.json({ modules: testQueue.listRunnableModules(req.params.project) }));

app.get('/api/:project/test-queue/preview', (req, res) => {
  const { scope, moduleCodes, tcIds, priority, system, status } = req.query;
  try {
    const codes = typeof moduleCodes === 'string' ? moduleCodes.split(',').filter(Boolean) : [];
    const ids = typeof tcIds === 'string' ? tcIds.split(',').filter(Boolean) : [];
    res.json(testQueue.preview(req.params.project, scope, { moduleCodes: codes, tcIds: ids, priority, system, status }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** TC 업로드 직후 편집용 뷰어(HTML) 재생성을 채팅(큐돌이)에게 자동 요청 — 4000과 동일 동작. */
function triggerViewerRefresh(project, userKey, modules) {
  if (activeRuns.has(runKey(project, userKey))) return { started: false, reason: '이 프로젝트의 채팅 세션이 이미 진행 중입니다.' };
  if (testQueueRuns.has(project)) return { started: false, reason: '이 프로젝트의 테스트 실행 큐가 진행 중입니다.' };
  const moduleDesc = modules.map((m) => `${m.moduleName}(${m.moduleCode}, v${m.version})`).join(', ');
  const text =
    `방금 대시보드의 TC 업로드 기능으로 다음 모듈이 갱신되었습니다: ${moduleDesc}. TC 데이터(JSON)는 ` +
    `이미 확정 반영된 상태이니, 이 모듈들의 TC 뷰어(HTML)만 최신 데이터 기준으로 재생성해주세요 ` +
    `(Phase 승인 절차 불필요 — 뷰어 재생성 작업입니다). 이 프로젝트에 모듈이 2개 이상 있으면 ` +
    `AGENTS.md 10항에 따라 통합(전체) 뷰어도 함께 갱신해주세요.`;
  runChatTurn(project, userKey, text, (p) => wsBroadcast(userKey, p));
  return { started: true };
}

app.post('/api/:project/tc-upload', async (req, res) => {
  const { project } = req.params;
  const { fileName, dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: '업로드할 파일 데이터가 없습니다.' });
  try {
    const result = await tcUpload.applyUpload(project, Buffer.from(dataBase64, 'base64'), fileName || 'uploaded.xlsx');
    if (result.updatedTcIds.length || result.createdTcIds.length) {
      const sourceLabel = /\.json$/i.test(fileName || '') ? 'JSON' : '엑셀';
      const summary = `${sourceLabel} 업로드 반영 (${fileName || 'uploaded.xlsx'}) — 수정 ${result.updatedTcIds.length}건, 신규 ${result.createdTcIds.length}건`;
      result.git = await gitOps.commitPaths([`project/${project}`], `${project}: ${summary}`);
      result.viewerRefresh = triggerViewerRefresh(project, auth.getCookie(req.headers.cookie, SESSION_COOKIE), result.modules);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/:project/chat-attachment', (req, res) => {
  const { project } = req.params;
  const { fileName, dataBase64 } = req.body || {};
  if (!dataBase64) return res.status(400).json({ error: '첨부할 파일 데이터가 없습니다.' });
  try {
    const base = path.basename(fileName || 'attachment').replace(/[\\/]/g, '_');
    const dir = path.join(defectStore.PROJECTS_ROOT, project, 'Policy');
    fs.mkdirSync(dir, { recursive: true });
    let finalName = base;
    if (fs.existsSync(path.join(dir, finalName))) {
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const ext = path.extname(base);
      finalName = `${path.basename(base, ext)}_${ts}${ext}`;
    }
    fs.writeFileSync(path.join(dir, finalName), Buffer.from(dataBase64, 'base64'));
    res.json({ path: `project/${project}/Policy/${finalName}`, fileName: finalName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function lanAddresses() {
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list || []) if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
  }
  return addrs;
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`QA Automation 대시보드 v2: http://localhost:${PORT} (TC_AUTOMATION_ROOT=${defectStore.TC_AUTOMATION_ROOT})`);
  lanAddresses().forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  console.log('공유 비밀번호는 4000 대시보드와 동일합니다 (D:\\QA\\tc-automation\\dashboard\\.dashboard-password).');
});
