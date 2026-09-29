@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FarmQuest Launcher

echo.
echo ============================================
echo   FarmQuest - Inicializacao local
echo ============================================
echo.

if not exist ".farmquest-local.cmd" (
  call "scripts\local\create-local-env.bat"
  if errorlevel 1 goto :fail
)

call ".farmquest-local.cmd"

sc query postgresql-x64-18 | findstr /C:"RUNNING" >nul 2>&1
if errorlevel 1 (
  echo PostgreSQL nao esta rodando. Tentando iniciar...
  net start postgresql-x64-18 >nul 2>&1
  timeout /t 2 /nobreak >nul
)

sc query postgresql-x64-18 | findstr /C:"RUNNING" >nul 2>&1
if errorlevel 1 (
  echo.
  echo ERRO: nao consegui iniciar o PostgreSQL.
  echo Clique com o botao direito neste arquivo e escolha "Executar como administrador".
  goto :fail
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call pnpm install
  if errorlevel 1 goto :fail
)

echo Limpando Prisma Client gerado anteriormente...
if exist "packages\database\generated\prisma" (
  rmdir /S /Q "packages\database\generated\prisma"
)

echo Gerando Prisma Client...
call pnpm db:generate
if errorlevel 1 goto :fail

echo Aplicando migrations...
call pnpm --filter @farmquest/database exec prisma migrate deploy --config prisma7.config.ts
if errorlevel 1 goto :fail

echo Aplicando privilegios do banco...
call "scripts\local\apply-grants.bat"
if errorlevel 1 goto :fail

echo Iniciando API...
start "FarmQuest API" cmd /k call "%~dp0scripts\local\run-api.bat"

echo Aguardando API...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; 1..40 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/v1/health/ready' -TimeoutSec 2; if($r.StatusCode -eq 200){$ok=$true; break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}"
if errorlevel 1 (
  echo.
  echo ERRO: a API nao respondeu em http://127.0.0.1:3001.
  echo Veja a janela "FarmQuest API" para o erro.
  goto :fail
)

echo Iniciando interface...
start "FarmQuest Web" cmd /k call "%~dp0scripts\local\run-web.bat"

echo Aguardando interface...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok=$false; 1..60 | ForEach-Object { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){$ok=$true; break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){exit 1}"
if errorlevel 1 (
  echo.
  echo ERRO: a interface nao respondeu em http://127.0.0.1:3000.
  echo Veja a janela "FarmQuest Web" para o erro.
  goto :fail
)

echo.
echo FarmQuest pronto.
echo URL: http://localhost:3000
echo Senha DEV local: %DEV_LOGIN_SECRET%
echo.
<nul set /p="%DEV_LOGIN_SECRET%" | clip
echo A senha DEV foi copiada para a Area de Transferencia.
echo Na tela de login, use Ctrl+V para colar a senha.
echo.
echo As janelas "FarmQuest API" e "FarmQuest Web" devem continuar abertas.
start "" "http://localhost:3000"
echo.
echo Pode minimizar esta janela. Pressione qualquer tecla somente quando quiser fecha-la.
pause >nul
exit /b 0

:fail
echo.
echo A inicializacao nao foi concluida.
pause
exit /b 1
