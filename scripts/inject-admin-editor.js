const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skip = new Set(['admin.html']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

function relativeScript(filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  return relative.startsWith('docs/') ? '../assets/admin-editor.js' : 'assets/admin-editor.js';
}

function inject(filePath) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  if (skip.has(relative)) return false;

  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('assets/admin-editor.js') || html.includes('assets/docs-live-edit.js')) return false;
  if (!/<\/body>/i.test(html)) return false;

  const script = `<script src="${relativeScript(filePath)}"></script>\n`;
  html = html.replace(/<\/body>/i, `${script}</body>`);
  fs.writeFileSync(filePath, html);
  return true;
}

const changed = walk(root).filter(inject);
if (changed.length) {
  console.log(`Injected admin editor into ${changed.length} HTML file(s).`);
} else {
  console.log('All HTML files already have the admin editor.');
}
