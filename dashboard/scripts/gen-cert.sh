#!/bin/bash
# HTTPS용 자체서명 인증서를 생성합니다 (dashboard/certs/에 저장 — git 비대상, 개인키 포함이라 커밋 금지).
# 최초 1회, 또는 이 PC의 외부용 IP가 바뀌거나(LAN IP 변경 등) 새로 추가되어(Tailscale/VPN 어댑터 등)
# 브라우저 인증서 경고의 호스트명 불일치가 거슬릴 때 재실행하세요:
#   bash dashboard/scripts/gen-cert.sh
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/certs"
mkdir -p "$DIR"
# [수정 2026-08-27] 네이티브 Windows openssl.exe에 넘길 -keyout/-out 경로는 Git Bash 스타일
# (/d/QA/tc-automation/...)이 아니라 Windows 스타일(D:/QA/tc-automation/...)이어야 함 — 아래 openssl
# 호출에 MSYS_NO_PATHCONV=1(‑subj/‑addext의 "/CN=..." 값이 경로로 오인돼 깨지는 것을 막기 위해
# 필요)을 켜두면 MSYS가 인자 경로 변환을 아예 안 하므로, /d/... 형태 그대로는 파일을 못 엶
# ("Can't open ... No such file or directory"). 이 PC에서 실제로 이 버그 때문에 인증서가 단
# 한 번도 생성된 적이 없었고(HTTPS 대신 계속 평문 HTTP로 폴백), gen-cert.sh 자체를 실행해서
# 처음 발견함 — pwd -W로 Windows 스타일 경로를 미리 구해서 우회.
WIN_DIR="$(cd "$DIR" && pwd -W)"

# [수정 2026-08-27] 예전엔 감지된 첫 번째 IPv4만 SAN에 넣었음 — LAN 어댑터 하나뿐일 때는 문제없었지만,
# Tailscale/VPN 등 두 번째 이상의 외부용 어댑터가 생기면 그중 하나만 SAN에 들어가고 나머지로 접속하는
# 사람은 자체서명 경고보다 더 혼란스러운 "호스트명 불일치" 경고를 보게 됨. 감지되는 외부용 IPv4를
# 전부 SAN에 포함하도록 변경.
ALL_IPS=$(node -e "
  const os = require('os');
  const nets = os.networkInterfaces();
  const seen = new Set();
  for (const list of Object.values(nets)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal && !seen.has(iface.address)) {
        seen.add(iface.address);
        console.log(iface.address);
      }
    }
  }
")

if [ -n "$ALL_IPS" ]; then
  echo "감지된 외부용 IPv4 (전부 인증서 SAN에 포함):"
  echo "$ALL_IPS" | sed 's/^/  /'
else
  echo "감지된 외부용 IPv4 없음 — localhost만 SAN에 포함"
fi

SAN="DNS:localhost,IP:127.0.0.1"
while IFS= read -r ip; do
  [ -n "$ip" ] && SAN="$SAN,IP:$ip"
done <<< "$ALL_IPS"

MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -keyout "$WIN_DIR/key.pem" -out "$WIN_DIR/cert.pem" -days 3650 -nodes \
  -subj "/CN=qa-automation-dashboard" \
  -addext "subjectAltName=$SAN"

echo "인증서 생성 완료: $DIR (10년 유효, 자체서명이라 브라우저 첫 접속 시 보안 경고가 뜹니다)"
