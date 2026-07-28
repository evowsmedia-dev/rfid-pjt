const {
  ensureTenantBuckets,
  normalizeArticle,
  normalizeModule,
  readHelpStore,
  recomputeModuleCounts,
  safeText,
  tenantExists,
  writeHelpStore
} = require('./_help');
const { json, readJsonBody, requireAdmin } = require('./_shared');

function publicStore(store) {
  return {
    tenants: store.tenants,
    modules: store.modules,
    articles: store.articles,
    updatedAt: store.updatedAt
  };
}

function ensureModuleForArticle(store, tenantId, article) {
  ensureTenantBuckets(store, tenantId);
  const exists = store.modules[tenantId].some((module) => module.name === article.module);
  if (!exists) {
    store.modules[tenantId].push(normalizeModule({
      name: article.module,
      icon: article.platform === 'mobile' ? 'fa-mobile-screen-button' : 'fa-circle-question',
      desc: `Hướng dẫn ${article.module}`,
      count: 0
    }));
  }
}

module.exports = async function handler(req, res) {
  try {
    requireAdmin(req);
    if (req.method === 'GET') {
      const { data } = await readHelpStore();
      return json(res, 200, publicStore(data));
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

    const payload = await readJsonBody(req);
    const action = String(payload.action || 'saveArticle');
    const tenantId = safeText(payload.tenantId, 80);
    const { sha, data } = await readHelpStore();
    if (!tenantId || !tenantExists(data, tenantId)) return json(res, 400, { error: 'Tenant không hợp lệ.' });
    ensureTenantBuckets(data, tenantId);

    if (action === 'saveArticle') {
      const article = normalizeArticle(payload.article || {}, tenantId);
      ensureModuleForArticle(data, tenantId, article);
      const index = data.articles[tenantId].findIndex((item) => item.id === article.id);
      if (index === -1) data.articles[tenantId].push(article);
      else data.articles[tenantId][index] = article;
      recomputeModuleCounts(data, tenantId);
      await writeHelpStore(sha, data);
      return json(res, 200, { ok: true, article, store: publicStore(data) });
    }

    if (action === 'deleteArticle') {
      const articleId = safeText(payload.articleId, 100);
      data.articles[tenantId] = data.articles[tenantId].filter((item) => item.id !== articleId);
      recomputeModuleCounts(data, tenantId);
      await writeHelpStore(sha, data);
      return json(res, 200, { ok: true, store: publicStore(data) });
    }

    return json(res, 400, { error: 'Action không hỗ trợ.' });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
