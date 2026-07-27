# 飲水紀錄 App

## 部署步驟（比照健身紀錄App的做法）

1. 到 GitHub 建立一個新的 Public 儲存庫，例如叫 `water-tracker`
2. 把這個資料夾裡的所有檔案（除了 node_modules、dist）上傳上去
3. 到 Vercel 用這個 GitHub 儲存庫建立新專案，Framework 選 Vite，直接部署
4. 部署完成後會拿到一個網址，用手機瀏覽器（Brave）打開，選單裡選「加到主畫面」

## 設定 Google Sheets 備份（選用）

打開 `public/google-apps-script.js`，裡面有完整的部署步驟說明。設定好之後，把拿到的網址貼到 App 裡「設定」→「Google Sheets 備份網址」。

## 本機開發

```
npm install
npm run dev
```
