' 작업 스케줄러용 숨김 실행기 + 감시 루프.
' - 콘솔 창 없이 서버를 띄우고, 서버가 어떤 이유로든 종료되면 잠시 뒤 다시 띄웁니다.
'   (작업 스케줄러의 "실패 시 재시작"은 이 구성에서 동작하지 않아 이 스크립트가 직접 담당)
' - 시작 후 10초 안에 죽으면(포트 충돌/코드 오류 등) 30초, 그 외에는 5초 대기 후 재시도해
'   고장난 상태에서 CPU/로그를 폭주시키지 않습니다.
' - 중지: 작업 스케줄러에서 작업을 "끝내기"(Stop-ScheduledTask)하면 이 스크립트와 서버가 함께 종료됩니다.
' 경로는 이 파일 위치 기준으로 계산합니다(한글/공백 경로를 파일에 직접 적지 않기 위함).
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
If Not fso.FolderExists(root & "\logs") Then fso.CreateFolder(root & "\logs")

Do
  startedAt = Timer
  sh.Run "cmd /c echo [watchdog] " & Now & " starting server >>""logs\out.log""", 0, True
  sh.Run "cmd /c node server.js >> ""logs\out.log"" 2>&1", 0, True
  ranFor = Timer - startedAt
  If ranFor < 0 Then ranFor = 99 ' 자정을 넘겨 Timer가 되감긴 경우
  If ranFor < 10 Then
    WScript.Sleep 30000
  Else
    WScript.Sleep 5000
  End If
Loop
