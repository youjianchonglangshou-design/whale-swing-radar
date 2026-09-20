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
function eventDirection(e){
 const d=String(e.dir||'').toLowerCase();
 if(d.includes('long')) return 'LONG';
 if(d.includes('short')) return 'SHORT';
 return null;
}
function eventKind(e){
 const d=String(e.dir||'').toLowerCase();
 if(d.includes('open')) return 'open';
 if(d.includes('close')) return 'close';
 return 'trade';
}
// Hyperliquid 常把一張大單拆成數十/數百個 fills。
// HUD 以「執行波」呈現：同標的、同方向/動作，前後成交間隔 <= 5 分鐘就合成一個事件。
function aggregateEvents(raw){
 const xs=[...raw].sort((a,b)=>Number(a.time)-Number(b.time));
 const out=[];
 const MAX_GAP=5*60*1000;
 for(const x of xs){
  const t=Number(x.time||0), dir=String(x.dir||((x.side==='B')?'BUY':'SELL'));
  const z=Math.abs(Number(x.sz||0)), px=Number(x.px||0);
  let g=out[out.length-1];
  const same=g && String(g.dir).toLowerCase()===dir.toLowerCase() && t-g.lastTime<=MAX_GAP;
  if(!same){
   g={time:t,lastTime:t,dir,side:x.side,startPosition:Number(x.startPosition||0),sz:0,notional:0,closedPnl:0,fills:0};
   out.push(g);
  }
  g.lastTime=t; g.sz+=z; g.notional+=z*px; g.closedPnl+=Number(x.closedPnl||0); g.fills++;
 }
 return out.map(g=>({...g,px:g.sz?g.notional/g.sz:0}));
}
function endPosition(e){
 const sp=Number(e.startPosition||0), z=Math.abs(Number(e.sz||0)), d=String(e.dir||'').toLowerCase();
 if(d.includes('open long')) return sp+z;
 if(d.includes('close long')) return sp-z;
 if(d.includes('open short')) return sp-z;
 if(d.includes('close short')) return sp+z;
 return sp;
}
function currentCycleEvents(p,raw){
 const all=aggregateEvents(raw);
 if(!all.length) return [];
 const side=p.side;
 const opens=all.map((e,i)=>({e,i})).filter(x=>eventKind(x.e)==='open'&&eventDirection(x.e)===side);
 if(!opens.length) return all;
 // 找目前這一輪倉位最後一次「由接近 0 開始」的位置；若 API 歷史被截斷，就用可見的第一個開倉波。
 let start=opens[0].i;
 for(const x of opens){
  const tol=Math.max(1e-9,Math.abs(Number(x.e.sz||0))*1e-8);
  if(Math.abs(Number(x.e.startPosition||0))<=tol) start=x.i;
 }
 return all.slice(start);
}
function actionOfCycleEvent(e,index,p){
 const kind=eventKind(e), dir=eventDirection(e), side=p.side;
 if(index===0 && kind==='open' && dir===side) return side==='LONG'?'🟢 建倉 LONG':'🔴 建倉 SHORT';
 if(kind==='open' && dir===side) return `➕ 加倉 ${side}`;
 if(kind==='close' && dir===side){
  const ep=endPosition(e), tol=Math.max(1e-9,Math.abs(Number(e.sz||0))*1e-8);
  return Math.abs(ep)<=tol?`⏹ 平倉 ${side}`:`➖ 減倉 ${side}`;
 }
 if(kind==='open') return `🔄 反向開倉 ${dir||''}`.trim();
 if(kind==='close') return `➖ 平/減倉 ${dir||''}`.trim();
 return e.side==='B'?'買入':'賣出';
}
function holdingInfo(p,events){
 if(!events.length)return {label:'-',since:'-'};
 const candidate=events[0];
 const ms=Math.max(0,Date.now()-Number(candidate.time));
 const days=ms/86400000;
 const label=days<1?(ms/3600000).toFixed(1)+'h':days.toFixed(days<10?1:0)+'d';
 const since=new Date(Number(candidate.time)).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'});
 return {label,since};
}
function render(){let ps=positions.filter(p=>filter==='all'||(filter==='crypto'?p.dex==='core':p.dex!=='core'));count.textContent=positions.length;const total=positions.reduce((s,p)=>s+p.value,0),pnlv=positions.reduce((s,p)=>s+p.upnl,0),longs=positions.filter(p=>p.side==='LONG').reduce((s,p)=>s+p.value,0);notional.textContent=money(total);pnl.textContent=(pnlv>=0?'+':'')+money(pnlv);pnl.className=pnlv>=0?'long':'short';bias.textContent=Math.round(longs/Math.max(total,1)*100)+'% / '+Math.round((total-longs)/Math.max(total,1)*100)+'%';cards.innerHTML='';
 ps.sort((a,b)=>b.value-a.value).forEach(p=>{const n=cardTpl.content.cloneNode(true);n.querySelector('.asset').textContent=p.coin;n.querySelector('.market').textContent=p.dex==='core'?'CRYPTO':'HIP-3 · '+p.dex.toUpperCase();const side=n.querySelector('.side');side.textContent=p.side;side.classList.add(p.side==='LONG'?'long':'short');const conf=Math.min(100,Math.round(p.value/Math.max(peaks[p.key]||p.value,1)*100));n.querySelector('.meterfill').style.width=conf+'%';n.querySelector('.confidence').textContent='WHALE POSITION '+conf+'%';n.querySelector('.entry').textContent='$'+num(p.entry);n.querySelector('.mark').textContent='$'+num(p.mark);n.querySelector('.position').textContent=money(p.value);const u=n.querySelector('.upnl');u.textContent=(p.upnl>=0?'+':'')+money(p.upnl);u.classList.add(p.upnl>=0?'long':'short');n.querySelector('.size').textContent=num(p.size);n.querySelector('.lev').textContent=p.lev==='-'?'-':p.lev+'x';
 const aliases=fillAliases(p), h=fills.filter(x=>aliases.has(x.coin));
 const cycle=currentCycleEvents(p,h);
 const hold=holdingInfo(p,cycle);n.querySelector('.holding').textContent=hold.label;n.querySelector('.since').textContent=hold.since;
 const events=[...cycle].reverse();
 n.querySelector('.history').innerHTML=events.slice(0,30).map((e,revIndex)=>{const chronologicalIndex=cycle.length-1-revIndex;const action=actionOfCycleEvent(e,chronologicalIndex,p);const cp=Number(e.closedPnl||0);return `<div class="fillrow"><span>${new Date(Number(e.time)).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</span> · <b>${action}</b> · AVG $${num(e.px)} × ${num(e.sz)} · ${money(e.notional)}${e.fills>1?` · ${e.fills} fills`:''}${cp?` · PnL <span class="${cp>=0?'long':'short'}">${cp>=0?'+':''}${money(cp)}</span>`:''}</div>`}).join('')||'目前沒有此標的近期成交';cards.appendChild(n)});if(!ps.length)cards.innerHTML='<div class="error">目前此分類沒有未平倉部位。</div>'}
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
