const WALLET='0xd142479997958a4fefd1f8d5373b31ce36987d73';
const HL='https://api.hyperliquid.xyz/info';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json;charset=UTF-8'};
async function post(body){const r=await fetch(HL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`Hyperliquid ${r.status}`);return r.json()}
async function snapshot(env){
 let dexes=[''];try{const d=await post({type:'perpDexs'});if(Array.isArray(d))dexes.push(...d.map(x=>x.name||x).filter(Boolean))}catch{} dexes=[...new Set([...dexes,'xyz'])];
 const states=await Promise.allSettled(dexes.map(d=>post({type:'clearinghouseState',user:WALLET,...(d?{dex:d}:{})}).then(s=>({d,s}))));
 const positions=[];for(const x of states){if(x.status!=='fulfilled')continue;const {d,s}=x.value;for(const a of(s.assetPositions||[])){const p=a.position||a,sz=Number(p.szi||0);if(!sz)continue;const key=(d?d+':':'')+p.coin,value=Math.abs(Number(p.positionValue||0)),mark=value/Math.abs(sz);positions.push({key,coin:p.coin,dex:d||'core',side:sz>0?'LONG':'SHORT',size:sz,entry:Number(p.entryPx||0),mark,value,upnl:Number(p.unrealizedPnl||0),lev:p.leverage?.value||p.leverage||'-'})}}
 let fills=[];try{const f=await post({type:'userFills',user:WALLET});fills=Array.isArray(f)?f:[]}catch{}
 const kv=env.WHALE_DATA||env.WHALE_KV||null;
 let old={};
 if(kv){try{old=JSON.parse(await kv.get('latest')||'{}')}catch{old={}}}
 const peaks=old.peaks||{};for(const p of positions)peaks[p.key]=Math.max(Number(peaks[p.key]||0),p.value);
 const data={wallet:WALLET,updatedAt:Date.now(),positions,fills:fills.slice(0,2000),peaks};
 if(kv)await kv.put('latest',JSON.stringify(data));
 return data;
}
export default{
 async fetch(request,env){if(request.method==='OPTIONS')return new Response(null,{headers:cors});const u=new URL(request.url);try{const kv=env.WHALE_DATA||env.WHALE_KV||null;let data;if(u.searchParams.get('refresh')==='1')data=await snapshot(env);else if(kv){const raw=await kv.get('latest');data=raw?JSON.parse(raw):await snapshot(env)}else data=await snapshot(env);return new Response(JSON.stringify(data),{headers:cors})}catch(e){return new Response(JSON.stringify({error:e.message}),{status:500,headers:cors})}},
 async scheduled(controller,env,ctx){ctx.waitUntil(snapshot(env))}
};
