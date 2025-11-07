# 📱 VoteChaos - 跨平台 APP

> 從 Web 應用成功轉換為 iOS + Android APP

---

## 🎯 專案概述

**VoteChaos** 是一個基於代幣的投票平台，用戶可以：
- 🗳️ 參與各種有趣的投票話題
- 💰 使用代幣或免費票投票
- 📝 創建自己的投票主題
- 🎁 完成任務獲得獎勵
- 📊 查看投票統計和歷史

**技術棧**：
- React 18 + TypeScript
- Vite 5
- Capacitor 6（iOS + Android）
- Supabase（後端）
- Shadcn UI + Tailwind CSS

---

## 🚀 快速開始

### Web 開發模式（最快）

```powershell
# 安裝依賴
npm install

# 啟動開發服務器
npm run dev

# 訪問 http://localhost:5173
```

### Android APP 模式

```powershell
# 1. 建置 Web 應用
npm run build

# 2. 添加 Android 平台（首次）
npx cap add android

# 3. 同步代碼
npx cap sync android

# 4. 打開 Android Studio
npx cap open android

# 5. 在 Android Studio 點擊 Run ▶️
```

### iOS APP 模式（僅 macOS）

```bash
# 1. 建置
npm run build

# 2. 添加 iOS 平台（首次）
npx cap add ios

# 3. 安裝依賴
cd ios/App && pod install && cd ../..

# 4. 同步
npx cap sync ios

# 5. 打開 Xcode
npx cap open ios

# 6. 在 Xcode 選擇模擬器並 Run
```

---

## 📁 專案結構

```
votechaos-main/
├── src/                          # 原始碼
│   ├── components/              # React 組件
│   │   ├── admin/              # 後台管理組件
│   │   ├── ui/                 # UI 組件庫（Shadcn）
│   │   ├── AnnouncementCarousel.tsx
│   │   ├── ReportDialog.tsx
│   │   └── SafeArea.tsx        # APP 安全區域組件
│   ├── contexts/               # React Context
│   ├── hooks/                  # 自定義 Hooks
│   ├── lib/                    # 工具函數
│   │   ├── capacitor.ts       # Capacitor 工具
│   │   ├── app-lifecycle.ts   # APP 生命週期
│   │   └── push-notifications.ts
│   ├── pages/                  # 頁面組件
│   └── integrations/supabase/  # Supabase 整合
├── android/                     # Android 原生專案
├── ios/                         # iOS 原生專案
├── supabase/                    # Supabase 配置
│   ├── functions/              # Edge Functions
│   └── migrations/             # 資料庫遷移
├── capacitor.config.ts         # Capacitor 配置
├── .env.local                  # 環境變數
└── package.json                # 專案依賴
```

---

## 🔧 可用命令

### 開發命令

```powershell
npm run dev              # Web 開發模式
npm run build            # 建置生產版本
npm run preview          # 預覽生產建置
npm run lint             # 程式碼檢查
```

### Capacitor 命令

```powershell
npm run cap:sync         # 同步到所有平台
npm run cap:sync:android # 同步到 Android
npm run cap:sync:ios     # 同步到 iOS
npm run android          # 打開 Android Studio
npm run ios              # 打開 Xcode
```

---

## 📚 文檔導覽

### 🚀 快速開始
- **QUICK_START_APP.md** - 5分鐘快速上手（推薦先看！）
- **APP_SETUP_CHECKLIST.md** - 逐步檢查清單

### 🔧 技術文檔
- **CAPACITOR_SETUP_GUIDE.md** - Capacitor 完整設置指南
- **CAPACITOR_CONVERSION_COMPLETE.md** - 轉換完成報告

### 🗄️ 資料庫
- **QUICK_SQL_MIGRATION.md** - SQL 遷移快速指南
- **DATABASE_MIGRATION_GUIDE.md** - 遷移詳細說明
- **SETUP_GUIDE.md** - Supabase 設置指南

### 📲 功能文檔
- **REPORT_SYSTEM_GUIDE.md** - 檢舉系統使用指南
- **MISSING_FEATURES_ANALYSIS.md** - 功能缺失分析
- **IMPLEMENTATION_COMPLETE.md** - 已實現功能報告

### 🚀 發布指南
- **APP_PUBLISHING_GUIDE.md** - 上架商店完整指南

---

## 🎨 功能特色

### ✅ 已實現功能

#### 核心功能：
- ✅ 用戶註冊/登入（郵箱）
- ✅ 匿名瀏覽
- ✅ 主題瀏覽（熱門/最新/參與過）
- ✅ 主題詳情查看
- ✅ 代幣投票
- ✅ 免費投票（每日每主題一次）
- ✅ 主題創建（含免費資格）
- ✅ 代幣系統
- ✅ 任務系統（觀看廣告）

#### 歷史紀錄：
- ✅ 投票歷史
- ✅ 發起紀錄
- ✅ 代幣使用紀錄

#### 平台功能：
- ✅ 公告系統（輪播顯示）
- ✅ 檢舉系統（9種類型）
- ✅ 後台管理（公告/檢舉/審核/配置）
- ✅ UI 文字管理
- ✅ 系統配置管理

#### 原生功能（APP）：
- ✅ 觸覺反饋
- ✅ 狀態欄控制
- ✅ 返回按鈕處理
- ✅ 深層連結
- ✅ APP 生命週期
- ✅ 推送通知框架（待配置 Firebase）

---

### ⏳ 待實現功能

#### 短期（1-2週）：
- ⏳ 搜尋功能
- ⏳ 主題篩選
- ⏳ 用戶個人資料編輯
- ⏳ 任務系統完善（每日登入、連續登入）

#### 中期（2-4週）：
- ⏳ 留言系統
- ⏳ 通知中心
- ⏳ 投票動畫效果
- ⏳ AdMob 廣告整合

#### 長期（1-2個月）：
- ⏳ 內購整合
- ⏳ OAuth 登入（Google/Apple）
- ⏳ 成就系統
- ⏳ 用戶管理（後台）
- ⏳ 風控系統

完整清單請見：`MISSING_FEATURES_ANALYSIS.md`

---

## 🔐 環境變數

需要在 `.env.local` 設置：

```env
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

**已配置** ✅

---

## 🗄️ 資料庫

### 主要表格：
- `profiles` - 用戶資料
- `topics` - 投票主題
- `free_votes` - 免費投票記錄
- `free_create_qualifications` - 免費建立資格
- `announcements` - 公告
- `reports` - 檢舉記錄
- `token_transactions` - 代幣交易
- `system_config` - 系統配置

### Edge Functions：
- `cast-vote` - 投票
- `cast-free-vote` - 免費投票
- `create-topic` - 建立主題
- `complete-mission` - 完成任務
- `watch-ad` - 觀看廣告

---

## 🎨 UI 組件

基於 **Shadcn UI**，包含：
- Button, Card, Dialog, Tabs, Badge
- Input, Textarea, Select, Switch
- Table, Progress, Alert
- Toast, Sonner（通知）
- 自定義主題色系

---

## 📱 支援平台

- ✅ **Web** - 所有現代瀏覽器
- ✅ **Android** - Android 5.1+ (API 22+)
- ✅ **iOS** - iOS 13.0+

---

## 🔌 已整合的外掛程式

| 外掛程式 | 用途 | 狀態 |
|----------|------|------|
| @capacitor/app | APP 基礎功能 | ✅ 完成 |
| @capacitor/status-bar | 狀態欄控制 | ✅ 完成 |
| @capacitor/splash-screen | 啟動畫面 | ✅ 完成 |
| @capacitor/keyboard | 鍵盤管理 | ✅ 完成 |
| @capacitor/haptics | 觸覺反饋 | ✅ 完成 |
| @capacitor/push-notifications | 推送通知 | ⚠️ 需配置 |
| @capacitor/toast | 原生提示 | ✅ 完成 |

---

## 🛠️ 維護

### 更新 APP：

```powershell
# 1. 修改程式碼
# 2. 建置
npm run build

# 3. 同步
npx cap sync

# 4. 遞增版本號（在 Capacitor config 和原生專案）
# 5. 在 Android Studio/Xcode 建置新版本
# 6. 上傳到商店
```

### 監控：
- Google Play Console - 崩潰報告
- App Store Connect - 分析資料
- Supabase Dashboard - 後端日誌

---

## 📄 授權

Private - All rights reserved

---

## 👥 貢獻

目前為私人專案。

---

## 📞 支援

如有問題：
1. 查看對應的文檔
2. 檢查 GitHub Issues
3. 聯繫開發團隊

---

## 🎊 特別說明

此專案已完成：
- ✅ Web 轉 APP 轉換
- ✅ 核心功能實現
- ✅ 資料庫設計
- ✅ 後台管理系統
- ✅ 完整文檔

**準備好上架了！** 🚀

---

**開發者**: VoteChaos Team  
**版本**: 1.0.0  
**最後更新**: 2025-01-15

