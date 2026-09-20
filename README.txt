Whale Swing Radar v0.2.1 hotfix

GitHub 只需覆蓋：
cloudflare-worker/worker.js

修正：
1. 優先使用 WHALE_DATA KV binding。
2. 相容舊 WHALE_KV binding。
3. 若 GitHub/Wrangler 部署暫時沒有帶入 KV binding，不再直接 Worker 500；HUD 會改成即時向 Hyperliquid 取資料。
4. /、/api/data 都可正常回傳同一份資料。
5. ?refresh=1 保留手動更新。

注意：要讓 Cron 真正把快照保存到 KV，Cloudflare Worker 的 KV binding 仍應存在，名稱建議 WHALE_DATA。
