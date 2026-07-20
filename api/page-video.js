const path = require('path');
const {
  ensurePageStore,
  githubGetContent,
  githubPutContent,
  json,
  normalizePage,
  readContentStore,
  readJsonBody,
  requireAdmin,
  requireGithubConfig,
  safeKey,
  writeContentStore
} = require('./_shared');

const ALLOWED_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-m4v': '.m4v',
  'video/ogg': '.ogv'
};

function safePageDir(page) {
  return page.replace(/^\/+/, '').replace(/\.html$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'index';
}

function videoBuffer(payload) {
  const raw = String(payload.dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Video không đúng định dạng data URL.');
  const mime = match[1].toLowerCase();
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error('Chỉ hỗ trợ MP4, WEBM, MOV, M4V hoặc OGV.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('Video trống.');
  if (buffer.length > 50 * 1024 * 1024) throw new Error('Video tối đa 50MB.');
  return { buffer, ext };
}

function publicAssetUrl(filePath) {
  return `/api/content-asset?path=${encodeURIComponent(filePath)}`;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    requireAdmin(req);

    const payload = await readJsonBody(req);
    const config = requireGithubConfig();
    const page = normalizePage(payload.page);
    const key = safeKey(payload.key);
    if (!key) return json(res, 400, { error: 'Missing key.' });

    const { buffer, ext } = videoBuffer(payload);
    const fileName = `${safePageDir(page)}/${key.replace(/[^\w.-]+/g, '-')}-${Date.now()}${ext}`;
    const filePath = path.posix.join('content-assets', fileName);
    const existing = await githubGetContent(config, filePath);

    await githubPutContent(config, filePath, buffer, `Upload document video for ${page}`, existing.sha);

    const src = publicAssetUrl(filePath);
    const { sha, data } = await readContentStore(config);
    const next = ensurePageStore(data, page);
    next.pages[page][key] = {
      type: 'video',
      src,
      assetPath: `/${filePath}`,
      title: String(payload.title || 'Video HDSD').slice(0, 160)
    };
    next.updatedAt = new Date().toISOString();

    await writeContentStore(config, sha, next);
    return json(res, 200, { ok: true, page, key, src, assetPath: `/${filePath}` });
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
