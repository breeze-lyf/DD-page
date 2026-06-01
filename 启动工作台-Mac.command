#!/bin/zsh
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "没有检测到 Node.js。"
  echo "请先在这台电脑安装 Node.js，再重新双击这个文件。"
  echo "安装完成后，本网站可以在大陆网络下本地运行。"
  read "?按回车退出..."
  exit 1
fi

echo "正在启动 lzddd 的私人宝典..."
echo "打开后请不要关闭这个终端窗口，关闭窗口会停止本地网站。"
PORT=8789 node server.mjs &
server_pid=$!
sleep 1
open "http://127.0.0.1:8789/"
wait $server_pid
