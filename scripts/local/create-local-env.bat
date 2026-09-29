@echo off
setlocal EnableExtensions
cd /d "%~dp0\..\.."

for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"`) do set "DEV_SECRET=%%A"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "([guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'))"`) do set "SESSION_SECRET_LOCAL=%%A"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "([guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'))"`) do set "CSRF_SECRET_LOCAL=%%A"

(
  echo set "APP_STAGE=dev"
  echo set "NODE_ENV=development"
  echo set "PORT=3001"
  echo set "DATABASE_URL=postgresql://farmquest_app@localhost:5432/farmquest?schema=farmquest"
  echo set "DATABASE_MIGRATION_URL=postgresql://farmquest_migrator@localhost:5432/farmquest?schema=farmquest"
  echo set "DEV_LOGIN_ENABLED=true"
  echo set "DEV_LOGIN_SECRET=%DEV_SECRET%"
  echo set "SESSION_COOKIE_SECURE=false"
  echo set "SESSION_SECRET=%SESSION_SECRET_LOCAL%"
  echo set "CSRF_SECRET=%CSRF_SECRET_LOCAL%"
  echo set "GAME_TIMEZONE=America/Sao_Paulo"
  echo set "TZ=UTC"
  echo set "LOG_LEVEL=info"
  echo set "API_INTERNAL_URL=http://127.0.0.1:3001"
) > ".farmquest-local.cmd"

echo Configuracao local criada em .farmquest-local.cmd
echo Esse arquivo fica somente no seu computador e nao vai para o GitHub.
exit /b 0
