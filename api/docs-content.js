const {
  adminPassword,
  ensurePageStore,
  getSession,
  githubConfig,
  json,
  normalizePage,
  readContentStore,
  readJsonBody,
  requireGithubConfig,
  safeKey,
  sanitizeHtml,
  writeContentStore
} = require('./_shared');

function isLegacyPasswordAllowed(payload) {
  const password = adminPassword();
  return Boolean(password && payload.password && payload.password === password);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = githubConfig();
      if (!config.owner || !config.repo) return json(res, 500, { error: 'GITHUB_REPO must be owner/repo.' });

      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const page = normalizePage(url.searchParams.get('page'));
      const { data } = await readContentStore(config);
      return json(res, 200, {
        page,
        edits: data.pages && data.pages[page] ? data.pages[page] : {}
      });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

    const payload = await readJsonBody(req);
    if (!getSession(req) && !isLegacyPasswordAllowed(payload)) {
      return json(res, 401, { error: 'Admin login required.' });
    }

    const config = requireGithubConfig();
    const page = normalizePage(payload.page);
    const key = safeKey(payload.key);
    if (!key) return json(res, 400, { error: 'Missing key.' });

    const { sha, data } = await readContentStore(config);
    const next = ensurePageStore(data, page);

    if (payload.value === null || payload.html === '') {
      delete next.pages[page][key];
    } else if (payload.value && typeof payload.value === 'object') {
      const value = { ...payload.value };
      if (typeof value.html === 'string') value.html = sanitizeHtml(value.html);
      next.pages[page][key] = value;
    } else {
      next.pages[page][key] = sanitizeHtml(payload.html);
    }

    if (!Object.keys(next.pages[page]).length) delete next.pages[page];
    next.updatedAt = new Date().toISOString();

    await writeContentStore(config, sha, next);
    return json(res, 200, { ok: true, page, key });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.message || 'Unknown error.' });
  }
};
