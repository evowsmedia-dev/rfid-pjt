const CONTENT_FILE = 'content-overrides.json';

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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function readContent({ owner, repo, branch, token }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${CONTENT_FILE}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (response.status === 404) return { sha: null, data: {} };
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${detail}`);
  }
  const payload = await response.json();
  const raw = Buffer.from(payload.content || '', 'base64').toString('utf8');
  return { sha: payload.sha, data: raw ? JSON.parse(raw) : {} };
}

async function writeContent({ owner, repo, branch, token, sha, data }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${CONTENT_FILE}`;
  const body = {
    message: 'Update document content overrides',
    branch,
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64')
  };
  if (sha) body.sha = sha;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...githubHeaders(token),
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

module.exports = async function handler(req, res) {
  const repoName = process.env.GITHUB_REPO || 'evowsmedia-dev/rfid-pjt';
  const [owner, repo] = repoName.split('/');
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo) return json(res, 500, { error: 'GITHUB_REPO must be owner/repo.' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
      const page = normalizePage(url.searchParams.get('page'));
      const { data } = await readContent({ owner, repo, branch, token });
      return json(res, 200, { page, edits: data.pages && data.pages[page] ? data.pages[page] : {} });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    if (!token) return json(res, 500, { error: 'Missing GITHUB_TOKEN on Vercel.' });
    if (!process.env.DOCS_EDIT_PASSWORD) return json(res, 500, { error: 'Missing DOCS_EDIT_PASSWORD on Vercel.' });

    const payload = JSON.parse(await readBody(req) || '{}');
    if (payload.password !== process.env.DOCS_EDIT_PASSWORD) return json(res, 401, { error: 'Invalid edit password.' });

    const page = normalizePage(payload.page);
    const key = String(payload.key || '').slice(0, 220);
    if (!key) return json(res, 400, { error: 'Missing key.' });

    const { sha, data } = await readContent({ owner, repo, branch, token });
    const next = data && typeof data === 'object' ? data : {};
    next.pages = next.pages && typeof next.pages === 'object' ? next.pages : {};
    next.pages[page] = next.pages[page] && typeof next.pages[page] === 'object' ? next.pages[page] : {};

    const html = sanitizeHtml(payload.html);
    if (html === null || html === undefined || html === '') {
      delete next.pages[page][key];
    } else {
      next.pages[page][key] = html;
    }
    next.updatedAt = new Date().toISOString();

    await writeContent({ owner, repo, branch, token, sha, data: next });
    return json(res, 200, { ok: true, page, key });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unknown error.' });
  }
};
