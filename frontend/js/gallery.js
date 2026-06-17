/* ═══════════════════════════════════════
   I-CLICKS — Gallery Logic
   ═══════════════════════════════════════ */

let state = {
  photos: [],
  page: 1,
  hasMore: true,
  loading: false,
  activeCategory: '',
  activeTag: '',
  searchQuery: '',
  lightboxIndex: -1,
  saved: new Set(),
  liked: new Set()
};

document.addEventListener('DOMContentLoaded', async () => {
  loadCategories();
  loadPhotos(true);
  setupSearch();
  setupLightbox();
  setupInfiniteScroll();
});

// ── Categories ──────────────────────
async function loadCategories() {
  try {
    const data = await api.get('/categories');
    const bar = document.getElementById('category-bar');
    if (!bar || !data.categories) return;
    bar.innerHTML = `<button class="cat-pill active" data-id="" onclick="filterCategory(this, '')">All</button>`;
    data.categories.forEach(cat => {
      bar.innerHTML += `<button class="cat-pill" data-id="${cat._id}" onclick="filterCategory(this, '${cat._id}')">${cat.name} <span style="opacity:0.5;font-size:11px;">${cat.photoCount || ''}</span></button>`;
    });
  } catch (e) {}
}

function filterCategory(btn, categoryId) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  state.activeCategory = categoryId;
  state.activeTag = '';
  loadPhotos(true);
}

// ── Load Photos ──────────────────────
async function loadPhotos(reset = false) {
  if (state.loading) return;
  if (reset) {
    state.page = 1;
    state.photos = [];
    state.hasMore = true;
    const grid = document.getElementById('gallery-grid');
    if (grid) grid.innerHTML = renderSkeletons(12);
  }
  if (!state.hasMore && !reset) return;
  state.loading = true;
  try {
    let url = `/photos?page=${state.page}&limit=20`;
    if (state.activeCategory) url += `&category=${state.activeCategory}`;
    if (state.activeTag) url += `&tag=${encodeURIComponent(state.activeTag)}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;
    const data = await api.get(url);
    if (!data.success) throw new Error(data.message);
    state.photos = reset ? data.photos : [...state.photos, ...data.photos];
    state.hasMore = data.pagination.hasMore;
    state.page++;
    renderGallery(data.photos, reset);
  } catch (e) {
    const grid = document.getElementById('gallery-grid');
    if (grid) grid.innerHTML = `<div class="empty-state"><div style="font-size:48px;">📷</div><p>No photos found</p></div>`;
  } finally {
    state.loading = false;
    updateLoadMoreBtn();
  }
}

// ── Render ───────────────────────────
function renderGallery(photos, reset) {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  if (reset) grid.innerHTML = '';
  if (reset && photos.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div style="font-size:48px;">📷</div><p>No photos found</p></div>`;
    return;
  }

  photos.forEach((photo, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.id = photo._id;
    const realIndex = reset ? idx : state.photos.length - photos.length + idx;
    card.dataset.index = realIndex;
    const aspectRatio = photo.height && photo.width ? (photo.height / photo.width * 100).toFixed(1) : 100;

    card.innerHTML = `
      ${photo.isFeatured ? '<div class="photo-card-featured">Featured</div>' : ''}
      <div style="padding-top:${aspectRatio}%;position:relative;overflow:hidden;">
        <img src="${photo.thumbnailUrl || photo.url}" alt="${escapeHtml(photo.title)}"
             style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
             loading="lazy" />
      </div>
      <div class="photo-card-overlay">
        <div class="photo-card-title">${escapeHtml(photo.title)}</div>
        ${photo.category ? `<div class="photo-card-meta">${photo.category.name}</div>` : ''}
      </div>
      <div class="photo-card-actions">
        <button class="card-action-btn save-btn" title="Save" onclick="toggleSave(event,'${photo._id}',this)">🔖 Save</button>
        <button class="card-action-btn like-btn" title="Like" onclick="toggleLike(event,'${photo._id}',this)">❤️</button>
        <button class="card-action-btn" title="Download" onclick="downloadPhoto(event,'${photo.url}','${escapeHtml(photo.title)}')">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    `;

    // Click card to open lightbox — stop if action button clicked
    card.addEventListener('click', (e) => {
      if (e.target.closest('.photo-card-actions')) return;
      openLightbox(parseInt(card.dataset.index));
    });

    grid.appendChild(card);
  });
}

function renderSkeletons(count) {
  return Array.from({ length: count }, (_, i) => {
    const h = [120, 180, 220, 150, 200, 170][i % 6];
    return `<div class="photo-skeleton" style="height:${h}px;"></div>`;
  }).join('');
}

// ── Save / Like ──────────────────────
function toggleSave(event, id, btn) {
  event.stopPropagation();
  if (state.saved.has(id)) {
    state.saved.delete(id);
    btn.textContent = '🔖 Save';
    btn.classList.remove('saved');
    showToast('Removed from saved');
  } else {
    state.saved.add(id);
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
    showToast('🔖 Saved!');
  }
}

function toggleLike(event, id, btn) {
  event.stopPropagation();
  if (state.liked.has(id)) {
    state.liked.delete(id);
    btn.classList.remove('liked');
  } else {
    state.liked.add(id);
    btn.classList.add('liked');
    showToast('❤️ Liked!');
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#111;color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:500;z-index:9999;animation:none;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// ── Lightbox ─────────────────────────
function setupLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

function openLightbox(index) {
  state.lightboxIndex = index;
  const photo = state.photos[index];
  if (!photo) return;
  const lb = document.getElementById('lightbox');
  lb.querySelector('#lb-img').src = photo.url;
  lb.querySelector('#lb-title').textContent = photo.title;
  lb.querySelector('#lb-desc').textContent = photo.description || '';
  lb.querySelector('#lb-tags').innerHTML = (photo.tags || []).map(t =>
    `<span class="tag-pill" onclick="filterTag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`
  ).join('');
  const meta = lb.querySelector('#lb-meta');
  meta.innerHTML = `
    ${photo.width ? `<div class="meta-row"><span class="meta-label">Resolution</span><span>${photo.width} × ${photo.height}</span></div>` : ''}
    ${photo.device ? `<div class="meta-row"><span class="meta-label">Device</span><span>${photo.device}</span></div>` : ''}
    ${photo.location ? `<div class="meta-row"><span class="meta-label">Location</span><span>${photo.location}</span></div>` : ''}
    <div class="meta-row"><span class="meta-label">Views</span><span>${(photo.views || 0).toLocaleString()}</span></div>
  `;
  lb.querySelector('#lb-download').onclick = () => downloadPhoto(null, photo.url, photo.title);
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  const newIndex = state.lightboxIndex + dir;
  if (newIndex >= 0 && newIndex < state.photos.length) openLightbox(newIndex);
  if (dir === 1 && newIndex >= state.photos.length - 4) loadPhotos();
}

// ── Search ────────────────────────────
let searchTimeout;
function setupSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { state.searchQuery = e.target.value.trim(); loadPhotos(true); }, 400);
  });
}

function filterTag(tag) {
  closeLightbox();
  state.activeTag = tag;
  state.activeCategory = '';
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.cat-pill[data-id=""]')?.classList.add('active');
  loadPhotos(true);
}

// ── Infinite Scroll ───────────────────
function setupInfiniteScroll() {
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.hasMore && !state.loading) loadPhotos();
  }, { rootMargin: '400px' }).observe(sentinel);
}

function updateLoadMoreBtn() {
  const btn = document.getElementById('load-more-btn');
  if (!btn) return;
  btn.style.display = state.hasMore ? 'block' : 'none';
}

// ── Utils ────────────────────────────
function downloadPhoto(event, url, title) {
  if (event) event.stopPropagation();
  const a = document.createElement('a');
  a.href = url;
  a.download = title.replace(/\s+/g, '-').toLowerCase() + '.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}