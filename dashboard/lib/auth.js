// 대시보드 공유 비밀번호 인증 — 팀원들이 사내망에서 같은 비밀번호로 함께 접속해 쓸 수 있게 합니다.
// 채팅 패널이 실제 claude CLI를 실행해 파일 쓰기/커밋까지 하므로, 인증 없이 네트워크에 열면
// 같은 네트워크의 누구나 이 동작을 트리거할 수 있어 최소한의 공유 비밀번호를 둡니다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD_FILE = path.join(__dirname, '..', '.dashboard-password'); // .gitignore 대상
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — 만료되면 비밀번호 재입력

function getOrCreatePassword() {
  if (process.env.DASHBOARD_PASSWORD) return process.env.DASHBOARD_PASSWORD;
  if (fs.existsSync(PASSWORD_FILE)) {
    const saved = fs.readFileSync(PASSWORD_FILE, 'utf-8').trim();
    if (saved) return saved;
  }
  const generated = crypto.randomBytes(6).toString('base64url');
  fs.writeFileSync(PASSWORD_FILE, generated, 'utf-8');
  return generated;
}

const PASSWORD = getOrCreatePassword();
const sessions = new Map(); // token -> 만료 시각(ms)

function verifyPassword(pw) {
  return typeof pw === 'string' && pw.length > 0 && pw === PASSWORD;
}

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function getCookie(header, name) {
  if (!header) return null;
  const found = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

module.exports = { PASSWORD, verifyPassword, createSession, isValidSession, destroySession, getCookie };
