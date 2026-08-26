const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const defectStore = require('./lib/defectStore');
const resultsStore = require('./lib/resultsStore');
const projectStore = require('./lib/projectStore');
const claudeRunner = require('./lib/claudeRunner');
const chatSessions = require('./lib/chatSessions');

const PORT = process.env.PORT || 4000;
const app = express();
const httpServer = http.createServer(app);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TC 폴더 아래 정적 파일(스크린샷, 스냅샷 HTML 등) 그대로 서빙 — 결함 썸네일/실행이력 HTML 열람용
app.use('/files/:project', (req, res, next) => {
  express.static(path.join(defectStore.PROJECTS_ROOT, req.params.project, 'TC'))(req, res, next);
});

app.get('/api/projects', (req, res) => {
  res.json({ projects: projectStore.listProjects() });
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

const wss = new WebSocketServer({ server: httpServer, path: '/ws/chat' });
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

httpServer.listen(PORT, () => {
  console.log(`큐돌이 대시보드: http://localhost:${PORT} (TC_AUTOMATION_ROOT=${defectStore.TC_AUTOMATION_ROOT})`);
});
