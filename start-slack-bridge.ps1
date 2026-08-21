# tc-automation Slack Bridge 시작 스크립트
# 이미 실행 중이면 중복 시작하지 않고 안내만 하고 종료합니다.

$bridgeDir = "D:\tc-automation\slack-bridge"
Set-Location $bridgeDir

$pidFile = Join-Path $bridgeDir "slack-bridge.pid"

if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
        Write-Host "이미 실행 중입니다 (PID $existingPid). 다시 시작하려면 restart-slack-bridge.ps1을 사용하세요."
        exit 0
    }
}

$proc = Start-Process -FilePath "node" `
    -ArgumentList "src/index.js" `
    -WorkingDirectory $bridgeDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $bridgeDir "server.log") `
    -RedirectStandardError (Join-Path $bridgeDir "server-error.log") `
    -PassThru

$proc.Id | Out-File -FilePath $pidFile -Encoding ascii
Write-Host "tc-automation Slack Bridge를 시작했습니다 (PID $($proc.Id))."
Write-Host "로그 확인: Get-Content '$bridgeDir\server.log' -Tail 20 -Wait"
