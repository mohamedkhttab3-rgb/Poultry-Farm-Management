@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUBLISH_GITHUB_PRIVATE.ps1"
if errorlevel 1 (echo FAILED - take a screenshot of the error above.) else (echo SUCCESS - check GitHub Actions.)
pause
