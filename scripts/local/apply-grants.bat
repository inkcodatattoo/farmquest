@echo off
setlocal EnableExtensions
cd /d "%~dp0\..\.."

set "PSQL="

for /f "delims=" %%P in ('where psql 2^>nul') do (
  if not defined PSQL set "PSQL=%%P"
)

if not defined PSQL if exist "C:\Program Files\PostgreSQL\18\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\18\bin\psql.exe"
if not defined PSQL if exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" set "PSQL=C:\Program Files\PostgreSQL\17\bin\psql.exe"

if not defined PSQL (
  echo ERRO: psql.exe nao encontrado.
  exit /b 1
)

"%PSQL%" -h localhost -U farmquest_migrator -d farmquest -v ON_ERROR_STOP=1 -f "infra\postgres\bootstrap\grants.sql"
exit /b %errorlevel%
