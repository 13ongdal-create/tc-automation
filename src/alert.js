const https = require('https');
const { URL } = require('url');

// Slack Incoming Webhook URL (api.slack.com/apps → 해당 앱 → Incoming Webhooks 에서 발급)
// 설정 안 하면 알림은 조용히 생략됩니다 (선택 기능).
const WEBHOOK_URL = process.env.SLACK_ERROR_WEBHOOK_URL;
// 예: "bong-hmf5032" 또는 "https://bong-hmf5032.slack.com" 어떤 형식으로 넣어도 되도록 정규화합니다.
const WORKSPACE_DOMAIN = (process.env.SLACK_WORKSPACE_DOMAIN || '')
  .replace(/^https?:\/\//, '')
  .replace(/\.slack\.com\/?$/, '')
  .trim() || null;

function threadLink(channel, threadTs) {
  if (!WORKSPACE_DOMAIN || !channel || !threadTs) return null;
  const p = threadTs.replace('.', '');
  return `https://${WORKSPACE_DOMAIN}.slack.com/archives/${channel}/p${p}`;
}

/** Slack Webhook으로 에러/장애 알림을 보냅니다. 실패해도 예외를 던지지 않습니다 (알림은 best-effort). */
function sendAlert(text) {
  if (!WEBHOOK_URL) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const url = new URL(WEBHOOK_URL);
      const payload = JSON.stringify({ text });
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        }
      );
      req.on('error', (err) => {
        console.error('[alert] 웹훅 전송 실패:', err.message);
        resolve();
      });
      req.write(payload);
      req.end();
    } catch (err) {
      console.error('[alert] 웹훅 URL 오류:', err.message);
      resolve();
    }
  });
}

/** 특정 요청(TC 생성/수정/중단 등) 처리 중 발생한 오류 알림 */
function alertRequestError({ channel, threadTs, project, kind, errorMessage }) {
  const link = threadLink(channel, threadTs);
  return sendAlert(
    [
      ':rotating_light: tc-automation 요청 처리 중 오류',
      `- 종류: ${kind || '알 수 없음'}${project ? ` / 프로젝트: ${project}` : ''}`,
      `- 오류: ${errorMessage}`,
      link ? `- 스레드: ${link}` : `- 채널/스레드: ${channel} / ${threadTs}`,
    ].join('\n')
  );
}

/** claude CLI 자체가 is_error=true로 응답한 경우 (오류는 아니지만 결과에 문제가 있다고 스스로 표시) */
function alertResultFlaggedError({ channel, threadTs, project, resultText }) {
  const link = threadLink(channel, threadTs);
  return sendAlert(
    [
      ':warning: tc-automation 응답이 오류로 표시되었습니다',
      project ? `- 프로젝트: ${project}` : null,
      `- 요약: ${(resultText || '').slice(0, 300)}`,
      link ? `- 스레드: ${link}` : `- 채널/스레드: ${channel} / ${threadTs}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
}

module.exports = { sendAlert, alertRequestError, alertResultFlaggedError };
