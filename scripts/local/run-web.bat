@echo off
cd /d "%~dp0\..\.."
call ".farmquest-local.cmd"
set "PORT=3000"
title FarmQuest Web
echo FarmQuest Web - http://127.0.0.1:3000
echo.
call pnpm --filter @farmquest/web dev
