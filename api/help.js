const path = require('path');
const {
  clearHelpSessionCookie,
  createHelpSessionCookie,
  ensureTenantBuckets,
  findTenant,
  getHelpSession,
  normalizeArticle,
  normalizeModule,
  passwordHash,
  publicAssetUrl,
  readHelpStore,
  recomputeModuleCounts,
  requireHelpSession,
  safeId,
  safeText,
  tenantExists,
  writeHelpStore
} = require('./_help');
const {
  githubGetContent,
  githubPutContent,
  json,
  readJsonBody,
  requireAdmin,
  requireGithubConfig
} = require('./_shared');

const ALLOWED_TYPES = {
  'image/png': { ext: '.png', kind: 'image', max: 5 * 1024 * 1024 },
  'image/jpeg': { ext: '.jpg', kind: 'image', max: 5 * 1024 * 1024 },
  'image/webp': { ext: '.webp', kind: 'image', max: 5 * 1024 * 1024 },
  'image/gif': { ext: '.gif', kind: 'image', max: 5 * 1024 * 1024 },
  'video/mp4': { ext: '.mp4', kind: 'video', max: 50 * 1024 * 1024 },
  'video/webm': { ext: '.webm', kind: 'video', max: 50 * 1024 * 1024 },
  'video/quicktime': { ext: '.mov', kind: 'video', max: 50 * 1024 * 1024 },
  'application/pdf': { ext: '.pdf', kind: 'document', max: 20 * 1024 * 1024 },
  'application/msword': { ext: '.doc', kind: 'document', max: 20 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', kind: 'document', max: 20 * 1024 * 1024 },
  'application/vnd.ms-excel': { ext: '.xls', kind: 'document', max: 20 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', kind: 'document', max: 20 * 1024 * 1024 },
  'application/vnd.ms-powerpoint': { ext: '.ppt', kind: 'document', max: 20 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: '.pptx', kind: 'document', max: 20 * 1024 * 1024 }
};

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

function fileBuffer(payload) {
  const raw = String(payload.dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('File không đúng định dạng data URL.');
  const mime = match[1].toLowerCase();
  const rule = ALLOWED_TYPES[mime];
  if (!rule) throw new Error('Định dạng file chưa được hỗ trợ.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('File trống.');
  if (buffer.length > rule.max) throw new Error(`File vượt quá giới hạn ${Math.round(rule.max / 1024 / 1024)}MB.`);
  return { buffer, mime, rule };
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const payload = await readJsonBody(req);
  const username = safeText(payload.username, 80);
  const password = String(payload.password || '');
  const { data } = await readHelpStore();
  const user = data.users.find((item) => item.username === username && item.active !== false);
  if (!user || user.passwordHash !== passwordHash(password) || !tenantExists(data, user.tenantId)) {
    return json(res, 401, { error: 'Sai tài khoản hoặc mật khẩu.' });
  }
  res.setHeader('Set-Cookie', createHelpSessionCookie(req, user));
  return json(res, 200, {
    ok: true,
    user: {
      userId: user.username,
      displayName: user.displayName || user.username,
      role: user.role || 'viewer',
      tenantId: user.tenantId
    },
    tenant: findTenant(data, user.tenantId)
  });
}

async function handleSession(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const session = getHelpSession(req);
  if (!session) return json(res, 200, { authenticated: false });
  const { data } = await readHelpStore();
  return json(res, 200, {
    authenticated: true,
    user: session,
    tenant: findTenant(data, session.tenantId)
  });
}

function handleLogout(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  res.setHeader('Set-Cookie', clearHelpSessionCookie(req));
  return json(res, 200, { ok: true });
}

async function handleContent(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const session = requireHelpSession(req);
  const { data } = await readHelpStore();
  const tenant = findTenant(data, session.tenantId);
  if (!tenant || tenant.active === false) return json(res, 403, { error: 'Tenant không hoạt động.' });
  ensureTenantBuckets(data, session.tenantId);
  return json(res, 200, {
    tenant,
    user: session,
    modules: data.modules[session.tenantId],
    articles: data.articles[session.tenantId]
  });
}

async function handleAdminData(req, res) {
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
}

async function handleUpload(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const admin = requireAdmin(req);
  const payload = await readJsonBody(req);
  const tenantId = safeId(payload.tenantId);
  const articleId = safeId(payload.articleId, `article-${Date.now()}`);
  const fileName = safeText(payload.fileName, 180) || 'attachment';
  if (!tenantId || !articleId) return json(res, 400, { error: 'Thiếu tenant hoặc article.' });

  const { data } = await readHelpStore();
  if (!tenantExists(data, tenantId)) return json(res, 400, { error: 'Tenant không hợp lệ.' });

  const { buffer, mime, rule } = fileBuffer(payload);
  const cleanName = fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'attachment';
  const storedName = `${cleanName}-${Date.now()}${rule.ext}`;
  const filePath = path.posix.join('content-assets', 'help-center', tenantId, articleId, storedName);
  const config = requireGithubConfig();
  const existing = await githubGetContent(config, filePath);
  await githubPutContent(config, filePath, buffer, `Upload help center file for ${tenantId}/${articleId}`, existing.sha);

  return json(res, 200, {
    ok: true,
    attachment: {
      id: safeId(`${cleanName}-${Date.now()}`),
      name: fileName,
      mime,
      size: buffer.length,
      type: rule.kind,
      src: publicAssetUrl(filePath),
      assetPath: `/${filePath}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: admin.role || 'admin'
    }
  });
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || '';
    if (action === 'login') return await handleLogin(req, res);
    if (action === 'session') return await handleSession(req, res);
    if (action === 'logout') return handleLogout(req, res);
    if (action === 'content') return await handleContent(req, res);
    if (action === 'admin-data') return await handleAdminData(req, res);
    if (action === 'upload') return await handleUpload(req, res);
    return json(res, 404, { error: 'Help Center action không tồn tại.' });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '60mb'
    }
  }
};
