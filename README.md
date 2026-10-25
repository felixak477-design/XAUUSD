# GoldMind AI V2 — Phone-friendly Vercel project

This replacement project is designed to be uploaded to GitHub and deployed on Vercel using a phone.

## Important truth about data
- `LIVE PROVIDER DATA` means candles came from Twelve Data using your API key. It does **not** mean the feed is your exact MT5 broker feed.
- `DEMO / SYNTHETIC` is generated example data and is never labelled live.
- The app defaults to no demo fallback. If the provider errors or lacks XAU/USD intraday support on your plan, it displays an error instead of fake live prices.
- XAU/USD data availability, real-time status, history, and API credits depend on the data provider's current plan. Confirm your plan supports the `XAU/USD` symbol and intraday intervals before relying on it.
- This is analysis only. No orders are sent to MT5 or any broker.

## Files
- `public/index.html` — responsive phone dashboard
- `api/analyze.js` — serverless API endpoint, keeps API key on server
- `api/health.js` — checks server-side configuration without exposing the key
- `vercel.json` — routing/config
- `.env.example` — environment variable template

## Deploy from your phone
1. Create/sign in to GitHub and create a new repository, e.g. `goldmind-xauusd-v2`.
2. Upload the contents of this folder to the repository (the `public`, `api`, `vercel.json`, and README must be at the repository root).
3. Create/sign in to Twelve Data and generate an API key. Check your account plan supports intraday XAU/USD data and the request volume you need.
4. In Vercel, import the GitHub repository.
5. In Vercel Project Settings → Environment Variables, add:
   - `TWELVE_DATA_API_KEY` = your private key
   - `DATA_MODE` = `live`
   - `SYMBOL` = `XAU/USD`
6. Redeploy after adding environment variables.
7. Open the public Vercel URL. In the dashboard, the badge should say `LIVE PROVIDER DATA` only after a successful provider response. The health panel will explain missing configuration/errors.

## Demo mode
Set `DATA_MODE=demo` in Vercel Environment Variables and redeploy. The app will show `DEMO / SYNTHETIC` visibly. Never treat demo candles as real prices.

## Timeframes and analysis
- 5m, 15m, 30m, 1H, 4H are requested from provider-supported intervals.
- 39m is resampled from 1-minute candles, if the provider returns enough M1 history.
- Indicators: EMA20, EMA50, RSI14, ATR14, support/resistance.
- Signal rules: BUY BIAS if EMA20 > EMA50, close > EMA20 and RSI 50–68; SELL BIAS if EMA20 < EMA50, close < EMA20 and RSI 32–50; otherwise WAIT.
- For qualifying signals only: entry = latest closed candle close; SL = 1.5 × ATR; TP1 = 1 × ATR; TP2 = 2 × ATR.
- Levels are technical study points, not predictions or guarantees. Backtest and paper trade first.

## Security
Never put `TWELVE_DATA_API_KEY` in `public/index.html`, a GitHub commit, or any client-side code. Keep it only in Vercel Environment Variables. Avoid sharing screenshots that reveal it.
