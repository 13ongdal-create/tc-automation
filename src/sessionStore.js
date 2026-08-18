const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'sessions.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function key(channel, threadTs) {
  return `${channel}:${threadTs}`;
}

/** 스레드(channel + thread_ts) 하나 = Claude Code CLI 세션 하나 */
function get(channel, threadTs) {
  const data = load();
  return data[key(channel, threadTs)] || null;
}

function set(channel, threadTs, record) {
  const data = load();
  data[key(channel, threadTs)] = { ...record, updatedAt: new Date().toISOString() };
  save(data);
}

module.exports = { get, set };
