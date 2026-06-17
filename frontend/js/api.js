/* ═══════════════════════════════════════
   I-CLICKS — API Helper
   ═══════════════════════════════════════ */

const API_BASE = '/api';

const api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  },

  async post(path, data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async postForm(path, formData, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData
    });
    return res.json();
  },

  async put(path, data, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async delete(path, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers });
    return res.json();
  }
};

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
