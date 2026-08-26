#!/bin/bash
# HTTPS용 자체서명 인증서를 생성합니다 (dashboard/certs/에 저장 — git 비대상, 개인키 포함이라 커밋 금지).
# 최초 1회, 또는 이 PC의 LAN IP가 바뀌어 브라우저 인증서 경고의 호스트명 불일치가 거슬릴 때 재실행하세요:
#   bash dashboard/scripts/gen-cert.sh
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
mkdir -p "$DIR"

LAN_IP=$(node -e "
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) { console.log(iface.address); process.exit(0); }
    }
  }
")
echo "LAN IP: ${LAN_IP:-(감지 안 됨 — localhost만 SAN에 포함)}"

SAN="DNS:localhost,IP:127.0.0.1"
if [ -n "$LAN_IP" ]; then SAN="$SAN,IP:$LAN_IP"; fi

MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -keyout "$DIR/key.pem" -out "$DIR/cert.pem" -days 3650 -nodes \
  -subj "/CN=qa-automation-dashboard" \
  -addext "subjectAltName=$SAN"

echo "인증서 생성 완료: $DIR (10년 유효, 자체서명이라 브라우저 첫 접속 시 보안 경고가 뜹니다)"
