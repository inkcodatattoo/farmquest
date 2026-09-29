@echo off
setlocal
echo Encerrando FarmQuest local...
taskkill /FI "WINDOWTITLE eq FarmQuest API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq FarmQuest Web*" /T /F >nul 2>&1
echo FarmQuest local encerrado.
timeout /t 2 /nobreak >nul
