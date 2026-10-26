// Vercel serverless function. Uses Twelve Data if TWELVEDATA_API_KEY is configured.
const cache = new Map();
const intervals = new Set(['1min','5min','15min','30min','1h','4h','1day']);
module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Access-Control-Allow-Origin','*');
  const interval = String(req.query.interval || '15min');
  if (!intervals.has(interval)) return res.status(400).json({error:'Unsupported timeframe.'});
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return res.status(503).json({error:'Missing TWELVEDATA_API_KEY environment variable in Vercel.'});
  const cacheKey = 'XAU/USD:'+interval;
  const now = Date.now(), hit = cache.get(cacheKey);
  // Short cache to reduce API credits; never label cached data as live and client still checks candle age.
  if (hit && now-hit.at < 20000) return res.status(200).json({...hit.payload, cache:'short-cache', fetchedAt:new Date(hit.at).toISOString()});
  try {
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol','XAU/USD'); url.searchParams.set('interval',interval);
    url.searchParams.set('outputsize','200'); url.searchParams.set('timezone','UTC'); url.searchParams.set('apikey',key);
    const upstream = await fetch(url.toString(), {headers:{'Accept':'application/json'}});
    const raw = await upstream.json();
    if (!upstream.ok || raw.status==='error' || !Array.isArray(raw.values)) {
      const msg = raw.message || raw.code || 'Market data provider did not return candle values.';
      return res.status(502).json({error:String(msg), providerStatus:raw.status || upstream.status});
    }
    const candles = raw.values.map(v => ({
      time: Math.floor(Date.parse(v.datetime.replace(' ','T')+'Z')/1000),
      open:Number(v.open), high:Number(v.high), low:Number(v.low), close:Number(v.close)
    })).reverse();
    if (candles.some(c=>!Number.isFinite(c.time)||![c.open,c.high,c.low,c.close].every(Number.isFinite)))
      return res.status(502).json({error:'Provider returned invalid or unparseable timestamps/prices.'});
    const payload = {source:'Twelve Data · XAU/USD',fetchedAt:new Date(now).toISOString(),candles};
    cache.set(cacheKey,{at:now,payload});
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(502).json({error:'Market data provider request failed. Check deployment logs and provider access.'});
  }
};
