Whale Swing Radar HUD 自動更新版

只需覆蓋 GitHub 專案根目錄的 app.js。
Cloudflare Worker / KV / Cron 不需修改。

行為：
- 開頁立即讀一次資料
- 每 30 秒讀一次 Worker 已保存資料
- updatedAt 沒變：HUD 不重繪
- updatedAt 有變：自動更新 HUD
- MANUAL UPDATE 保留，仍可立即觸發 Worker refresh
