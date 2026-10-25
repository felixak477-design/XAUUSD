# GoldMind AI V2 — corrected Vercel structure

This replacement uses the required Vercel layout:
- `api/analyze.js` — Twelve Data candle request and indicator calculations
- `api/health.js` — safe API configuration health check (does not reveal the API key)
- `public/index.html` — phone-friendly dashboard
- `vercel.json` — minimal config; no unmatched `functions` glob or API rewrites

## Vercel environment variables
Set these in Project Settings → Environment Variables:
- `TWELVE_DATA_API_KEY` = your actual Twelve Data API key
- `DATA_MODE` = `live`
- `SYMBOL` = `XAU/USD`

Redeploy after changing environment variables. Do not put the API key in frontend code or share it publicly.

## Check after deployment
- `/api/health` should return JSON with `ok: true` and `hasApiKey: true`.
- `/api/analyze?timeframe=15` should return JSON with `ok: true` and a live price, or a clear provider error.

The app does not execute trades. The analysis is informational and must be checked against the user's broker feed. Provider symbols, account plans and rate limits may affect data access.
