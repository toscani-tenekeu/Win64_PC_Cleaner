@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current Node.js LTS x64 release, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing local dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 pause
