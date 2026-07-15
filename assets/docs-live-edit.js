(function () {
  var apiUrl = '/api/docs-content';
  var editMode = new URLSearchParams(window.location.search).get('edit') === '1';
  var password = null;
  var saveTimers = new Map();

  function pagePath() {
    var path = window.location.pathname || '/index.html';
    if (path === '/') return '/index.html';
    if (path.endsWith('/')) return path + 'index.html';
    return path;
  }

  function selector() {
    return [
      'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
      'main p', 'main li', 'main th', 'main td',
      '.main-content h1', '.main-content h2', '.main-content h3', '.main-content h4', '.main-content h5', '.main-content h6',
      '.main-content p', '.main-content li', '.main-content th', '.main-content td',
      '.content h1', '.content h2', '.content h3', '.content h4', '.content h5', '.content h6',
      '.content p', '.content li', '.content th', '.content td',
      '.proc-title', '.proc-subtitle', '.editable',
      '.flow-node', '.flow-label', '.flow-description',
      '.card-title', '.card-desc', '.module-title', '.module-subtitle',
      '.mini-cover h1', '.mini-cover p', '.mini-cover b', '.mini-cover span',
      '.chapter-badge', '.tab-empty-note'
    ].join(',');
  }

  function isAllowed(element) {
    if (!element || !element.textContent || !element.textContent.trim()) return false;
    if (element.closest('nav, .sp-nav, .erp-sidebar, .erp-doc-sidebar, .local-shot, script, style, button, label, input, textarea, select')) return false;
    if (element.matches('a, button, label, input, textarea, select')) return false;
    return true;
  }

  function ownerId(element) {
    var owner = element.closest('[id]');
    return owner ? owner.id : 'document';
  }

  function editableElements() {
    var seen = new Set();
    return Array.prototype.filter.call(document.querySelectorAll(selector()), function (element) {
      if (!isAllowed(element) || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function assignKeys(elements) {
    var counters = {};
    elements.forEach(function (element) {
      var owner = ownerId(element);
      var name = owner + ':' + element.tagName.toLowerCase();
      counters[name] = (counters[name] || 0) + 1;
      element.dataset.liveKey = name + ':' + counters[name];
    });
  }

  function applyEdits(edits) {
    editableElements().forEach(function (element) {
      var html = edits[element.dataset.liveKey];
      if (typeof html === 'string') element.innerHTML = html;
    });
  }

  function requestPassword() {
    if (password) return password;
    password = window.sessionStorage.getItem('tre-erp-docs-edit-password');
    if (!password) {
      password = window.prompt('Mật khẩu chỉnh sửa tài liệu');
      if (password) window.sessionStorage.setItem('tre-erp-docs-edit-password', password);
    }
    return password;
  }

  async function saveElement(element) {
    var pass = requestPassword();
    if (!pass) return;
    var response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: pagePath(),
        key: element.dataset.liveKey,
        html: element.innerHTML,
        password: pass
      })
    });
    if (response.status === 401) {
      window.sessionStorage.removeItem('tre-erp-docs-edit-password');
      password = null;
    }
    if (!response.ok) {
      var payload = await response.json().catch(function () { return {}; });
      throw new Error(payload.error || 'Không lưu được nội dung.');
    }
  }

  function queueSave(element) {
    window.clearTimeout(saveTimers.get(element));
    saveTimers.set(element, window.setTimeout(function () {
      saveElement(element).catch(function (error) {
        window.alert(error.message);
      });
    }, 1200));
  }

  function enableEditing(elements) {
    if (!requestPassword()) return;
    elements.forEach(function (element) {
      element.setAttribute('contenteditable', 'true');
      element.setAttribute('spellcheck', 'false');
      element.addEventListener('input', function () { queueSave(element); });
      element.addEventListener('blur', function () { queueSave(element); });
      element.addEventListener('paste', function (event) {
        event.preventDefault();
        var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        document.execCommand('insertText', false, text);
      });
    });
  }

  async function init() {
    var elements = editableElements();
    assignKeys(elements);
    var response = await fetch(apiUrl + '?page=' + encodeURIComponent(pagePath()), { cache: 'no-store' });
    if (response.ok) {
      var payload = await response.json();
      applyEdits(payload.edits || {});
    }
    if (editMode) enableEditing(elements);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
