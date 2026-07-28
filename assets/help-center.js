(function(){
  var modules = [];
  var articles = [];
  var currentUser = null;
  var currentTenant = null;
  var selectedFiles = [];
  var isAuthenticated = false;
  var contentMode = 'demo';
  var DEMO_MODULES = [
    {name:'Kế toán', icon:'fa-calculator', desc:'Hóa đơn, công nợ, hạch toán và báo cáo.', count:1},
    {name:'Kho', icon:'fa-boxes-stacked', desc:'Nhập kho, xuất kho, kiểm kê và tồn kho.', count:3},
    {name:'Bán hàng', icon:'fa-cart-shopping', desc:'Đơn hàng, duyệt giá và trạng thái giao hàng.', count:2},
    {name:'Nhân sự', icon:'fa-id-card', desc:'Chấm công, đơn từ và thông tin nhân viên.', count:1},
    {name:'Hệ thống', icon:'fa-gear', desc:'Đăng nhập, mật khẩu, phân quyền và đồng bộ.', count:2},
    {name:'TNGoffice', icon:'fa-mobile-screen-button', desc:'Thao tác app, thông báo và phê duyệt.', count:1}
  ];
  var DEMO_ARTICLES = [
    {
      id:'demo-duyet-don-winform',
      title:'Cách duyệt đơn hàng trên ERP Winform',
      module:'Bán hàng',
      platform:'pc',
      desc:'Hướng dẫn kiểm tra thông tin và duyệt đơn hàng trên màn hình desktop.',
      time:'4 phút',
      views:1240,
      keywords:'duyet don hang ban hang winform',
      steps:[
        {title:'Mở đúng module', body:'Đăng nhập ERP Winform và truy cập module Bán hàng.'},
        {title:'Kiểm tra đơn hàng', body:'Đối chiếu khách hàng, mã hàng, số lượng, ngày giao và trạng thái xử lý.'},
        {title:'Duyệt hoặc trả lại', body:'Bấm Duyệt nếu thông tin hợp lệ; nếu sai, ghi chú lý do và trả lại bước trước.'}
      ],
      notes:['Nếu nút Duyệt không hiển thị, kiểm tra lại phân quyền hoặc trạng thái đơn hàng.']
    },
    {
      id:'demo-duyet-don-mobile',
      title:'Duyệt đơn hàng trên TNGoffice Mobile',
      module:'Bán hàng',
      platform:'mobile',
      desc:'Thao tác duyệt nhanh bằng điện thoại và kiểm tra trạng thái xử lý.',
      time:'3 phút',
      views:980,
      keywords:'duyet don hang mobile app tngoffice',
      steps:[
        {title:'Mở thông báo phê duyệt', body:'Mở TNGoffice và chọn thông báo đơn hàng cần xử lý.'},
        {title:'Xem chi tiết', body:'Kiểm tra thông tin chính, trạng thái hiện tại và người gửi yêu cầu.'},
        {title:'Xác nhận', body:'Chọn Duyệt hoặc Từ chối kèm lý do.'}
      ],
      notes:[]
    },
    {
      id:'demo-login-error',
      title:'Khắc phục lỗi không đăng nhập được',
      module:'Hệ thống',
      platform:'mobile',
      desc:'Kiểm tra kết nối, phiên bản ứng dụng và đặt lại mật khẩu.',
      time:'2 phút',
      views:1720,
      keywords:'loi dang nhap mat khau mobile',
      steps:[
        {title:'Kiểm tra kết nối', body:'Đảm bảo thiết bị có mạng ổn định và không bị chặn VPN/proxy.'},
        {title:'Kiểm tra tài khoản', body:'Nhập đúng tên đăng nhập, mật khẩu và thử đăng nhập lại.'},
        {title:'Gửi hỗ trợ', body:'Nếu vẫn lỗi, chụp màn hình thông báo và tạo ticket hỗ trợ.'}
      ],
      notes:[]
    },
    {id:'demo-nhap-kho-nvl', title:'Nhập kho nguyên vật liệu trên Winform', module:'Kho', platform:'pc', desc:'Quy trình nhập phiếu, đối chiếu số lượng và lưu chứng từ.', time:'6 phút', views:850, keywords:'nhap kho nguyen vat lieu pc', steps:[], notes:[]},
    {id:'demo-quet-ma-nhap-kho', title:'Quét mã nhập kho bằng TNGoffice', module:'Kho', platform:'mobile', desc:'Dùng camera điện thoại để quét mã và xác nhận số lượng.', time:'4 phút', views:760, keywords:'quet ma nhap kho barcode mobile', steps:[], notes:[]}
  ];

  var $ = function(selector){ return document.querySelector(selector); };
  var $$ = function(selector){ return Array.prototype.slice.call(document.querySelectorAll(selector)); };

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }

  function toast(message){
    var el = $('#toast');
    if(!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  async function requestJson(url, options){
    var response = await fetch(url, Object.assign({credentials:'same-origin'}, options || {}));
    var payload = await response.json().catch(function(){ return {}; });
    if(!response.ok) throw new Error(payload.error || 'Không thể tải dữ liệu.');
    return payload;
  }

  function showLogin(){
    var old = $('#helpLoginShell');
    if(old) old.remove();
    var shell = document.createElement('div');
    shell.id = 'helpLoginShell';
    shell.className = 'help-login-shell';
    shell.innerHTML =
      '<form class="help-login-card" id="helpLoginForm">'+
        '<h1>Đăng nhập Tre Support</h1>'+
        '<p>Vui lòng đăng nhập để xem đúng bộ hướng dẫn dành cho nội bộ hoặc khách hàng của bạn.</p>'+
        '<label for="helpUsername">Tài khoản</label>'+
        '<input id="helpUsername" name="username" autocomplete="username" autofocus>'+
        '<label for="helpPassword">Mật khẩu</label>'+
        '<input id="helpPassword" name="password" type="password" autocomplete="current-password">'+
        '<div style="display:flex;gap:10px;align-items:center;margin-top:16px">'+
          '<button class="primary-btn" type="submit">Đăng nhập</button>'+
          '<button class="secondary-btn" type="button" id="helpLoginCancel">Đóng</button>'+
        '</div>'+
        '<div class="help-login-status" id="helpLoginStatus"></div>'+
      '</form>';
    document.body.insertBefore(shell, document.body.firstChild);
    $('#helpLoginCancel').addEventListener('click', function(){
      shell.remove();
    });
    $('#helpLoginForm').addEventListener('submit', async function(event){
      event.preventDefault();
      var status = $('#helpLoginStatus');
      status.textContent = 'Đang đăng nhập...';
      try{
        await requestJson('/api/help?action=login', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({username:this.username.value, password:this.password.value})
        });
        shell.remove();
        await loadContent();
      }catch(error){
        status.textContent = error.message;
      }
    });
  }

  function unlock(){
    var shell = $('#helpLoginShell');
    if(shell) shell.remove();
  }

  function updateSolutionLoginButton(){
    var button = $('#helpLoginOpen');
    if(!button) return;
    button.innerHTML = isAuthenticated
      ? '<i class="fa-solid fa-book-open"></i> HDSD của tôi'
      : '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập khách ngoài';
  }

  function removeTenantBar(){
    var bar = $('#helpTenantBar');
    if(bar) bar.remove();
  }

  function showPage(name){
    $$('.page').forEach(function(page){ page.classList.remove('active'); });
    var page = $('#page-' + name);
    if(page) page.classList.add('active');
    var isSolution = name === 'benefits';
    if($('#solutionHeader')) $('#solutionHeader').classList.toggle('hidden', !isSolution);
    if($('#appHeader')) $('#appHeader').classList.toggle('hidden', isSolution);
    $$('.nav-link').forEach(function(item){ item.classList.toggle('active', item.dataset.page === name); });
    if($('#mobileMenu')) $('#mobileMenu').classList.add('hidden');
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function badge(platform){
    return platform === 'pc'
      ? '<span class="badge pc"><i class="fa-solid fa-desktop"></i> Winform</span>'
      : '<span class="badge mobile"><i class="fa-solid fa-mobile-screen-button"></i> TNGoffice</span>';
  }

  function card(article){
    return '<article class="article-card" data-id="'+escapeHtml(article.id)+'">'+
      '<div class="badges">'+badge(article.platform)+'<span class="badge module">'+escapeHtml(article.module)+'</span></div>'+
      '<h3>'+escapeHtml(article.title)+'</h3><p>'+escapeHtml(article.desc)+'</p>'+
      '<div class="article-meta"><span><i class="fa-regular fa-clock"></i> '+escapeHtml(article.time || '3 phút')+' · '+Number(article.views || 0).toLocaleString('vi-VN')+' lượt xem</span><button class="ghost-btn open-link" data-open-article="'+escapeHtml(article.id)+'">Xem <i class="fa-solid fa-arrow-right"></i></button></div>'+
    '</article>';
  }

  function renderTenantBar(){
    var nav = $('#appHeader .desktop-nav');
    if(!nav || $('#helpTenantBar')) return;
    var bar = document.createElement('span');
    bar.id = 'helpTenantBar';
    bar.className = 'tenant-pill';
    bar.innerHTML = '<i class="fa-solid fa-building"></i> <span></span> <button class="ghost-btn" type="button" style="padding:4px 7px" id="helpLogout">Thoát</button>';
    nav.appendChild(bar);
    $('#helpLogout').addEventListener('click', async function(){
      await requestJson('/api/help?action=logout', {method:'POST'}).catch(function(){});
      currentUser = null;
      currentTenant = null;
      isAuthenticated = false;
      modules = [];
      articles = [];
      updateSolutionLoginButton();
      showPage('benefits');
    });
  }

  function updateTenantBar(){
    if(contentMode === 'demo'){
      removeTenantBar();
      return;
    }
    renderTenantBar();
    var label = $('#helpTenantBar span');
    if(label) label.textContent = currentTenant ? currentTenant.name : '';
  }

  function renderHome(){
    $('#moduleGrid').innerHTML = modules.map(function(module){
      return '<button class="module-card" data-module="'+escapeHtml(module.name)+'">'+
        '<div class="module-top"><span class="module-icon"><i class="fa-solid '+escapeHtml(module.icon || 'fa-circle-question')+'"></i></span><span class="count">'+Number(module.count || 0)+' bài</span></div>'+
        '<h3>'+escapeHtml(module.name)+'</h3><p>'+escapeHtml(module.desc || '')+'</p>'+
      '</button>';
    }).join('');
    $('#popularGrid').innerHTML = articles.slice().sort(function(a,b){ return Number(b.views || 0) - Number(a.views || 0); }).slice(0,3).map(card).join('');
    var moduleFilter = $('#moduleFilter');
    moduleFilter.innerHTML = '<option value="all">Tất cả module</option>' + modules.map(function(module){
      return '<option value="'+escapeHtml(module.name)+'">'+escapeHtml(module.name)+'</option>';
    }).join('');
    renderKnowledge();
  }

  function renderKnowledge(){
    var q = ($('#kbSearch').value || '').toLowerCase().trim();
    var p = $('#platformFilter').value;
    var m = $('#moduleFilter').value;
    var filtered = articles.filter(function(article){
      var hay = (article.title + ' ' + article.desc + ' ' + article.keywords + ' ' + article.module).toLowerCase();
      return (!q || hay.indexOf(q) !== -1) && (p === 'all' || article.platform === p) && (m === 'all' || article.module === m);
    });
    $('#knowledgeGrid').innerHTML = filtered.map(card).join('');
    $('#emptyState').classList.toggle('hidden', filtered.length > 0);
  }

  function fileSize(bytes){
    var value = Number(bytes || 0);
    if(value >= 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + ' MB';
    if(value >= 1024) return Math.round(value / 1024) + ' KB';
    return value + ' B';
  }

  function attachmentPreview(file){
    if(file.type === 'image'){
      return '<div class="article-media-preview"><img src="'+escapeHtml(file.src)+'" alt="'+escapeHtml(file.name)+'"></div>';
    }
    if(file.type === 'video'){
      return '<div class="article-media-preview"><video src="'+escapeHtml(file.src)+'" controls preload="metadata"></video></div>';
    }
    return '';
  }

  function renderAttachments(article){
    var attachments = Array.isArray(article.attachments) ? article.attachments : [];
    if(!attachments.length) return '';
    return '<section id="media"><h2>File hướng dẫn đính kèm</h2><div class="attachment-list">'+attachments.map(function(file){
      return '<div>'+
        '<div class="attachment-card"><div><strong>'+escapeHtml(file.name)+'</strong><span>'+escapeHtml(file.mime || file.type || 'file')+' · '+fileSize(file.size)+'</span></div><a class="secondary-btn" href="'+escapeHtml(file.src)+'" target="_blank" rel="noopener">Mở/Tải</a></div>'+
        attachmentPreview(file)+
      '</div>';
    }).join('')+'</div></section>';
  }

  function openArticle(id){
    var article = articles.find(function(item){ return String(item.id) === String(id); });
    if(!article) return;
    var steps = Array.isArray(article.steps) && article.steps.length ? article.steps : [
      {title:'Mở đúng module', body:'Đăng nhập hệ thống và truy cập module '+article.module+'. Kiểm tra đúng đơn vị và dữ liệu làm việc.'},
      {title:'Tìm chức năng cần thao tác', body:'Dùng menu hoặc ô tìm kiếm chức năng, sau đó chọn bản ghi cần xử lý.'},
      {title:'Kiểm tra và xác nhận', body:'Đối chiếu thông tin, thực hiện thao tác và chờ thông báo thành công.'}
    ];
    var gesture = article.platform === 'mobile'
      ? '<p><strong>Lưu ý thao tác:</strong> chạm một lần để chọn, vuốt lên/xuống để xem thêm, nhấn giữ khi cần mở tùy chọn.</p>'
      : '<p><strong>Lưu ý thao tác:</strong> sử dụng chuột và phím Tab để di chuyển nhanh giữa các trường nhập liệu.</p>';
    var notes = Array.isArray(article.notes) && article.notes.length
      ? '<section id="notes"><h2>Lưu ý</h2>'+article.notes.map(function(note){ return '<p class="notice"><i class="fa-solid fa-circle-info"></i><span>'+escapeHtml(note)+'</span></p>'; }).join('')+'</section>'
      : '';
    $('#articleContent').innerHTML =
      '<section id="summary">'+
        '<div class="badges">'+badge(article.platform)+'<span class="badge module">'+escapeHtml(article.module)+'</span></div>'+
        '<h1>'+escapeHtml(article.title)+'</h1><p>'+escapeHtml(article.desc)+'</p>'+gesture+
      '</section>'+
      '<section id="steps"><h2>Cách thực hiện</h2>'+
        steps.map(function(step, index){
          return '<div class="step"><div class="step-num">'+(index + 1)+'</div><div><strong>'+escapeHtml(step.title || ('Bước ' + (index + 1)))+'</strong><p>'+escapeHtml(step.body || '')+'</p></div></div>';
        }).join('')+
      '</section>'+
      notes+
      renderAttachments(article)+
      '<section id="feedback" class="feedback"><div><strong>Bạn đã làm được chưa?</strong><div style="color:var(--muted);font-size:14px;margin-top:4px">Phản hồi giúp đội nội dung cải thiện bài hướng dẫn.</div></div><div style="display:flex;gap:8px"><button class="primary-btn feedback-btn" data-value="yes"><i class="fa-solid fa-thumbs-up"></i> Đã làm được</button><button class="secondary-btn feedback-btn" data-value="no"><i class="fa-solid fa-thumbs-down"></i> Chưa được</button></div></section>';
    showPage('article');
    $$('.feedback-btn').forEach(function(button){
      button.addEventListener('click', function(){
        toast(button.dataset.value === 'yes' ? 'Cảm ơn bạn! Phản hồi đã được ghi nhận.' : 'Đã ghi nhận. Bạn có thể gửi ticket để IT hỗ trợ.');
      });
    });
  }

  async function loadContent(options){
    options = options || {};
    var payload = await requestJson('/api/help?action=content');
    currentUser = payload.user;
    currentTenant = payload.tenant;
    isAuthenticated = true;
    contentMode = 'tenant';
    modules = payload.modules || [];
    articles = payload.articles || [];
    unlock();
    updateTenantBar();
    updateSolutionLoginButton();
    renderHome();
    if(options.stayOnBenefits) showPage('benefits');
    else showPage(options.targetPage || 'home');
  }

  function openDemoPage(name){
    contentMode = 'demo';
    modules = DEMO_MODULES.slice();
    articles = DEMO_ARTICLES.slice();
    currentTenant = null;
    removeTenantBar();
    updateSolutionLoginButton();
    renderHome();
    showPage(name);
    return true;
  }

  async function openTenantPage(name){
    if(!isAuthenticated){
      showLogin();
      return false;
    }
    if(contentMode !== 'tenant' || !articles.length) await loadContent({targetPage:name});
    else showPage(name);
    return true;
  }

  function openCurrentPage(name){
    if(contentMode === 'tenant') return openTenantPage(name);
    return Promise.resolve(openDemoPage(name));
  }

  function bindBaseUi(){
    document.querySelectorAll('.brand-solution-link').forEach(function(el){
      el.addEventListener('click', function(event){ event.preventDefault(); showPage('benefits'); });
    });
    $$('[data-page]').forEach(function(el){
      el.addEventListener('click', function(event){
        event.preventDefault();
        var page = el.dataset.page;
        if(page === 'benefits') showPage('benefits');
        else if(page === 'home' && (el.closest('#solutionHeader') || el.closest('#page-benefits'))) openDemoPage('home');
        else openCurrentPage(page).catch(function(error){ toast(error.message); showLogin(); });
      });
    });
    if($('#helpLoginOpen')) $('#helpLoginOpen').addEventListener('click', function(){
      if(isAuthenticated) openTenantPage('home').catch(function(error){ toast(error.message); });
      else showLogin();
    });
    if($('#menuBtn')) $('#menuBtn').addEventListener('click', function(){ $('#mobileMenu').classList.toggle('hidden'); });
    ['kbSearch','platformFilter','moduleFilter'].forEach(function(id){
      var el = $('#' + id);
      if(el) el.addEventListener('input', renderKnowledge);
    });
    if($('#resetFilter')) $('#resetFilter').addEventListener('click', function(){
      $('#kbSearch').value = '';
      $('#platformFilter').value = 'all';
      $('#moduleFilter').value = 'all';
      renderKnowledge();
    });
    $$('.faq-question').forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = btn.closest('.faq-item');
        $$('.faq-item').forEach(function(x){ if(x !== item) x.classList.remove('open'); });
        item.classList.toggle('open');
      });
    });
    document.addEventListener('click', function(event){
      var btn = event.target.closest('[data-open-article]');
      if(btn) openArticle(btn.dataset.openArticle);
    });
    if($('#heroSearchForm')) $('#heroSearchForm').addEventListener('submit', function(event){
      event.preventDefault();
      var query = $('#heroSearch').value;
      openCurrentPage('knowledge').then(function(ok){
        if(!ok) return;
        $('#kbSearch').value = query;
        renderKnowledge();
      }).catch(function(error){ toast(error.message); });
    });
    $$('[data-platform-shortcut]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var platform = btn.dataset.platformShortcut;
        openCurrentPage('knowledge').then(function(ok){
          if(!ok) return;
          $('#platformFilter').value = platform;
          renderKnowledge();
        }).catch(function(error){ toast(error.message); });
      });
    });
    document.addEventListener('click', function(event){
      var btn = event.target.closest('[data-module]');
      if(!btn) return;
      var moduleName = btn.dataset.module;
      openCurrentPage('knowledge').then(function(ok){
        if(!ok) return;
        $('#moduleFilter').value = moduleName;
        renderKnowledge();
      }).catch(function(error){ toast(error.message); });
    });
  }

  function bindChat(){
    var chatPanel = $('#chatPanel');
    var chatMessages = $('#chatMessages');
    var chatText = $('#chatText');
    function openChat(){
      chatPanel.classList.add('open');
      chatPanel.setAttribute('aria-hidden','false');
      setTimeout(function(){ chatText.focus(); },120);
    }
    function closeChat(){
      chatPanel.classList.remove('open');
      chatPanel.setAttribute('aria-hidden','true');
    }
    function appendMessage(text,type){
      var div = document.createElement('div');
      div.className = 'message ' + (type || 'bot');
      div.textContent = text;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function assistantReply(text){
      var q = text.toLowerCase();
      var reply = 'Tôi đã hiểu vấn đề. Trước tiên, hãy kiểm tra kết nối mạng, đăng nhập lại và thử thao tác một lần nữa. Bạn có thể cho tôi biết lỗi xuất hiện trên máy tính hay điện thoại không?';
      if(q.indexOf('đăng nhập') !== -1 || q.indexOf('mat khau') !== -1 || q.indexOf('mật khẩu') !== -1){
        reply = 'Hãy kiểm tra 3 bước: 1) đúng tên đăng nhập; 2) mạng ổn định; 3) thử đặt lại mật khẩu. Nếu có thông báo lỗi cụ thể, hãy gửi nguyên văn để tôi hướng dẫn tiếp.';
      }else if(q.indexOf('duyệt') !== -1 || q.indexOf('đơn hàng') !== -1){
        reply = 'Bạn hãy kiểm tra trạng thái đơn hàng, quyền phê duyệt và người đang giữ bước xử lý hiện tại. Nếu nút Duyệt không xuất hiện, khả năng cao tài khoản chưa đủ quyền hoặc đơn chưa đến đúng bước.';
      }else if(q.indexOf('đồng bộ') !== -1 || q.indexOf('mobile') !== -1 || q.indexOf('điện thoại') !== -1){
        reply = 'Trên điện thoại, hãy kéo xuống để làm mới, kiểm tra mạng, sau đó đăng xuất và đăng nhập lại. Nếu dữ liệu vẫn lệch, hãy quay màn hình ngắn để chuyển cho người hỗ trợ.';
      }
      setTimeout(function(){ appendMessage(reply,'bot'); },450);
    }
    $$('.open-chat').forEach(function(btn){ btn.addEventListener('click', function(event){ event.preventDefault(); openChat(); }); });
    if($('#chatClose')) $('#chatClose').addEventListener('click', closeChat);
    if($('#chatForm')) $('#chatForm').addEventListener('submit', function(event){
      event.preventDefault();
      var text = chatText.value.trim();
      if(!text) return;
      appendMessage(text,'user');
      chatText.value = '';
      assistantReply(text);
    });
    $$('[data-prompt]').forEach(function(btn){ btn.addEventListener('click', function(){ appendMessage(btn.dataset.prompt,'user'); assistantReply(btn.dataset.prompt); }); });
    if($('#humanChat')) $('#humanChat').addEventListener('click', function(){
      appendMessage('Đang chuyển bạn tới nhân viên hỗ trợ. Thời gian chờ dự kiến 1–3 phút. Nếu chưa có người trực, bạn có thể tạo ticket để được tiếp nhận theo SLA.','bot');
      toast('Đã gửi yêu cầu kết nối nhân viên hỗ trợ.');
    });
    if($('#ticketFromChat')) $('#ticketFromChat').addEventListener('click', function(){
      closeChat();
      openCurrentPage('ticket').catch(function(error){ toast(error.message); });
    });
  }

  function bindTicket(){
    var dropzone = $('#dropzone');
    var fileInput = $('#fileInput');
    var fileList = $('#fileList');
    if(!dropzone || !fileInput || !fileList) return;
    dropzone.addEventListener('click', function(){ fileInput.click(); });
    ['dragenter','dragover'].forEach(function(ev){ dropzone.addEventListener(ev, function(event){ event.preventDefault(); dropzone.classList.add('drag'); }); });
    ['dragleave','drop'].forEach(function(ev){ dropzone.addEventListener(ev, function(event){ event.preventDefault(); dropzone.classList.remove('drag'); }); });
    dropzone.addEventListener('drop', function(event){ addFiles(Array.prototype.slice.call(event.dataTransfer.files)); });
    fileInput.addEventListener('change', function(){ addFiles(Array.prototype.slice.call(fileInput.files)); });
    function addFiles(files){
      var valid = files.filter(function(file){ return file.size <= 25 * 1024 * 1024; });
      if(valid.length < files.length) toast('Một số file vượt quá 25 MB và đã bị bỏ qua.');
      selectedFiles = selectedFiles.concat(valid);
      renderFiles();
    }
    function renderFiles(){
      fileList.innerHTML = selectedFiles.map(function(file, index){
        return '<div class="file-item"><span><i class="fa-regular fa-file"></i> '+escapeHtml(file.name)+'</span><button type="button" class="ghost-btn" data-remove-file="'+index+'"><i class="fa-solid fa-xmark"></i></button></div>';
      }).join('');
    }
    fileList.addEventListener('click', function(event){
      var button = event.target.closest('[data-remove-file]');
      if(!button) return;
      selectedFiles.splice(Number(button.dataset.removeFile),1);
      renderFiles();
    });
    if($('#ticketForm')) $('#ticketForm').addEventListener('submit', function(event){
      event.preventDefault();
      if(!event.currentTarget.reportValidity()) return;
      toast('Ticket TRE-' + Math.floor(1000 + Math.random() * 9000) + ' đã được tạo thành công.');
      event.currentTarget.reset();
      selectedFiles = [];
      renderFiles();
    });
  }

  async function init(){
    bindBaseUi();
    bindChat();
    bindTicket();
    try{
      var session = await requestJson('/api/help?action=session');
      if(session.authenticated){
        currentUser = session.user;
        currentTenant = session.tenant;
        isAuthenticated = true;
      }
      updateSolutionLoginButton();
    }catch(error){
      updateSolutionLoginButton();
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
