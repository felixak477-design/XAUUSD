export default function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({
    configured:!!process.env.TWELVE_DATA_API_KEY,
    mode:process.env.DATA_MODE==="demo"?"DEMO / SYNTHETIC":"LIVE PROVIDER DATA",
    symbol:process.env.SYMBOL||"XAU/USD",
    note:"LIVE PROVIDER DATA means an external provider response, not your exact MT5 broker feed. Check /api/analyze?timeframe=15 to validate actual candle retrieval."
  });
}
