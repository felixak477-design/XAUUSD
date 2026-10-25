const MODES = ["5min","15min","30min","1h","4h"];
const TF = {
  "5": { label:"5m", interval:"5min", minutes:5 },
  "15": { label:"15m", interval:"15min", minutes:15 },
  "30": { label:"30m", interval:"30min", minutes:30 },
  "39": { label:"39m", interval:"1min", minutes:39 },
  "60": { label:"1H", interval:"1h", minutes:60 },
  "240": { label:"4H", interval:"4h", minutes:240 }
};
function ema(a, n) {
  const k=2/(n+1); let v=a[0]; const out=[];
  for (let i=0;i<a.length;i++){v=i===0?a[i]:a[i]*k+v*(1-k);out.push(v);}
  return out;
}
function indicators(c) {
  const closes=c.map(x=>x.close), e20=ema(closes,20), e50=ema(closes,50);
  let g=0,l=0; const rsi=closes.map((v,i)=>{
    if(i===0)return 50; const d=v-closes[i-1], gain=Math.max(d,0), loss=Math.max(-d,0);
    if(i===1){g=gain;l=loss;}else{g=(g*13+gain)/14;l=(l*13+loss)/14;}
    return l===0?100:100-100/(1+g/l);
  });
  const atrs=[]; let atr=0;
  c.forEach((v,i)=>{const pc=i?c[i-1].close:v.close;const tr=Math.max(v.high-v.low,Math.abs(v.high-pc),Math.abs(v.low-pc));atr=i===0?tr:(atr*13+tr)/14;atrs.push(atr);});
  return {e20,e50,rsi,atrs};
}
function resample39(rows) {
  const buckets=new Map();
  for (const x of rows) {
    const ms=Date.parse(x.datetime+"Z");
    if(!Number.isFinite(ms))continue;
    const start=Math.floor(ms/(39*60000))*(39*60000);
    const key=new Date(start).toISOString();
    if(!buckets.has(key))buckets.set(key,{time:key,open:x.open,high:x.high,low:x.low,close:x.close});
    else {const b=buckets.get(key);b.high=Math.max(b.high,x.high);b.low=Math.min(b.low,x.low);b.close=x.close;}
  }
  return [...buckets.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
}
async function providerCandles(tf) {
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key)throw new Error("Missing TWELVE_DATA_API_KEY. Add it in Vercel → Project Settings → Environment Variables, then redeploy.");
  const symbol=process.env.SYMBOL||"XAU/USD";
  const interval=TF[tf].interval;
  const url=new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol",symbol);url.searchParams.set("interval",interval);
  url.searchParams.set("outputsize",tf==="39"?"500":"250");url.searchParams.set("timezone","UTC");url.searchParams.set("order","ASC");url.searchParams.set("apikey",key);
  const response=await fetch(url.toString(),{headers:{"Accept":"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error("Market data provider HTTP error "+response.status+".");
  const j=await response.json();
  if(j.status==="error"||!Array.isArray(j.values))throw new Error(j.message||j.code||"Provider did not return candles. Check XAU/USD support, plan limits and API credits.");
  let rows=j.values.map(v=>({time:new Date(v.datetime.replace(" ","T")+"Z").toISOString(),open:+v.open,high:+v.high,low:+v.low,close:+v.close})).filter(v=>Object.values(v).every((x,i)=>i===0||Number.isFinite(x))).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  if(tf==="39")rows=resample39(j.values.map(v=>({datetime:v.datetime,open:+v.open,high:+v.high,low:+v.low,close:+v.close})));
  // Exclude latest candle because it may still be forming.
  rows=rows.slice(0,-1);
  if(rows.length<60)throw new Error("Provider returned too few closed candles for stable indicators. Check data plan/history.");
  return {rows,mode:"LIVE PROVIDER DATA",symbol};
}
function demoCandles(tf) {
  let seed=8901+Number(tf), p=3300;const rows=[];const minutes=TF[tf].minutes;
  for(let i=0;i<180;i++){seed=(seed*9301+49297)%233280;let r=seed/233280;let o=p;p+=((r-.49)*Math.sqrt(minutes)*.24);let c=p;seed=(seed*9301+49297)%233280;r=seed/233280;rows.push({time:new Date(Date.now()-(180-i)*minutes*60000).toISOString(),open:o,high:Math.max(o,c)+r*.5,low:Math.min(o,c)-r*.5,close:c});}
  return rows;
}
function buildAnalysis(rows, tf, mode, symbol) {
  const {e20,e50,rsi,atrs}=indicators(rows);const i=rows.length-1,v=rows[i],close=v.close,atr=atrs[i],rv=rsi[i];
  const bull=e20[i]>e50[i]&&close>e20[i],bear=e20[i]<e50[i]&&close<e20[i];
  const signal=bull&&rv>=50&&rv<=68?"BUY BIAS":bear&&rv>=32&&rv<=50?"SELL BIAS":"WAIT";
  const score=Math.max(20,Math.min(95,Math.round(45+Math.abs(e20[i]-e50[i])/Math.max(atr,.0001)*15+Math.abs(rv-50)*.45)));
  let entry=null,sl=null,tp1=null,tp2=null;
  if(signal==="BUY BIAS"){entry=close;sl=close-1.5*atr;tp1=close+atr;tp2=close+2*atr;}
  if(signal==="SELL BIAS"){entry=close;sl=close+1.5*atr;tp1=close-atr;tp2=close-2*atr;}
  const now=Date.now(), age=Math.max(0,Math.floor((now-Date.parse(v.time))/1000));
  const fresh=age<=Math.max(300,TF[tf].minutes*120);
  return {timeframe:tf,label:TF[tf].label,mode,symbol,price:close,trend:bull?"BULLISH":bear?"BEARISH":"MIXED",signal:mode==="LIVE PROVIDER DATA"&&!fresh?"WAIT":signal,score,rsi:rv,atr,ema20:e20[i],ema50:e50[i],support:Math.min(...rows.slice(-30).map(x=>x.low)),resistance:Math.max(...rows.slice(-30).map(x=>x.high)),entry:signal!=="WAIT"&&fresh?entry:null,stop_loss:signal!=="WAIT"&&fresh?sl:null,take_profit_1:signal!=="WAIT"&&fresh?tp1:null,take_profit_2:signal!=="WAIT"&&fresh?tp2:null,last_candle_utc:v.time,data_age_seconds:age,data_fresh:fresh,candles:rows.slice(-90),warning:mode==="DEMO / SYNTHETIC"?"Synthetic sample only. Not live market data.":!fresh?"Latest candle is stale; signal levels are suppressed.":"Provider data may differ from your MT5 broker feed.",method:"EMA20/50 + RSI14 + ATR14"};
}
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, max-age=0");
  if(req.method!=="GET"){res.status(405).json({error:"GET only"});return;}
  const tf=String(req.query.timeframe||"15");
  if(tf==="multi"){
    const results=[],errors=[];
    for(const t of Object.keys(TF)){try{results.push(await getAnalysis(t));}catch(e){errors.push({timeframe:t,label:TF[t].label,error:e.message});}}
    res.status(200).json({mode:process.env.DATA_MODE==="demo"?"DEMO / SYNTHETIC":"LIVE PROVIDER DATA",rows:results.map(x=>({timeframe:x.timeframe,label:x.label,mode:x.mode,price:x.price,signal:x.signal,trend:x.trend,rsi:x.rsi,score:x.score,data_age_seconds:x.data_age_seconds,data_fresh:x.data_fresh})),errors});return;
  }
  if(!TF[tf]){res.status(400).json({error:"Use timeframe 5, 15, 30, 39, 60, 240 or multi."});return;}
  try{res.status(200).json(await getAnalysis(tf));}catch(e){res.status(503).json({error:e.message,mode:process.env.DATA_MODE==="demo"?"DEMO / SYNTHETIC":"UNAVAILABLE — NOT LIVE"});}
}
async function getAnalysis(tf) {
  const demo=process.env.DATA_MODE==="demo";
  if(demo)return buildAnalysis(demoCandles(tf),tf,"DEMO / SYNTHETIC","SYNTHETIC XAUUSD");
  const {rows,mode,symbol}=await providerCandles(tf);
  return buildAnalysis(rows,tf,mode,symbol);
}
