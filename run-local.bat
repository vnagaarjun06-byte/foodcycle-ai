@echo off
title FoodCycle AI - Local Server
set "PATH=%~dp0..\tools\node-v20.18.0-win-x64;%PATH%"
echo ====================================================
echo Starting FoodCycle AI Server...
echo ====================================================
start "" http://localhost:3000
node server.js
pause
