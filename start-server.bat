@echo off
cd /d "%~dp0"
echo Starting BullRuniX server...
start "BullRuniX Server" cmd /k "npm start"
echo Waiting for server to start...
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:3000/index.html"
exit /b
