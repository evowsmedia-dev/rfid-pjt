(function(){
  if(new URLSearchParams(location.search).get('embed') === '1') return;

  var isDocsPath = location.pathname.indexOf('/docs/') !== -1;
  var prefix = isDocsPath ? '../' : '';
  var links = [
    ['Nhân sự', 'index.html#dm-nhansu', 'erp-lvl-1'],
    ['App đi học', 'Di_hoc_hoi.html', 'erp-lvl-2'],
    ['Đơn hàng', 'index.html#dm-donhang', 'erp-lvl-1'],
    ['App sửa ngày xuất hàng', 'docs/BA_sua_ngay_xuat_hang.html', 'erp-lvl-2'],
    ['KHSX', 'index.html#dm-khsx', 'erp-lvl-1'],
    ['Công nghệ', 'index.html#dm-congnghe', 'erp-lvl-1'],
    ['QLCL', 'index.html#dm-qlcl', 'erp-lvl-1'],
    ['Kho', 'docs/02-process-flow.html', 'erp-lvl-1']
  ];
  var warehouseLinks = [
    ['Quy trình RFID', '02-process-flow.html'],
    ['RFID kho nguyên liệu', '05-kho-nguyen-lieu-analysis.html'],
    ['RFID kho phụ liệu', '04-sitemap-analysis.html'],
    ['Mô phỏng PDA - Kho NL', 'pda-mockup-kho-nguyen-lieu.html'],
    ['Mô phỏng PDA - Kho PL', 'pda-mockup-kho-PL.html']
  ];
  var floatingWarehouseFiles = [
    '05-kho-nguyen-lieu-analysis.html',
    '04-sitemap-analysis.html',
    'pda-mockup-kho-nguyen-lieu.html',
    'pda-mockup-kho-PL.html'
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
    renderWarehouseNav();
  }
  function renderWarehouseNav(){
    var file = location.pathname.split('/').pop();
    var isWarehouseDoc = warehouseLinks.some(function(item){ return item[1] === file; });
    if(!isWarehouseDoc || document.querySelector('.warehouse-doc-nav')) return;
    var forceFloating = floatingWarehouseFiles.indexOf(file) !== -1;
    var target = document.querySelector('.sidebar') || document.querySelector('.side-panel');
    var nav = document.createElement('div');
    nav.className = 'warehouse-doc-nav';
    nav.innerHTML = '<div class="warehouse-doc-nav-title">Tài liệu Kho</div>' + warehouseLinks.map(function(item){
      var active = item[1] === file ? ' active' : '';
      return '<a class="'+active+'" href="'+item[1]+'">'+item[0]+'</a>';
    }).join('');
    if(target && !forceFloating) {
      target.insertBefore(nav, target.firstChild);
    } else {
      nav.className += ' warehouse-floating';
      document.body.classList.add('has-warehouse-floating');
      document.body.insertBefore(nav, document.body.firstChild.nextSibling);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
