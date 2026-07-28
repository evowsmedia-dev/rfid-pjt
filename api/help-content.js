const {
  ensureTenantBuckets,
  findTenant,
  readHelpStore,
  requireHelpSession
} = require('./_help');
const { json } = require('./_shared');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    const session = requireHelpSession(req);
    const { data } = await readHelpStore();
    const tenant = findTenant(data, session.tenantId);
    if (!tenant || tenant.active === false) return json(res, 403, { error: 'Tenant chưa được kích hoạt.' });
    ensureTenantBuckets(data, session.tenantId);
    return json(res, 200, {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type || 'external'
      },
      user: {
        userId: session.userId,
        displayName: session.displayName,
        role: session.role || 'viewer'
      },
      modules: data.modules[session.tenantId],
      articles: data.articles[session.tenantId]
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
