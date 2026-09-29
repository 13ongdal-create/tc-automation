// TC 엑셀 업로드 — 프로젝트에 이미 등록된 TC 캐노니컬 JSON에 자동으로 수정/추가 반영하는 순수 로직
// (Claude 미사용, 토큰 소모 없음). AGENTS.md 2항 TC 컬럼 스키마·10항 파일 저장 규칙(legacy 아카이브,
// meta.version/changeHistory)을 그대로 따릅니다. 사용자 요청(2026-09-29)으로 대시보드 "TC 관리"
// 패널에 추가되는 "+ TC 업로드" 기능의 백엔드.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { PROJECTS_ROOT } = require('./defectStore');
const tcStore = require('./tcStore');

// AGENTS.md 2항 컬럼명(사람이 작성한 헤더는 띄어쓰기가 조금씩 다를 수 있어 여러 표기를 허용) → 캐노니컬
// JSON 필드명. 공백 제거 후 대문자로 비교합니다(한글은 대소문자가 없어 영향 없음).
const FIELD_ALIASES = {
  tcId: ['TCID'],
  system: ['SYSTEM'],
  majorCategory: ['대분류'],
  midCategory: ['중분류'],
  minorCategory: ['소분류'],
  screenName: ['화면명'],
  platform: ['플랫폼'],
  type: ['유형'],
  item: ['테스트항목(시나리오)', '테스트항목'],
  baseDoc: ['기준문서'],
  priority: ['우선순위'],
  testData: ['테스트데이터'],
  precondition: ['사전조건'],
  steps: ['테스트수행절차', '수행절차'],
  expected: ['기대결과'],
  result: ['실행결과'],
  assignee: ['담당자'],
  issueSummary: ['이슈내용요약', '이슈내용'],
  issueLink: ['이슈링크'],
  remark: ['비고'],
};
const FIELD_LABELS = { majorCategory: '대분류', item: '테스트항목', steps: '테스트 수행 절차', expected: '기대결과', priority: '우선순위' };
const REQUIRED_FIELDS = ['majorCategory', 'item', 'steps', 'expected', 'priority'];
const PRIORITY_VALUES = ['P1', 'P2', 'P3'];
const SYSTEM_VALUES = ['FO', 'BO'];
const RESULT_VALUES = ['Pass', 'Fail', 'N/A', 'N/T'];
const TCID_RE = /^TC_([A-Z]+)_(\d{3})$/;

function normalizeHeader(h) {
  return String(h == null ? '' : h).replace(/\s+/g, '').toUpperCase();
}

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result); // 수식 셀
    return '';
  }
  return String(v).trim();
}

/** 엑셀(모든 시트)에서 헤더를 인식해 {필드명: 값, __sheet, __rowNumber} 행 배열을 만듭니다. */
async function readWorkbookRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const rows = [];

  for (const sheet of workbook.worksheets) {
    const headerRow = sheet.getRow(1);
    const colToField = {}; // 열 번호 -> 필드명
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const norm = normalizeHeader(cellText(cell.value));
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.some((a) => normalizeHeader(a) === norm)) colToField[colNumber] = field;
      }
    });
    if (!Object.keys(colToField).length) continue; // 이 시트엔 인식 가능한 헤더가 없음 — 건너뜀

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const parsed = { __sheet: sheet.name, __rowNumber: rowNumber };
      let hasAny = false;
      for (const [colNumber, field] of Object.entries(colToField)) {
        const v = cellText(row.getCell(Number(colNumber)).value);
        parsed[field] = v;
        if (v) hasAny = true;
      }
      if (hasAny) rows.push(parsed);
    });
  }
  return rows;
}

function validateRow(row, isNew) {
  if (isNew) {
    for (const f of REQUIRED_FIELDS) {
      if (!row[f]) return `${FIELD_LABELS[f]} 값이 비어 있습니다 (신규 TC는 필수).`;
    }
  }
  if (row.priority && !PRIORITY_VALUES.includes(row.priority)) {
    return `우선순위 값이 올바르지 않습니다: "${row.priority}" (P1/P2/P3만 가능)`;
  }
  if (row.system && !SYSTEM_VALUES.includes(row.system)) {
    return `system 값이 올바르지 않습니다: "${row.system}" (FO/BO만 가능)`;
  }
  if (row.result && !RESULT_VALUES.includes(row.result)) {
    return `실행결과 값이 올바르지 않습니다: "${row.result}" (Pass/Fail/N/A/N/T 또는 빈 값만 가능)`;
  }
  return null;
}

/** 업로드 값이 있는 필드만 기존 항목에 덮어씁니다 — 빈 칸은 기존 값(특히 실행결과/담당자 등 QA
 * 진행 상태)을 그대로 보존합니다(엑셀 재업로드로 이미 쌓인 실행 이력이 지워지는 것을 방지). */
function applyFieldsOnto(item, fields) {
  for (const field of Object.keys(FIELD_ALIASES)) {
    if (field === 'tcId') continue;
    const v = fields[field];
    if (v) item[field] = v;
  }
}

function buildNewItem(tcId, fields) {
  return {
    tcId,
    system: fields.system || 'FO',
    majorCategory: fields.majorCategory,
    midCategory: fields.midCategory || '',
    minorCategory: fields.minorCategory || '',
    screenName: fields.screenName || '',
    platform: fields.platform || 'Web',
    type: fields.type || '',
    item: fields.item,
    baseDoc: fields.baseDoc || '-',
    priority: fields.priority,
    testData: fields.testData || '',
    precondition: fields.precondition || '특이 사전조건 없음',
    steps: fields.steps,
    expected: fields.expected,
    verifyNote: '',
    result: fields.result || '',
    assignee: fields.assignee || '',
    issueSummary: fields.issueSummary || '',
    issueLink: fields.issueLink || '',
    remark: fields.remark || '',
    origin: '신규',
    displayNo: 0, // 모듈 파일에 반영할 때 전체 재계산
  };
}

/**
 * 엑셀 업로드를 프로젝트의 TC 캐노니컬 JSON에 반영합니다.
 * - TC ID가 있고 이미 등록되어 있으면: 값이 채워진 필드만 수정
 * - TC ID가 있는데 아직 없으면: 그 ID로 신규 생성
 * - TC ID가 없으면: 대분류로 기존 모듈을 찾아 그 모듈의 다음 번호로 신규 생성
 * - 어느 쪽도 판단할 수 없으면(모듈 못 찾음/형식 오류/필수값 누락) 건너뛰고 사유를 기록
 * @returns {Promise<{updatedTcIds:string[], createdTcIds:string[], skipped:object[], warnings:string[], modules:object[]}>}
 */
async function applyUpload(project, buffer, sourceFileName) {
  const rows = await readWorkbookRows(buffer);
  if (!rows.length) throw new Error('엑셀에서 인식 가능한 TC 행을 찾지 못했습니다 — 헤더가 AGENTS.md 2항 컬럼명과 일치하는지 확인해주세요.');

  const moduleFiles = tcStore.readModuleFiles(project);
  if (!moduleFiles.length) throw new Error('이 프로젝트에 캐노니컬 TC 파일이 없습니다 — 먼저 모듈을 최소 1개 생성해주세요.');

  const byCode = new Map(moduleFiles.map((m) => [m.moduleCode, m]));
  // 대분류 값으로 모듈을 찾을 때는 meta.moduleName뿐 아니라, 그 모듈에 실제로 쓰인 majorCategory
  // 값들도 후보로 둡니다 — 실측 데이터에서 meta.moduleName("시스템(공통)")과 항목의 majorCategory
  // ("시스템")가 서로 다른 프로젝트가 있어(2026-09-29 발견), moduleName만 보면 매칭에 실패합니다.
  const byName = new Map();
  for (const m of moduleFiles) {
    byName.set(m.moduleName, m.moduleCode);
    for (const item of m.data.items || []) {
      if (item.majorCategory) byName.set(item.majorCategory, m.moduleCode);
    }
  }
  const tcIndex = new Map(); // tcId -> moduleCode (이번 업로드에서 새로 배정된 것 포함)
  for (const m of moduleFiles) {
    for (const item of m.data.items || []) tcIndex.set(item.tcId, m.moduleCode);
  }

  const pendingByModule = new Map(); // moduleCode -> { updates:[{tcId,fields}], creates:[{tcId,fields}] }
  const skipped = [];
  const warnings = [];

  function ensurePending(code) {
    if (!pendingByModule.has(code)) pendingByModule.set(code, { updates: [], creates: [] });
    return pendingByModule.get(code);
  }

  function nextIdFor(code) {
    let max = 0;
    for (const id of tcIndex.keys()) {
      const m = TCID_RE.exec(id);
      if (m && m[1] === code) max = Math.max(max, parseInt(m[2], 10));
    }
    const id = `TC_${code}_${String(max + 1).padStart(3, '0')}`;
    tcIndex.set(id, code); // 같은 배치 안에서 번호가 겹치지 않도록 즉시 예약
    return id;
  }

  for (const row of rows) {
    const rowLabel = `[${row.__sheet}] ${row.__rowNumber}행`;
    const tcId = (row.tcId || '').trim();

    if (tcId) {
      const m = TCID_RE.exec(tcId);
      if (!m) {
        skipped.push({ row: rowLabel, tcId, reason: `TC ID 형식이 올바르지 않습니다(TC_{모듈코드}_{3자리숫자}): "${tcId}"` });
        continue;
      }
      const code = m[1];
      if (!byCode.has(code)) {
        skipped.push({ row: rowLabel, tcId, reason: `모듈코드 "${code}"에 해당하는 캐노니컬 TC 파일이 이 프로젝트에 없습니다.` });
        continue;
      }
      const existingCode = tcIndex.get(tcId);
      const isNew = existingCode === undefined;
      const err = validateRow(row, isNew);
      if (err) {
        skipped.push({ row: rowLabel, tcId, reason: err });
        continue;
      }
      if (row.majorCategory && byName.get(row.majorCategory) && byName.get(row.majorCategory) !== code) {
        warnings.push(`${rowLabel} ${tcId}: 파일의 대분류("${row.majorCategory}")가 다른 모듈(${byName.get(row.majorCategory)})의 값과 같아 보이지만, TC ID 기준(모듈 ${code})으로 반영했습니다.`);
      }
      const pending = ensurePending(code);
      if (isNew) {
        pending.creates.push({ tcId, fields: row });
        tcIndex.set(tcId, code);
      } else {
        pending.updates.push({ tcId, fields: row });
      }
      continue;
    }

    const majorCategory = (row.majorCategory || '').trim();
    const code = byName.get(majorCategory);
    if (!code) {
      skipped.push({ row: rowLabel, tcId: '', reason: `대분류 "${majorCategory || '(빈 값)'}"와 일치하는 기존 모듈이 없어 어느 모듈에 추가할지 판단할 수 없습니다.` });
      continue;
    }
    const err = validateRow(row, true);
    if (err) {
      skipped.push({ row: rowLabel, tcId: '', reason: err });
      continue;
    }
    const newId = nextIdFor(code);
    ensurePending(code).creates.push({ tcId: newId, fields: row });
  }

  const today = new Date().toISOString().slice(0, 10);
  const result = { updatedTcIds: [], createdTcIds: [], skipped, warnings, modules: [] };
  const dir = path.join(PROJECTS_ROOT, project, 'TC');
  const legacyDir = path.join(dir, 'legacy');

  for (const [code, pending] of pendingByModule.entries()) {
    if (!pending.updates.length && !pending.creates.length) continue;
    const mod = byCode.get(code);
    const filePath = path.join(dir, `${project}_TC_${code}.json`);
    const rawBefore = fs.readFileSync(filePath, 'utf8');
    const canonical = JSON.parse(rawBefore);
    const itemsById = new Map(canonical.items.map((i) => [i.tcId, i]));

    for (const { tcId, fields } of pending.updates) {
      applyFieldsOnto(itemsById.get(tcId), fields);
      result.updatedTcIds.push(tcId);
    }
    for (const { tcId, fields } of pending.creates) {
      const item = buildNewItem(tcId, fields);
      canonical.items.push(item);
      result.createdTcIds.push(tcId);
    }
    canonical.items.forEach((item, i) => { item.displayNo = i + 1; });

    fs.mkdirSync(legacyDir, { recursive: true });
    const prevVersion = canonical.meta.version || 1;
    fs.writeFileSync(path.join(legacyDir, `${project}_TC_${code}_v${prevVersion}.json`), rawBefore, 'utf8');

    canonical.meta.version = prevVersion + 1;
    canonical.meta.changeHistory = canonical.meta.changeHistory || [];
    canonical.meta.changeHistory.push({
      version: canonical.meta.version,
      date: today,
      summary: `엑셀 업로드 반영 (${sourceFileName}) — 수정 ${pending.updates.length}건, 신규 ${pending.creates.length}건`,
    });

    fs.writeFileSync(filePath, JSON.stringify(canonical, null, 2) + '\n', 'utf8');
    result.modules.push({ moduleCode: code, moduleName: mod.moduleName, updated: pending.updates.length, created: pending.creates.length, version: canonical.meta.version });
  }

  return result;
}

module.exports = { applyUpload };
