module.exports = (req,res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({ok:true,service:'GOLDMIND AI V4',apiKeyConfigured:Boolean(process.env.TWELVE_DATA_API_KEY),dataMode:process.env.DATA_MODE||'live'});
};