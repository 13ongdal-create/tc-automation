const path = require('path');
const express = require('express');
const defectStore = require('./lib/defectStore');
const resultsStore = require('./lib/resultsStore');
const projectStore = require('./lib/projectStore');

const PORT = process.env.PORT || 4000;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// TC 폴더 아래 정적 파일(스크린샷, 스냅샷 HTML 등) 그대로 서빙 — 결함 썸네일/실행이력 HTML 열람용
app.use('/files/:project', (req, res, next) => {
  express.static(path.join(defectStore.TC_AUTOMATION_ROOT, req.params.project, 'TC'))(req, res, next);
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

app.listen(PORT, () => {
  console.log(`큐돌이 대시보드: http://localhost:${PORT} (TC_AUTOMATION_ROOT=${defectStore.TC_AUTOMATION_ROOT})`);
});
