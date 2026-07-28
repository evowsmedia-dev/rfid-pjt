const crypto = require('crypto');
const {
  githubConfig,
  githubGetContent,
  githubPutContent,
  requireGithubConfig
} = require('./_shared');

const HELP_CONTENT_FILE = 'help-center-content.json';
const HELP_SESSION_COOKIE = 'tre_help_user';
const HELP_SESSION_TTL_SECONDS = 60 * 60 * 24;

function authSecret() {
  return process.env.AUTH_SECRET || process.env.DOCS_AUTH_SECRET || process.env.ADMIN_PASSWORD || process.env.DOCS_EDIT_PASSWORD || '';
}

function isHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' || req.headers.host && !/^localhost(?::|$)|^127\.0\.0\.1(?::|$)/.test(req.headers.host);
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function sign(value) {
  const secret = authSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function passwordHash(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function safeId(value, fallback) {
  const id = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return id || fallback || '';
}

function safeText(value, limit) {
  return String(value || '').trim().slice(0, limit || 500);
}

function createHelpSessionCookie(req, user) {
  const payload = Buffer.from(JSON.stringify({
    role: user.role || 'viewer',
    tenantId: user.tenantId,
    userId: user.username,
    displayName: user.displayName || user.username,
    exp: Math.floor(Date.now() / 1000) + HELP_SESSION_TTL_SECONDS
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  return `${HELP_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${HELP_SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`;
}

function clearHelpSessionCookie(req) {
  return `${HELP_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`;
}

function getHelpSession(req) {
  const token = parseCookies(req)[HELP_SESSION_COOKIE];
  const secret = authSecret();
  if (!token || !secret || token.indexOf('.') === -1) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== sign(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.tenantId || !data.userId) return null;
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function requireHelpSession(req) {
  const session = getHelpSession(req);
  if (!session) {
    const error = new Error('Help Center login required.');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

function normalizeStore(data) {
  const next = data && typeof data === 'object' ? data : {};
  next.version = next.version || 1;
  next.tenants = Array.isArray(next.tenants) ? next.tenants : [];
  next.users = Array.isArray(next.users) ? next.users : [];
  next.modules = next.modules && typeof next.modules === 'object' ? next.modules : {};
  next.articles = next.articles && typeof next.articles === 'object' ? next.articles : {};
  next.updatedAt = next.updatedAt || new Date().toISOString();
  return next;
}

async function readHelpStore(configOverride) {
  const config = configOverride || githubConfig();
  const result = await githubGetContent(config, HELP_CONTENT_FILE);
  if (!result.data) return { sha: null, data: normalizeStore({}) };
  const raw = result.data.toString('utf8');
  return { sha: result.sha, data: normalizeStore(raw ? JSON.parse(raw) : {}) };
}

async function writeHelpStore(sha, data) {
  const config = requireGithubConfig();
  const next = normalizeStore(data);
  next.updatedAt = new Date().toISOString();
  return githubPutContent(
    config,
    HELP_CONTENT_FILE,
    `${JSON.stringify(next, null, 2)}\n`,
    'Update help center content',
    sha
  );
}

function publicAssetUrl(filePath) {
  return `/api/content-asset?path=${encodeURIComponent(filePath)}`;
}

function tenantExists(store, tenantId) {
  return store.tenants.some((tenant) => tenant.id === tenantId);
}

function findTenant(store, tenantId) {
  return store.tenants.find((tenant) => tenant.id === tenantId) || null;
}

function ensureTenantBuckets(store, tenantId) {
  store.modules[tenantId] = Array.isArray(store.modules[tenantId]) ? store.modules[tenantId] : [];
  store.articles[tenantId] = Array.isArray(store.articles[tenantId]) ? store.articles[tenantId] : [];
}

function normalizeModule(module) {
  const name = safeText(module && module.name, 80);
  return {
    name,
    icon: safeText(module && module.icon, 60) || 'fa-circle-question',
    desc: safeText(module && module.desc, 220),
    count: Number(module && module.count) || 0
  };
}

function normalizeArticle(article, tenantId) {
  const id = safeId(article && article.id, `article-${Date.now()}`);
  return {
    id,
    tenantId,
    title: safeText(article && article.title, 160) || 'Bài hướng dẫn mới',
    platform: ['pc', 'mobile'].includes(article && article.platform) ? article.platform : 'pc',
    module: safeText(article && article.module, 80) || 'Hệ thống',
    desc: safeText(article && article.desc, 300),
    views: Math.max(0, Number(article && article.views) || 0),
    time: safeText(article && article.time, 40) || '3 phút',
    keywords: safeText(article && article.keywords, 500),
    steps: Array.isArray(article && article.steps) ? article.steps.map((step) => ({
      title: safeText(step && step.title, 160),
      body: safeText(step && step.body, 2000)
    })).filter((step) => step.title || step.body).slice(0, 30) : [],
    notes: Array.isArray(article && article.notes) ? article.notes.map((note) => safeText(note, 1000)).filter(Boolean).slice(0, 20) : [],
    attachments: Array.isArray(article && article.attachments) ? article.attachments.map((file) => ({
      id: safeId(file && file.id, `file-${Date.now()}`),
      name: safeText(file && file.name, 180) || 'Tệp đính kèm',
      mime: safeText(file && file.mime, 120),
      size: Math.max(0, Number(file && file.size) || 0),
      type: safeText(file && file.type, 30) || 'document',
      src: safeText(file && file.src, 500),
      assetPath: safeText(file && file.assetPath, 500),
      uploadedAt: safeText(file && file.uploadedAt, 80),
      uploadedBy: safeText(file && file.uploadedBy, 120)
    })).filter((file) => file.src || file.assetPath).slice(0, 50) : [],
    updatedAt: safeText(article && article.updatedAt, 80) || new Date().toISOString()
  };
}

function recomputeModuleCounts(store, tenantId) {
  ensureTenantBuckets(store, tenantId);
  const counts = store.articles[tenantId].reduce((acc, article) => {
    acc[article.module] = (acc[article.module] || 0) + 1;
    return acc;
  }, {});
  store.modules[tenantId] = store.modules[tenantId].map((module) => ({
    ...module,
    count: counts[module.name] || 0
  }));
}

module.exports = {
  HELP_CONTENT_FILE,
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
};
