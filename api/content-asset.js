const path = require('path');
const { getSession, githubConfig, githubGetContent } = require('./_shared');
const { getHelpSession } = require('./_help');

const MIME_BY_EXT = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(message);
}

function safeAssetPath(value) {
  const raw = String(value || '').replace(/^\/+/, '');
  const normalized = path.posix.normalize(raw);
  if (!normalized.startsWith('content-assets/') || normalized.includes('..')) return '';
  return normalized;
}

function helpTenantFromPath(assetPath) {
  const parts = assetPath.split('/');
  if (parts[0] === 'content-assets' && parts[1] === 'help-center' && parts[2]) return parts[2];
  return '';
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed.');

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const assetPath = safeAssetPath(url.searchParams.get('path'));
    if (!assetPath) return sendText(res, 400, 'Invalid asset path.');
    const helpTenantId = helpTenantFromPath(assetPath);
    if (helpTenantId) {
      const helpSession = getHelpSession(req);
      const adminSession = getSession(req);
      if (!adminSession && (!helpSession || helpSession.tenantId !== helpTenantId)) {
        return sendText(res, 403, 'Asset forbidden.');
      }
    }

    const config = githubConfig();
    if (!config.owner || !config.repo) return sendText(res, 500, 'GITHUB_REPO must be owner/repo.');

    const result = await githubGetContent(config, assetPath);
    if (!result.data) return sendText(res, 404, 'Asset not found.');

    const ext = path.posix.extname(assetPath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.setHeader('Content-Length', result.data.length);
    if (req.method === 'HEAD') return res.end();
    return res.end(result.data);
  } catch (error) {
    return sendText(res, 500, error.message || 'Unknown error.');
  }
};
