module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({ ok: true, service: 'GoldMind AI API', timestamp: new Date().toISOString(), hasApiKey: Boolean(process.env.TWELVE_DATA_API_KEY), dataMode: process.env.DATA_MODE || 'not_set', symbol: process.env.SYMBOL || 'not_set' });
};
