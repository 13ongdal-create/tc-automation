const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const defectStore = require('./lib/defectStore');
const resultsStore = require('./lib/resultsStore');
const projectStore = require('./lib/projectStore');
const claudeRunner = require('./lib/claudeRunner');
const chatSessions = require('./lib/chatSessions');
const auth = require('./lib/auth');

const PORT = process.env.PORT || 4000;
const SESSION_COOKIE = 'qa_session';
const app = express();
const httpServer = http.createServer(app);
app.use(express.json());

// ── 로그인 (공유 비밀번호) ────────────────────────────────────────────────
// 채팅 패널이 실제 claude CLI를 실행해 파일 쓰기/커밋까지 하므로, 같은 네트워크에 열어도
// 비밀번호를 아는 팀원만 접근/조작할 수 있도록 최소한의 세션 인증을 둡니다.
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login', '/styles.css']);

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

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

// TC 폴더 아래 정적 파일(스크린샷, 스냅샷 HTML 등) 그대로 서빙 — 결함 썸네일/실행이력 HTML 열람용
app.use('/files/:project', (req, res, next) => {
  express.static(path.join(defectStore.PROJECTS_ROOT, req.params.project, 'TC'))(req, res, next);
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
  const resultSummary = resultsStore.latestSummary(project);
  if (defectSummary === null) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  res.json({ defects: defectSummary, results: resultSummary });
});

// ── 💬 사이트분석 · TC 생성 채팅 패널 (WebSocket) ──────────────────────────
// 프로젝트당 동시에 하나의 claude 세션만 돌립니다 (같은 프로젝트에 메시지를 연타해도
// 겹쳐 실행되지 않도록). 진행 중인 claude 프로세스 핸들을 프로젝트명으로 보관해두면
// 취소(cancel) 요청 시 바로 찾아 종료할 수 있습니다.
const activeRuns = new Map(); // project -> claudeRunner handle

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
  console.log(`QA Automation 대시보드: http://localhost:${PORT} (TC_AUTOMATION_ROOT=${defectStore.TC_AUTOMATION_ROOT})`);
  const lan = lanAddresses();
  if (lan.length) {
    console.log(`같은 네트워크의 다른 사람은 아래 주소로 접속할 수 있습니다:`);
    lan.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  }
  console.log(`공유 비밀번호: ${auth.PASSWORD}  (dashboard/.dashboard-password에 저장됨, .env로 DASHBOARD_PASSWORD 지정 시 그 값 사용)`);
});
