# 🚀 部署 Edge Functions 到 Supabase

## 📝 問題

`create-topic` Edge Function 的代碼在本地（`supabase/functions/create-topic/index.ts`），
但**還沒有部署到 Supabase 雲端**，所以無法使用。

## ✅ 解決方案

有兩種方法部署 Edge Functions：

### 方法 1：使用 Supabase CLI（推薦）

#### 前置條件
需要安裝 Supabase CLI。

#### 步驟
```powershell
# 1. 登入 Supabase
supabase login

# 2. 連接到專案
supabase link --project-ref <您的專案ID>

# 3. 部署所有 Edge Functions
supabase functions deploy

# 或只部署 create-topic
supabase functions deploy create-topic
```

### 方法 2：在 Supabase Dashboard 手動建立（簡單）

#### 步驟 1：前往 Edge Functions
1. https://supabase.com/dashboard
2. 選擇 VoteChaos 專案
3. 左側選單 → **Edge Functions**

#### 步驟 2：建立新函數
1. 點擊 **Create a new function**
2. 函數名稱：`create-topic`
3. 複製 `supabase/functions/create-topic/index.ts` 的內容
4. 貼到編輯器
5. 點擊 **Deploy function**

#### 步驟 3：重複其他函數
需要部署的函數：
- ✅ `create-topic`
- ✅ `cast-vote`
- ✅ `complete-mission`
- ✅ `watch-ad`
- ✅ `get-system-config`

## ⚠️ 簡化方案（暫時不使用 Edge Functions）

如果部署 Edge Functions 太複雜，我可以修改代碼改為**直接操作資料庫**。

優點：
- ✅ 不需要部署 Edge Functions
- ✅ 立即可用
- ✅ 簡單快速

缺點：
- ❌ 缺少伺服器端驗證
- ❌ 安全性較低
- ❌ 某些複雜邏輯可能無法實現

---

**選擇**：
1. 部署 Edge Functions（需要 Supabase CLI 或手動建立）
2. 或讓我建立簡化版本（直接操作資料庫）

您想要哪一種？



