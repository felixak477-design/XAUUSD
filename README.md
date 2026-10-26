# GOLDMIND AI V4 — Complete Replacement Package

## Included
- Mobile-friendly dashboard with candlestick chart.
- EMA 20 / EMA 50 overlays.
- Rule-based BUY / SELL / WAIT signal, entry reference, stop-loss, two take-profit levels, support and resistance.
- `/api/analyze` endpoint using Twelve Data.
- `/api/health` endpoint.
- 60-second in-memory server cache and a browser cache that marks cached data as stale.
- API errors are displayed; stale/cached values never enable entry signals.

## Deploy safely without deleting the current project
1. Download and extract this ZIP.
2. In your existing `felixak477-design/Lamivfx` GitHub repository, add/replace the files to match this folder structure. Do not delete the repository or unrelated files.
3. Important: `analyze.js` and `health.js` belong inside the `api/` folder. The homepage is `index.html` at the repository root.
4. Commit changes to GitHub; Vercel should redeploy the connected project.
5. In Vercel → Project → Settings → Environment Variables, set `TWELVE_DATA_API_KEY` to your own Twelve Data key. Set `DATA_MODE` to `live` and `SYMBOL` to `XAU/USD` if those variables are used. Apply to Production and Preview as needed, then redeploy.
6. Check `https://YOUR-DOMAIN/api/health` and `https://YOUR-DOMAIN/api/analyze`.
7. Never put your API key in `index.html`, GitHub source, or screenshots.

## API credits and caching
The endpoint caches each symbol/timeframe for 60 seconds in a warm serverless instance. Browser-side cache avoids duplicate refresh requests for 60 seconds and labels those results stale. Serverless in-memory caching is best-effort, not a shared/global cache, and can reset between deployments/instances. A free plan can still reach its provider limit if other users or requests consume the same key. Do not poll this endpoint rapidly.

## Data freshness
The dashboard checks the last candle timestamp against a timeframe-specific age threshold. Market closure, provider delays, and instrument/session rules can make data old. When old or cached, the dashboard disables signal and entry levels. This check is a safeguard, not a guarantee of correct exchange data.

## Signal caveat
Signals are simple technical rules, not machine-learning predictions and not guarantees. The API's current price is the last candle close, not necessarily the executable broker bid/ask. Verify broker price, spread, market session, and position sizing. This app does not place trades.

## Licensing
Check Twelve Data's current plan and redistribution/display terms before showing market data to public users or monetizing the site. API availability alone does not establish redistribution permission.

## Existing project note
This is a replacement package, not a command to delete your GitHub project. Keep your existing repo and Vercel project. Compare the file paths first, then replace only the matching application files you intend to update.
