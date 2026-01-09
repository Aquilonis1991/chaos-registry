@echo off
REM Apple JWT Token 自動更新腳本
REM 
REM 使用說明：
REM 1. 設定環境變數（可選）
REM 2. 執行此批次檔
REM 3. 可以設定為 Windows Task Scheduler 定期執行

REM 設定環境變數（如果沒有在系統中設定）
REM set APPLE_TEAM_ID=YOUR_TEAM_ID
REM set APPLE_KEY_ID=YOUR_KEY_ID

REM 切換到專案根目錄
cd /d "%~dp0\.."

REM 執行更新腳本
node scripts/update-apple-jwt.js

REM 如果執行失敗，暫停以查看錯誤訊息
if errorlevel 1 (
    echo.
    echo ❌ 執行失敗，請檢查錯誤訊息
    pause
)
