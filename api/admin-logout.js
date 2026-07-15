const { clearSessionCookie, json } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  res.setHeader('Set-Cookie', clearSessionCookie(req));
  return json(res, 200, { ok: true });
};
