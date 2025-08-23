(() => {
  const q = (s, r=document) => r.querySelector(s);
  const qq = (s, r=document) => Array.from(r.querySelectorAll(s));

  function showToast(type, message) {
    let c = q('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 30);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2500);
  }

  const state = {
    token: null,
    user: null,
    otpTimer: null,

  };

  function startOtpTimer() {
    // Clear existing timer
    if (state.otpTimer) {
      clearInterval(state.otpTimer);
    }
    
    const timerElement = q('#otpTimer');
    const timerText = q('#timerText');
    
    if (!timerElement || !timerText) return;
    
    // Show timer with animation
    timerElement.style.display = 'block';
    timerElement.classList.remove('expired', 'warning');
    timerElement.style.animation = 'slideInUp 0.5s ease-out';
    
    let timeLeft = 120; // 2 minutes in seconds
    
    const updateTimer = () => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Add warning class when less than 30 seconds
      if (timeLeft <= 30) {
        timerElement.classList.add('warning');
        timerElement.style.animation = 'pulse 1s infinite';
      }
      
      if (timeLeft <= 0) {
        timerElement.classList.add('expired');
        timerText.textContent = 'Süre doldu!';
        timerElement.style.animation = 'shake 0.5s ease-in-out';
        clearInterval(state.otpTimer);
        state.otpTimer = null;
        
        // Disable verify button when expired
        const verifyBtn = q('#adminVerifyOtpBtn');
        if (verifyBtn) {
          verifyBtn.disabled = true;
          verifyBtn.textContent = 'Kod süresi doldu';
          verifyBtn.style.background = 'linear-gradient(135deg, #ff4757, #c44569)';
          verifyBtn.style.cursor = 'not-allowed';
        }
        
        showToast('error', 'Doğrulama kodunun süresi doldu. Yeniden gönderin.');
        return;
      }
      
      timeLeft--;
    };
    
    // Update immediately and then every second
    updateTimer();
    state.otpTimer = setInterval(updateTimer, 1000);
  }

  function stopOtpTimer() {
    if (state.otpTimer) {
      clearInterval(state.otpTimer);
      state.otpTimer = null;
    }
    
    const timerElement = q('#otpTimer');
    if (timerElement) {
      timerElement.style.display = 'none';
      timerElement.style.animation = '';
    }
  }

  // Toggle password visibility
  function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggleBtn = input.nextElementSibling;
    const icon = toggleBtn.querySelector('i');
    
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
      toggleBtn.setAttribute('title', 'Şifreyi gizle');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
      toggleBtn.setAttribute('title', 'Şifreyi göster');
    }
  }



  // Apply clean design styles
  function applyCleanDesign() {
    // Reduce animation intensity
    const style = document.createElement('style');
    style.textContent = `
      .admin-sidebar .btn:hover {
        transform: translateX(4px) !important;
      }
      
      .admin-card:hover {
        transform: translateY(-2px) !important;
      }
      
      .admin-table tbody tr:hover {
        transform: none !important;
      }
      
      .btnEdit:hover, .btnDel:hover, .btnDelContact:hover, .btnDelUser:hover {
        transform: translateY(-1px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Enhanced loading states with better feedback
  function showLoading(element, text = 'Yükleniyor...') {
    if (!element) return;
    
    // Prevent multiple loading states on the same element
    if (element.dataset.loading === 'true') {
      return;
    }
    
    // Store original state
    const originalHTML = element.innerHTML;
    const originalDisabled = element.disabled;
    const originalOpacity = element.style.opacity;
    const originalCursor = element.style.cursor;
    
    // Set loading state
    element.dataset.loading = 'true';
    element.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
    element.disabled = true;
    element.style.opacity = '0.7';
    element.style.cursor = 'wait';
    
    // Return cleanup function
    return () => {
      if (element) {
        element.dataset.loading = 'false';
        element.innerHTML = originalHTML;
        element.disabled = originalDisabled;
        element.style.opacity = originalOpacity || '1';
        element.style.cursor = originalCursor || 'pointer';
      }
    };
  }

  // Enhanced table row animations with better timing
  function animateTableRow(row, delay = 0) {
    row.style.opacity = '0';
    row.style.transform = 'translateY(20px)';
    row.style.transition = 'none';
    
    setTimeout(() => {
      row.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      row.style.opacity = '1';
      row.style.transform = 'translateY(0)';
    }, delay);
  }

  // Better error handling for API calls
  async function safeApiCall(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      showToast('error', `İşlem başarısız: ${error.message}`);
      throw error;
    }
  }

  function setAuth(token, user) {
    console.log('setAuth called with:', { token: token ? token.substring(0, 20) + '...' : null, user });
    state.token = token;
    state.user = user;
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(user));
    

    
    // Hide login, show dashboard
    q('#adminLogin').style.display = 'none';
    const dashboard = q('#adminDashboard');
    dashboard.style.display = 'block';
    
    // Force visibility for all dashboard elements
    forceAdminVisibility();
    
    // Load initial data
    loadProducts();
    loadOrders();
    loadContacts();
    loadUsers();
    loadCoupons();
    loadReviews();
    loadNotifications();
    

    
    // Show all sections by default
    setTimeout(() => {
      showSection('users');
      showSection('products');
      showSection('orders');
      showSection('contacts');
      showSection('coupons');
      showSection('reviews');
    }, 100);
  }

  // Get token from cookie
  function getCookieToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  // Force visibility for admin panel elements

  
  function forceAdminVisibility() {
    const dashboard = q('#adminDashboard');
    const sidebar = q('.admin-sidebar');
    const content = q('.admin-content');
    
    if (dashboard) {
      dashboard.style.display = 'block';
      dashboard.style.visibility = 'visible';
      dashboard.style.opacity = '1';
    }
    
    if (sidebar) {
      sidebar.style.display = 'block';
      sidebar.style.visibility = 'visible';
      sidebar.style.opacity = '1';
      
      // Force sidebar text visibility
      const sidebarTexts = sidebar.querySelectorAll('*');
      sidebarTexts.forEach(el => {
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.display = 'revert';
      });
    }
    
    if (content) {
      content.style.display = 'flex';
      content.style.visibility = 'visible';
      content.style.opacity = '1';
    }
    
    // Force table visibility
    const tables = document.querySelectorAll('.admin-table');
    tables.forEach(table => {
      table.style.display = 'table';
      table.style.visibility = 'visible';
      table.style.opacity = '1';
      
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        row.style.display = 'table-row';
        row.style.visibility = 'visible';
        row.style.opacity = '1';
        
        const cells = row.querySelectorAll('th, td');
        cells.forEach(cell => {
          cell.style.display = 'table-cell';
          cell.style.visibility = 'visible';
          cell.style.opacity = '1';
        });
      });
    });
    
    console.log('Admin visibility forced');
  }

  // Attempt to get session from /api/auth/me using stored token
  async function probeSession() {
    try {
      // First check if we have a stored token
      const token = localStorage.getItem('adminToken') || getCookieToken();
      console.log('probeSession - stored token:', token ? token.substring(0, 20) + '...' : null);
      if (!token) {
        console.log('No token found, showing login screen');
        return;
      }
      
      // Use the stored token to verify session
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      
      if (!res.ok) {
        // Token is invalid, clear it
        console.log('Token invalid, clearing localStorage');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        state.token = null;
        state.user = null;
        
        // Show login screen
        const loginDiv = q('#adminLogin');
        const dashboardDiv = q('#adminDashboard');
        if (loginDiv) loginDiv.style.display = 'block';
        if (dashboardDiv) dashboardDiv.style.display = 'none';
        return;
      }
      
      const data = await res.json();
      if (data.ok && data.user) {
        setAuth(token, data.user);
      }
    } catch (error) {
      console.error('Session probe error:', error);
      // Clear invalid tokens on error
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
    }
  }

  async function loginAdmin(email, password) {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('loginAdmin called with:', { email, password: password ? '***' : 'undefined' });
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      console.log('Login response status:', res.status);
      console.log('Login response headers:', res.headers);
      
      const data = await res.json();
      console.log('Login response data:', data);

    // Handle OTP step on successful response
    if (res.ok && data && data.ok && data.step === 'otp_required') {
      console.log('OTP step required, processing (success branch)...');
      const otpSection = q('#adminOtpSection');
      const loginBtn = q('#adminLoginBtn');
      const verifyBtn = q('#adminVerifyOtpBtn');

      if (otpSection) {
        otpSection.removeAttribute('style');
        otpSection.classList.add('otp-visible');
        otpSection.style.display = 'block';
        otpSection.style.visibility = 'visible';
        otpSection.style.opacity = '1';
        otpSection.style.height = 'auto';
        otpSection.style.overflow = 'visible';
        otpSection.style.position = 'static';
        otpSection.style.zIndex = '1000';

        setTimeout(() => {
          if (typeof bindOtpActions === 'function') bindOtpActions();
          // Start the OTP timer
          startOtpTimer();
        }, 50);
      } else {
        console.error('OTP section element not found!');
      }
      if (loginBtn) loginBtn.style.display = 'none';
      if (verifyBtn) verifyBtn.style.display = 'block';
              showToast('success', 'Giriş kodu e-postanıza gönderildi. Kod 2 dakika geçerlidir.');
      return { step: 'otp' };
    }

    // Error branch
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'login_failed');
    }

    // Full login completed (should include token)
    if (data.token && data.user) {
      setAuth(data.token, data.user);
      return;
    }

    // Fallback: no token but ok==true; treat as error
    throw new Error('unexpected_login_response');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (state.token) {
      h['Authorization'] = 'Bearer ' + state.token;
      console.log('authHeaders - using token:', state.token.substring(0, 20) + '...');
    } else {
      console.log('authHeaders - no token found in state');
    }
    return h;
  }

  async function loadProducts() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadProducts - no token, skipping API call');
      return;
    }
    
    const loadingBtn = q('#navProducts');
    const stopLoading = showLoading(loadingBtn, 'Yükleniyor...');
    
    try {
      console.log('loadProducts - calling /api/admin/products with headers:', authHeaders());
      const res = await fetch('/api/admin/products', { headers: authHeaders() });
      if (!res.ok) {
        showToast('error', 'Ürünler yüklenemedi');
        return;
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Ürünler yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblProducts tbody');
      tbody.innerHTML = '';
      
      if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz ürün bulunmuyor</td></tr>';
        showToast('info', 'Henüz ürün bulunmuyor');
        return;
      }
      
      items.forEach((p, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${p.id}</strong></td>
          <td><strong>${p.name}</strong></td>
          <td><code>${p.slug}</code></td>
          <td><strong>₺${(p.price/100).toFixed(2)}</strong></td>
          <td>${p.currency}</td>
          <td>${p.category || '-'}</td>
          <td>${p.platform || '-'}</td>
          <td>${p.package_level || '-'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btnEdit" data-id="${p.id}" title="Düzenle"><i class="fas fa-edit"></i></button>
              <button class="btn btnDel" data-id="${p.id}" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
        
        // Animate each row with staggered delay
        animateTableRow(tr, index * 100);
      });
      
      showToast('success', `${items.length} ürün yüklendi`);
      
      // bind row actions
      qq('.btnEdit', tbody).forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.id)));
      qq('.btnDel', tbody).forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.id)));
      
    } catch (error) {
      console.error('Load products error:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        showToast('error', 'İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edin.');
      } else {
        showToast('error', 'Ürünler yüklenirken hata oluştu: ' + error.message);
      }
      
      // Show empty state on error
      const tbody = q('#tblProducts tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">Ürünler yüklenemedi</td></tr>';
      }
    } finally {
      if (stopLoading) stopLoading();
    }
  }

  async function loadOrders() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadOrders - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/orders', { headers: authHeaders() });
      if (!res.ok) { 
        showToast('error', 'Sipariş yükleme hatası'); 
        return; 
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Siparişler yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblOrders tbody');
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz sipariş bulunmuyor</td></tr>';
        showToast('info', 'Henüz sipariş bulunmuyor');
        return;
      }
      
      items.forEach(o => {
        const tr = document.createElement('tr');
        const createdDate = new Date(o.created_at).toLocaleDateString('tr-TR');
        const userName = o.user_name || `Kullanıcı #${o.user_id}`;
        const userEmail = o.user_email || 'Bilinmeyen';
        
        tr.innerHTML = `
          <td>${o.id}</td>
          <td><strong>${userName}</strong><br><small>${userEmail}</small></td>
          <td><strong>₺${(o.total_price/100).toFixed(2)}</strong></td>
          <td><span class="status-badge ${o.status}">${o.status}</span></td>
          <td>${createdDate}</td>
        `;
        tbody.appendChild(tr);
      });
      
      showToast('success', `${items.length} sipariş yüklendi`);
      
    } catch (error) {
      console.error('Load orders error:', error);
      showToast('error', 'Siparişler yüklenirken hata oluştu: ' + error.message);
    }
  }

  async function loadContacts() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadContacts - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/contacts', { headers: authHeaders() });
      if (!res.ok) { 
        showToast('error', 'Mesaj yükleme hatası'); 
        return; 
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Mesajlar yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblContacts tbody');
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz mesaj bulunmuyor</td></tr>';
        showToast('info', 'Henüz mesaj bulunmuyor');
        return;
      }
      
      items.forEach(c => {
        const tr = document.createElement('tr');
        const createdDate = new Date(c.created_at).toLocaleDateString('tr-TR');
        const messagePreview = c.message.length > 50 ? c.message.substring(0, 50) + '...' : c.message;
        
        tr.innerHTML = `
          <td><strong>#${c.id}</strong></td>
          <td><strong>${c.name}</strong></td>
          <td><code>${c.email}</code></td>
          <td><em>${c.subject || '-'}</em></td>
          <td><div class="message-preview" title="${c.message}">${messagePreview}</div></td>
          <td><small>${createdDate}</small></td>
          <td>
            <button class="btn btnDelContact" data-id="${c.id}" title="Mesajı Sil"><i class="fas fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      showToast('success', `${items.length} mesaj yüklendi`);
      
      // Bind event listeners
      qq('.btnDelContact', tbody).forEach(b => b.addEventListener('click', () => deleteContact(b.dataset.id)));
      
    } catch (error) {
      console.error('Load contacts error:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        showToast('error', 'İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edin.');
      } else {
        showToast('error', 'Mesajlar yüklenirken hata oluştu: ' + error.message);
      }
      
      // Show empty state on error
      const tbody = q('#tblContacts tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Mesajlar yüklenemedi</td></tr>';
      }
    }
  }

  async function deleteContact(id) {
    if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { 
        method: 'DELETE', 
        headers: authHeaders() 
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Mesaj silinemedi');
      }
      
      // Find and remove the row from the table instead of reloading
      const tbody = q('#tblContacts tbody');
      const rows = tbody.querySelectorAll('tr');
      
      rows.forEach(row => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && firstCell.textContent.includes(`#${id}`)) {
          // Add fade out animation
          row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          row.style.opacity = '0';
          row.style.transform = 'translateX(-20px)';
          
          // Remove the row after animation
          setTimeout(() => {
            row.remove();
            
            // Check if table is empty and show message
            const remainingRows = tbody.querySelectorAll('tr');
            if (remainingRows.length === 0) {
              tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz mesaj bulunmuyor</td></tr>';
            }
          }, 300);
        }
      });
      
      showToast('success', 'Mesaj silindi');
    } catch (error) {
      console.error('Delete contact error:', error);
      showToast('error', 'Mesaj silinirken hata oluştu: ' + error.message);
    }
  }

  async function loadUsers() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadUsers - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      if (!res.ok) { 
        showToast('error', 'Kullanıcılar yüklenemedi'); 
        return; 
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Kullanıcılar yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblUsers tbody');
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz kullanıcı bulunmuyor</td></tr>';
        showToast('info', 'Henüz kullanıcı bulunmuyor');
        return;
      }
      
              items.forEach(u => {
          const tr = document.createElement('tr');
          const createdDate = new Date(u.created_at).toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          tr.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${u.name || '-'}</strong></td>
            <td><code>${u.email || '-'}</code></td>
            <td><span class="role-badge ${u.role}">${u.role || 'user'}</span></td>
            <td>${u.email_verified ? '<span class="verified-badge">✓ Doğrulandı</span>' : '<span class="pending-badge">⏳ Bekliyor</span>'}</td>
            <td>${createdDate}</td>
            <td>${u.role !== 'admin' ? `<button class="btn btnDelUser" data-id="${u.id}" title="Kullanıcıyı Sil"><i class="fas fa-trash"></i></button>` : '<span class="admin-protected">Admin</span>'}</td>
          `;
          tbody.appendChild(tr);
        });
      
      showToast('success', `${items.length} kullanıcı yüklendi`);
      qq('.btnDelUser', tbody).forEach(b => b.addEventListener('click', () => deleteUser(b.dataset.id)));
      
    } catch (error) {
      console.error('Load users error:', error);
      showToast('error', 'Kullanıcılar yüklenirken hata oluştu: ' + error.message);
    }
  }

  async function loadSupportSummary() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadSupportSummary - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/support/ratings/summary', { headers: authHeaders() });
      if (!res.ok) { 
        console.warn('Support summary failed'); 
        return; 
      }
      
      const data = await res.json();
      
      // Update summary display
      const totalElement = document.getElementById('totalRatings');
      const avgElement = document.getElementById('avgRating');
      
      if (totalElement) totalElement.textContent = data.total || 0;
      if (avgElement) avgElement.textContent = data.average ? data.average.toFixed(1) : '-';
      
    } catch (error) {
      console.error('Load support summary error:', error);
    }
  }

  async function loadSupportRatings() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadSupportRatings - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/support/ratings', { headers: authHeaders() });
      if (!res.ok) { 
        console.warn('Support ratings failed'); 
        showToast('error', 'Destek değerlendirmeleri yüklenemedi');
        return; 
      }
      
      const data = await res.json();
      
      const tbody = q('#tblSupport tbody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      if (!data.items || data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz değerlendirme bulunmuyor</td></tr>';
        showToast('info', 'Henüz değerlendirme bulunmuyor');
        return;
      }
      
      data.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Create star rating display
        const stars = Array(5).fill(0).map((_, i) => 
          `<span class="star ${i < item.rating ? 'filled' : ''}">★</span>`
        ).join('');
        
        tr.innerHTML = `
          <td><strong>#${item.id}</strong></td>
          <td><div class="rating-stars">${stars}</div></td>
          <td style="max-width: 200px; word-wrap: break-word;">${item.comment || '-'}</td>
          <td><small>${item.user_email || 'Anonim'}</small></td>
          <td>${new Date(item.created_at).toLocaleDateString('tr-TR')}</td>
        `;
        
        tbody.appendChild(tr);
        
        // Animate each row with staggered delay
        animateTableRow(tr, index * 100);
      });
      
      showToast('success', `${data.items.length} değerlendirme yüklendi`);
      
    } catch (error) {
      console.error('Load support ratings error:', error);
      showToast('error', 'Destek değerlendirmeleri yüklenirken hata oluştu');
    }
  }

  async function deleteUser(id) {
    if (!confirm('Kullanıcıyı silmek istiyor musunuz?')) return;
    try {
      const res = await fetch('/api/admin/users/' + id, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { showToast('error', 'Kullanıcı silinemedi'); return; }
      showToast('success', 'Kullanıcı silindi');
      loadUsers();
    } catch { showToast('error', 'Ağ hatası'); }
  }

  // OTP actions - bind these after OTP section becomes visible
  function bindOtpActions() {
    // Add input validation for OTP field
    const codeInput = q('#adminOtp');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => {
        // Remove non-numeric characters
        e.target.value = e.target.value.replace(/\D/g, '');
        
        // Limit to 6 characters
        if (e.target.value.length > 6) {
          e.target.value = e.target.value.slice(0, 6);
        }
      });
      
      codeInput.addEventListener('keypress', (e) => {
        // Allow only numeric keys and control keys
        if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }
    
    const vbtn = q('#adminVerifyOtpBtn');
    if (vbtn) {
      vbtn.addEventListener('click', async () => {
        // Prevent duplicate clicks
        if (vbtn.disabled) {
          console.log('OTP verification already in progress');
          return;
        }
        
        // Disable button to prevent duplicate requests
        vbtn.disabled = true;
        vbtn.textContent = 'Doğrulanıyor...';
        const emailInput = q('#adminEmail');
        const codeInput = q('#adminOtp');
        
        if (!emailInput) {
          console.error('Email input not found');
          showToast('error', 'E-posta alanı bulunamadı');
          return;
        }
        
        if (!codeInput) {
          console.error('OTP input not found');
          showToast('error', 'Doğrulama kodu alanı bulunamadı');
          return;
        }
        
        const email = emailInput.value.trim();
        const code = codeInput.value.trim();
        
        console.log('Email input value:', email);
        console.log('OTP input value:', code);
        console.log('OTP input length:', code.length);
        console.log('OTP input type:', typeof code);
        
        if (!email) {
          showToast('error', 'E-posta adresi gerekli');
          return;
        }
        
        if (!code) {
          showToast('error', 'Doğrulama kodu gerekli');
          return;
        }
        
        if (code.length !== 6) {
          showToast('error', 'Doğrulama kodu 6 haneli olmalı');
          return;
        }
        
        if (!/^\d{6}$/.test(code)) {
          showToast('error', 'Doğrulama kodu sadece rakam içermeli');
          // Clear invalid input
          if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
          }
          return;
        }
        try {
          const requestBody = { email, code };
          console.log('=== OTP VERIFICATION REQUEST ===');
          console.log('Sending request body:', requestBody);
          
          const res = await fetch('/api/auth/login/verify-otp', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(requestBody) 
          });
          
          console.log('OTP verification response status:', res.status);
          console.log('OTP verification response headers:', res.headers);
          
          const data = await res.json();
          console.log('OTP verification response data:', data);
          
          // Check if OTP verification was successful
          if (data.ok && data.token && data.user) {
            // Stop OTP timer on successful verification
            stopOtpTimer();
            
            // Clear OTP input on success
            const codeInput = q('#adminOtp');
            if (codeInput) {
              codeInput.value = '';
            }
            
            setAuth(data.token, data.user);
            showToast('success', 'Giriş tamamlandı');
          } else {
            // Show specific error message
            let errorMsg = 'Kod doğrulanamadı';
            
            if (data.error) {
              switch (data.error) {
                case 'validation_failed':
                  errorMsg = 'Geçersiz veri formatı';
                  if (data.details) {
                    console.log('Validation details:', data.details);
                  }
                  break;
                case 'invalid_code':
                  errorMsg = 'Geçersiz doğrulama kodu';
                  break;
                case 'used_code':
                  errorMsg = 'Bu kod zaten kullanılmış';
                  break;
                case 'expired_code':
                  errorMsg = 'Kod süresi dolmuş';
                  break;
                case 'email_not_verified':
                  errorMsg = 'E-posta adresi doğrulanmamış';
                  break;
                default:
                  errorMsg = data.error;
              }
            }
            
            showToast('error', errorMsg);
            console.log('OTP verification failed:', data);
            
            // Clear OTP input on error
            const codeInput = q('#adminOtp');
            if (codeInput) {
              codeInput.value = '';
              codeInput.focus();
            }
            
            // Re-enable button on error
            vbtn.disabled = false;
            vbtn.textContent = 'Kodu Doğrula';
          }
        } catch (error) { 
          console.error('OTP verification error:', error);
          showToast('error', 'Ağ hatası');
          
          // Re-enable button on error
          vbtn.disabled = false;
          vbtn.textContent = 'Kodu Doğrula';
        }
      });
    }
    
    const rbtn = q('#adminResendOtpBtn');
    if (rbtn) {
      rbtn.addEventListener('click', async () => {
        const email = q('#adminEmail').value.trim();
        if (!email) return showToast('error', 'E‑posta gerekli');
        try { 
          await fetch('/api/auth/login/resend-otp', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email }) 
          }); 
          
          // Clear OTP input and restart timer
          const codeInput = q('#adminOtp');
          if (codeInput) {
            codeInput.value = '';
            codeInput.focus();
          }
          
          // Restart OTP timer
          stopOtpTimer(); // Stop existing timer first
          startOtpTimer(); // Start new timer
          
          showToast('success', 'Yeni kod gönderildi'); 
        } catch { 
          showToast('error', 'Ağ hatası'); 
        }
      });
    }
  }

  // Section management
  function showSection(section) {
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    
    // Get all admin cards
    const allCards = document.querySelectorAll('.admin-card[id$="Card"]');
    
    if (isMobile) {
      // On mobile, hide all cards first, then show only the selected one
      allCards.forEach(card => {
        card.style.display = 'none';
      });
    } else {
      // On desktop, show all cards
      allCards.forEach(card => {
        card.style.display = 'block';
      });
    }
    
    // Find the target card for this section
    let targetCard;
    switch (section) {
      case 'products':
        targetCard = document.getElementById('productsCard');
        break;
      case 'orders':
        targetCard = document.getElementById('ordersCard');
        break;
      case 'contacts':
        targetCard = document.getElementById('contactsCard');
        break;
      case 'users':
        targetCard = document.getElementById('usersCard');
        break;
      case 'support':
        targetCard = document.getElementById('supportCard');
        break;
      case 'featured':
        targetCard = document.getElementById('featuredCard');
        break;
      case 'coupons':
        targetCard = document.getElementById('couponsCard');
        break;
      case 'reviews':
        targetCard = document.getElementById('reviewsCard');
        break;
      case 'notifications':
        targetCard = document.getElementById('notificationsCard');
        break;
    }
    
    if (targetCard) {
      // Show the target card
      targetCard.style.display = 'block';
      
      if (!isMobile) {
        // On desktop, smooth scroll to the target card
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    

    
    // Load data for the selected section
    switch (section) {
      case 'products':
        if (state.token) loadProducts();
        break;
      case 'orders':
        if (state.token) loadOrders();
        break;
      case 'contacts':
        if (state.token) loadContacts();
        break;
      case 'users':
        if (state.token) loadUsers();
        break;
      case 'support':
        if (state.token) {
          loadSupportSummary();
          loadSupportRatings();
        }
        break;
      case 'featured':
        if (state.token) loadFeaturedProducts();
        break;
      case 'coupons':
        if (state.token) loadCoupons();
        break;
      case 'reviews':
        if (state.token) loadReviews();
        break;
      case 'notifications':
        if (state.token) loadNotifications();
        break;
    }
  }

  function bindUI() {
    // Password toggle functionality
    q('.password-toggle').addEventListener('click', (e) => {
      e.preventDefault();
      const toggleBtn = e.target.closest('.password-toggle');
      const inputId = toggleBtn.parentElement.querySelector('input').id;
      togglePassword(inputId);
    });
    

    
    q('#adminLoginBtn').addEventListener('click', async () => {
      const email = q('#adminEmail').value.trim();
      const password = q('#adminPassword').value;
      try {
        const r = await loginAdmin(email, password);
        // OTP adımına geçtiyse veya tam giriş tamamlandıysa başarılı
        if (!r || (r && r.step === 'otp')) {
          // OTP adımındaysa farklı mesaj göster
          if (r && r.step === 'otp') {
            // showToast zaten loginAdmin içinde gösteriliyor
          } else {
            showToast('success', 'Giriş başarılı');
          }
        }
      } catch (e) {
        console.error('Login error:', e);
        showToast('error', 'Giriş başarısız: ' + e.message);
      }
    });
    
    // Bind OTP actions initially and after OTP section becomes visible
    bindOtpActions();
    
    // Navigation
    q('#navProducts').addEventListener('click', () => showSection('products'));
    q('#navOrders').addEventListener('click', () => showSection('orders'));
    q('#navContacts').addEventListener('click', () => showSection('contacts'));
    q('#navUsers').addEventListener('click', () => showSection('users'));
    q('#navSupport').addEventListener('click', () => showSection('support'));
    q('#navFeatured').addEventListener('click', () => showSection('featured'));
    q('#navCoupons').addEventListener('click', () => showSection('coupons'));
    q('#navReviews').addEventListener('click', () => showSection('reviews'));
    q('#navNotifications').addEventListener('click', () => showSection('notifications'));
  
    q('#btnLogout').addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        console.error('Logout error:', e);
      }
      
      // Clear localStorage
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      state.token = null;
      state.user = null;
      
      // Redirect to admin login
      location.href = '/admin';
    });

    // product modal
    q('#btnOpenNewProduct').addEventListener('click', () => openProductModal());
    q('#closeProductModal').addEventListener('click', closeProductModal);
    q('#saveProductBtn').addEventListener('click', saveProduct);

    // featured products modal
    q('#addFeaturedBtn').addEventListener('click', () => openFeaturedModal());
    q('#closeFeaturedModal').addEventListener('click', closeFeaturedModal);
    q('#saveFeaturedBtn').addEventListener('click', saveFeaturedProduct);
    q('#deleteFeaturedBtn').addEventListener('click', deleteFeaturedProduct);
    
    // coupons
    q('#addCouponBtn').addEventListener('click', () => openCouponModal());
    q('#closeCouponModal').addEventListener('click', closeCouponModal);
    q('#saveCouponBtn').addEventListener('click', saveCoupon);
    q('#deleteCouponBtn').addEventListener('click', () => deleteCoupon(q('#couponModal').dataset.id));
    
    // Coupon type change handler
    q('#cType').addEventListener('change', updateCouponValueHelp);
    
    // Notifications
    q('#addNotificationBtn').addEventListener('click', () => openNotificationModal());
    q('#closeNotificationModal').addEventListener('click', closeNotificationModal);
    q('#sendNotificationBtn').addEventListener('click', sendNotification);
    q('#nTarget').addEventListener('change', toggleUserSelect);
    

  }

  function openProductModal(id) {
    const overlay = q('#productModal');
    overlay.dataset.id = id || '';
    if (id) {
      // load existing
      const tbody = q('#tblProducts tbody');
      const rows = tbody.querySelectorAll('tr');
      let row = null;
      
      // Find row by ID in first cell
      for (const tr of rows) {
        const firstCell = tr.querySelector('td:first-child');
        if (firstCell && firstCell.textContent.includes(id)) {
          row = tr;
          break;
        }
      }
    }
    // clear fields
    if (!id) {
      q('#pName').value=''; 
      q('#pSlug').value=''; 
      q('#pPrice').value='0'; 
      q('#pCurrency').value='TRY'; 
      q('#pCategory').value=''; 
      q('#pPlatform').value=''; 
      q('#pPackageLevel').value=''; 
      q('#pDesc').value='';
    }
    overlay.classList.add('active');
    
    // Add ESC key listener
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeProductModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Add click outside to close
    const clickOutsideHandler = (e) => {
      if (e.target === overlay) {
        closeProductModal();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
      }
    };
    overlay.addEventListener('click', clickOutsideHandler);
  }

  function closeProductModal() {
    q('#productModal').classList.remove('active');
  }

  async function saveProduct() {
    const id = q('#productModal').dataset.id;
    const body = {
      name: q('#pName').value.trim(),
      slug: q('#pSlug').value.trim(),
      price: parseInt(q('#pPrice').value || '0', 10),
      currency: q('#pCurrency').value.trim() || 'TRY',
      category: q('#pCategory').value.trim() || null,
      platform: q('#pPlatform').value.trim() || null,
      package_level: q('#pPackageLevel').value.trim() || null,
      description: q('#pDesc').value.trim() || null,
    };
    
    // Validation
    if (!body.name || !body.slug || body.price <= 0) {
      showToast('error', 'Lütfen gerekli alanları doldurun');
      return;
    }
    
    try {
      let res;
      if (id) {
        res = await fetch('/api/products/' + id, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
      } else {
        res = await fetch('/api/products', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'save_failed');
      showToast('success', 'Ürün başarıyla kaydedildi ve öne çıkarılanlara eklendi!');
      closeProductModal();
      if (state.token) {
        loadProducts();
        loadFeaturedProducts(); // Refresh featured products
      }
    } catch (e) {
      showToast('error', 'Kayıt başarısız: ' + (e.message || 'Bilinmeyen hata'));
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch('/api/products/' + id, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('delete_failed');
      
      // Find and remove the row from the table instead of reloading
      const tbody = q('#tblProducts tbody');
      const rows = tbody.querySelectorAll('tr');
      
      rows.forEach(row => {
        const firstCell = row.querySelector('td:first-child');
        if (firstCell && firstCell.textContent.includes(`#${id}`)) {
          // Add fade out animation
          row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          row.style.opacity = '0';
          row.style.transform = 'translateX(-20px)';
          
          // Remove the row after animation
          setTimeout(() => {
            row.remove();
            
            // Check if table is empty and show message
            const remainingRows = tbody.querySelectorAll('tr');
            if (remainingRows.length === 0) {
              tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz ürün bulunmuyor</td></tr>';
            }
          }, 300);
        }
      });
      
      showToast('success', 'Ürün silindi');
      
      // Trigger real-time update on main page for product deletion
      triggerMainPageProductUpdate();
    } catch (e) {
      showToast('error', 'Silme başarısız');
    }
  }

  // Support rating filters
  function applySupportFilters() {
    const rating = document.getElementById('ratingFilter').value;
    const hasComment = document.getElementById('commentFilter').value;
    const dateFrom = document.getElementById('dateFromFilter').value;
    const dateTo = document.getElementById('dateToFilter').value;
    const search = document.getElementById('searchFilter').value;
    
    const params = new URLSearchParams();
    if (rating) params.append('rating', rating);
    if (hasComment) params.append('has_comment', hasComment);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (search) params.append('search', search);
    
    loadSupportRatingsWithFilters(params.toString());
  }
  
  function clearSupportFilters() {
    document.getElementById('ratingFilter').value = '';
    document.getElementById('commentFilter').value = '';
    document.getElementById('dateFromFilter').value = '';
    document.getElementById('dateToFilter').value = '';
    document.getElementById('searchFilter').value = '';
    
    if (state.token) {
      loadSupportRatings();
    }
  }
  
  async function loadSupportRatingsWithFilters(queryString) {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadSupportRatingsWithFilters - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/support/ratings?${queryString}`, { headers: authHeaders() });
      if (!res.ok) { 
        console.warn('Support ratings failed'); 
        showToast('error', 'Filtreleme başarısız');
        return; 
      }
      
      const data = await res.json();
      
      const tbody = q('#tblSupport tbody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      if (!data.items || data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Filtreye uygun sonuç bulunamadı</td></tr>';
        showToast('info', 'Filtreye uygun sonuç bulunamadı');
        return;
      }
      
      data.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // Create star rating display
        const stars = Array(5).fill(0).map((_, i) => 
          `<span class="star ${i < item.rating ? 'filled' : ''}">★</span>`
        ).join('');
        
        tr.innerHTML = `
          <td><strong>#${item.id}</strong></td>
          <td><div class="rating-stars">${stars}</div></td>
          <td style="max-width: 200px; word-wrap: break-word;">${item.comment || '-'}</td>
          <td><small>${item.user_email || 'Anonim'}</small></td>
          <td>${new Date(item.created_at).toLocaleDateString('tr-TR')}</td>
        `;
        
        tbody.appendChild(tr);
        
        // Animate each row with staggered delay
        animateTableRow(tr, index * 100);
      });
      
      showToast('success', `${data.items.length} sonuç bulundu`);
      
    } catch (error) {
      console.error('Load support ratings with filters error:', error);
      showToast('error', 'Filtreleme sırasında hata oluştu');
    }
  }

  // Handle window resize for responsive behavior
  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    const allCards = document.querySelectorAll('.admin-card[id$="Card"]');
    
    if (!isMobile) {
      // On desktop, show all cards
      allCards.forEach(card => {
        card.style.display = 'block';
      });

    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyCleanDesign(); // Apply clean design styles
  
    bindUI();
    probeSession();
    
    // Show all admin cards by default
    const allCards = document.querySelectorAll('.admin-card[id$="Card"]');
    allCards.forEach(card => {
      card.style.display = 'block';
    });
    
    // Don't load products by default - wait for successful authentication
    // loadProducts() will be called from setAuth() after successful login
  });

  // View Featured Product Details
  window.viewFeaturedProduct = function(productId) {
    // Öne çıkan ürün detaylarını göster
    const product = window.featuredProducts?.find(p => p.id === productId);
    if (product) {
      showToast('info', `${product.name} - ${product.platform} - ₺${product.price}`);
      // Burada ürün detay modal'ı açılabilir
      console.log('Featured Product Details:', product);
    }
  }

  // Featured Products Management
  async function loadFeaturedProducts() {
    const loadingBtn = q('#navFeatured');
    const stopLoading = showLoading(loadingBtn, 'Yükleniyor...');
    
    try {
      // Check if user is authenticated
      if (!state.token) {
        showToast('error', 'Oturum açmanız gerekiyor');
        return;
      }
      
      const response = await fetch('/api/admin/featured', {
        headers: authHeaders()
      });
      
      if (!response.ok) { 
        if (response.status === 401) {
          showToast('error', 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
          // Redirect to login
          location.reload();
          return;
        }
        showToast('error', 'Öne çıkan ürünler yüklenemedi'); 
        return; 
      }
      
      const data = await response.json();
      if (!data.ok) {
        showToast('error', 'Öne çıkan ürünler yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      // Global değişkene ata
      window.featuredProducts = items;
      displayFeaturedProducts(items);
      updateFeaturedSummary(items);
      
      if (items.length === 0) {
        showToast('info', 'Henüz öne çıkan ürün bulunmuyor');
      } else {
        showToast('success', `${items.length} öne çıkan ürün yüklendi`);
      }
      
    } catch (error) {
      console.error('Error loading featured products:', error);
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        showToast('error', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
      } else {
        showToast('error', 'Öne çıkan ürünler yüklenirken hata oluştu: ' + error.message);
      }
    } finally {
      if (stopLoading) stopLoading();
    }
  }
  
  function displayFeaturedProducts(products) {
    const tbody = document.getElementById('tblFeatured').querySelector('tbody');
    tbody.innerHTML = '';
    
    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz öne çıkan ürün bulunmuyor</td></tr>';
      return;
    }
    
    products.forEach((product, index) => {
      const row = document.createElement('tr');
      const discountText = product.discount > 0 ? `-${product.discount}%` : '-';
      const badgeText = product.badge ? getBadgeText(product.badge) : '-';
      const iconPreview = product.icon ? `<i class="${product.icon}" style="font-size: 18px; color: var(--primary-color);"></i>` : '-';
      const finalPrice = product.discount > 0 ? 
        product.price * (1 - product.discount / 100) : product.price;
      
      row.innerHTML = `
        <td><strong>${product.display_order}</strong></td>
        <td><strong style="cursor: pointer; color: var(--primary-color);" onclick="viewFeaturedProduct(${product.id})">${product.name}</strong></td>
        <td><code>${product.platform}</code></td>
        <td>
          <strong>₺${product.price}</strong>
          ${product.discount > 0 ? `<br><small style="color: var(--success-color);">Final: ₺${finalPrice.toFixed(2)}</small>` : ''}
        </td>
        <td>
          ${product.discount > 0 ? 
            `<span class="status-badge discount">${discountText}</span>` : 
            '<span style="color: var(--text-muted);">-</span>'
          }
        </td>
        <td>
          ${product.badge ? 
            `<span class="status-badge ${product.badge}">${badgeText}</span>` : 
            '<span style="color: var(--text-muted);">-</span>'
          }
        </td>
        <td>${iconPreview}</td>
        <td>
          <button class="btn btnEdit" onclick="window.editFeaturedProduct(${product.id})" title="Düzenle">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btnDel" onclick="window.deleteFeaturedProduct(${product.id})" title="Sil">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      
      // Add hover effect
      row.addEventListener('mouseenter', () => row.style.backgroundColor = 'var(--bg-hover)');
      row.addEventListener('mouseleave', () => row.style.backgroundColor = '');
      
      tbody.appendChild(row);
    });
  }
  
  function updateFeaturedSummary(products) {
    const totalFeatured = document.getElementById('totalFeatured');
    const totalValue = document.getElementById('totalFeaturedValue');
    
    if (totalFeatured) totalFeatured.textContent = products.length;
    
    if (totalValue) {
      const totalPrice = products.reduce((sum, product) => {
        const finalPrice = product.discount > 0 ? 
          product.price * (1 - product.discount / 100) : product.price;
        return sum + finalPrice;
      }, 0);
      totalValue.textContent = totalPrice.toFixed(2);
    }
  }
  
  function getBadgeText(badge) {
    switch (badge) {
      case 'discount': return 'İndirim';
      case 'hot': return 'Popüler';
      case 'new': return 'Yeni';
      default: return badge;
    }
  }
  
  // Global function for opening featured modal
  window.openFeaturedModal = function(id = null) {
    const modal = document.getElementById('featuredModal');
    const deleteBtn = document.getElementById('deleteFeaturedBtn');
    
    if (id) {
      // Edit mode
      modal.dataset.id = id;
      deleteBtn.style.display = 'inline-block';
      loadFeaturedProductData(id);
    } else {
      // Add mode
      modal.dataset.id = '';
      deleteBtn.style.display = 'none';
      clearFeaturedForm();
    }
    
    modal.classList.add('active');
  }
  
  // Global function for closing featured modal
  window.closeFeaturedModal = function() {
    document.getElementById('featuredModal').classList.remove('active');
  }
  
  // Global function for clearing featured form
  window.clearFeaturedForm = function() {
    document.getElementById('fName').value = '';
    document.getElementById('fPlatform').value = '';
    document.getElementById('fPrice').value = '0';
    document.getElementById('fDiscount').value = '0';
    document.getElementById('fBadge').value = '';
    document.getElementById('fIcon').value = '';
    document.getElementById('fOrder').value = '1';
    document.getElementById('iconPreview').innerHTML = '';
  }
  
  // Global function for loading featured product data
  window.loadFeaturedProductData = async function(id) {
    try {
      const response = await fetch(`/api/admin/featured`, {
        headers: authHeaders()
      });
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error('Failed to load product data');
      }
      
      const product = data.items.find(p => p.id == id);
      if (product) {
        document.getElementById('fName').value = product.name;
        document.getElementById('fPlatform').value = product.platform;
        document.getElementById('fPrice').value = product.price;
        document.getElementById('fDiscount').value = product.discount;
        document.getElementById('fBadge').value = product.badge || '';
        document.getElementById('fIcon').value = product.icon || '';
        document.getElementById('fOrder').value = product.display_order;
        
        // Update icon preview
        if (product.icon) {
          document.getElementById('iconPreview').innerHTML = `<i class="${product.icon}"></i>`;
        } else {
          document.getElementById('iconPreview').innerHTML = '';
        }
      }
    } catch (error) {
      console.error('Error loading product data:', error);
      showToast('error', 'Ürün bilgileri yüklenemedi');
    }
  };
  
  // Global function for saving featured product
  window.saveFeaturedProduct = async function() {
    const id = document.getElementById('featuredModal').dataset.id;
    const formData = {
      name: document.getElementById('fName').value.trim(),
      platform: document.getElementById('fPlatform').value.trim(),
      price: parseFloat(document.getElementById('fPrice').value) || 0,
      discount: parseFloat(document.getElementById('fDiscount').value) || 0,
      badge: document.getElementById('fBadge').value || null,
      icon: document.getElementById('fIcon').value.trim(),
      display_order: parseInt(document.getElementById('fOrder').value) || 1
    };
    
    if (!formData.name || !formData.platform || formData.price <= 0) {
      showToast('error', 'Lütfen gerekli alanları doldurun');
      return;
    }
    
    if (formData.discount < 0 || formData.discount > 100) {
      showToast('error', 'İndirim oranı 0-100 arasında olmalıdır');
      return;
    }
    
    if (formData.display_order < 1) {
      showToast('error', 'Sıra numarası 1\'den küçük olamaz');
      return;
    }
    
    try {
      showLoading();
      let response;
      if (id) {
        // Update existing
        response = await fetch(`/api/admin/featured/${id}`, {
          method: 'PUT',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        // Create new
        response = await fetch('/api/admin/featured', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      
      if (!response.ok) {
        throw new Error('Network error');
      }
      
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      
      showToast('success', id ? 'Ürün güncellendi' : 'Ürün eklendi');
      closeFeaturedModal();
      loadFeaturedProducts();
      
      // Trigger immediate update on main page
      triggerMainPageUpdate();
    } catch (error) {
      console.error('Error saving featured product:', error);
      showToast('error', 'Kayıt başarısız: ' + error.message);
    } finally {
      if (stopLoading) stopLoading();
    }
  }
  
  // Global function for deleting featured product
  window.deleteFeaturedProduct = async function(id) {
    if (!id) {
      // If called from modal, get ID from modal
      id = document.getElementById('featuredModal').dataset.id;
    }
    
    if (!id) {
      showToast('error', 'Silinecek ürün ID\'si bulunamadı');
      return;
    }
    
    if (!confirm('Bu öne çıkan ürünü silmek istediğinize emin misiniz?')) {
      return;
    }
    
    try {
      showLoading();
      const response = await fetch(`/api/admin/featured/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Network error');
      }
      
      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to delete');
      }
      
      showToast('success', 'Ürün silindi');
      
      // Close modal if it was open
      const modal = document.getElementById('featuredModal');
      if (modal && modal.classList.contains('active')) {
        closeFeaturedModal();
      }
      
      loadFeaturedProducts();
      
      // Trigger immediate update on main page
      triggerMainPageUpdate();
    } catch (error) {
      console.error('Error deleting featured product:', error);
      showToast('error', 'Silme başarısız: ' + error.message);
    } finally {
      if (stopLoading) stopLoading();
    }
  }

  // Global function for editing featured product
  window.editFeaturedProduct = function(id) {
    window.openFeaturedModal(id);
  }

  // Trigger immediate update on main page
  function triggerMainPageUpdate() {
    try {
      // Use localStorage to signal main page to update
      localStorage.setItem('featuredProductsUpdate', Date.now().toString());
      
      // Also try to use BroadcastChannel if supported
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('featuredProductsChannel');
        channel.postMessage({ type: 'update', timestamp: Date.now() });
        channel.close();
      }
    } catch (error) {
      console.log('Could not trigger main page update:', error);
    }
  }
  
  // Trigger immediate update on main page for product changes
  function triggerMainPageProductUpdate() {
    try {
      // Use localStorage to signal main page to update products
      localStorage.setItem('productsUpdate', Date.now().toString());
      
      // Also try to use BroadcastChannel if supported
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('productsChannel');
        channel.postMessage({ type: 'update', timestamp: Date.now() });
        channel.close();
      }
    } catch (error) {
      console.log('Could not trigger main page product update:', error);
    }
  }
  
  // Load coupons for admin panel
  async function loadCoupons() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadCoupons - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/coupons', { headers: authHeaders() });
      if (!res.ok) { 
        showToast('error', 'Kuponlar yüklenemedi'); 
        return; 
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Kuponlar yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblCoupons tbody');
      if (!tbody) return; // Table might not exist yet
      
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz kupon bulunmuyor</td></tr>';
        showToast('info', 'Henüz kupon bulunmuyor');
        return;
      }
      
      items.forEach(coupon => {
        const tr = document.createElement('tr');
        const validFrom = new Date(coupon.valid_from).toLocaleDateString('tr-TR');
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString('tr-TR') : 'Süresiz';
        const isActive = coupon.is_active ? 'Aktif' : 'Pasif';
        const usageLimit = coupon.max_uses === -1 ? 'Sınırsız' : coupon.max_uses;
        
        tr.innerHTML = `
          <td><strong>#${coupon.id}</strong></td>
          <td><code style="font-size: 14px; font-weight: 600; color: var(--accent-color);">${coupon.code}</code></td>
          <td><span class="coupon-type-badge ${coupon.type}">${coupon.type === 'percentage' ? 'Yüzde' : 'Sabit'}</span></td>
          <td><strong>${coupon.type === 'percentage' ? `%${coupon.value}` : `₺${(coupon.value/100).toFixed(2)}`}</strong></td>
          <td><code>₺${(coupon.min_order_amount/100).toFixed(2)}</code></td>
          <td><span class="usage-count">${coupon.used_count} / ${usageLimit}</span></td>
          <td>
            <div style="font-size: 11px; line-height: 1.2; text-align: center;">
              <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 3px;">${validFrom}</div>
              <div style="color: var(--text-muted); font-size: 10px;">→</div>
              <div style="font-weight: 500; color: var(--text-primary); margin-top: 3px;">${validUntil}</div>
            </div>
          </td>
          <td><span class="status-badge ${coupon.is_active ? 'active' : 'inactive'}">${isActive}</span></td>
          <td>
            <button class="btn btnEditCoupon" data-id="${coupon.id}" title="Düzenle" style="margin-right: 5px;"><i class="fas fa-edit"></i></button>
            <button class="btn btnDelCoupon" data-id="${coupon.id}" title="Sil"><i class="fas fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      showToast('success', `${items.length} kupon yüklendi`);
      
      // Bind event listeners
      qq('.btnEditCoupon', tbody).forEach(b => b.addEventListener('click', () => editCoupon(b.dataset.id)));
      qq('.btnDelCoupon', tbody).forEach(b => b.addEventListener('click', () => deleteCoupon(b.dataset.id)));
      
    } catch (error) {
      console.error('Load coupons error:', error);
      showToast('error', 'Kuponlar yüklenirken hata oluştu: ' + error.message);
    }
  }
  
  // Load product reviews for admin panel
  async function loadReviews() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadReviews - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/reviews', { headers: authHeaders() });
      if (!res.ok) { 
        showToast('error', 'Yorumlar yüklenemedi'); 
        return; 
      }
      
      const data = await res.json();
      if (!data.ok) {
        showToast('error', 'Yorumlar yüklenemedi: ' + (data.error || 'Bilinmeyen hata'));
        return;
      }
      
      const items = data.items || [];
      const tbody = q('#tblReviews tbody');
      if (!tbody) return; // Table might not exist yet
      
      tbody.innerHTML = '';
      
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz yorum bulunmuyor</td></tr>';
        showToast('info', 'Henüz yorum bulunmuyor');
        return;
      }
      
      items.forEach(review => {
        const tr = document.createElement('tr');
        const createdDate = new Date(review.created_at).toLocaleDateString('tr-TR');
        const stars = Array(5).fill(0).map((_, i) => 
          `<span class="star ${i < review.rating ? 'filled' : ''}">★</span>`
        ).join('');
        
        // Limit text lengths for better display
        const productName = review.product_name || 'Bilinmeyen';
        const shortProductName = productName.length > 12 ? productName.substring(0, 12) + '...' : productName;
        
        const reviewTitle = review.title || '-';
        const shortTitle = reviewTitle.length > 15 ? reviewTitle.substring(0, 15) + '...' : reviewTitle;
        
        const reviewComment = review.comment || '-';
        const shortComment = reviewComment.length > 25 ? reviewComment.substring(0, 25) + '...' : reviewComment;
        
        tr.innerHTML = `
          <td><strong>#${review.id}</strong></td>
          <td title="${productName}"><strong style="font-size: 11px;">${shortProductName}</strong></td>
          <td><div class="rating-stars" style="font-size: 11px;">${stars}</div></td>
          <td title="${reviewTitle}"><em style="font-size: 10px;">${shortTitle}</em></td>
          <td title="${reviewComment}"><div class="review-comment" style="font-size: 10px; line-height: 1.2;">${shortComment}</div></td>
          <td><span class="status-badge ${review.is_approved ? 'approved' : 'pending'}" style="font-size: 9px; padding: 2px 4px;">${review.is_approved ? 'Onay' : 'Bekl.'}</span></td>
          <td><small style="font-size: 9px;">${createdDate}</small></td>
          <td style="white-space: nowrap;">
            <button class="btn btnToggleReview" data-id="${review.id}" data-approved="${review.is_approved}" title="${review.is_approved ? 'Onayı Kaldır' : 'Onayla'}" style="margin-right: 2px; padding: 3px 4px; font-size: 10px; min-width: auto;">
              <i class="fas fa-${review.is_approved ? 'times' : 'check'}"></i>
            </button>
            <button class="btn btnDelReview" data-id="${review.id}" title="Sil" style="padding: 3px 4px; font-size: 10px; min-width: auto;"><i class="fas fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      showToast('success', `${items.length} yorum yüklendi`);
      
      // Bind event listeners
      qq('.btnToggleReview', tbody).forEach(b => b.addEventListener('click', () => toggleReviewApproval(b.dataset.id, b.dataset.approved === 'true')));
      qq('.btnDelReview', tbody).forEach(b => b.addEventListener('click', () => deleteReview(b.dataset.id)));
      
    } catch (error) {
      console.error('Load reviews error:', error);
      showToast('error', 'Yorumlar yüklenirken hata oluştu: ' + error.message);
    }
  }
  
  // Coupon management functions
  function openCouponModal(id) {
    const overlay = q('#couponModal');
    overlay.dataset.id = id || '';
    
    if (id) {
      // Load existing coupon data
      loadCouponData(id);
      q('#deleteCouponBtn').style.display = 'block';
    } else {
      // Clear fields for new coupon
      clearCouponFields();
      q('#deleteCouponBtn').style.display = 'none';
    }
    
    // Update help text based on initial type
    updateCouponValueHelp();
    
    overlay.classList.add('active');
    
    // Add ESC key listener
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeCouponModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Add click outside to close
    const clickOutsideHandler = (e) => {
      if (e.target === overlay) {
        closeCouponModal();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
      }
    };
    overlay.addEventListener('click', clickOutsideHandler);
  }

  function closeCouponModal() {
    q('#couponModal').classList.remove('active');
  }

  function clearCouponFields() {
    q('#cCode').value = '';
    q('#cType').value = 'percentage';
    q('#cValue').value = '0';
    q('#cMinOrder').value = '0';
    q('#cMaxUses').value = '-1';
    q('#cValidUntil').value = '';
    q('#cStatus').value = '1';
    updateCouponValueHelp();
  }

  function updateCouponValueHelp() {
    const type = q('#cType').value;
    const helpText = q('#cValueHelp');
    const valueInput = q('#cValue');
    
    if (type === 'percentage') {
      helpText.textContent = 'Yüzde için 0-100 arası değer girin';
      valueInput.placeholder = 'Örn: 15';
      valueInput.step = '0.01';
    } else {
      helpText.textContent = 'Sabit tutar için kuruş cinsinden değer girin (örn: 1000 = 10₺)';
      valueInput.placeholder = 'Örn: 1000';
      valueInput.step = '1';
    }
  }

  async function loadCouponData(id) {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadCouponData - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { headers: authHeaders() });
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Kupon yüklenemedi');
      }
      
      const coupon = data.coupon;
      q('#cCode').value = coupon.code;
      q('#cType').value = coupon.type;
      q('#cValue').value = coupon.type === 'percentage' ? coupon.value : (coupon.value / 100).toFixed(2);
      q('#cMinOrder').value = (coupon.min_order_amount / 100).toFixed(2);
      q('#cMaxUses').value = coupon.max_uses;
      q('#cValidUntil').value = coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : '';
      q('#cStatus').value = coupon.is_active ? '1' : '0';
      updateCouponValueHelp();
    } catch (error) {
      console.error('Load coupon data error:', error);
      showToast('error', 'Kupon verisi yüklenirken hata oluştu: ' + error.message);
    }
  }

  async function saveCoupon() {
    const id = q('#couponModal').dataset.id;
    const type = q('#cType').value;
    const value = parseFloat(q('#cValue').value);
    const minOrder = parseFloat(q('#cMinOrder').value);
    const maxUses = parseInt(q('#cMaxUses').value);
    const validUntil = q('#cValidUntil').value;
    const status = q('#cStatus').value === '1';
    
    // Validation
    if (!q('#cCode').value.trim()) {
      showToast('error', 'Kupon kodu gerekli');
      return;
    }
    
    if (type === 'percentage' && (value <= 0 || value > 100)) {
      showToast('error', 'Yüzde değeri 0-100 arasında olmalı');
      return;
    }
    
    if (type === 'fixed' && value <= 0) {
      showToast('error', 'Sabit tutar 0\'dan büyük olmalı');
      return;
    }
    
    if (minOrder < 0) {
      showToast('error', 'Minimum sipariş tutarı negatif olamaz');
      return;
    }
    
    if (maxUses < -1) {
      showToast('error', 'Maksimum kullanım -1\'den küçük olamaz');
      return;
    }
    
    const body = {
      code: q('#cCode').value.trim(),
      type: type,
      value: type === 'percentage' ? Math.round(value) : Math.round(value * 100), // Convert to kuruş for fixed
      min_order_amount: Math.round(minOrder * 100), // Convert to kuruş
      max_uses: maxUses,
      valid_until: validUntil || null,
      is_active: status
    };
    
    try {
      let res;
      if (id) {
        res = await fetch(`/api/admin/coupons/${id}`, { 
          method: 'PUT', 
          headers: authHeaders(), 
          body: JSON.stringify(body) 
        });
      } else {
        res = await fetch('/api/admin/coupons', { 
          method: 'POST', 
          headers: authHeaders(), 
          body: JSON.stringify(body) 
        });
      }
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Kupon kaydedilemedi');
      }
      
      showToast('success', `Kupon ${id ? 'güncellendi' : 'eklendi'}`);
      closeCouponModal();
      loadCoupons();
    } catch (error) {
      console.error('Save coupon error:', error);
      showToast('error', 'Kupon kaydedilirken hata oluştu: ' + error.message);
    }
  }

  async function editCoupon(id) {
    openCouponModal(id);
  }
  
  async function deleteCoupon(id) {
    if (!confirm('Bu kuponu silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { 
        method: 'DELETE', 
        headers: authHeaders() 
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Kupon silinemedi');
      }
      
      showToast('success', 'Kupon silindi');
      loadCoupons();
    } catch (error) {
      console.error('Delete coupon error:', error);
      showToast('error', 'Kupon silinirken hata oluştu: ' + error.message);
    }
  }
  
  // Review management functions
  async function toggleReviewApproval(id, isCurrentlyApproved) {
    const action = isCurrentlyApproved ? 'onayını kaldırmak' : 'onaylamak';
    if (!confirm(`Bu yorumun ${action} istediğinize emin misiniz?`)) return;
    
    try {
      const res = await fetch(`/api/admin/reviews/${id}/toggle-approval`, { 
        method: 'PUT', 
        headers: authHeaders() 
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Yorum durumu güncellenemedi');
      }
      
      showToast('success', `Yorum ${isCurrentlyApproved ? 'onayı kaldırıldı' : 'onaylandı'}`);
      loadReviews();
    } catch (error) {
      console.error('Toggle review approval error:', error);
      showToast('error', 'Yorum durumu güncellenirken hata oluştu: ' + error.message);
    }
  }
  
  async function deleteReview(id) {
    if (!confirm('Bu yorumu silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { 
        method: 'DELETE', 
        headers: authHeaders() 
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Yorum silinemedi');
      }
      
      showToast('success', 'Yorum silindi');
      loadReviews();
    } catch (error) {
      console.error('Delete review error:', error);
      showToast('info', 'Yorum silinirken hata oluştu: ' + error.message);
    }
  }
  
  // Notification management functions
  async function loadNotifications() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadNotifications - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/notifications', { headers: authHeaders() });
      
      if (!res.ok) {
        if (res.status === 404) {
          // No notifications found, show empty state
          const tbody = q('#tblNotifications tbody');
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz bildirim bulunmuyor</td></tr>';
          }
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Bildirimler yüklenemedi');
      }
      
      const tbody = q('#tblNotifications tbody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      const notifications = data.notifications || [];
      
      if (notifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Henüz bildirim bulunmuyor</td></tr>';
        return;
      }
      
      notifications.forEach(notification => {
        const row = document.createElement('tr');
        const createdAt = new Date(notification.created_at).toLocaleDateString('tr-TR');
        const isRead = notification.is_read ? 'Evet' : 'Hayır';
        const userName = notification.user_name || 'Bilinmeyen Kullanıcı';
        const userEmail = notification.user_email || 'N/A';
        
        row.innerHTML = `
          <td><strong>#${notification.id}</strong></td>
          <td>${userName} (${userEmail})</td>
          <td><strong>${notification.title}</strong></td>
          <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${notification.message}</td>
          <td><span class="notification-type-badge ${notification.type}">${notification.type}</span></td>
          <td><span class="read-status ${notification.is_read ? 'read' : 'unread'}">${isRead}</span></td>
          <td>${createdAt}</td>
        `;
        
        tbody.appendChild(row);
      });
      
    } catch (error) {
      console.error('Load notifications error:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        showToast('error', 'İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edin.');
      } else {
        showToast('error', 'Bildirimler yüklenirken hata oluştu: ' + error.message);
      }
      
      // Show empty state on error
      const tbody = q('#tblNotifications tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Bildirimler yüklenemedi</td></tr>';
      }
    }
  }

  function openNotificationModal() {
    const overlay = q('#notificationModal');
    
    // Clear fields
    q('#nTitle').value = '';
    q('#nMessage').value = '';
    q('#nType').value = 'admin';
    q('#nTarget').value = 'all';
    
    // Load users for selection
    loadUsersForNotification();
    
    // Hide user select initially
    toggleUserSelect();
    
    overlay.classList.add('active');
    
    // Add ESC key listener
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeNotificationModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Add click outside to close
    const clickOutsideHandler = (e) => {
      if (e.target === overlay) {
        closeNotificationModal();
        overlay.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', escHandler);
      }
    };
    overlay.addEventListener('click', clickOutsideHandler);
  }

  function closeNotificationModal() {
    q('#notificationModal').classList.remove('active');
  }

  function toggleUserSelect() {
    const target = q('#nTarget').value;
    const userSelectGroup = q('#userSelectGroup');
    
    if (target === 'specific') {
      userSelectGroup.style.display = 'block';
    } else {
      userSelectGroup.style.display = 'none';
    }
  }

  async function loadUsersForNotification() {
    // Check if user is authenticated before making API call
    if (!state.token) {
      console.log('loadUsersForNotification - no token, skipping API call');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/users', { headers: authHeaders() });
      const data = await res.json();
      
      if (!res.ok || !data.ok) {
        throw new Error('Kullanıcılar yüklenemedi');
      }
      
      // Check if data.users exists and is an array
      if (!data.users || !Array.isArray(data.users)) {
        console.warn('Users data is not available or not an array:', data);
        return;
      }
      
      const userSelect = q('#nUsers');
      if (!userSelect) {
        console.warn('User select element not found');
        return;
      }
      
      userSelect.innerHTML = '';
      
      data.users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.email})`;
        userSelect.appendChild(option);
      });
      
    } catch (error) {
      console.error('Load users for notification error:', error);
      showToast('error', 'Kullanıcılar yüklenirken hata oluştu');
    }
  }

  async function sendNotification() {
    const title = q('#nTitle').value.trim();
    const message = q('#nMessage').value.trim();
    const type = q('#nType').value;
    const target = q('#nTarget').value;
    
    // Validation
    if (!title) {
      showToast('error', 'Başlık gerekli');
      return;
    }
    
    if (!message) {
      showToast('error', 'Mesaj gerekli');
      return;
    }
    
    let userIds = null;
    if (target === 'specific') {
      const selectedUsers = Array.from(q('#nUsers').selectedOptions).map(option => parseInt(option.value));
      if (selectedUsers.length === 0) {
        showToast('error', 'En az bir kullanıcı seçin');
        return;
      }
      userIds = selectedUsers;
    }
    
    const body = {
      title: title,
      message: message,
      type: type,
      user_ids: userIds
    };
    
    try {
      const res = await fetch('/api/admin/notifications', { 
        method: 'POST', 
        headers: authHeaders(), 
        body: JSON.stringify(body) 
      });
      
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Bildirim gönderilemedi');
      }
      
      showToast('success', data.message || 'Bildirim gönderildi');
      closeNotificationModal();
      loadNotifications();
    } catch (error) {
      console.error('Send notification error:', error);
      showToast('error', 'Bildirim gönderilirken hata oluştu: ' + error.message);
    }
  }



  // Global function for icon preview
  window.previewIcon = function() {
    const iconSelect = document.getElementById('fIcon');
    const iconPreview = document.getElementById('iconPreview');
    
    if (iconSelect.value) {
      iconPreview.innerHTML = `<i class="${iconSelect.value}"></i>`;
    } else {
      iconPreview.innerHTML = '';
    }
  };
})();

// Global function for icon preview
window.previewIcon = function() {
  const iconSelect = document.getElementById('fIcon');
  const iconPreview = document.getElementById('iconPreview');
  
  if (iconSelect.value) {
    iconPreview.innerHTML = `<i class="${iconSelect.value}"></i>`;
  } else {
    iconPreview.innerHTML = '';
  }
};

// Global function for clearing featured form
window.clearFeaturedForm = function() {
  document.getElementById('fName').value = '';
  document.getElementById('fPlatform').value = '';
  document.getElementById('fPrice').value = '0';
  document.getElementById('fDiscount').value = '0';
  document.getElementById('fBadge').value = '';
  document.getElementById('fIcon').value = '';
  document.getElementById('fOrder').value = '1';
  document.getElementById('iconPreview').innerHTML = '';
};

// Global function for closing featured modal
window.closeFeaturedModal = function() {
  document.getElementById('featuredModal').classList.remove('active');
};

// Global function for opening featured modal
window.openFeaturedModal = function(id = null) {
  const modal = document.getElementById('featuredModal');
  const deleteBtn = document.getElementById('deleteFeaturedBtn');
  
  if (id) {
    // Edit mode
    modal.dataset.id = id;
    deleteBtn.style.display = 'inline-block';
    loadFeaturedProductData(id);
  } else {
    // Add mode
    modal.dataset.id = '';
    deleteBtn.style.display = 'none';
    clearFeaturedForm();
  }
  
  modal.classList.add('active');
};

// Global functions for featured products management
window.editFeaturedProduct = function(id) {
  window.openFeaturedModal(id);
};

window.deleteFeaturedProduct = async function(id) {
  if (!id) {
    // If called from modal, get ID from modal
    id = document.getElementById('featuredModal').dataset.id;
  }
  
  if (!id) {
    alert('Silinecek ürün ID\'si bulunamadı');
    return;
  }
  
  if (!confirm('Bu öne çıkan ürünü silmek istediğinize emin misiniz?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/featured/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
      }
    });
    
    if (!response.ok) {
      throw new Error('Network error');
    }
    
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.error || 'Failed to delete');
    }
    
    showToast('success', 'Ürün silindi');
    
    // Close modal if it was open
    const modal = document.getElementById('featuredModal');
    if (modal && modal.classList.contains('active')) {
      window.closeFeaturedModal();
    }
    
    // Reload featured products
    if (typeof loadFeaturedProducts === 'function') {
      loadFeaturedProducts();
    }
    
  } catch (error) {
    console.error('Error deleting featured product:', error);
    showToast('error', 'Silme başarısız: ' + error.message);
  }
};

// Event listeners for featured modal
document.addEventListener('DOMContentLoaded', function() {
  // Save featured product button
  const saveFeaturedBtn = document.getElementById('saveFeaturedBtn');
  if (saveFeaturedBtn) {
    saveFeaturedBtn.addEventListener('click', window.saveFeaturedProduct);
  }
  
  // Close featured modal button
  const closeFeaturedBtn = document.getElementById('closeFeaturedModal');
  if (closeFeaturedBtn) {
    closeFeaturedBtn.addEventListener('click', window.closeFeaturedModal);
  }
  
  // Delete featured product button
  const deleteFeaturedBtn = document.getElementById('deleteFeaturedBtn');
  if (deleteFeaturedBtn) {
    deleteFeaturedBtn.addEventListener('click', () => {
      const modal = document.getElementById('featuredModal');
      const id = modal.dataset.id;
      if (id) {
        window.deleteFeaturedProduct(id);
      }
    });
  }
});


