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
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function safePageDir(page) {
  return page.replace(/^\/+/, '').replace(/\.html$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'index';
}

function imageBuffer(payload) {
  const raw = String(payload.dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng data URL.');
  const mime = match[1].toLowerCase();
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error('Chỉ hỗ trợ PNG, JPG, WEBP hoặc GIF.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('Ảnh trống.');
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5MB.');
  return { buffer, ext, mime };
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

    const { buffer, ext } = imageBuffer(payload);
    const fileName = `${safePageDir(page)}/${key.replace(/[^\w.-]+/g, '-')}-${Date.now()}${ext}`;
    const filePath = path.posix.join('content-assets', fileName);
    const existing = await githubGetContent(config, filePath);

    await githubPutContent(config, filePath, buffer, `Upload document image for ${page}`, existing.sha);

    if (payload.inlineOnly === true) {
      return json(res, 200, { ok: true, page, key, src: `/${filePath}` });
    }

    const { sha, data } = await readContentStore(config);
    const next = ensurePageStore(data, page);
    next.pages[page][key] = {
      type: 'image',
      src: `/${filePath}`,
      alt: String(payload.alt || 'Ảnh minh họa').slice(0, 160)
    };
    next.updatedAt = new Date().toISOString();

    await writeContentStore(config, sha, next);
    return json(res, 200, { ok: true, page, key, src: `/${filePath}` });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
