// TC/results/*_Result_{YYYYMMDD}.json 스냅샷을 읽어 실행 이력 목록을 만드는 순수 로직 (토큰 미사용)
// _scratch/{project}/build_results_index.js와 동일한 집계 방식을 재사용 (2026-08-24 대시보드용 이식)
const fs = require('fs');
const path = require('path');
const { PROJECTS_ROOT } = require('./defectStore');

function resultsDir(project) {
  return path.join(PROJECTS_ROOT, project, 'TC', 'results');
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
      const p1 = items.filter((i) => i.priority === 'P1').length;
      const p2 = items.filter((i) => i.priority === 'P2').length;
      const p3 = items.filter((i) => i.priority === 'P3').length;
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
        p1,
        p2,
        p3,
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

/** 모듈별 최신 스냅샷 1개씩만 골라 배열로 반환 (과거 스냅샷 중복 집계 방지) */
function latestByModule(project) {
  const entries = listSnapshots(project);
  const map = {};
  entries.forEach((e) => {
    const cur = map[e.moduleCode];
    if (!cur || e.dateStr > cur.dateStr) map[e.moduleCode] = e;
  });
  return Object.values(map);
}

/** 모듈별 최신 스냅샷을 프로젝트 전체(Full TC) 기준으로 합산 */
function latestSummary(project) {
  const latest = latestByModule(project);
  const grand = latest.reduce(
    (acc, e) => {
      acc.total += e.total;
      acc.pass += e.pass;
      acc.fail += e.fail;
      acc.blocked += e.blocked;
      acc.na += e.na;
      acc.nt += e.nt;
      acc.executed += e.executed;
      acc.p1 += e.p1;
      acc.p2 += e.p2;
      acc.p3 += e.p3;
      return acc;
    },
    { total: 0, pass: 0, fail: 0, blocked: 0, na: 0, nt: 0, executed: 0, p1: 0, p2: 0, p3: 0 }
  );
  grand.none = grand.total - grand.executed; // 미실행
  return { latestDate: latest.length ? latest.reduce((a, e) => (e.dateStr > a ? e.dateStr : a), '00000000') : null, ...grand };
}

/**
 * 날짜별 진척율(수행율) 추이 — 모듈마다 실행일이 다를 수 있으므로, 각 날짜 시점에
 * "그때까지 알려진 모듈별 최신 상태"를 이어붙여(carry-forward) 프로젝트 전체 수행율을 계산합니다.
 * 예: PD가 8/20에, CRT가 8/22에 실행됐다면 8/22 시점 수행율에는 PD(8/20 결과)+CRT(8/22 결과)가 모두 반영됩니다.
 */
function progressOverTime(project) {
  const entries = listSnapshots(project);
  if (!entries.length) return [];
  const byModDate = new Map();
  const modules = new Set();
  entries.forEach((e) => {
    byModDate.set(`${e.moduleCode}|${e.dateStr}`, e);
    modules.add(e.moduleCode);
  });
  const allDates = [...new Set(entries.map((e) => e.dateStr))].sort();
  const state = {};
  return allDates.map((dateStr) => {
    modules.forEach((mod) => {
      const rec = byModDate.get(`${mod}|${dateStr}`);
      if (rec) state[mod] = rec;
    });
    const vals = Object.values(state);
    const total = vals.reduce((s, v) => s + v.total, 0);
    const executed = vals.reduce((s, v) => s + v.executed, 0);
    return {
      dateStr,
      dateFmt: `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`,
      total,
      executed,
      execRate: total ? Math.round((executed / total) * 100) : 0,
    };
  });
}

module.exports = { listSnapshots, latestByModule, latestSummary, progressOverTime, resultsDir };
