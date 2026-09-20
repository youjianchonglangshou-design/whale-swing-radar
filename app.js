const WALLET='0xd142479997958a4fefd1f8d5373b31ce36987d73';
const WORKER=(window.WHALE_HUD_CONFIG?.workerUrl||'').replace(/\/$/,'');
let positions=[], fills=[], peaks={}, filter='all';
let lastUpdatedAt=0;
let autoChecking=false;
wallet.textContent=WALLET;
const money=n=>{n=Number(n||0);const a=Math.abs(n);return (n<0?'-$':'$')+(a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(1)+'K':a.toFixed(2))};
const num=n=>Math.abs(Number(n))>=1000?Number(n).toLocaleString(undefined,{maximumFractionDigits:2}):Number(n).toLocaleString(undefined,{maximumFractionDigits:5});
async function getData(force=false){
 if(!WORKER||WORKER.includes('YOUR-WORKER')) throw Error('請先在 config.js 填入 Cloudflare Worker 網址');
 const r=await fetch(WORKER+(force?'?refresh=1':''),{cache:'no-store'}); if(!r.ok) throw Error('Worker '+r.status); return r.json();
}
async function load(force=false){live.textContent=force?'UPDATING':'LOADING';cards.innerHTML='';try{
 const data=await getData(force); positions=data.positions||[];fills=data.fills||[];peaks=data.peaks||{};render();live.textContent='READY';
 lastUpdatedAt=Number(data.updatedAt||0);
 updated.textContent='DATA '+new Date(data.updatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 }catch(e){cards.innerHTML='<div class="error">'+e.message+'</div>';live.textContent='OFFLINE'}}
function fillAliases(p){return new Set([p.coin,p.key,p.dex==='core'?p.coin:p.dex+':'+p.coin])}
function actionOfEvent(e){
 const d=String(e.dir||'').toLowerCase(), sp=Number(e.startPosition||0), sz=Math.abs(Number(e.sz||0));
 const eps=Math.max(1e-12,sz*1e-8);
 if(d.includes('open long')) return sp>eps?'➕ 加倉 LONG':'🟢 建倉 LONG';
 if(d.includes('open short')) return sp<-eps?'➕ 加倉 SHORT':'🔴 建倉 SHORT';
 if(d.includes('close long')) return Math.abs(sp-sz)<=eps?'⏹ 平倉 LONG':'➖ 減倉 LONG';
 if(d.includes('close short')) return Math.abs(sp+sz)<=eps?'⏹ 平倉 SHORT':'➖ 減倉 SHORT';
 return e.side==='B'?'買入':'賣出';
}
function aggregateEvents(raw){
 const groups=new Map();
 [...raw].sort((a,b)=>Number(a.time)-Number(b.time)).forEach(x=>{
  const t=Number(x.time||0), dir=x.dir||((x.side==='B')?'BUY':'SELL');
  const key=x.oid!=null?`oid:${x.oid}:${dir}`:`sec:${Math.floor(t/1000)}:${dir}`;
  let g=groups.get(key);
  if(!g){g={time:t,dir,side:x.side,oid:x.oid,startPosition:x.startPosition,sz:0,notional:0,closedPnl:0,fills:0};groups.set(key,g)}
  const z=Math.abs(Number(x.sz||0)), px=Number(x.px||0);
  g.time=Math.min(g.time,t);g.sz+=z;g.notional+=z*px;g.closedPnl+=Number(x.closedPnl||0);g.fills++;
 });
 return [...groups.values()].map(g=>({...g,px:g.sz?g.notional/g.sz:0,action:actionOfEvent(g)})).sort((a,b)=>b.time-a.time);
}
function holdingInfo(p,raw){
 const want=p.side==='LONG'?'open long':'open short';
 const hs=[...raw].sort((a,b)=>Number(a.time)-Number(b.time));
 let candidate=null, exact=false;
 for(const x of hs){
  const d=String(x.dir||'').toLowerCase(); if(!d.includes(want)) continue;
  const sp=Number(x.startPosition||0);
  if(Math.abs(sp)<1e-12){candidate=x;exact=true}
 }
 if(!candidate){candidate=hs.find(x=>String(x.dir||'').toLowerCase().includes(want))||null}
 if(!candidate)return {label:'-',since:'-'};
 const ms=Math.max(0,Date.now()-Number(candidate.time));
 const days=ms/86400000;
 const label=(exact?'':'≥ ')+(days<1?(ms/3600000).toFixed(1)+'h':days.toFixed(days<10?1:0)+'d');
 const since=new Date(Number(candidate.time)).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'});
 return {label,since};
}
function render(){let ps=positions.filter(p=>filter==='all'||(filter==='crypto'?p.dex==='core':p.dex!=='core'));count.textContent=positions.length;const total=positions.reduce((s,p)=>s+p.value,0),pnlv=positions.reduce((s,p)=>s+p.upnl,0),longs=positions.filter(p=>p.side==='LONG').reduce((s,p)=>s+p.value,0);notional.textContent=money(total);pnl.textContent=(pnlv>=0?'+':'')+money(pnlv);pnl.className=pnlv>=0?'long':'short';bias.textContent=Math.round(longs/Math.max(total,1)*100)+'% / '+Math.round((total-longs)/Math.max(total,1)*100)+'%';cards.innerHTML='';
 ps.sort((a,b)=>b.value-a.value).forEach(p=>{const n=cardTpl.content.cloneNode(true);n.querySelector('.asset').textContent=p.coin;n.querySelector('.market').textContent=p.dex==='core'?'CRYPTO':'HIP-3 · '+p.dex.toUpperCase();const side=n.querySelector('.side');side.textContent=p.side;side.classList.add(p.side==='LONG'?'long':'short');const conf=Math.min(100,Math.round(p.value/Math.max(peaks[p.key]||p.value,1)*100));n.querySelector('.meterfill').style.width=conf+'%';n.querySelector('.confidence').textContent='WHALE POSITION '+conf+'%';n.querySelector('.entry').textContent='$'+num(p.entry);n.querySelector('.mark').textContent='$'+num(p.mark);n.querySelector('.position').textContent=money(p.value);const u=n.querySelector('.upnl');u.textContent=(p.upnl>=0?'+':'')+money(p.upnl);u.classList.add(p.upnl>=0?'long':'short');n.querySelector('.size').textContent=num(p.size);n.querySelector('.lev').textContent=p.lev==='-'?'-':p.lev+'x';
 const aliases=fillAliases(p), h=fills.filter(x=>aliases.has(x.coin));
 const hold=holdingInfo(p,h);n.querySelector('.holding').textContent=hold.label;n.querySelector('.since').textContent=hold.since;
 const events=aggregateEvents(h);
 n.querySelector('.history').innerHTML=events.slice(0,30).map(e=>{const cp=Number(e.closedPnl||0);return `<div class="fillrow"><span>${new Date(Number(e.time)).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</span> · <b>${e.action}</b> · AVG $${num(e.px)} × ${num(e.sz)} · ${money(e.notional)}${e.fills>1?` · ${e.fills} fills`:''}${cp?` · PnL <span class="${cp>=0?'long':'short'}">${cp>=0?'+':''}${money(cp)}</span>`:''}</div>`}).join('')||'目前沒有此標的近期成交';cards.appendChild(n)});if(!ps.length)cards.innerHTML='<div class="error">目前此分類沒有未平倉部位。</div>'}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()});
refresh.onclick=()=>load(true);

// 每 30 秒只讀 Cloudflare Worker 已保存的最新資料。
// 不會觸發 Hyperliquid refresh；只有 Cloudflare Cron / MANUAL UPDATE 才會真正抓新資料。
async function autoCheck(){
 if(autoChecking) return;
 autoChecking=true;
 try{
  const data=await getData(false);
  const nextUpdatedAt=Number(data.updatedAt||0);
  if(nextUpdatedAt && nextUpdatedAt!==lastUpdatedAt){
   positions=data.positions||[];
   fills=data.fills||[];
   peaks=data.peaks||{};
   lastUpdatedAt=nextUpdatedAt;
   render();
   live.textContent='READY';
   updated.textContent='DATA '+new Date(nextUpdatedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
  }
 }catch(e){
  // 自動檢查失敗時保留目前 HUD，不清空畫面；下一輪再重試。
  console.warn('Auto check failed:',e);
 }finally{autoChecking=false}
}

load(false);
setInterval(autoCheck,30000);
