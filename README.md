# Whale HUD v0.2.0

唯一追蹤地址：`0xd142479997958a4fefd1f8d5373b31ce36987d73`

## 架構
- GitHub Pages：只負責 HUD 顯示。
- Cloudflare Worker：抓 Hyperliquid、保存最新快照與已觀測 Peak。
- Cloudflare KV binding：`WHALE_DATA`。
- 網頁開啟時讀一次；閒置時不會自動更新。
- `MANUAL UPDATE` 會要求 Worker 立即重新抓 Hyperliquid 並更新 KV。

## 台灣時間排程
08:00、12:00、16:00、20:00、21:00、22:00、23:00、00:00、01:00、04:00。
Cloudflare Cron（UTC）：`0 0,4,8,12,13,14,15,16,17,20 * * *`

## Cloudflare 設定
1. Workers & Pages → Create application → 建立 Worker，名稱可用 `whale-swing-radar`。
2. 將 `cloudflare-worker/worker.js` 貼入 Worker 程式碼並部署。
3. 建立 KV namespace（例如 `whale-swing-radar-data`）。
4. Worker → Settings → Bindings → Add → KV namespace，Variable name 必須填 `WHALE_DATA`，選剛建立的 namespace。
5. Worker → Triggers / Cron Triggers 新增：`0 0,4,8,12,13,14,15,16,17,20 * * *`。
6. 取得 Worker 的 `https://...workers.dev` 網址。
7. 編輯 GitHub 專案根目錄 `config.js`，把 `workerUrl` 改成你的 Worker 網址。
8. 上傳 `index.html / style.css / app.js / config.js` 到 GitHub Pages。

## 注意
Whale Position % 是「目前名目持倉 ÷ Worker 從啟用後觀測到的該標的最大名目持倉」，不是價格上漲機率。初次啟用時目前持倉自然會是 100%，之後累積歷史才會形成有意義的比例。
