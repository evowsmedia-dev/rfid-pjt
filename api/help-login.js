const {
  createHelpSessionCookie,
  passwordHash,
  readHelpStore
} = require('./_help');
const { json, readJsonBody } = require('./_shared');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const payload = await readJsonBody(req);
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '');
    if (!username || !password) return json(res, 400, { error: 'Vui lòng nhập tài khoản và mật khẩu.' });

    const { data } = await readHelpStore();
    const user = data.users.find((item) => item.active !== false && String(item.username || '').toLowerCase() === username);
    if (!user || user.passwordHash !== passwordHash(password)) return json(res, 401, { error: 'Sai tài khoản hoặc mật khẩu.' });

    const tenant = data.tenants.find((item) => item.id === user.tenantId && item.active !== false);
    if (!tenant) return json(res, 403, { error: 'Tenant chưa được kích hoạt.' });

    res.setHeader('Set-Cookie', createHelpSessionCookie(req, user));
    return json(res, 200, {
      ok: true,
      user: {
        userId: user.username,
        displayName: user.displayName || user.username,
        tenantId: user.tenantId,
        tenantName: tenant.name,
        role: user.role || 'viewer'
      }
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
