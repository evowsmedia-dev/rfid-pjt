const path = require('path');
const {
  publicAssetUrl,
  safeId,
  safeText,
  tenantExists,
  readHelpStore
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

module.exports = async function handler(req, res) {
  try {
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

    const attachment = {
      id: safeId(`${cleanName}-${Date.now()}`),
      name: fileName,
      mime,
      size: buffer.length,
      type: rule.kind,
      src: publicAssetUrl(filePath),
      assetPath: `/${filePath}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: admin.role || 'admin'
    };
    return json(res, 200, { ok: true, attachment });
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
