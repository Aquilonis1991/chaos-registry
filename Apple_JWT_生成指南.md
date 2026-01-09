# Apple Sign In JWT Token 生成指南

## 📋 問題說明

Supabase 的 Apple Provider 需要的是 **JWT Token**，而不是直接的 `.p8` 私鑰內容。

錯誤訊息：`Secret key should be a JWT`

---

## 🔧 解決方案

### 方法 1：使用 Node.js 腳本（推薦）

#### 步驟 1：安裝依賴

```bash
npm install jsonwebtoken
```

#### 步驟 2：配置腳本

1. 打開 `scripts/generate-apple-jwt.js`
2. 修改以下配置：

```javascript
const TEAM_ID = 'YOUR_TEAM_ID';        // 替換為您的 Team ID
const CLIENT_ID = 'com.votechaos.app.services';
const KEY_ID = 'YOUR_KEY_ID';          // 替換為您的 Key ID
const KEY_FILE_PATH = path.join(__dirname, '../secrets/apple-sign-in-key.p8');
```

#### 步驟 3：執行腳本

```bash
node scripts/generate-apple-jwt.js
```

#### 步驟 4：複製 JWT Token

腳本會輸出 JWT Token，複製並貼到 Supabase 的 **Secret Key** 欄位。

---

### 方法 2：使用線上工具（快速）

#### 推薦工具：Apple JWT Generator

1. 訪問：https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
2. 或使用第三方工具：
   - https://appleid.apple.com/signinwithapple/button
   - 搜尋 "Apple JWT Generator"

#### 需要準備的資訊：

- **Team ID**：從 Apple Developer Portal 右上角取得
- **Client ID (Services ID)**：`com.votechaos.app.services`
- **Key ID**：從 Apple Developer Portal Keys 頁面取得
- **Private Key**：`.p8` 檔案內容

---

### 方法 3：使用 Python 腳本

如果您熟悉 Python：

```python
import jwt
import time

# 配置
TEAM_ID = 'YOUR_TEAM_ID'
CLIENT_ID = 'com.votechaos.app.services'
KEY_ID = 'YOUR_KEY_ID'
KEY_FILE = 'secrets/apple-sign-in-key.p8'

# 讀取私鑰
with open(KEY_FILE, 'r') as f:
    private_key = f.read()

# 建立 JWT
headers = {
    'alg': 'ES256',
    'kid': KEY_ID
}

payload = {
    'iss': TEAM_ID,
    'iat': int(time.time()),
    'exp': int(time.time()) + (180 * 24 * 60 * 60),  # 180 天
    'aud': 'https://appleid.apple.com',
    'sub': CLIENT_ID
}

token = jwt.encode(payload, private_key, algorithm='ES256', headers=headers)
print(token)
```

---

## 📝 JWT Token 格式說明

生成的 JWT Token 格式類似：

```
eyJraWQiOiJBQkMxMjNERUY0IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJBQkMxMjNERUY0IiwiaWF0IjoxNzA5ODc2NDAwLCJleHAiOjE3MjU0Mjg0MDAsImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20udm90ZWNoYW9zLmFwcC5zZXJ2aWNlcyJ9...
```

這是一個長字串，包含三個部分（用 `.` 分隔）：
- Header（標頭）
- Payload（負載）
- Signature（簽名）

---

## ⚠️ 重要提醒

### 1. JWT Token 有效期

- **有效期**：最長 180 天
- **到期前**：需要重新生成並更新 Supabase 設定
- **建議**：設定提醒，每 6 個月更新一次

### 2. 安全注意事項

- ✅ JWT Token 可以儲存在 Supabase Dashboard 中
- ❌ 不要將 `.p8` 私鑰檔案提交到 Git
- ✅ 已將 `secrets/` 資料夾加入 `.gitignore`

### 3. 更新流程

當 JWT Token 即將到期時：

1. 重新執行腳本生成新的 JWT Token
2. 在 Supabase Dashboard 中更新 Secret Key
3. 儲存設定

---

## ✅ 完成後檢查

- [ ] JWT Token 已生成
- [ ] JWT Token 已貼到 Supabase 的 Secret Key 欄位
- [ ] 所有其他欄位已正確填寫
- [ ] 已點擊 Save 按鈕
- [ ] 沒有錯誤訊息

---

## 🧪 測試

完成設定後，測試 Apple 登入：

1. 前往應用程式登入頁面
2. 點擊「使用 Apple 登入」按鈕
3. 應該會跳轉到 Apple 登入頁面
4. 完成登入後應該會重定向回應用程式
