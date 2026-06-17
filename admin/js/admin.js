/* ═══════════════════════════════════════
   I-CLICKS — Admin Utilities
   ═══════════════════════════════════════ */

function getToken() {
  return localStorage.getItem('admin_token');
}

function getAdminInfo() {
  try { return JSON.parse(localStorage.getItem('admin_info')); } catch { return null; }
}

function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }
  const info = getAdminInfo();
  if (info) {
    const nameEl = document.getElementById('admin-name');
    if (nameEl) nameEl.textContent = info.name || 'Admin';
  }
}

function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_info');
  window.location.href = '/admin/login.html';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

async function authFetch(url, options = {}) {
  const token = getToken();
  options.headers = options.headers || {};
  options.headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, options);
  if (res.status === 401) {
    logout();
    return null;
  }
  return res.json();
}

function showAlert(id, message, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert ${type}`;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
