const json = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
};

function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) value = values[i] * k + value * (1 - k);
  return value;
}
function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = values[i] - values[i - 1]; if (d >= 0) gains += d; else losses -= d; }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) { const d = values[i] - values[i - 1]; avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period; }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function round(v) { return Number.isFinite(v) ? Number(v.toFixed(2)) : null; }

module.exports = async function handler(req, res) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const symbol = process.env.SYMBOL || 'XAU/USD';
  if ((process.env.DATA_MODE || 'live').toLowerCase() !== 'live') return json(res, 503, { ok: false, error: 'DATA_MODE is not live. Set DATA_MODE=live in Vercel.' });
  if (!apiKey) return json(res, 500, { ok: false, error: 'Missing TWELVE_DATA_API_KEY environment variable in Vercel.' });
  const allowed = { '1': '1min', '5': '5min', '15': '15min', '30': '30min', '60': '1h', '240': '4h' };
  const requested = String((req.query && req.query.timeframe) || '15');
  const interval = allowed[requested] || (['1min','5min','15min','30min','1h','4h'].includes(requested) ? requested : '15min');
  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', '100');
  url.searchParams.set('apikey', apiKey);
  try {
    const upstream = await fetch(url.toString(), { headers: { accept: 'application/json' } });
    const raw = await upstream.text();
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { return json(res, 502, { ok: false, error: 'Market data provider returned a non-JSON response.', detail: raw.slice(0, 180) }); }
    if (!upstream.ok || payload.status === 'error' || payload.code || !Array.isArray(payload.values)) {
      const msg = payload.message || payload.error || `Provider HTTP ${upstream.status}`;
      return json(res, upstream.status === 429 ? 429 : 502, { ok: false, error: 'Twelve Data could not provide candles.', detail: msg, providerCode: payload.code || null, symbol, interval });
    }
    const candles = payload.values.map(v => ({ time: v.datetime, open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close) })).filter(c => [c.open,c.high,c.low,c.close].every(Number.isFinite)).reverse();
    if (candles.length < 51) return json(res, 502, { ok: false, error: 'Not enough valid candles returned for analysis.', candlesReceived: candles.length });
    const closes = candles.map(c => c.close);
    const e20 = ema(closes, 20), e50 = ema(closes, 50), r = rsi(closes, 14);
    const ranges = candles.slice(1).map((c, i) => Math.max(c.high-c.low, Math.abs(c.high-candles[i].close), Math.abs(c.low-candles[i].close)));
    const atr = ranges.length >= 14 ? ranges.slice(-14).reduce((a,b)=>a+b,0)/14 : null;
    const price = closes[closes.length - 1];
    const bias = e20 > e50 && price > e20 ? 'BULLISH' : e20 < e50 && price < e20 ? 'BEARISH' : 'NEUTRAL';
    const recent = candles.slice(-30);
    const support = Math.min(...recent.map(c=>c.low));
    const resistance = Math.max(...recent.map(c=>c.high));
    const entry = price;
    const sl = bias === 'BULLISH' ? entry - (atr || 0) * 1.5 : bias === 'BEARISH' ? entry + (atr || 0) * 1.5 : null;
    const tp1 = bias === 'BULLISH' ? entry + (atr || 0) * 1.5 : bias === 'BEARISH' ? entry - (atr || 0) * 1.5 : null;
    const tp2 = bias === 'BULLISH' ? entry + (atr || 0) * 2.5 : bias === 'BEARISH' ? entry - (atr || 0) * 2.5 : null;
    return json(res, 200, { ok: true, source: 'Twelve Data', symbol, interval, updatedAt: new Date().toISOString(), candleTime: candles[candles.length-1].time, price: round(price), bias, rsi: round(r), ema20: round(e20), ema50: round(e50), atr: round(atr), support: round(support), resistance: round(resistance), entry: round(entry), stopLoss: round(sl), takeProfit1: round(tp1), takeProfit2: round(tp2), candles: candles.slice(-50) });
  } catch (e) {
    return json(res, 502, { ok: false, error: 'Could not connect to Twelve Data.', detail: String(e && e.message || e) });
  }
};
