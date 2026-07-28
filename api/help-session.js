const { getHelpSession, readHelpStore } = require('./_help');
const { json } = require('./_shared');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    const session = getHelpSession(req);
    if (!session) return json(res, 200, { authenticated: false });
    const { data } = await readHelpStore();
    const tenant = data.tenants.find((item) => item.id === session.tenantId);
    return json(res, 200, {
      authenticated: true,
      user: {
        userId: session.userId,
        displayName: session.displayName,
        tenantId: session.tenantId,
        tenantName: tenant ? tenant.name : session.tenantId,
        role: session.role || 'viewer'
      },
      expiresAt: new Date(session.exp * 1000).toISOString()
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
