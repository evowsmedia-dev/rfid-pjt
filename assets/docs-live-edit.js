(function () {
  if (window.__treAdminEditorRequested || window.__treAdminEditorLoaded) return;
  window.__treAdminEditorRequested = true;

  var script = document.createElement('script');
  var current = document.currentScript;
  var src = current && current.src ? current.src : '/assets/docs-live-edit.js';
  script.src = src.replace(/docs-live-edit\.js(?:\?.*)?$/, 'admin-editor.js');
  script.defer = true;
  document.head.appendChild(script);
})();
