// 결함 관리에서 자주 쓰는 정형화된 요청은 Claude 없이 코드로 직접 처리합니다 (토큰 미사용).
// 매칭 안 되면 null을 반환하고, 호출부에서 Claude 기반 처리로 폴백합니다.
const defectStore = require('./defectStore');

const STATUS_WORDS = defectStore.STATUS_ORDER.join('|');

const PATTERNS = [
  // "DEF_xxx 담당자를 홍길동으로 지정해줘" / "DEF_xxx 담당자 홍길동으로 변경"
  {
    re: /^(DEF_\S+)\s*담당자[를은]?\s*(.+?)\s*(?:로|으로)\s*(?:지정|배정|변경)해?\s*줘?\.?$/i,
    apply: (m) => ({ defectId: m[1], field: 'assignee', value: m[2].trim() }),
  },
  // "DEF_xxx 상태를 처리중으로 변경해줘" / "DEF_xxx 처리중으로 변경"
  {
    re: new RegExp(`^(DEF_\\S+)\\s*(?:상태[를은]?\\s*)?(${STATUS_WORDS})(?:으로|로)?\\s*(?:변경|처리)해?\\s*줘?\\.?$`, 'i'),
    apply: (m) => ({ defectId: m[1], field: 'status', value: m[2] }),
  },
  // "DEF_xxx 완료" / "DEF_xxx 완료 처리해줘" (위 패턴과 겹치지만 "처리"/"변경" 없이 짧게 쓰는 경우 보강)
  {
    re: new RegExp(`^(DEF_\\S+)\\s*(${STATUS_WORDS})\\.?$`, 'i'),
    apply: (m) => ({ defectId: m[1], field: 'status', value: m[2] }),
  },
  // "DEF_xxx 이슈링크 https://... 로 등록해줘"
  {
    re: /^(DEF_\S+)\s*이슈링크\s*(\S+)\s*(?:로|으로)?\s*(?:등록|추가|연결)해?\s*줘?\.?$/i,
    apply: (m) => ({ defectId: m[1], field: 'issueLink', value: m[2].trim() }),
  },
];

/**
 * [수정 2026-08-27] defectStore.updateField()가 동시쓰기 방지를 위해 비동기 함수로 바뀌면서
 * 이 함수도 async로 전환 — 호출부(index.js)에서 await 필요.
 * @returns {Promise<{ handled: true, text: string } | null>} 매칭되면 즉시 응답할 텍스트, 안 되면 null (Claude로 폴백)
 */
async function tryHandle(project, text) {
  const trimmed = (text || '').trim();
  for (const { re, apply } of PATTERNS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const { defectId, field, value } = apply(m);
    const updated = await defectStore.updateField(project, defectId, field, value);
    if (!updated) {
      return { handled: true, text: `:warning: \`${defectId}\`를 "${project}" 프로젝트 결함 대장에서 찾을 수 없습니다.` };
    }
    const label = { assignee: '담당자', status: '상태', issueLink: '이슈링크' }[field] || field;
    return { handled: true, text: `:white_check_mark: \`${defectId}\`의 ${label}를(을) "${value}"(으)로 변경했습니다.` };
  }
  return null;
}

module.exports = { tryHandle };
