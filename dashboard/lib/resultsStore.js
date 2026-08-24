// TC/results/*_Result_{YYYYMMDD}.json 스냅샷을 읽어 실행 이력 목록을 만드는 순수 로직 (토큰 미사용)
// _scratch/{project}/build_results_index.js와 동일한 집계 방식을 재사용 (2026-08-24 대시보드용 이식)
const fs = require('fs');
const path = require('path');
const { TC_AUTOMATION_ROOT } = require('./defectStore');

function resultsDir(project) {
  return path.join(TC_AUTOMATION_ROOT, project, 'TC', 'results');
}

function listSnapshots(project) {
  const dir = resultsDir(project);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const entries = files
    .map((f) => {
      const m = f.match(/^(.+)_TC_([A-Z]+)_Result_(\d{8})\.json$/);
      if (!m) return null;
      const [, proj, moduleCode, dateStr] = m;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch {
        return null;
      }
      const items = data.items || [];
      const total = items.length;
      const pass = items.filter((i) => i.result === 'Pass').length;
      const fail = items.filter((i) => i.result === 'Fail').length;
      const blocked = items.filter((i) => i.result === 'Blocked').length;
      const na = items.filter((i) => i.result === 'N/A').length;
      const nt = items.filter((i) => i.result === 'N/T').length;
      const none = items.filter((i) => !i.result).length;
      const executed = total - none;
      return {
        project: proj,
        moduleCode,
        moduleName: data.meta?.moduleName || moduleCode,
        dateStr,
        dateFmt: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
        total,
        pass,
        fail,
        blocked,
        na,
        nt,
        none,
        executed,
        execRate: total ? Math.round((executed / total) * 100) : 0,
        passRate: executed ? Math.round((pass / executed) * 100) : 0,
        failRate: executed ? Math.round((fail / executed) * 100) : 0,
        htmlFile: f.replace(/\.json$/, '.html'),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.dateStr.localeCompare(a.dateStr) || a.moduleCode.localeCompare(b.moduleCode));

  return entries;
}

/** 모듈별 최신 스냅샷만 골라 합산 (과거 스냅샷 중복 집계 방지) */
function latestSummary(project) {
  const entries = listSnapshots(project);
  const latestByModule = {};
  entries.forEach((e) => {
    const cur = latestByModule[e.moduleCode];
    if (!cur || e.dateStr > cur.dateStr) latestByModule[e.moduleCode] = e;
  });
  const latest = Object.values(latestByModule);
  const grand = latest.reduce(
    (acc, e) => {
      acc.total += e.total;
      acc.pass += e.pass;
      acc.fail += e.fail;
      acc.executed += e.executed;
      return acc;
    },
    { total: 0, pass: 0, fail: 0, executed: 0 }
  );
  return { latestDate: latest.length ? latest.reduce((a, e) => (e.dateStr > a ? e.dateStr : a), '00000000') : null, ...grand };
}

module.exports = { listSnapshots, latestSummary, resultsDir };
