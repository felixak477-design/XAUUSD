# GOLDMIND AI V4 — LAMIC FX

A complete starter deployment for an XAU/USD candlestick analysis dashboard. The home page carries **LAMIC FX** branding in the footer; this is a text/monogram brand treatment, not a separate logo image.

## Vercel deployment

1. Download this ZIP and inspect its contents.
2. Upload/commit the project files into your existing GitHub repository. Do not delete your existing project blindly; make a backup/branch first and compare the file structure.
3. In Vercel, open the project connected to that repository and add the environment variable `TWELVEDATA_API_KEY` using your Twelve Data API key. Add it to the Production environment (and Preview if needed). Never place the key in browser code or commit it to GitHub.
4. Redeploy after setting the variable.
5. Visit `/api/market?interval=15min` on the deployed site. A successful response should include `source`, `fetchedAt`, and `candles`. If it returns an error, use the provider message to diagnose key permissions, credits, or symbol support.

## Important provider notes

- This implementation expects Twelve Data to support the `XAU/USD` symbol for the user's plan/API key. Availability and credits depend on the provider account. If the provider does not support this symbol for the key, change the symbol/provider in `api/market.js` to a data source you are authorized to use.
- Data is fetched server-side. A 20-second in-memory cache reduces API calls, but serverless instances may have separate caches.
- The client checks timestamp ordering, future timestamps, candle age, response timestamp, and OHLC numeric validity. On any validation error it displays `STALE / UNVERIFIED` and disables signals.
- Market providers can return the latest *completed* candle rather than a tick-by-tick live price. The dashboard therefore reports the candle time and age rather than claiming the quote is tick-live.
- BUY/SELL are basic educational EMA/candle conditions, not a guarantee of profitable trades. This app does not execute trades or connect to a Deriv account. Do not use signals as financial advice.
- If the build fails because of a Vercel runtime setting, remove the explicit `functions` runtime line from `vercel.json` and let Vercel select the Node runtime automatically.
