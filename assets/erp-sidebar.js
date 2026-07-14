(function(){
  var isDocsPath = location.pathname.indexOf('/docs/') !== -1;
  var prefix = isDocsPath ? '../' : '';
  var links = [
    ['Nhân sự', 'index.html#dm-nhansu', 'erp-lvl-1'],
    ['Đào tạo & Học hỏi CBQL', 'Di_hoc_hoi.html', 'erp-lvl-3'],
    ['Đơn hàng', 'index.html#dm-donhang', 'erp-lvl-1'],
    ['KHSX', 'index.html#dm-khsx', 'erp-lvl-1'],
    ['Công nghệ', 'index.html#dm-congnghe', 'erp-lvl-1'],
    ['QLCL', 'index.html#dm-qlcl', 'erp-lvl-1'],
    ['Kho', 'index.html#dm-kho', 'erp-lvl-1'],
    ['Quy trình RFID', 'docs/02-process-flow.html', 'erp-lvl-3'],
    ['RFID kho nguyên liệu', 'docs/05-kho-nguyen-lieu-analysis.html', 'erp-lvl-3'],
    ['RFID kho phụ liệu', 'docs/04-sitemap-analysis.html', 'erp-lvl-3'],
    ['Mô phỏng PDA - Kho NL', 'docs/pda-mockup-kho-nguyen-lieu.html', 'erp-lvl-3'],
    ['Mô phỏng PDA - Kho PL', 'docs/pda-mockup-kho-PL.html', 'erp-lvl-3']
  ];
  function hrefFor(href){
    return href.indexOf('docs/') === 0 || href.indexOf('Di_hoc_hoi') === 0 || href.indexOf('index') === 0 ? prefix + href : href;
  }
  function render(){
    if(document.querySelector('.erp-global-sidebar')) return;
    document.body.classList.add('has-erp-global');
    if(localStorage.getItem('tre-erp-sidebar-collapsed') === '1') document.body.classList.add('erp-sidebar-collapsed');
    var nav = links.map(function(item){
      var href = hrefFor(item[1]);
      var current = location.pathname.split('/').pop() === item[1].split('/').pop();
      return '<a class="'+item[2]+(current ? ' active' : '')+'" href="'+href+'">'+item[0]+'</a>';
    }).join('');
    var el = document.createElement('aside');
    el.className = 'erp-global-sidebar';
    el.innerHTML =
      '<div class="erp-global-head"><a class="erp-global-mark" href="'+prefix+'index.html">Tre</a>'+
      '<div class="erp-global-brand"><b>Tre ERP Docs</b><span>Tài liệu BA · Hệ thống ERP</span></div>'+
      '<button class="erp-global-toggle" type="button" aria-label="Thu gọn/mở menu">‹</button></div>'+
      '<div class="erp-global-label">Danh mục tài liệu</div><nav class="erp-global-nav">'+nav+'</nav>'+
      '<div class="erp-global-foot">TNG Office · Tre ERP Docs<br>Cập nhật 14/07/2026</div>';
    document.body.insertBefore(el, document.body.firstChild);
    el.querySelector('.erp-global-toggle').addEventListener('click', function(){
      document.body.classList.toggle('erp-sidebar-collapsed');
      localStorage.setItem('tre-erp-sidebar-collapsed', document.body.classList.contains('erp-sidebar-collapsed') ? '1' : '0');
      this.textContent = document.body.classList.contains('erp-sidebar-collapsed') ? '›' : '‹';
    });
    el.querySelector('.erp-global-toggle').textContent = document.body.classList.contains('erp-sidebar-collapsed') ? '›' : '‹';
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
