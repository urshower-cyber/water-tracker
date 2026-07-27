# 飲水紀錄 App

## 部署步驟

1. 到 GitHub 建立一個新的 Public 儲存庫，例如叫 `water-tracker`
2. 把這個資料夾裡的所有檔案（除了 node_modules、dist）上傳上去
3. 到 Vercel 用這個 GitHub 儲存庫建立新專案，Framework 選 Vite，直接部署
4. 部署完成後會拿到一個網址，用手機瀏覽器（Brave）打開，選單裡選「加到主畫面」

## 設定 Google Sheets 備份（必要，推播通知也需要它）

打開 `public/google-apps-script.js`，裡面有完整的部署步驟說明。設定好之後，把拿到的網址貼到 App 裡「設定」→「Google Sheets 備份網址」。

## 設定推播通知（可靠版，App關閉也會提醒）

推播通知需要三個環境變數（在 Vercel 專案的 Settings → Environment Variables 裡新增），以及一個 GitHub Actions 的 Secret。

**Vercel 環境變數：**

| 名稱 | 值 |
|---|---|
| `VAPID_PUBLIC_KEY` | （Claude 已在對話中給你，請直接複製那邊的值） |
| `VAPID_PRIVATE_KEY` | （同上，這組是機密金鑰，不要貼在這份公開的 README 裡） |
| `VAPID_SUBJECT` | `mailto:你的email@example.com` |
| `APPS_SCRIPT_URL` | 你的 Google Apps Script Web App 網址（跟App設定裡貼的同一個） |
| `CRON_SECRET` | （同上，自訂一組亂數字串即可，不要貼在這份公開的 README 裡） |

新增完環境變數後，記得回到 Vercel 專案的 Deployments，重新部署一次（Redeploy）讓環境變數生效。

**GitHub Actions Secret：**

到 GitHub 儲存庫 → Settings → Secrets and variables → Actions → New repository secret：

- 名稱：`REMINDER_ENDPOINT`
- 值：`https://你的網址.vercel.app/api/send-reminders?secret=你的CRON_SECRET值`

設定好之後，GitHub Actions 會每 5 分鐘自動呼叫一次，檢查是否有提醒該發送。可以到儲存庫的 Actions 分頁手動觸發一次（workflow_dispatch）測試看看有沒有正常運作。

**在 App 裡啟用：**

先確認「Google Sheets 備份網址」已經填好並儲存，再到設定裡按「啟用推播通知」，手機會跳出允許通知的詢問，同意之後就完成了。

## 本機開發

```
npm install
npm run dev
```
