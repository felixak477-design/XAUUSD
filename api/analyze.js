const CACHE = globalThis.__goldmindCache || (globalThis.__goldmindCache = new Map());
const CACHE_TTL = 60 * 1000;
function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
function ema(values, period) {
  if (values.length < period) return null;
  let v = values.slice(0, period).reduce((a,b)=>a+b,0)/period;
  const k = 2/(period+1);
  for (let i=period;i<values.length;i++) v=values[i]*k+v*(1-k);
  return v;
}
function rsi(values, period=14) {
  if(values.length<=period) return null;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>=0)gain+=d;else loss-=d;}
  gain/=period;loss/=period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;}
  if(loss===0)return 100;
  return 100-(100/(1+gain/loss));
}
function atr(candles,period=14){
  if(candles.length<period+1)return null;
  const trs=[];
  for(let i=1;i<candles.length;i++){const c=candles[i],p=candles[i-1];trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
  return trs.slice(-period).reduce((a,b)=>a+b,0)/period;
}
module.exports = async (req,res) => {
  if(req.method!=='GET') return json(res,405,{ok:false,error:'Use GET.'});
  const apiKey=process.env.TWELVE_DATA_API_KEY;
  if(!apiKey) return json(res,503,{ok:false,error:'TWELVE_DATA_API_KEY is missing in Vercel Environment Variables.'});
  if(process.env.DATA_MODE && process.env.DATA_MODE!=='live') return json(res,503,{ok:false,error:'Live data mode is disabled. Set DATA_MODE=live after configuring a valid API key.'});
  const interval=String(req.query.interval||'15min');
  if(!['1min','5min','15min','30min','1h','4h','1day'].includes(interval)) return json(res,400,{ok:false,error:'Unsupported interval.'});
  const symbol=process.env.SYMBOL||'XAU/USD';
  const key=`${symbol}:${interval}`;
  const cached=CACHE.get(key);
  if(cached && Date.now()-cached.savedAt<CACHE_TTL) return json(res,200,{...cached.data,cache:'server'});
  const url=new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol',symbol);url.searchParams.set('interval',interval);url.searchParams.set('outputsize','100');url.searchParams.set('apikey',apiKey);
  try {
    const upstream=await fetch(url.toString(),{headers:{Accept:'application/json'}});
    const payload=await upstream.json();
    if(!upstream.ok || payload.status==='error' || payload.code || !Array.isArray(payload.values)){
      const msg=payload.message||payload.description||`Twelve Data request failed (${upstream.status}).`;
      const isLimit=/credit|limit|api key|subscription|permission/i.test(msg);
      return json(res,isLimit?429:502,{ok:false,error:`Twelve Data: ${msg}`,code:payload.code||null,source:'Twelve Data',retryAfterSeconds:60});
    }
    const candles=payload.values.map(v=>({time:v.datetime,open:num(v.open),high:num(v.high),low:num(v.low),close:num(v.close)}))
      .filter(c=>c.time && [c.open,c.high,c.low,c.close].every(Number.isFinite)).reverse();
    if(candles.length<55) return json(res,502,{ok:false,error:'Provider returned too few valid candles for indicator analysis.'});
    const closes=candles.map(c=>c.close), last=candles[candles.length-1], e20=ema(closes,20),e50=ema(closes,50),r=rsi(closes),a=atr(candles);
    const highs=candles.slice(-20).map(c=>c.high),lows=candles.slice(-20).map(c=>c.low);
    const support=Math.min(...lows),resistance=Math.max(...highs),price=last.close;
    let bias='NEUTRAL';
    if(e20>e50 && price>e20)bias='BULLISH';
    else if(e20<e50 && price<e20)bias='BEARISH';
    // Conservative confirmation: candle direction + trend + RSI; otherwise WAIT.
    const prev=candles[candles.length-2];
    let signal='WAIT',reason='No fully aligned setup; wait for confirmation.';
    if(bias==='BULLISH' && last.close>last.open && r>=50 && r<70 && last.close>prev.high){signal='BUY';reason='Bullish trend, RSI confirmation and close above prior candle high.';}
    else if(bias==='BEARISH' && last.close<last.open && r<=50 && r>30 && last.close<prev.low){signal='SELL';reason='Bearish trend, RSI confirmation and close below prior candle low.';}
    const risk=Math.max(a||0,Math.abs(price)*0.0005);
    const sl=signal==='BUY'?price-risk:signal==='SELL'?price+risk:null;
    const tp1=signal==='BUY'?price+risk:signal==='SELL'?price-risk:null;
    const tp2=signal==='BUY'?price+2*risk:signal==='SELL'?price-2*risk:null;
    const data={ok:true,source:'Twelve Data',symbol,interval,updatedAt:new Date().toISOString(),candleTime:last.time,price,bias,signal,reason,
      rsi:r,ema20:e20,ema50:e50,atr:a,support,resistance,entry:signal==='WAIT'?null:price,sl,tp1,tp2,candles};
    CACHE.set(key,{savedAt:Date.now(),data});
    return json(res,200,data);
  } catch(e) {
    return json(res,502,{ok:false,error:`Unable to reach Twelve Data: ${e.message||'network error'}`});
  }
};