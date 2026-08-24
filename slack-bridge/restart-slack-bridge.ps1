# tc-automation Slack Bridge 재시작 스크립트 (중지 후 시작)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $here "stop-slack-bridge.ps1")
Start-Sleep -Seconds 1
& (Join-Path $here "start-slack-bridge.ps1")
