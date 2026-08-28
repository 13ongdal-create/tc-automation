# tc-automation Slack Bridge 중지 스크립트
# start-slack-bridge.ps1이 남겨둔 PID 파일을 읽어, 그 프로세스만 정확히 종료합니다
# (다른 node.exe 프로세스에는 영향 없음).

$bridgeDir = "D:\QA\tc-automation\slack-bridge"
$pidFile = Join-Path $bridgeDir "slack-bridge.pid"

if (-not (Test-Path $pidFile)) {
    Write-Host "PID 파일이 없습니다 — 이 스크립트로 시작한 브릿지가 실행 중이 아닌 것으로 보입니다."
    exit 0
}

$targetPid = Get-Content $pidFile -ErrorAction SilentlyContinue
if ($targetPid -and (Get-Process -Id $targetPid -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $targetPid -Force
    Write-Host "tc-automation Slack Bridge를 중지했습니다 (PID $targetPid)."
} else {
    Write-Host "PID $targetPid 프로세스가 이미 종료된 상태입니다."
}

Remove-Item $pidFile -ErrorAction SilentlyContinue
