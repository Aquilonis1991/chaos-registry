# LINE Assertion Signing Key - 私鑰保管說明

> **⚠️ 重要**：此文件包含敏感資訊，請妥善保管  
> **更新日期**：2025-01-29

---

## 🔐 已生成的私鑰

**生成時間**：2025-01-29  
**金鑰類型**：RSA 2048 位元  
**用途**：LINE Assertion Signing Key（用於簽名 JWT）

---

## 📝 私鑰內容

**⚠️ 警告**：此私鑰是敏感資訊，請妥善保管，不要分享或提交到 Git！

```json
{
  "alg": "RS256",
  "d": "B1fBeZw5rdiLeoLNaoEzH6pQdMzicWE-VFnJjaJNxZYHHKQGI2D1f1n9UJ-D6zyuE5jbLJaUkwNbv5JB135Lm03oSPUe4Ehdiw7hS2izGmOsUqv-NgKBL8t2ctekfz3pBJIq3h52wB4y4kD0KCHmFwbVqlVlG9RTSz1Rm_iOXW2kCfhwpJgDJCKfM3bKFGJZQwwP-CzfUkb6R0e9ZKvGMObgVh5LjOL-Hd5ypJRu-aeF-OQ6kpTOcilvIMSegEB_PnNccSV0nd-O7befgXQET2iIqSIA0-h6RPQXLw9qM28iXrRijYRyMD22ISO_GMDMMTFcBwJfxDnph6k3DoD8KQ",
  "dp": "lIiCmOweN_1dziPKM-QvLu1t_KAZhOUSPzNKoW3WBlj7J_o4S9ABoMgqY8Xk6CqSEvH1GQBengxDD0Yu9IexNLcniDStWkdd8K_Sks0xiKwqZDxtZsJk5yYyvykqcqi6EOXQPaRwMXBO5KstCSV2OLdGb_yt5QnByMwsD1VNmZU",
  "dq": "sQEUkPY3xWsfc2dqcLgmMwgMlJnwNsSyve5GiW83JnFsqzNUkCX5Q7krZnG9HCHyJFXRHSIEPPselYaM9zSRdAOKV8uVocmNDAdPFHK6ej2Rp_vHZVoZ7K9rkhsgzkEoMVtxMDtvP7A5m-tev-_a0c3jhnUCRCgtXbEdNd694Rk",
  "e": "AQAB",
  "ext": true,
  "key_ops": [
    "sign"
  ],
  "kty": "RSA",
  "n": "wy73KQjoYqocqeZYf1zxmumIZXrpVwgEUZ_x0ZJlBJmJmJi3GWWxA_G9gbi5G7vQeSp-7hA2_T3OxqIFr1YJMxZVVivnbvh0O6TfECU5sDusjd5YkdsOTuBofNENBN7aM--JPrKUOt4z3A6USEYBp1Gh8eKOsI-dGxyxsCtv4NuLAak2gYx2SoENf1rIPxrndSvHt_IAwonsweTh3kc6Zrzr7iGf7-SZwgpYWic_msdjGFPmjC6ZiZtfsMz9lyN5a_wwpyQcIraK2ymEPh2R3Fw-SrLfbTk1QwNd-sdiuQOnvyNb3qw6Rb_zGyqtMDUBdMXmyvHCOZcYrt8WYnjW8Q",
  "p": "-X3pPexS4d_mq5z636LMTFMLiqVsSWXe64TzCHybh2XYzzaLn5qteKdA9mO_m72kI7GAZzspBF52gZEC81-1BVLS_gNosN6cfGmoSxyQM71vxf2pbPYSFG0B_zmmrJGBwlzmy3E9SaqWghjF98ng9A_R9iOj0AxT0SOqfZqv-nU",
  "q": "yEZjB2Amczn7YRi7bsvsAGGWCQcDaASjeJ5-a75Fsp8tZLnOAGr2wKiDCN77i1miK5QTkOJL7Tjcxw1imCtjFZBZpaI8ty-GUqIKkijsCTF5XS7oiUQWV0BljfuTUOGKiNVcXLqU0UfzQQ3T8OVg_DYD2wSbysMF8IYyL6B6ww0",
  "qi": "7AenqowsgDEal3xhf2y19bzmeRZ4GSUUfBroGF1wQaY4zcZH1xYI7ERTDX4IVPGiMkNrDxvzEiDT_5opYvjWHmKT9jDXngcsmL2DyFFocVrRpcoOqBmn_WrhdPKeOwUJp61OgVMYN3BJGv29aZnFd3Lc0xc-Yrdb_hON901swK8"
}
```

---

## 📝 公鑰內容（已提交到 LINE Console）

**用於 LINE Developers Console**：

```json
{
  "alg": "RS256",
  "e": "AQAB",
  "ext": true,
  "key_ops": [
    "verify"
  ],
  "kty": "RSA",
  "n": "wy73KQjoYqocqeZYf1zxmumIZXrpVwgEUZ_x0ZJlBJmJmJi3GWWxA_G9gbi5G7vQeSp-7hA2_T3OxqIFr1YJMxZVVivnbvh0O6TfECU5sDusjd5YkdsOTuBofNENBN7aM--JPrKUOt4z3A6USEYBp1Gh8eKOsI-dGxyxsCtv4NuLAak2gYx2SoENf1rIPxrndSvHt_IAwonsweTh3kc6Zrzr7iGf7-SZwgpYWic_msdjGFPmjC6ZiZtfsMz9lyN5a_wwpyQcIraK2ymEPh2R3Fw-SrLfbTk1QwNd-sdiuQOnvyNb3qw6Rb_zGyqtMDUBdMXmyvHCOZcYrt8WYnjW8Q"
}
```

**狀態**：✅ 已提交到 LINE Developers Console  
**Channel ID**：`2008600116`  
**Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126` ✅ 已生成（2025-01-29）

---

## 🔒 私鑰保管建議

### 1. 立即備份

**建議備份位置**：
- ✅ 加密的雲端儲存（例如：Google Drive、Dropbox，使用加密檔案）
- ✅ 密碼管理器（例如：1Password、LastPass）
- ✅ 離線儲存（USB 隨身碟，加密後存放）
- ✅ 安全筆記本（實體筆記本，存放在安全位置）

### 2. 不要做的事

- ❌ **不要提交到 Git**（即使是在私有倉庫）
- ❌ **不要分享給他人**（除非是信任的團隊成員）
- ❌ **不要存放在未加密的檔案中**
- ❌ **不要透過 Email 或即時通訊軟體傳送**

### 3. 建議的保管方式

**方式 1：加密檔案**
```bash
# 使用 7-Zip 或 WinRAR 加密壓縮
# 密碼使用強密碼（至少 16 個字元，包含大小寫、數字、符號）
```

**方式 2：密碼管理器**
- 使用 1Password、LastPass 等密碼管理器
- 建立一個新的「安全筆記」項目
- 將私鑰 JSON 貼上並儲存

**方式 3：離線儲存**
- 將私鑰 JSON 儲存到 USB 隨身碟
- 使用加密軟體（例如：VeraCrypt）加密整個隨身碟
- 存放在安全位置（例如：保險箱）

---

## 📋 使用私鑰和 Key ID 的場景

### 私鑰用途

私鑰用於以下場景：

1. **簽名 JWT Token**
   - 當應用程式需要向 LINE 發送請求時
   - 使用私鑰簽名 JWT，LINE 使用公鑰驗證

2. **驗證應用程式身份**
   - LINE 使用公鑰驗證應用程式的身份
   - 確保請求來自合法的應用程式

### Key ID (kid) 用途

**Key ID**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`

**用途**：
- 在 JWT Header 中指定使用的金鑰
- LINE 使用 kid 來識別對應的公鑰
- 當有多個金鑰時，kid 用於選擇正確的金鑰

**JWT Header 範例**：
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "cc31abb4-94d1-4655-aba2-2e7a7e4ab126"
}
```

**重要**：
- ⚠️ kid 必須與 LINE Console 中註冊的公鑰對應
- ⚠️ 如果重新生成金鑰對，kid 會改變，需要更新應用程式中的 kid

---

## ⚠️ 遺失私鑰的後果

如果私鑰遺失：

1. **無法使用 Assertion Signing Key 功能**
2. **需要重新生成金鑰對**
3. **需要在 LINE Console 中更新公鑰**
4. **可能影響現有的整合功能**

**預防措施**：
- ✅ 立即備份私鑰到多個安全位置
- ✅ 定期檢查備份是否完整
- ✅ 記錄私鑰的存放位置

---

## 🔄 如果私鑰遺失

如果私鑰遺失，需要：

1. **重新生成金鑰對**
   - 使用瀏覽器開發者工具重新生成
   - 或使用 OpenSSL 等工具

2. **更新 LINE Console 中的公鑰**
   - 進入 LINE Developers Console
   - 更新 Assertion Signing Key 的公鑰

3. **更新應用程式中的私鑰**
   - 如果應用程式中儲存了私鑰，需要更新

---

## ✅ 檢查清單

- [ ] 私鑰已備份到至少 2 個安全位置
- [ ] 私鑰已加密儲存
- [ ] 私鑰未提交到 Git（檢查 .gitignore）
- [ ] 私鑰存放位置已記錄
- [ ] 團隊成員（如有）知道私鑰的存放位置
- [x] 公鑰已提交到 LINE Console ✅
- [x] Key ID (kid) 已記錄：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126` ✅

---

## 📞 相關文件

- [LINE Assertion Signing Key 設定指南](./LINE-AssertionSigningKey設定指南.md)
- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)

---

## 🔐 安全提醒

**最後提醒**：
- ⚠️ 此私鑰是敏感資訊，請妥善保管
- ⚠️ 不要分享或提交到公開位置
- ⚠️ 定期檢查備份是否完整
- ⚠️ 如果懷疑私鑰已洩露，立即重新生成金鑰對

