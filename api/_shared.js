const crypto = require('crypto');

const CONTENT_FILE = 'content-overrides.json';
const DEFAULT_REPO = 'evowsmedia-dev/rfid-pjt';
const DEFAULT_BRANCH = 'main';
const SESSION_COOKIE = 'tre_erp_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 24;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(data));
}

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'tre-erp-docs-editor'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function githubConfig() {
  const repoName = process.env.GITHUB_REPO || DEFAULT_REPO;
  const [owner, repo] = repoName.split('/');
  return {
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH,
    token: process.env.GITHUB_TOKEN
  };
}

function requireGithubConfig() {
  const config = githubConfig();
  if (!config.owner || !config.repo) throw new Error('GITHUB_REPO must be owner/repo.');
  if (!config.token) throw new Error('Missing GITHUB_TOKEN on Vercel.');
  return config;
}

function sanitizeHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\sjavascript:/gi, '');
}

function normalizePage(value) {
  let page = String(value || '/index.html').split('?')[0].split('#')[0];
  if (!page.startsWith('/')) page = `/${page}`;
  if (page.endsWith('/')) page += 'index.html';
  if (page === '/') page = '/index.html';
  return page;
}

function safeKey(value) {
  return String(value || '').replace(/[^\w:.-]/g, '').slice(0, 220);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  return raw ? JSON.parse(raw) : {};
}

async function githubGetContent(config, path, ref) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref || config.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(config.token) });
  if (response.status === 404) return { sha: null, data: null };
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${detail}`);
  }
  const payload = await response.json();
  return {
    sha: payload.sha,
    data: Buffer.from(payload.content || '', 'base64'),
    payload
  };
}

async function githubPutContent(config, path, buffer, message, sha) {
  const body = {
    message,
    branch: config.branch,
    content: Buffer.from(buffer).toString('base64')
  };
  if (sha) body.sha = sha;

  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...githubHeaders(config.token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub write failed: ${response.status} ${detail}`);
  }
  return response.json();
}

async function readContentStore(config) {
  const result = await githubGetContent(config, CONTENT_FILE);
  if (!result.data) return { sha: null, data: {} };
  const raw = result.data.toString('utf8');
  return { sha: result.sha, data: raw ? JSON.parse(raw) : {} };
}

async function writeContentStore(config, sha, data) {
  return githubPutContent(
    config,
    CONTENT_FILE,
    `${JSON.stringify(data, null, 2)}\n`,
    'Update document content overrides',
    sha
  );
}

function ensurePageStore(data, page) {
  const next = data && typeof data === 'object' ? data : {};
  next.pages = next.pages && typeof next.pages === 'object' ? next.pages : {};
  next.pages[page] = next.pages[page] && typeof next.pages[page] === 'object' ? next.pages[page] : {};
  return next;
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

function authSecret() {
  return process.env.AUTH_SECRET || process.env.DOCS_AUTH_SECRET || process.env.ADMIN_PASSWORD || process.env.DOCS_EDIT_PASSWORD || '';
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.DOCS_EDIT_PASSWORD || '';
}

function sign(value) {
  const secret = authSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function isHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' || req.headers.host && !/^localhost(?::|$)|^127\.0\.0\.1(?::|$)/.test(req.headers.host);
}

function createSessionCookie(req) {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`;
}

function clearSessionCookie(req) {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  const secret = authSecret();
  if (!token || !secret || token.indexOf('.') === -1) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== sign(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.role !== 'admin') return null;
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function requireAdmin(req) {
  const session = getSession(req);
  if (!session) {
    const error = new Error('Admin login required.');
    error.statusCode = 401;
    throw error;
  }
  return session;
}

module.exports = {
  CONTENT_FILE,
  SESSION_COOKIE,
  adminPassword,
  clearSessionCookie,
  createSessionCookie,
  ensurePageStore,
  getSession,
  githubConfig,
  githubGetContent,
  githubPutContent,
  json,
  normalizePage,
  readContentStore,
  readJsonBody,
  requireAdmin,
  requireGithubConfig,
  safeKey,
  sanitizeHtml,
  writeContentStore
};
