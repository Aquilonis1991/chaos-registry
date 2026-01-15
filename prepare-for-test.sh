#!/bin/bash
# 測試前準備腳本 (Bash)
# 自動執行重新構建和清理應用數據

echo "========================================"
echo "測試前準備腳本"
echo "========================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "錯誤: 請在專案根目錄執行此腳本"
    exit 1
fi

# 步驟 1: 重新構建應用
echo "[1/4] 重新構建應用..."
echo "  - 構建前端..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] 前端構建失敗"
    exit 1
fi
echo "  [OK] 前端構建完成"

echo "  - 同步 Capacitor..."
npm run cap:sync:android
if [ $? -ne 0 ]; then
    echo "[ERROR] Capacitor 同步失敗"
    exit 1
fi
echo "  [OK] Capacitor 同步完成"

echo "  - 構建並安裝 Android 應用..."
cd android
./gradlew assembleDebug installDebug
if [ $? -ne 0 ]; then
    echo "[ERROR] Android 構建或安裝失敗"
    cd ..
    exit 1
fi
echo "  [OK] Android 應用構建並安裝完成"
cd ..

echo "[OK] 應用重新構建完成"
echo ""

# 步驟 2: 清理應用數據
echo "[2/4] 清理應用數據..."
if adb devices | grep -q "device$"; then
    adb shell pm clear com.votechaos.app.debug
    if [ $? -eq 0 ]; then
        echo "[OK] 應用數據已清理"
    else
        echo "[WARN] 清理應用數據時出現錯誤（可能應用未安裝）"
    fi
else
    echo "[WARN] 警告: 未檢測到已連接的設備/模擬器"
    echo "  請確保模擬器已啟動，然後手動執行: adb shell pm clear com.votechaos.app.debug"
fi

echo ""

# 步驟 3: 完成
echo "[3/4] 準備完成！"
echo ""

# 步驟 4: 提示下一步
echo "========================================"
echo "準備完成，可以開始測試"
echo "========================================"
echo ""
echo "下一步操作:"
echo "1. 啟動應用進行測試"
echo "2. 查看 Logcat: adb logcat -s VoteChaos"
echo ""
