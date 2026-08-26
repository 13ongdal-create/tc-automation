// 프로젝트별 채팅(사이트분석·TC생성) 대화 상태를 메모리에 보관합니다.
// 서버 재시작 시 초기화됩니다 — 로컬 1인 대시보드 특성상 영속화는 하지 않습니다(§ zero-token 편집과
// 달리 이건 Claude 세션 자체가 상태를 들고 있으므로, 서버가 죽으면 어차피 --resume으로 이어갈 대상도
// 함께 사라진 것으로 취급).
const sessions = new Map(); // project -> { sessionId, messages: [{role, text, at}] }

function get(project) {
  return sessions.get(project) || null;
}

function ensure(project) {
  if (!sessions.has(project)) {
    sessions.set(project, { sessionId: null, messages: [] });
  }
  return sessions.get(project);
}

function reset(project) {
  sessions.delete(project);
}

function appendMessage(project, role, text) {
  const s = ensure(project);
  s.messages.push({ role, text, at: new Date().toISOString() });
  return s;
}

function setSessionId(project, sessionId) {
  const s = ensure(project);
  s.sessionId = sessionId;
}

/**
 * 이 대화의 첫 메시지에만 프로젝트 컨텍스트를 덧붙입니다. 이후 메시지는 --resume으로 이어지므로
 * Claude가 이미 대화 맥락(AGENTS.md 규칙, 이전 답변 등)을 들고 있어 그대로 전달합니다.
 * (Slack 버전과 달리 "승인/반려/테스트 실행" 같은 정형 문구를 따로 감지해 재작성하지 않습니다 —
 * 채팅 UI에서는 사용자가 자연어로 말해도 AGENTS.md 13항 Phase 워크플로우를 Claude가 대화 맥락으로
 * 직접 판단할 수 있기 때문입니다.)
 */
function buildPrompt(project, userText, isFirstMessage) {
  if (!isFirstMessage) return userText;
  return [
    `tc-automation 저장소(현재 작업 디렉터리)에서, "${project}" 프로젝트(project/${project})에 대한 요청입니다.`,
    `agents-config/AGENTS.md, agents-config/skills/qa-test-case-generator/SKILL.md 규칙을 그대로 따라주세요 — 특히 13항의 Phase 0~8 워크플로우(단계별 승인 필요)를 지켜주세요.`,
    `이 대화는 큐돌이 대시보드의 채팅 패널을 통해 진행됩니다 — 사용자에게 보여줄 응답은 마크다운으로 간결하게 정리해주세요.`,
    `이 세션은 헤드리스(터미널 승인 프롬프트 없음)라 사전 승인된 명령 패턴만 실행됩니다. Bash로`,
    `node 스크립트를 실행할 때는 반드시 "node _scratch/${project}/{파일명}" 형태로 저장소 루트 기준`,
    `상대경로 전체를 포함해 호출하세요 — cd로 이동한 뒤 파일명만 쓰거나 node -e 인라인 실행은 승인되지`,
    `않아 멈춥니다. git은 "git add project/${project}/..."와 "git commit -m ..." 형태만 승인됩니다.`,
    ``,
    `사용자 요청: ${userText}`,
  ].join('\n');
}

module.exports = { get, ensure, reset, appendMessage, setSessionId, buildPrompt };
