@echo off
cd /d "%~dp0"
if exist Shifra.exe (
  start "" "%~dp0Shifra.exe"
  exit /b 0
)
cd shipra
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
