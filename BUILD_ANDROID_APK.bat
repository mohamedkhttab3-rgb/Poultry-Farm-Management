@echo off
setlocal
chcp 65001 > nul
cd /d "%~dp0"
where node >nul 2>&1 || (echo ERROR: Install Node.js 22+ & pause & exit /b 1)
where java >nul 2>&1 || (echo ERROR: Install Java JDK 21 & pause & exit /b 1)
if not defined ANDROID_HOME if not defined ANDROID_SDK_ROOT (echo ERROR: Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK location. & pause & exit /b 1)
set ELECTRON_SKIP_BINARY_DOWNLOAD=1
call npm install --no-audit --no-fund || (echo npm installation failed & pause & exit /b 1)
if not exist android (call npx cap add android || (echo ERROR: cap add android failed. & pause & exit /b 1))
call npx cap sync android || (echo ERROR: cap sync failed. & pause & exit /b 1)
call npm run android:icons || (echo ERROR: Android icons failed. & pause & exit /b 1)
call node scripts/set-android-version.cjs || (echo ERROR: Android version failed. & pause & exit /b 1)
cd android
call gradlew.bat --no-daemon assembleDebug || (echo ERROR: Gradle build failed. & pause & exit /b 1)
echo APK built: android\app\build\outputs\apk\debug\app-debug.apk
pause
