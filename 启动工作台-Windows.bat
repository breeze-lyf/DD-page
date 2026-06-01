@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 没有检测到 Node.js。
  echo 请先在这台电脑安装 Node.js，再重新双击这个文件。
  echo 安装完成后，本网站可以在大陆网络下本地运行。
  pause
  exit /b 1
)

echo 正在启动 lzddd 的私人宝典...
echo 打开后请不要关闭这个窗口，关闭窗口会停止本地网站。
set PORT=8789
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8789/"
node server.mjs
