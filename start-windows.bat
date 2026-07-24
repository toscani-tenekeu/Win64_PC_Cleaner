@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current Node.js LTS x64 release, then run this file again.
  pause
  exit /b 1
)

for /f %%A in ('node -p "process.arch"') do set "NODE_ARCH=%%A"
if /i not "%NODE_ARCH%"=="x64" (
  echo This application requires the x64 version of Node.js on Windows 10 or 11.
  echo Detected architecture: %NODE_ARCH%
  pause
  exit /b 1
)

if not exist node_modules\better-sqlite3\package.json goto install_dependencies
if not exist node_modules\express\package.json goto install_dependencies
goto start_application

:install_dependencies
echo Installing local dependencies...
call npm install
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)

:start_application
call npm start
if errorlevel 1 pause
