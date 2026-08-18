const fs = require('fs');
const path = require('path');

const SCREENSHOT_LINE = /^SCREENSHOT:\s*(.+)$/gm;

function extractScreenshotPaths(text) {
  const paths = [...(text || '').matchAll(SCREENSHOT_LINE)].map((m) => m[1].trim());
  // 존재하는 파일만, 중복 제거
  return [...new Set(paths)].filter((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

function stripScreenshotLines(text) {
  return (text || '').replace(SCREENSHOT_LINE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Claude 응답에 SCREENSHOT: 줄이 있으면 본문은 정리해서 올리고, 스크린샷은 파일로 첨부합니다. */
async function postResult(client, { channel, threadTs, text }) {
  const screenshots = extractScreenshotPaths(text);
  const displayText = stripScreenshotLines(text) || text || '(빈 응답)';

  await client.chat.postMessage({ channel, thread_ts: threadTs, text: displayText });

  for (const shotPath of screenshots) {
    try {
      await client.files.uploadV2({
        channel_id: channel,
        thread_ts: threadTs,
        file: fs.createReadStream(shotPath),
        filename: path.basename(shotPath),
        title: path.basename(shotPath),
      });
    } catch (err) {
      await client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `:warning: 스크린샷 첨부 실패 (${path.basename(shotPath)}): ${err.message}\n(Slack App에 files:write 스코프가 추가/재설치되어 있는지 확인하세요)`,
      });
    }
  }
}

module.exports = { postResult, extractScreenshotPaths, stripScreenshotLines };
