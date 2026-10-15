@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js LTS. & pause & exit /b 1)
call npm install || (pause & exit /b 1)
if not exist android (call npm run android:init || (pause & exit /b 1))
call npm run android:sync || (pause & exit /b 1)
call npm run android:open
pause
