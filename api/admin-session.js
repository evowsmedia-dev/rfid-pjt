const { getSession, json } = require('./_shared');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const session = getSession(req);
  return json(res, 200, {
    authenticated: Boolean(session),
    expiresAt: session ? new Date(session.exp * 1000).toISOString() : null
  });
};
