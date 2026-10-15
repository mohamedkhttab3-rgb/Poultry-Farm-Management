@echo off
setlocal
chcp 65001 > nul
cd /d "%~dp0"
where node >nul 2>&1 || (echo ERROR: Node.js 22+ is required. & pause & exit /b 1)
call npm install --no-audit --no-fund || (echo ERROR: npm install failed. & pause & exit /b 1)
call npm run verify:source || (echo ERROR: Source check failed. & pause & exit /b 1)
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build:win || (echo ERROR: EXE build failed. & pause & exit /b 1)
echo Finished. See dist-desktop folder for .exe files.
pause
