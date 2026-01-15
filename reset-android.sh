#!/bin/bash

# Android 模擬器重置腳本 (Bash)
# 用於重置模擬器並確保所有修改都應用到應用

echo "========================================"
echo "Android 模擬器重置腳本"
echo "========================================"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "錯誤: 請在專案根目錄執行此腳本"
    exit 1
fi

# 步驟 1: 清理應用數據
echo "[1/7] 清理應用數據..."
if adb devices | grep -q "device$"; then
    adb shell pm clear com.votechaos.app.debug
    echo "✓ 應用數據已清理"
else
    echo "⚠ 警告: 未檢測到已連接的設備/模擬器"
    echo "  請確保模擬器已啟動"
fi

echo ""

# 步驟 2: 清理前端構建
echo "[2/7] 清理前端構建..."
if [ -d "dist" ]; then
    rm -rf dist
    echo "✓ dist 目錄已清理"
fi
npm run build
if [ $? -eq 0 ]; then
    echo "✓ 前端構建完成"
else
    echo "✗ 前端構建失敗"
    exit 1
fi

echo ""

# 步驟 3: 同步 Capacitor
echo "[3/7] 同步 Capacitor..."
npm run cap:sync:android
if [ $? -eq 0 ]; then
    echo "✓ Capacitor 同步完成"
else
    echo "✗ Capacitor 同步失敗"
    exit 1
fi

echo ""

# 步驟 4: 清理 Android 構建
echo "[4/7] 清理 Android 構建..."
cd android
if [ -d "app/build" ]; then
    rm -rf app/build
    echo "✓ app/build 已清理"
fi
if [ -d "build" ]; then
    rm -rf build
    echo "✓ build 已清理"
fi
./gradlew clean
if [ $? -eq 0 ]; then
    echo "✓ Gradle clean 完成"
else
    echo "✗ Gradle clean 失敗"
    cd ..
    exit 1
fi

echo ""

# 步驟 5: 重新構建
echo "[5/7] 重新構建 Android 專案..."
./gradlew assembleDebug
if [ $? -eq 0 ]; then
    echo "✓ Android 專案構建完成"
else
    echo "✗ Android 專案構建失敗"
    cd ..
    exit 1
fi

echo ""

# 步驟 6: 安裝到模擬器
echo "[6/7] 安裝應用到模擬器..."
if adb devices | grep -q "device$"; then
    ./gradlew installDebug
    if [ $? -eq 0 ]; then
        echo "✓ 應用已安裝"
    else
        echo "✗ 應用安裝失敗"
        cd ..
        exit 1
    fi
else
    echo "⚠ 警告: 未檢測到已連接的設備/模擬器"
    echo "  請確保模擬器已啟動，然後手動執行: ./gradlew installDebug"
fi

echo ""

# 步驟 7: 完成
echo "[7/7] 重置完成！"
echo ""
echo "========================================"
echo "下一步操作:"
echo "1. 打開 Logcat: adb logcat -s VoteChaos"
echo "2. 啟動應用進行測試"
echo "3. 按照測試流程進行測試"
echo "========================================"

cd ..
