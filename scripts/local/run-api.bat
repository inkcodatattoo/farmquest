@echo off
cd /d "%~dp0\..\.."
call ".farmquest-local.cmd"
title FarmQuest API
echo FarmQuest API - http://127.0.0.1:3001
echo.
call pnpm --filter @farmquest/api start
