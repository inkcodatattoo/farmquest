@echo off
setlocal
cd /d "%~dp0"
set "FQ_TARGET=%~dp0START_FARMQUEST.bat"
set "FQ_WORKDIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop=[Environment]::GetFolderPath('Desktop'); $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut((Join-Path $desktop 'FarmQuest Local.lnk')); $s.TargetPath=$env:FQ_TARGET; $s.WorkingDirectory=$env:FQ_WORKDIR; $s.Description='Abrir FarmQuest local'; $s.Save()"

if errorlevel 1 (
  echo Nao foi possivel criar o atalho.
  pause
  exit /b 1
)

echo Atalho "FarmQuest Local" criado na Area de Trabalho.
pause
