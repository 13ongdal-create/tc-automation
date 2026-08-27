const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const defectStore = require('./lib/defectStore');
const resultsStore = require('./lib/resultsStore');
const projectStore = require('./lib/projectStore');
const tcStore = require('./lib/tcStore');
const claudeRunner = require('./lib/claudeRunner');
const chatSessions = require('./lib/chatSessions');
const auth = require('./lib/auth');

// 채팅 패널이 spawn하는 claude CLI(Windows에서 .cmd shim → 내부적으로 cmd.exe 경유)가 종료될 때
// 같은 콘솔 세션 전체(그룹 0)로 Ctrl+C를 보내는 사례가 실측 확인됨 — 이 서버 프로세스까지 함께
// 죽어 상시구동(Windows Scheduled Task)이 무력화되는 문제가 있었음(2026-08-26). 이 서버는
// taskkill/Stop-ScheduledTask로만 종료되어야 하므로, 다른 프로세스발 SIGINT/SIGBREAK는 무시합니다.
if (process.platform === 'win32') {
  process.on('SIGINT', () => {});
  process.on('SIGBREAK', () => {});
}

const PORT = process.env.PORT || 4000;
const SESSION_COOKIE = 'qa_session';
const app = express();

// 네트워크(사내망)로 열린 상태로 로그인 비밀번호가 평문으로 오가지 않도록 HTTPS를 우선 사용합니다.
// dashboard/certs/{key,cert}.pem(자체서명, .gitignore 대상 — 팀원 각자 로컬에서 생성)이 있으면 HTTPS로,
// 없으면 로컬 개발 편의를 위해 HTTP로 자동 폴백합니다.
const CERT_DIR = path.join(__dirname, 'certs');
let httpServer;
let usesHttps = false;
try {
  const key = fs.readFileSync(path.join(CERT_DIR, 'key.pem'));
  const cert = fs.readFileSync(path.join(CERT_DIR, 'cert.pem'));
  httpServer = https.createServer({ key, cert }, app);
  usesHttps = true;
} catch {
  httpServer = http.createServer(app);
}
app.use(express.json());

// ── 로그인 (공유 비밀번호) ────────────────────────────────────────────────
// 채팅 패널이 실제 claude CLI를 실행해 파일 쓰기/커밋까지 하므로, 같은 네트워크에 열어도
// 비밀번호를 아는 팀원만 접근/조작할 수 있도록 최소한의 세션 인증을 둡니다.
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login', '/styles.css']);

app.get('/login', (req, res) => {
  // 이미 로그인된 세션이 /login을 다시 열면(예: 뒤로가기로 이 URL을 다시 밟는 경우) 로그인
  // 화면 대신 바로 앱으로 돌려보냅니다 — 그대로 두면 유효한 세션인데도 로그인 폼이 다시 뜹니다.
  const token = auth.getCookie(req.headers.cookie, SESSION_COOKIE);
  if (auth.isValidSession(token)) {
    const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/';
    return res.redirect(next);
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (!auth.verifyPassword(password)) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
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

// 프로젝트 폴더(project/{project}/) 전체를 실제 디렉터리 구조 그대로 정적 서빙 — TC 뷰어,
// 스크린샷, 실행결과 스냅샷, PRD 등. 예전엔 /files(TC/만)와 /analysis(Analysis/만)가 서로
// 다른 URL 프리픽스였는데, 실제 폴더 구조는 TC/와 Analysis/가 형제 폴더라서 PRD.html 안의
// 상대경로 링크("../TC/...")가 어느 쪽으로도 못 맞아 깨졌음(2026-08-27 사용자 리포트) —
// 실제 폴더 구조를 그대로 반영하는 단일 프리픽스로 통합해 상대경로가 항상 맞게 함.
// testAccounts.json(AGENTS.md 7항, 실제 계정 자격증명)은 공유 대시보드 비밀번호만으로
// 누구나 열람 가능해지는 걸 막기 위해 이 라우트에서 명시적으로 차단합니다.
const BLOCKED_PROJECT_FILES = new Set(['testAccounts.json']);
app.use('/project-files/:project', (req, res, next) => {
  if (BLOCKED_PROJECT_FILES.has(path.basename(req.path))) {
    return res.status(403).json({ error: '접근할 수 없는 파일입니다.' });
  }
  express.static(path.join(defectStore.PROJECTS_ROOT, req.params.project))(req, res, next);
});

app.get('/api/:project/meta', (req, res) => {
  res.json(projectStore.loadMeta(req.params.project));
});

app.get('/api/projects', (req, res) => {
  res.json({ projects: projectStore.listProjects() });
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body || {};
  const reason = projectStore.validateProjectName(name);
  if (reason) return res.status(400).json({ error: reason });
  try {
    const created = projectStore.createProject(name);
    res.json({ project: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:project/defects', (req, res) => {
  const defects = defectStore.load(req.params.project);
  if (defects === null) return res.status(404).json({ error: '프로젝트를 찾을 수 없거나 defects.json이 없습니다.' });
  res.json({ defects });
});

app.patch('/api/:project/defects/:defectId', (req, res) => {
  const { field, value } = req.body || {};
  const ALLOWED_FIELDS = ['assignee', 'status', 'issueLink'];
  if (!ALLOWED_FIELDS.includes(field)) {
    return res.status(400).json({ error: `field는 ${ALLOWED_FIELDS.join('/')} 중 하나여야 합니다.` });
  }
  if (field === 'status' && !defectStore.STATUS_ORDER.includes(value)) {
    return res.status(400).json({ error: `status는 ${defectStore.STATUS_ORDER.join('/')} 중 하나여야 합니다.` });
  }
  const updated = defectStore.updateField(req.params.project, req.params.defectId, field, value);
  if (!updated) return res.status(404).json({ error: '해당 결함을 찾을 수 없습니다.' });
  res.json({ defect: updated });
});

app.get('/api/:project/results', (req, res) => {
  res.json({ snapshots: resultsStore.listSnapshots(req.params.project) });
});

app.get('/api/:project/kpi', (req, res) => {
  const { project } = req.params;
  const defectSummary = defectStore.summary(project);
  if (defectSummary === null) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  const resultSummary = resultsStore.latestSummary(project);
  resultSummary.byModule = resultsStore.latestByModule(project);
  resultSummary.timeline = resultsStore.progressOverTime(project);
  res.json({
    defects: defectSummary,
    results: resultSummary,
    viewerFile: tcStore.findFullViewer(project),
    tcChangeHistory: tcStore.getChangeHistory(project),
    tcPriorityByModule: tcStore.getPriorityByModule(project),
  });
});

// ── 💬 사이트분석 · TC 생성 채팅 패널 (WebSocket) ──────────────────────────
// 프로젝트당 동시에 하나의 claude 세션만 돌립니다 (같은 프로젝트에 메시지를 연타해도
// 겹쳐 실행되지 않도록). 진행 중인 claude 프로세스 핸들을 프로젝트명으로 보관해두면
// 취소(cancel) 요청 시 바로 찾아 종료할 수 있습니다.
const activeRuns = new Map(); // project -> claudeRunner handle

// headless(`claude -p`)로 실행되면 승인 프롬프트를 띄울 터미널이 없어, 사전 허용되지 않은
// Write/Edit/Bash 호출은 응답 없는 stdin을 기다리며 무한정 멈춥니다(2026-08-26 실측). 저장소
// 루트 .claude/settings.json에 전역으로 허용해두면 터미널/IDE의 대화형 세션에서도 승인
// 프롬프트가 안 뜨게 되므로, 이 대시보드 spawn 호출에만 --allowedTools로 범위를 한정합니다.
// AGENTS.md 16항(프로젝트 격리) 그대로 Write/Edit는 project/** 로만 한정하고, Bash는 실제로
// 필요한 것만(커밋, 테스트 실행) 콕 집어 허용 — 다중 사용자(공유 비밀번호)로 열려있어 임의
// 명령 실행(`Bash(node *)` 등 광범위한 규칙)은 의도적으로 제외했습니다.
// _scratch/**도 함께 허용 — AGENTS.md 9/19항의 Phase 1 관찰(Playwright 헤드리스 접속·DOM 덤프)이
// 저장하는 유일한 위치로 명시된 곳이라(실제로 이 경로가 막혀 "승인 대기"로 멈춘 사례 확인,
// 2026-08-26), project/**와 마찬가지로 안전하게 사전 허용할 수 있는 범위입니다.
const CHAT_ALLOWED_TOOLS = [
  'Write(project/**)',
  'Edit(project/**)',
  'Write(_scratch/**)',
  'Edit(_scratch/**)',
  'Bash(git add project/*)',
  'Bash(git commit *)',
  'Bash(node _scratch/**)', // _scratch/{project}/{file} 두 단계 깊이라 * 대신 **
  'Bash(npx playwright test *)',
];

function wsSend(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws/chat',
  verifyClient: (info, cb) => {
    const token = auth.getCookie(info.req.headers.cookie, SESSION_COOKIE);
    if (auth.isValidSession(token)) return cb(true);
    cb(false, 401, 'Unauthorized');
  },
});
wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return wsSend(ws, { type: 'error', error: '잘못된 메시지 형식입니다.' });
    }

    if (msg.type === 'cancel') {
      const handle = activeRuns.get(msg.project);
      if (handle) handle.cancel();
      return;
    }

    if (msg.type !== 'message' || !msg.project || !msg.text || !msg.text.trim()) {
      return wsSend(ws, { type: 'error', error: 'project와 text가 필요합니다.' });
    }
    const { project } = msg;
    const text = msg.text.trim();

    if (activeRuns.has(project)) {
      return wsSend(ws, { type: 'error', project, error: '이 프로젝트에서 이미 진행 중인 요청이 있습니다. 완료 후 다시 시도해주세요.' });
    }

    const session = chatSessions.ensure(project);
    const isFirst = !session.sessionId;
    chatSessions.appendMessage(project, 'user', text);
    wsSend(ws, { type: 'ack', project, text });

    const prompt = chatSessions.buildPrompt(project, text, isFirst);
    const callbacks = {
      onProcess: (handle) => activeRuns.set(project, handle),
      onStatus: (statusText) => wsSend(ws, { type: 'status', project, text: statusText }),
      onIssue: (issueText) => wsSend(ws, { type: 'issue', project, text: issueText }),
      allowedTools: CHAT_ALLOWED_TOOLS,
    };

    try {
      const result = isFirst
        ? await claudeRunner.startSession(prompt, callbacks)
        : await claudeRunner.resumeSession(session.sessionId, prompt, callbacks);
      if (result.sessionId) chatSessions.setSessionId(project, result.sessionId);
      chatSessions.appendMessage(project, 'assistant', result.resultText);
      wsSend(ws, { type: 'result', project, text: result.resultText, isError: result.isError });
    } catch (err) {
      wsSend(ws, {
        type: 'error',
        project,
        error: err.cancelled ? '중단되었습니다.' : `실행 오류: ${err.message}`,
      });
    } finally {
      activeRuns.delete(project);
    }
  });
});

app.get('/api/:project/chat/history', (req, res) => {
  const session = chatSessions.get(req.params.project);
  res.json({ messages: session ? session.messages : [] });
});

app.post('/api/:project/chat/reset', (req, res) => {
  chatSessions.reset(req.params.project);
  res.json({ ok: true });
});

function lanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const ifaceList of Object.values(nets)) {
    for (const iface of ifaceList || []) {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    }
  }
  return addrs;
}

// 0.0.0.0으로 열어 같은 네트워크(사내망)의 다른 사람도 접속해 함께 쓸 수 있게 합니다 (2026-08-26).
// 공유 비밀번호(위 로그인 라우트)가 없으면 아무도 조회/조작할 수 없으므로 안전합니다.
httpServer.listen(PORT, '0.0.0.0', () => {
  const proto = usesHttps ? 'https' : 'http';
  console.log(`QA Automation 대시보드: ${proto}://localhost:${PORT} (TC_AUTOMATION_ROOT=${defectStore.TC_AUTOMATION_ROOT})`);
  if (!usesHttps) {
    console.log(`  ⚠ dashboard/certs/{key,cert}.pem이 없어 HTTP로 실행 중입니다 (평문 통신) — HTTPS로 실행하려면 'bash dashboard/scripts/gen-cert.sh'를 실행하세요.`);
  }
  const lan = lanAddresses();
  if (lan.length) {
    console.log(`같은 네트워크의 다른 사람은 아래 주소로 접속할 수 있습니다:`);
    lan.forEach((ip) => console.log(`  ${proto}://${ip}:${PORT}`));
  }
  if (usesHttps) {
    console.log(`  (자체서명 인증서라 브라우저에 보안 경고가 뜹니다 — "고급" → "계속 진행"을 눌러 접속하면 됩니다)`);
  }
  console.log(`공유 비밀번호: ${auth.PASSWORD}  (dashboard/.dashboard-password에 저장됨, .env로 DASHBOARD_PASSWORD 지정 시 그 값 사용)`);
});
