# 減少 Cursor / VS Code OOM（記憶體不足）錯誤

若經常出現 `The window terminated unexpectedly (reason: 'oom', code: '-536870904')`，可依下列方式降低記憶體使用。

## 1. 專案設定（已套用）

- **`.vscode/settings.json`**  
  - `files.watcherExclude`：不監聽 `node_modules`、`dist`、`android`、`ios` 等大型目錄。  
  - `search.exclude`：搜尋時排除上述目錄，減少索引量。

## 2. `.cursorignore`（已建立）

專案根目錄已包含 `.cursorignore`，讓 Cursor 不索引 `node_modules`、`dist`、`android`、`ios` 等大型目錄，以減少記憶體使用。

若檔案被刪除，可手動建立同名檔案，內容為：

```
node_modules/
dist/
android/
ios/
.git/
*.log
.env
.env.*
```

或於 PowerShell 在專案根目錄執行：
```powershell
@("node_modules/","dist/","android/","ios/",".git/","*.log",".env",".env.*") | Set-Content -Path ".cursorignore" -Encoding utf8
```

建立或修改後，重新開啟 Cursor 或重新載入視窗使設定生效。

## 3. 其他建議

- **關閉不需的擴充功能**：只保留常用擴充，減少背景負載。  
- **縮小工作區**：若用多根資料夾（multi-root），可改為只開啟 `votechaos-main` 一個資料夾。  
- **提高系統虛擬記憶體**：Windows 可適度提高分頁檔大小。  
- **關閉其他吃記憶體的程式**：瀏覽器分頁、其他 IDE 等。  
- **建置時限制 Node 記憶體**（若是在終端跑 build 時 OOM）：  
  `set NODE_OPTIONS=--max-old-space-size=4096`（PowerShell）再執行 `npm run build`。

上述設定與步驟可降低編輯器與建置過程的記憶體使用，減少 OOM 發生機率。
