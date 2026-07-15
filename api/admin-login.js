const { adminPassword, createSessionCookie, json, readJsonBody } = require('./_shared');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const password = adminPassword();
    if (!password) return json(res, 500, { error: 'Missing ADMIN_PASSWORD or DOCS_EDIT_PASSWORD on Vercel.' });

    const payload = await readJsonBody(req);
    if (payload.password !== password) return json(res, 401, { error: 'Sai mật khẩu admin.' });

    res.setHeader('Set-Cookie', createSessionCookie(req));
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unknown error.' });
  }
};
