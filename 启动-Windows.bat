@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。请先安装 Node.js 24 或更新版本：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules\.bin\next.cmd (
  echo 第一次运行或检测到非 Windows 依赖，正在安装依赖...
  npm install
)

echo 正在启动 MyAssist...
echo 浏览器打开：http://localhost:3011
npm run dev
pause
