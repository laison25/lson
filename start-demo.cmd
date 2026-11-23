@echo off
setlocal
cd /d "%~dp0"
set "LSON_NODE=%~dp0.tools\node\node.exe"
if exist "%LSON_NODE%" goto ready
where node.exe >nul 2>&1
if errorlevel 1 goto missingnode
set "LSON_NODE=node.exe"
:ready
if /I "%~1"=="accounts" goto accounts
if not exist "node_modules\vite\bin\vite.js" goto missingdeps
"%LSON_NODE%" "scripts\demo.mjs"
exit /b %errorlevel%
:accounts
"%LSON_NODE%" "scripts\accounts.mjs"
exit /b %errorlevel%
:missingnode
echo Khong tim thay Node.js. Cai Node.js 24 LTS, sau do mo lai VS Code.
exit /b 1
:missingdeps
echo Chua co thu vien du an. Cai pnpm va chay pnpm install theo README.
exit /b 1
