@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js LTS from https://nodejs.org/ first. & pause & exit /b 1)
call npm install || (echo npm install failed. & pause & exit /b 1)
call npm run desktop:win
pause
