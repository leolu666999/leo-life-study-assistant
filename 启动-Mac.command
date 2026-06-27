#!/bin/zsh
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js 24 或更新版本：https://nodejs.org/"
  read "?按回车退出"
  exit 1
fi

if [ ! -x "node_modules/.bin/next" ]; then
  echo "第一次运行，正在安装依赖..."
  npm install
fi

echo "正在启动 Leo的生活学习助手..."
echo "浏览器打开：http://localhost:3011"
npm run dev
