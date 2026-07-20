(function () {
  if (window.__treAdminEditorLoaded) return;
  window.__treAdminEditorLoaded = true;

  var contentApi = '/api/docs-content';
  var imageApi = '/api/page-image';
  var videoApi = '/api/page-video';
  var sessionApi = '/api/admin-session';
  var logoutApi = '/api/admin-logout';
  var saveTimers = new Map();
  var currentEdits = {};
  var adminSession = null;
  var toolbar = null;
  var editing = false;
  var tableElements = [];
  var textElements = [];
  var imageElements = [];
  var videoElements = [];
  var boxClipboard = null;
  var activeTextElement = null;
  var boxTools = null;
  var activeTableRow = null;
  var tableTools = null;

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

  function assetSrc(src) {
    var value = String(src || '');
    if (!value) return '';
    if (value.indexOf('/api/content-asset?') === 0) return value;
    if (value.indexOf(window.location.origin + '/api/content-asset?') === 0) return value.replace(window.location.origin, '');
    if (value.indexOf(window.location.origin + '/content-assets/') === 0) return '/api/content-asset?path=' + encodeURIComponent(value.replace(window.location.origin + '/', ''));
    if (value.indexOf('/content-assets/') === 0) return '/api/content-asset?path=' + encodeURIComponent(value.slice(1));
    if (value.indexOf('content-assets/') === 0) return '/api/content-asset?path=' + encodeURIComponent(value);
    return value;
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
      '.step-content',
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
    if (element.closest('.step-content') && !element.matches('.step-content')) return false;
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

  function collectVideoElements() {
    var slots = Array.prototype.slice.call(document.querySelectorAll(
      '.video-upload-preview[data-video-preview], video[data-live-video-key]'
    ));
    var seen = new Set();
    return slots.filter(function (element) {
      if (!element || isBlocked(element) || seen.has(element)) return false;
      seen.add(element);
      return true;
    });
  }

  function collectTableElements() {
    var seen = new Set();
    return Array.prototype.filter.call(document.querySelectorAll(
      'main table, .main-content table, .content table, .content-area table'
    ), function (table) {
      if (!table || seen.has(table) || isBlocked(table)) return false;
      seen.add(table);
      return true;
    });
  }

  function assignTableKeys(elements) {
    var counters = {};
    elements.forEach(function (table) {
      if (table.dataset.liveTableKey) return;
      var owner = ownerId(table);
      var name = owner + ':table';
      counters[name] = (counters[name] || 0) + 1;
      table.dataset.liveTableKey = name + ':' + counters[name];
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

  function assignVideoKeys(elements) {
    var counters = {};
    elements.forEach(function (element) {
      if (element.dataset.liveVideoKey) return;
      if (element.matches('.video-upload-preview[data-video-preview]')) {
        element.dataset.liveVideoKey = 'video:' + element.dataset.videoPreview;
        return;
      }
      var owner = ownerId(element);
      var name = owner + ':video';
      counters[name] = (counters[name] || 0) + 1;
      element.dataset.liveVideoKey = name + ':' + counters[name];
    });
  }

  function setImageSlot(element, edit) {
    var src = edit && edit.src ? assetSrc(edit.src) : '';
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

  function setVideoSlot(element, edit) {
    var src = edit && edit.src ? assetSrc(edit.src) : '';
    var embedSrc = edit && edit.embedSrc ? String(edit.embedSrc || '') : '';
    if (!src && !embedSrc) return;
    if (element.matches('.video-upload-preview[data-video-preview]')) {
      element.innerHTML = '';
      if (embedSrc) {
        var iframe = document.createElement('iframe');
        iframe.src = embedSrc;
        iframe.title = edit.title || 'Video HDSD';
        iframe.loading = 'lazy';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        element.appendChild(iframe);
      } else {
        var video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        element.appendChild(video);
      }
    } else {
      element.src = src;
      element.controls = true;
      element.preload = 'metadata';
      element.playsInline = true;
    }
  }

  function youtubeEmbedUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var url;
    try {
      url = new URL(raw);
    } catch (error) {
      try {
        url = new URL('https://' + raw);
      } catch (innerError) {
        return '';
      }
    }
    var host = url.hostname.replace(/^www\./, '').toLowerCase();
    var id = '';
    if (host === 'youtu.be') {
      id = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      if (!id && url.pathname.indexOf('/embed/') === 0) id = url.pathname.split('/')[2] || '';
      if (!id && url.pathname.indexOf('/shorts/') === 0) id = url.pathname.split('/')[2] || '';
      if (!id && url.pathname.indexOf('/live/') === 0) id = url.pathname.split('/')[2] || '';
    }
    id = String(id || '').replace(/[^\w-]/g, '').slice(0, 32);
    if (!id) return '';
    var params = new URLSearchParams();
    params.set('rel', '0');
    var start = url.searchParams.get('t') || url.searchParams.get('start') || '';
    var seconds = 0;
    if (/^\d+$/.test(start)) seconds = parseInt(start, 10);
    var complex = String(start).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!seconds && complex) {
      seconds = (parseInt(complex[1] || '0', 10) * 3600) + (parseInt(complex[2] || '0', 10) * 60) + parseInt(complex[3] || '0', 10);
    }
    if (seconds) params.set('start', String(seconds));
    return 'https://www.youtube.com/embed/' + id + '?' + params.toString();
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

  function clearVideoSlot(element) {
    if (element.matches('.video-upload-preview[data-video-preview]')) {
      element.textContent = 'Chưa có video. Chọn file MP4, WEBM hoặc MOV từ máy tính.';
    } else {
      element.removeAttribute('src');
    }
  }

  function applyEdits(edits) {
    currentEdits = edits || {};
    textElements.forEach(function (element) {
      var table = element.closest('table');
      var tableEdit = table && currentEdits[table.dataset.liveTableKey];
      if (tableEdit && tableEdit.type === 'table') return;
      var edit = currentEdits[element.dataset.liveKey];
      if (typeof edit === 'string') element.innerHTML = edit;
      if (edit && typeof edit.html === 'string') element.innerHTML = edit.html;
      normalizeInlineImages(element);
    });
    imageElements.forEach(function (element) {
      var edit = currentEdits[element.dataset.liveImageKey];
      if (edit && edit.type === 'image') setImageSlot(element, edit);
    });
    videoElements.forEach(function (element) {
      var edit = currentEdits[element.dataset.liveVideoKey];
      if (edit && edit.type === 'video') setVideoSlot(element, edit);
    });
  }

  function normalizeInlineImages(root) {
    Array.prototype.forEach.call(root.querySelectorAll ? root.querySelectorAll('img') : [], function (img) {
      var next = assetSrc(img.getAttribute('src'));
      if (next && next !== img.getAttribute('src')) img.setAttribute('src', next);
      if (!img.style.maxWidth) img.style.maxWidth = '60%';
      if (!img.style.height) img.style.height = 'auto';
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
      'body.admin-editing [data-live-video-key]{outline:2px dashed rgba(234,140,0,.6);outline-offset:4px;}',
      '.tre-image-tools{display:none;gap:6px;margin:8px 0 0;justify-content:center;}',
      'body.admin-editing .tre-image-tools{display:flex;}',
      '.tre-image-tools button{border:1px solid #d9e2dc;border-radius:8px;background:#fff;color:#1a2332;font-size:11px;font-weight:800;padding:6px 9px;cursor:pointer;}',
      '.tre-image-tools button:hover{border-color:#5eb332;color:#3f7d22;}',
      '.tre-box-tools{position:fixed;z-index:99998;display:none;gap:6px;align-items:center;flex-wrap:wrap;padding:6px;background:#fff;border:1px solid #d9e2dc;border-radius:10px;box-shadow:0 10px 28px rgba(26,35,50,.14);}',
      'body.admin-editing .tre-box-tools.visible{display:flex;}',
      '.tre-box-tools button{border:1px solid #d9e2dc;border-radius:8px;background:#fff;color:#1a2332;font-size:11px;font-weight:800;padding:6px 9px;cursor:pointer;}',
      '.tre-box-tools button:hover{border-color:#5eb332;color:#3f7d22;}',
      '.tre-box-tools button[disabled]{opacity:.45;cursor:not-allowed;}',
      '.tre-box-tools input{display:none;}',
      'body.admin-editing [data-live-key] img{max-width:60%;height:auto;display:block;margin:10px auto;border-radius:8px;border:1px solid #d9e2dc;}',
      '.tre-table-tools{position:fixed;z-index:99998;display:none;gap:6px;align-items:center;padding:6px;background:#fff;border:1px solid #d9e2dc;border-radius:10px;box-shadow:0 10px 28px rgba(26,35,50,.14);}',
      'body.admin-editing .tre-table-tools.visible{display:flex;}',
      '.tre-table-tools button{border:1px solid #d9e2dc;border-radius:8px;background:#fff;color:#1a2332;font-size:11px;font-weight:800;padding:6px 9px;cursor:pointer;}',
      '.tre-table-tools button:hover{border-color:#5eb332;color:#3f7d22;}',
      '.tre-table-tools button.danger{color:#dc2626;}',
      'body.admin-editing tr.admin-active-row>td,body.admin-editing tr.admin-active-row>th{box-shadow:inset 0 0 0 9999px rgba(94,179,50,.08);}',
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

  async function saveTable(table) {
    if (!table || !table.dataset.liveTableKey) return;
    setStatus('Đang lưu bảng...');
    var response = await fetch(contentApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page: pagePath(),
        key: table.dataset.liveTableKey,
        value: {
          type: 'table',
          html: table.innerHTML
        }
      })
    });
    if (!response.ok) {
      var payload = await response.json().catch(function () { return {}; });
      throw new Error(payload.error || 'Không lưu được bảng.');
    }
    setStatus('Đã lưu bảng');
  }

  function queueSaveTable(table) {
    window.clearTimeout(saveTimers.get(table));
    saveTimers.set(table, window.setTimeout(function () {
      saveTable(table).catch(function (error) {
        setStatus('Lỗi lưu bảng');
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

  async function uploadVideo(element, file) {
    if (!file || !file.type || file.type.indexOf('video/') !== 0) {
      window.alert('Vui lòng chọn file video.');
      return;
    }
    setStatus('Đang tải video...');
    var dataUrl = await fileToDataUrl(file);
    var response = await fetch(videoApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page: pagePath(),
        key: element.dataset.liveVideoKey,
        dataUrl: dataUrl,
        title: element.getAttribute('aria-label') || 'Video HDSD'
      })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Không tải được video.');
    setVideoSlot(element, { type: 'video', src: payload.src, title: 'Video HDSD' });
    setStatus('Đã lưu video');
  }

  async function saveVideoEmbed(element, url) {
    var embedSrc = youtubeEmbedUrl(url);
    if (!embedSrc) {
      window.alert('Link YouTube không hợp lệ.');
      return;
    }
    setStatus('Đang lưu YouTube...');
    var response = await fetch(contentApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        page: pagePath(),
        key: element.dataset.liveVideoKey,
        value: {
          type: 'video',
          provider: 'youtube',
          src: embedSrc,
          embedSrc: embedSrc,
          originalUrl: String(url || '').trim(),
          title: 'Video HDSD'
        }
      })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Không lưu được link YouTube.');
    setVideoSlot(element, { type: 'video', provider: 'youtube', embedSrc: embedSrc, title: 'Video HDSD' });
    setStatus('Đã lưu YouTube');
  }

  async function uploadInlineImage(element, file) {
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
        key: element.dataset.liveKey + ':inline-image',
        dataUrl: dataUrl,
        inlineOnly: true,
        alt: 'Ảnh minh họa'
      })
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Không tải được ảnh.');

    var img = document.createElement('img');
    img.src = assetSrc(payload.src);
    img.alt = 'Ảnh minh họa';
    img.loading = 'lazy';
    img.style.maxWidth = '60%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '10px auto';
    element.appendChild(img);
    normalizeInlineImages(element);
    await saveText(element);
    setStatus('Đã thêm ảnh');
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

  function addVideoTools(element) {
    if (element.dataset.videoToolsReady === '1') return;
    element.dataset.videoToolsReady = '1';
    var tools = document.createElement('div');
    tools.className = 'tre-image-tools';
    tools.innerHTML = '<button type="button" data-video-upload>Đổi video</button><button type="button" data-video-youtube>YouTube</button><button type="button" data-video-clear>Xóa video</button><input type="file" accept="video/mp4,video/webm,video/quicktime,video/*" hidden>';
    var input = tools.querySelector('input');
    tools.querySelector('[data-video-upload]').addEventListener('click', function () { input.click(); });
    tools.querySelector('[data-video-youtube]').addEventListener('click', function () {
      var url = window.prompt('Dán link YouTube');
      if (!url) return;
      saveVideoEmbed(element, url).catch(function (error) {
        setStatus('Lỗi YouTube');
        clearVideoSlot(element);
        window.alert(error.message);
      });
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      uploadVideo(element, file).catch(function (error) {
        setStatus('Lỗi video');
        window.alert(error.message);
      }).finally(function () {
        input.value = '';
      });
    });
    tools.querySelector('[data-video-clear]').addEventListener('click', function () {
      deleteOverride(element.dataset.liveVideoKey, 'video').then(function () {
        clearVideoSlot(element);
      }).catch(function (error) {
        setStatus('Lỗi xóa');
        window.alert(error.message);
      });
    });

    if (element.matches('.video-upload-preview[data-video-preview]')) {
      element.insertAdjacentElement('afterend', tools);
    } else if (element.parentElement) {
      element.parentElement.insertBefore(tools, element.nextSibling);
    }
  }

  function refreshPasteButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.tre-box-tools [data-box-paste]'), function (button) {
      button.disabled = !boxClipboard;
    });
  }

  function positionBoxTools(element) {
    if (!boxTools || !element || !editing) return;
    var rect = element.getBoundingClientRect();
    boxTools.classList.add('visible');
    var top = rect.top - boxTools.offsetHeight - 10;
    if (top < 8) top = Math.min(window.innerHeight - boxTools.offsetHeight - 8, rect.bottom + 8);
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - boxTools.offsetWidth - 8);
    boxTools.style.top = top + 'px';
    boxTools.style.left = left + 'px';
  }

  function hideBoxToolsSoon() {
    window.setTimeout(function () {
      if (!boxTools || !editing) return;
      if (boxTools.matches(':hover')) return;
      var active = document.activeElement;
      if (active && active.dataset && active.dataset.liveKey) return;
      boxTools.classList.remove('visible');
    }, 160);
  }

  function copyBox(element) {
    boxClipboard = {
      html: element.innerHTML,
      source: element.dataset.liveKey
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(element.innerHTML).catch(function () {});
      }
    } catch (error) {}
    refreshPasteButtons();
    setStatus('Đã copy box');
  }

  function pasteBox(element) {
    if (!boxClipboard) return;
    element.innerHTML = boxClipboard.html;
    normalizeInlineImages(element);
    queueSave(element);
    setStatus('Đã paste box');
  }

  function addBoxTools(element) {
    if (!boxTools) {
      boxTools = document.createElement('div');
      boxTools.className = 'tre-box-tools';
      boxTools.innerHTML = '<button type="button" data-box-copy>Copy box</button><button type="button" data-box-paste disabled>Paste vào box</button><button type="button" data-box-image>Thêm ảnh</button><input type="file" accept="image/*">';
      document.body.appendChild(boxTools);
      var input = boxTools.querySelector('input');
      boxTools.querySelector('[data-box-copy]').addEventListener('click', function () {
        if (activeTextElement) copyBox(activeTextElement);
      });
      boxTools.querySelector('[data-box-paste]').addEventListener('click', function () {
        if (activeTextElement) pasteBox(activeTextElement);
      });
      boxTools.querySelector('[data-box-image]').addEventListener('click', function () {
        input.click();
      });
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file || !activeTextElement) return;
        uploadInlineImage(activeTextElement, file).catch(function (error) {
          setStatus('Lỗi ảnh');
          window.alert(error.message);
        }).finally(function () {
          input.value = '';
        });
      });
      window.addEventListener('scroll', function () {
        if (activeTextElement && boxTools.classList.contains('visible')) positionBoxTools(activeTextElement);
      }, true);
      window.addEventListener('resize', function () {
        if (activeTextElement && boxTools.classList.contains('visible')) positionBoxTools(activeTextElement);
      });
    }
    if (element.dataset.boxToolsReady === '1') return;
    element.dataset.boxToolsReady = '1';
    element.addEventListener('focus', function () {
      activeTextElement = element;
      positionBoxTools(element);
    });
    element.addEventListener('click', function () {
      activeTextElement = element;
      positionBoxTools(element);
    });
    element.addEventListener('blur', hideBoxToolsSoon);
    refreshPasteButtons();
  }

  function tableForRow(row) {
    return row ? row.closest('table') : null;
  }

  function bodyRow(row) {
    return row && row.closest('tbody') ? row : null;
  }

  function positionTableTools(row) {
    if (!tableTools || !row || !editing) return;
    var rect = row.getBoundingClientRect();
    tableTools.classList.add('visible');
    var top = rect.top - tableTools.offsetHeight - 8;
    if (top < 8) top = Math.min(window.innerHeight - tableTools.offsetHeight - 8, rect.bottom + 8);
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - tableTools.offsetWidth - 8);
    tableTools.style.top = top + 'px';
    tableTools.style.left = left + 'px';
  }

  function setActiveTableRow(row) {
    if (activeTableRow) activeTableRow.classList.remove('admin-active-row');
    activeTableRow = bodyRow(row);
    if (activeTableRow) {
      activeTableRow.classList.add('admin-active-row');
      positionTableTools(activeTableRow);
    }
  }

  function hideTableToolsSoon() {
    window.setTimeout(function () {
      if (!tableTools || !editing) return;
      if (tableTools.matches(':hover')) return;
      tableTools.classList.remove('visible');
      if (activeTableRow) activeTableRow.classList.remove('admin-active-row');
      activeTableRow = null;
    }, 180);
  }

  function clearEditorAttrs(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-live-key], [data-admin-bound], [contenteditable], [spellcheck]'), function (node) {
      node.removeAttribute('data-live-key');
      node.removeAttribute('data-admin-bound');
      node.removeAttribute('contenteditable');
      node.removeAttribute('spellcheck');
    });
  }

  function blankRowFrom(row) {
    var clone = row.cloneNode(true);
    clone.classList.remove('admin-active-row');
    clearEditorAttrs(clone);
    Array.prototype.forEach.call(clone.children, function (cell) {
      cell.innerHTML = '';
      cell.setAttribute('contenteditable', 'true');
      cell.setAttribute('spellcheck', 'false');
    });
    return clone;
  }

  function refreshEditableCollections() {
    textElements = collectTextElements();
    imageElements = collectImageElements();
    videoElements = collectVideoElements();
    assignTextKeys(textElements);
    assignImageKeys(imageElements);
    assignVideoKeys(videoElements);
    if (editing) {
      textElements.forEach(bindEditableText);
      textElements.forEach(addBoxTools);
      tableElements.forEach(enableTableCells);
      imageElements.forEach(addImageTools);
      videoElements.forEach(addVideoTools);
    }
  }

  function addTableRow() {
    var row = bodyRow(activeTableRow);
    if (!row) return;
    var table = tableForRow(row);
    var next = blankRowFrom(row);
    row.parentNode.insertBefore(next, row.nextSibling);
    refreshEditableCollections();
    setActiveTableRow(next);
    saveTable(table).catch(function (error) {
      setStatus('Lỗi lưu bảng');
      window.alert(error.message);
    });
  }

  function deleteTableRow() {
    var row = bodyRow(activeTableRow);
    if (!row) return;
    var tbody = row.closest('tbody');
    var table = tableForRow(row);
    var rows = tbody ? Array.prototype.filter.call(tbody.rows, function (item) { return item.closest('tbody') === tbody; }) : [];
    if (rows.length <= 1) {
      window.alert('Bảng cần giữ ít nhất 1 dòng nội dung.');
      return;
    }
    var next = row.nextElementSibling || row.previousElementSibling;
    row.remove();
    refreshEditableCollections();
    if (next && next.closest('tbody')) setActiveTableRow(next);
    saveTable(table).catch(function (error) {
      setStatus('Lỗi lưu bảng');
      window.alert(error.message);
    });
  }

  function addTableTools(table) {
    if (!tableTools) {
      tableTools = document.createElement('div');
      tableTools.className = 'tre-table-tools';
      tableTools.innerHTML = '<button type="button" data-table-add>Thêm dòng</button><button type="button" class="danger" data-table-delete>Xóa dòng</button>';
      document.body.appendChild(tableTools);
      tableTools.querySelector('[data-table-add]').addEventListener('click', addTableRow);
      tableTools.querySelector('[data-table-delete]').addEventListener('click', deleteTableRow);
      window.addEventListener('scroll', function () {
        if (activeTableRow && tableTools.classList.contains('visible')) positionTableTools(activeTableRow);
      }, true);
      window.addEventListener('resize', function () {
        if (activeTableRow && tableTools.classList.contains('visible')) positionTableTools(activeTableRow);
      });
    }
    if (table.dataset.tableToolsReady === '1') return;
    table.dataset.tableToolsReady = '1';
    table.addEventListener('click', function (event) {
      var row = event.target.closest('tbody tr');
      if (!row || !table.contains(row)) return;
      setActiveTableRow(row);
    });
    table.addEventListener('focusin', function (event) {
      var row = event.target.closest('tbody tr');
      if (!row || !table.contains(row)) return;
      setActiveTableRow(row);
    });
    table.addEventListener('mouseleave', hideTableToolsSoon);
    table.addEventListener('input', function () { queueSaveTable(table); });
    table.addEventListener('blur', function () { queueSaveTable(table); }, true);
  }

  function enableTableCells(table) {
    Array.prototype.forEach.call(table.querySelectorAll('tbody td, tbody th'), function (cell) {
      cell.setAttribute('contenteditable', 'true');
      cell.setAttribute('spellcheck', 'false');
    });
  }

  function disableTableCells(table) {
    Array.prototype.forEach.call(table.querySelectorAll('tbody td, tbody th'), function (cell) {
      if (!cell.dataset.liveKey) {
        cell.removeAttribute('contenteditable');
        cell.removeAttribute('spellcheck');
      }
    });
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

    document.addEventListener('change', function (event) {
      if (!editing) return;
      var input = event.target.closest && event.target.closest('[data-video-input]');
      if (!input) return;
      var key = input.dataset.videoInput;
      var slot = document.querySelector('[data-video-preview="' + key + '"]');
      var file = input.files && input.files[0];
      if (slot && file) {
        window.setTimeout(function () {
          uploadVideo(slot, file).catch(function (error) {
            setStatus('Lỗi video');
            clearVideoSlot(slot);
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

    document.addEventListener('click', function (event) {
      if (!editing) return;
      var button = event.target.closest && event.target.closest('[data-clear-video]');
      if (!button) return;
      var key = button.dataset.clearVideo;
      var slot = document.querySelector('[data-video-preview="' + key + '"]');
      if (slot) {
        window.setTimeout(function () {
          deleteOverride(slot.dataset.liveVideoKey, 'video').catch(function (error) {
            setStatus('Lỗi xóa');
            window.alert(error.message);
          });
        }, 50);
      }
    }, true);

    document.addEventListener('click', function (event) {
      if (!editing) return;
      var button = event.target.closest && event.target.closest('[data-video-embed]');
      if (!button) return;
      var key = button.dataset.videoEmbed;
      var slot = document.querySelector('[data-video-preview="' + key + '"]');
      var input = document.querySelector('[data-video-url="' + key + '"]');
      if (slot && input) {
        window.setTimeout(function () {
          saveVideoEmbed(slot, input.value).catch(function (error) {
            setStatus('Lỗi YouTube');
            clearVideoSlot(slot);
            window.alert(error.message);
          });
        }, 50);
      }
    }, true);
  }

  function bindEditableText(element) {
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('spellcheck', 'false');
    if (element.dataset.adminBound === '1') return;
    element.dataset.adminBound = '1';
    element.addEventListener('input', function () { queueSave(element); });
    element.addEventListener('blur', function () { queueSave(element); });
    element.addEventListener('paste', function (event) {
      var html = event.clipboardData ? event.clipboardData.getData('text/html') : '';
      var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
      if (html) {
        event.preventDefault();
        document.execCommand('insertHTML', false, html);
        normalizeInlineImages(element);
        queueSave(element);
        return;
      }
      if (text) {
        event.preventDefault();
        document.execCommand('insertText', false, text);
        queueSave(element);
      }
    });
  }

  function enableEditing() {
    editing = true;
    document.body.classList.add('admin-editing');
    textElements.forEach(bindEditableText);
    textElements.forEach(addBoxTools);
    tableElements.forEach(addTableTools);
    tableElements.forEach(enableTableCells);
    imageElements.forEach(addImageTools);
    videoElements.forEach(addVideoTools);
    setStatus('Đang sửa');
  }

  function disableEditing() {
    editing = false;
    document.body.classList.remove('admin-editing');
    if (boxTools) boxTools.classList.remove('visible');
    if (tableTools) tableTools.classList.remove('visible');
    if (activeTableRow) activeTableRow.classList.remove('admin-active-row');
    activeTableRow = null;
    textElements.forEach(function (element) {
      element.removeAttribute('contenteditable');
      element.removeAttribute('spellcheck');
    });
    tableElements.forEach(disableTableCells);
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
    var edits = await loadEdits();
    tableElements = collectTableElements();
    assignTableKeys(tableElements);
    currentEdits = edits || {};
    tableElements.forEach(function (table) {
      var edit = currentEdits[table.dataset.liveTableKey];
      if (edit && edit.type === 'table' && typeof edit.html === 'string') table.innerHTML = edit.html;
    });

    textElements = collectTextElements();
    imageElements = collectImageElements();
    videoElements = collectVideoElements();
    assignTextKeys(textElements);
    assignImageKeys(imageElements);
    assignVideoKeys(videoElements);
    applyEdits(edits);
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
