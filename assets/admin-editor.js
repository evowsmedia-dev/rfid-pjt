(function () {
  if (window.__treAdminEditorLoaded) return;
  window.__treAdminEditorLoaded = true;

  var contentApi = '/api/docs-content';
  var imageApi = '/api/page-image';
  var sessionApi = '/api/admin-session';
  var logoutApi = '/api/admin-logout';
  var saveTimers = new Map();
  var currentEdits = {};
  var adminSession = null;
  var toolbar = null;
  var editing = false;
  var textElements = [];
  var imageElements = [];

  function pagePath() {
    var path = window.location.pathname || '/index.html';
    if (path === '/') return '/index.html';
    if (path.endsWith('/')) return path + 'index.html';
    return path;
  }

  function hashParams() {
    var hash = window.location.hash || '';
    var queryStart = hash.indexOf('?');
    return new URLSearchParams(queryStart === -1 ? '' : hash.slice(queryStart + 1));
  }

  function wantsEditMode() {
    return new URLSearchParams(window.location.search).get('edit') === '1' || hashParams().get('edit') === '1';
  }

  function textSelector() {
    return [
      'main h1', 'main h2', 'main h3', 'main h4', 'main h5', 'main h6',
      'main p', 'main li', 'main th', 'main td',
      '.main-content h1', '.main-content h2', '.main-content h3', '.main-content h4', '.main-content h5', '.main-content h6',
      '.main-content p', '.main-content li', '.main-content th', '.main-content td',
      '.content h1', '.content h2', '.content h3', '.content h4', '.content h5', '.content h6',
      '.content p', '.content li', '.content th', '.content td',
      '.content-area h1', '.content-area h2', '.content-area h3', '.content-area h4', '.content-area h5', '.content-area h6',
      '.content-area p', '.content-area li', '.content-area th', '.content-area td',
      '.proc-title', '.proc-subtitle', '.editable',
      '.flow-node', '.flow-label', '.flow-description',
      '.card-title', '.card-desc', '.module-title', '.module-subtitle',
      '.mini-cover h1', '.mini-cover p', '.mini-cover b', '.mini-cover span',
      '.chapter-badge', '.tab-empty-note'
    ].join(',');
  }

  function isBlocked(element) {
    return Boolean(element.closest('nav, .sp-nav, .erp-sidebar, .erp-global-sidebar, .erp-doc-sidebar, .tre-admin-toolbar, .local-shot-head, script, style, button, label, input, textarea, select'));
  }

  function isAllowedText(element) {
    if (!element || !element.textContent || !element.textContent.trim()) return false;
    if (isBlocked(element)) return false;
    if (element.matches('a, button, label, input, textarea, select')) return false;
    return true;
  }

  function isAllowedImageSlot(element) {
    if (!element || isBlocked(element)) return false;
    if (element.matches('img')) return true;
    return Boolean(element.matches('.local-shot-preview[data-image-preview]'));
  }

  function ownerId(element) {
    var owner = element.closest('[id]');
    return owner ? owner.id : 'document';
  }

  function collectTextElements() {
    var seen = new Set();
    return Array.prototype.filter.call(document.querySelectorAll(textSelector()), function (element) {
      if (!isAllowedText(element) || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function collectImageElements() {
    var slots = Array.prototype.slice.call(document.querySelectorAll(
      'main img, .main-content img, .content img, .content-area img, .diagram-img-wrap img, .local-shot-preview[data-image-preview]'
    ));
    var seen = new Set();
    return slots.filter(function (element) {
      if (!isAllowedImageSlot(element) || seen.has(element)) return false;
      if (element.matches('img') && element.closest('.local-shot-preview[data-image-preview]')) return false;
      seen.add(element);
      return true;
    });
  }

  function assignTextKeys(elements) {
    var counters = {};
    elements.forEach(function (element) {
      if (element.dataset.liveKey) return;
      var owner = ownerId(element);
      var name = owner + ':' + element.tagName.toLowerCase();
      counters[name] = (counters[name] || 0) + 1;
      element.dataset.liveKey = name + ':' + counters[name];
    });
  }

  function assignImageKeys(elements) {
    var counters = {};
    elements.forEach(function (element) {
      if (element.dataset.liveImageKey) return;
      if (element.matches('.local-shot-preview[data-image-preview]')) {
        element.dataset.liveImageKey = 'step' + element.dataset.imagePreview + ':image';
        return;
      }
      var owner = ownerId(element);
      var name = owner + ':img';
      counters[name] = (counters[name] || 0) + 1;
      element.dataset.liveImageKey = name + ':' + counters[name];
    });
  }

  function setImageSlot(element, edit) {
    var src = edit && edit.src ? edit.src : '';
    if (!src) return;
    if (element.matches('.local-shot-preview[data-image-preview]')) {
      element.innerHTML = '';
      var img = document.createElement('img');
      img.src = src;
      img.alt = edit.alt || ('Ảnh minh họa bước ' + element.dataset.imagePreview);
      element.appendChild(img);
    } else {
      element.src = src;
      if (edit.alt) element.alt = edit.alt;
    }
  }

  function clearImageSlot(element) {
    if (element.matches('.local-shot-preview[data-image-preview]')) {
      var step = element.dataset.imagePreview || '';
      element.textContent = step === '1'
        ? 'Chưa có ảnh. Chọn ảnh màn hình đăng nhập hoặc menu CBQL → Đi học hỏi từ máy tính.'
        : 'Chưa có ảnh. Chọn ảnh minh hoạ bước ' + step + ' từ máy tính.';
    } else {
      element.removeAttribute('src');
    }
  }

  function applyEdits(edits) {
    currentEdits = edits || {};
    textElements.forEach(function (element) {
      var edit = currentEdits[element.dataset.liveKey];
      if (typeof edit === 'string') element.innerHTML = edit;
      if (edit && typeof edit.html === 'string') element.innerHTML = edit.html;
    });
    imageElements.forEach(function (element) {
      var edit = currentEdits[element.dataset.liveImageKey];
      if (edit && edit.type === 'image') setImageSlot(element, edit);
    });
  }

  function injectStyles() {
    if (document.getElementById('tre-admin-editor-style')) return;
    var style = document.createElement('style');
    style.id = 'tre-admin-editor-style';
    style.textContent = [
      '.tre-admin-toolbar{position:fixed;right:18px;bottom:18px;z-index:99999;display:flex;align-items:center;gap:8px;padding:9px 10px;background:#fff;border:1px solid #d9e2dc;border-radius:12px;box-shadow:0 12px 32px rgba(26,35,50,.16);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a2332;}',
      '.tre-admin-toolbar button,.tre-admin-toolbar a{border:1px solid #d9e2dc;background:#f6f7f9;color:#1a2332;border-radius:9px;padding:7px 10px;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer;line-height:1;}',
      '.tre-admin-toolbar button.primary{background:#5eb332;border-color:#5eb332;color:#fff;}',
      '.tre-admin-toolbar button.danger{background:#fff;color:#dc2626;}',
      '.tre-admin-toolbar span{font-size:11px;color:#6b7280;white-space:nowrap;}',
      'body.admin-editing [data-live-key]{outline:1.5px dashed rgba(94,179,50,.48);outline-offset:3px;cursor:text;}',
      'body.admin-editing [data-live-key]:focus{outline:2px solid #ea8c00;background:rgba(255,244,229,.6);}',
      'body.admin-editing [data-live-image-key]{outline:2px dashed rgba(8,145,178,.55);outline-offset:4px;}',
      '.tre-image-tools{display:none;gap:6px;margin:8px 0 0;justify-content:center;}',
      'body.admin-editing .tre-image-tools{display:flex;}',
      '.tre-image-tools button{border:1px solid #d9e2dc;border-radius:8px;background:#fff;color:#1a2332;font-size:11px;font-weight:800;padding:6px 9px;cursor:pointer;}',
      '.tre-image-tools button:hover{border-color:#5eb332;color:#3f7d22;}',
      '@media(max-width:700px){.tre-admin-toolbar{left:10px;right:10px;bottom:10px;justify-content:center;flex-wrap:wrap;}.tre-admin-toolbar span{width:100%;text-align:center;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function setStatus(message) {
    var status = toolbar && toolbar.querySelector('[data-admin-status]');
    if (status) status.textContent = message || '';
  }

  async function saveText(element) {
    setStatus('Đang lưu...');
    var response = await fetch(contentApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page: pagePath(),
        key: element.dataset.liveKey,
        html: element.innerHTML
      })
    });
    if (!response.ok) {
      var payload = await response.json().catch(function () { return {}; });
      throw new Error(payload.error || 'Không lưu được nội dung.');
    }
    setStatus('Đã lưu');
  }

  function queueSave(element) {
    window.clearTimeout(saveTimers.get(element));
    saveTimers.set(element, window.setTimeout(function () {
      saveText(element).catch(function (error) {
        setStatus('Lỗi lưu');
        window.alert(error.message);
      });
    }, 900));
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(element, file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      window.alert('Vui lòng chọn file ảnh.');
      return;
    }
    setStatus('Đang tải ảnh...');
    var dataUrl = await fileToDataUrl(file);
    var response = await fetch(imageApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page: pagePath(),
        key: element.dataset.liveImageKey,
        dataUrl: dataUrl,
        alt: element.alt || element.getAttribute('aria-label') || 'Ảnh minh họa'
      })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Không tải được ảnh.');
    setImageSlot(element, { type: 'image', src: payload.src, alt: element.alt || 'Ảnh minh họa' });
    setStatus('Đã lưu ảnh');
  }

  async function deleteOverride(key, type) {
    setStatus('Đang xóa...');
    var response = await fetch(contentApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ page: pagePath(), key: key, value: null })
    });
    if (!response.ok) {
      var payload = await response.json().catch(function () { return {}; });
      throw new Error(payload.error || 'Không xóa được nội dung.');
    }
    setStatus(type === 'image' ? 'Đã xóa ảnh' : 'Đã xóa');
  }

  function addImageTools(element) {
    if (element.dataset.imageToolsReady === '1') return;
    element.dataset.imageToolsReady = '1';
    var tools = document.createElement('div');
    tools.className = 'tre-image-tools';
    tools.innerHTML = '<button type="button" data-image-upload>Đổi ảnh</button><button type="button" data-image-clear>Xóa ảnh</button><input type="file" accept="image/*" hidden>';
    var input = tools.querySelector('input');
    tools.querySelector('[data-image-upload]').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      uploadImage(element, file).catch(function (error) {
        setStatus('Lỗi ảnh');
        window.alert(error.message);
      }).finally(function () {
        input.value = '';
      });
    });
    tools.querySelector('[data-image-clear]').addEventListener('click', function () {
      deleteOverride(element.dataset.liveImageKey, 'image').then(function () {
        clearImageSlot(element);
      }).catch(function (error) {
        setStatus('Lỗi xóa');
        window.alert(error.message);
      });
    });

    if (element.matches('.local-shot-preview[data-image-preview]')) {
      element.insertAdjacentElement('afterend', tools);
    } else if (element.parentElement) {
      element.parentElement.insertBefore(tools, element.nextSibling);
    }
  }

  function bindHrUploadControls() {
    document.addEventListener('change', function (event) {
      if (!editing) return;
      var input = event.target.closest && event.target.closest('[data-image-input]');
      if (!input) return;
      var step = input.dataset.imageInput;
      var slot = document.querySelector('[data-image-preview="' + step + '"]');
      var file = input.files && input.files[0];
      if (slot && file) {
        window.setTimeout(function () {
          uploadImage(slot, file).catch(function (error) {
            setStatus('Lỗi ảnh');
            window.alert(error.message);
          });
        }, 50);
      }
    }, true);

    document.addEventListener('click', function (event) {
      if (!editing) return;
      var button = event.target.closest && event.target.closest('[data-clear-step]');
      if (!button) return;
      var step = button.dataset.clearStep;
      var slot = document.querySelector('[data-image-preview="' + step + '"]');
      if (slot) {
        window.setTimeout(function () {
          deleteOverride(slot.dataset.liveImageKey, 'image').catch(function (error) {
            setStatus('Lỗi xóa');
            window.alert(error.message);
          });
        }, 50);
      }
    }, true);
  }

  function enableEditing() {
    editing = true;
    document.body.classList.add('admin-editing');
    textElements.forEach(function (element) {
      element.setAttribute('contenteditable', 'true');
      element.setAttribute('spellcheck', 'false');
      if (element.dataset.adminBound === '1') return;
      element.dataset.adminBound = '1';
      element.addEventListener('input', function () { queueSave(element); });
      element.addEventListener('blur', function () { queueSave(element); });
      element.addEventListener('paste', function (event) {
        event.preventDefault();
        var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        document.execCommand('insertText', false, text);
      });
    });
    imageElements.forEach(addImageTools);
    setStatus('Đang sửa');
  }

  function disableEditing() {
    editing = false;
    document.body.classList.remove('admin-editing');
    textElements.forEach(function (element) {
      element.removeAttribute('contenteditable');
      element.removeAttribute('spellcheck');
    });
    setStatus('Đã tắt sửa');
  }

  function renderToolbar() {
    if (toolbar) return;
    injectStyles();
    toolbar = document.createElement('div');
    toolbar.className = 'tre-admin-toolbar';
    toolbar.innerHTML = '<button type="button" class="primary" data-admin-edit>Bật sửa</button><a href="/admin.html">Admin</a><button type="button" class="danger" data-admin-logout>Thoát</button><span data-admin-status>Admin</span>';
    document.body.appendChild(toolbar);
    toolbar.querySelector('[data-admin-edit]').addEventListener('click', function () {
      if (editing) {
        disableEditing();
        this.textContent = 'Bật sửa';
      } else {
        enableEditing();
        this.textContent = 'Tắt sửa';
      }
    });
    toolbar.querySelector('[data-admin-logout]').addEventListener('click', async function () {
      await fetch(logoutApi, { method: 'POST', credentials: 'same-origin' });
      window.location.reload();
    });
  }

  function redirectToAdmin() {
    var next = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = '/admin.html?next=' + encodeURIComponent(next);
  }

  async function loadSession() {
    var response = await fetch(sessionApi, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return { authenticated: false };
    return response.json();
  }

  async function loadEdits() {
    var response = await fetch(contentApi + '?page=' + encodeURIComponent(pagePath()), { cache: 'no-store' });
    if (!response.ok) return {};
    var payload = await response.json();
    return payload.edits || {};
  }

  async function init() {
    textElements = collectTextElements();
    imageElements = collectImageElements();
    assignTextKeys(textElements);
    assignImageKeys(imageElements);
    applyEdits(await loadEdits());
    adminSession = await loadSession();
    bindHrUploadControls();

    if (adminSession.authenticated) {
      renderToolbar();
      if (wantsEditMode()) {
        enableEditing();
        toolbar.querySelector('[data-admin-edit]').textContent = 'Tắt sửa';
      }
    } else if (wantsEditMode()) {
      redirectToAdmin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
