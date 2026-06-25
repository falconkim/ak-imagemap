!macro customInit
  ; Read the uninstall registry key for the app (usually registered under com.ak.imagemap)
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ak.imagemap" "UninstallString"
  StrCmp $0 "" check_hklm
    Goto found_existing
    
  check_hklm:
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.ak.imagemap" "UninstallString"
  StrCmp $0 "" no_previous
  
  found_existing:
    MessageBox MB_YESNO|MB_ICONINFORMATION "기존에 설치된 AK Image Map Editor가 감지되었습니다.$\n확인을 누르시면 기존 버전을 최신 버전으로 업데이트하여 설치를 진행합니다.$\n$\n업데이트 설치를 진행하시겠습니까?" IDYES continue IDNO cancel
    cancel:
      Quit
    continue:
    
  no_previous:
!macroend
