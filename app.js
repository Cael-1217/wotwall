// ==================== TanksWall v2.1 ====================

const TYPE_ICONS = {
  '重坦': `<g stroke="currentColor" stroke-width="3" stroke-linecap="butt">
             <line x1="8"  y1="4" x2="4"  y2="20"/>
             <line x1="14" y1="4" x2="10" y2="20"/>
             <line x1="20" y1="4" x2="16" y2="20"/>
           </g>`,
  '中坦': `<g stroke="currentColor" stroke-width="4" stroke-linecap="butt">
             <line x1="10" y1="4" x2="6"  y2="20"/>
             <line x1="18" y1="4" x2="14" y2="20"/>
           </g>`,
  '轻坦': `<polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/>`,
  '自行火炮/歼击车': `<polygon points="2,3 22,3 12,21" fill="currentColor"/>`,
  '防空车': `<polygon points="12,3 22,21 2,21" fill="currentColor"/>`,
  '工程车': `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="currentColor"/>`,
};

const MERGED_TD_SPG = '自行火炮/歼击车';
const TD_SPG_ALIASES = ['反坦', '火炮', MERGED_TD_SPG];
function isTDorSPG(type) { return TD_SPG_ALIASES.includes(type); }
function displayType(type) { return isTDorSPG(type) ? MERGED_TD_SPG : type; }

const GAME_NATIONS = {
  FR: 'F系', DE: 'D系', US: 'M系', RU: 'S系', CN: 'C系', SE: 'V系',
  UK: 'Y系', PL: 'B系', JK: 'J系', JP: 'R系', SP: 'X系', IT: 'I系'
};

const WT_NATION_OPTIONS = [
  ['US', '美国'],
  ['DE', '德国'],
  ['RU', '俄罗斯 / 苏联'],
  ['UK', '英国'],
  ['FR', '法国'],
  ['IT', '意大利'],
  ['SE', '瑞典'],
  ['IL', '以色列'],
  ['OT', '其他']
];
const WT_NATIONS = Object.fromEntries(WT_NATION_OPTIONS);

const WOT_TIERS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];

const WT_TIERS = (() => {
  const arr = [];
  for (let i = 1; i <= 15; i++) {
    arr.push(`${i}.0`);
    if (i < 15) { arr.push(`${i}.3`); arr.push(`${i}.7`); }
  }
  return arr;
})();

const REAL_ERAS = {
  WW1: '一战时期',
  WW2: '二战时期',
  COLD: '冷战降临',
  MODERN: '现代战争',
  F2042: '未来先锋'
};

const REAL_NATIONS = {
  CN: '中国', RU: '俄罗斯', SU: '苏联', US: '美国', UK: '英国',
  FR: '法国', DE: '德国', IT: '意大利', PL: '波兰', JP: '日本',
  SE: '北欧', AU: '澳大利亚', IL: '以色列',
  AM: '其他（美洲）', AS: '其他（亚洲）', EU: '其他（欧洲）',
  AF: '其他（非洲）', OC: '其他（澳洲）'
};
const REAL_NATION_OPTIONS = [
  ['CN', '中国'], ['RU', '俄罗斯 / 苏联'], ['US', '美国'],
  ['UK', '英国'], ['FR', '法国'], ['DE', '德国'], ['IT', '意大利'],
  ['PL', '波兰'], ['JP', '日本'], ['SE', '北欧'], ['AU', '澳大利亚'],
  ['IL', '以色列'],
  ['AM', '其他（美洲）'], ['AS', '其他（亚洲）'], ['EU', '其他（欧洲）'],
  ['AF', '其他（非洲）'], ['OC', '其他（澳洲）']
];

const CATEGORY_LABELS = { WOT: 'WOT/B', WT: 'WT', REAL: '现实/架空' };

const state = {
  currentPage: 'tank-page',
  currentAuthor: '',
  currentUser: null,
  pageAnimEnabled: true,
  layout: 'grid',
};

const $ = id => document.getElementById(id);

// ==================== 初始化 ====================
(function init() {
  loadSettings();
  loadUserFromStorage();
  bindGlobalEvents();
  renderAuthors();
  updateFilterOptions();
  drawTanks();
  setupPageTabs();
  setupSpottingAutoCalc();
  setupSubmitInputs();
  updateSubmitOptions();
  enhanceAllSelects();
  startLoadingScreen();
})();

function startLoadingScreen() {
  const s = $('loading-screen');
  if (!s) return;
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    s.classList.add('hidden');
    setTimeout(() => { s.style.display = 'none'; }, 850);
  };
  s.addEventListener('click', dismiss);
  s.addEventListener('touchstart', dismiss, { passive: true });
  setTimeout(dismiss, 3000);
}

// ==================== 设置 ====================
function loadSettings() {
  if (localStorage.getItem('tw_theme') === 'light') {
    document.documentElement.classList.add('light');
    $('theme-toggle').checked = true;
  }
  const layout = localStorage.getItem('tw_layout') || 'grid';
  state.layout = layout;
  $('layout-select').value = layout;
  $('grid').className = layout === 'list' ? 'list-mode' : 'grid-mode';
  if (localStorage.getItem('tw_anim') === '0') {
    state.pageAnimEnabled = false;
    $('anim-toggle').checked = false;
  }
}
function toggleTheme(isLight) {
  document.documentElement.classList.toggle('light', isLight);
  localStorage.setItem('tw_theme', isLight ? 'light' : 'dark');
}
function toggleLayout(mode) {
  state.layout = mode;
  $('grid').className = mode === 'list' ? 'list-mode' : 'grid-mode';
  localStorage.setItem('tw_layout', mode);
  drawTanks();
}
function togglePageAnim(enabled) {
  state.pageAnimEnabled = enabled;
  localStorage.setItem('tw_anim', enabled ? '1' : '0');
}

// ==================== 页面切换 ====================
function setupPageTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });
}
function switchPage(pageId) {
  if (state.currentPage === pageId) return;
  state.currentPage = pageId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  $('header-filters').style.display = pageId === 'tank-page' ? 'grid' : 'none';
  document.querySelectorAll('.page-content').forEach(p => {
    const isTarget = p.id === pageId;
    p.classList.toggle('active', isTarget);
    p.classList.toggle('no-anim', !state.pageAnimEnabled);
  });
  window.scrollTo(0, 0);
  if (pageId === 'user-page' && state.currentUser) updateFavUI();
  if (pageId === 'submit-page') updateSubmitVisibility();
}

// ==================== 筛选栏 ====================
function fillSelect(sel, pairs, firstLabel) {
  let html = `<option value="">${firstLabel}</option>`;
  pairs.forEach(([k, v]) => { html += `<option value="${k}">${v}</option>`; });
  sel.innerHTML = html;
}

function updateFilterOptions() {
  const cat = $('category').value;
  const nationSel = $('nation');
  const tierSel = $('tier-or-era');
  const typeSel = $('type');

  const prevNation = nationSel.value;
  const prevTier = tierSel.value;
  const prevType = typeSel.value;

  const typeOpts = ['重坦', '中坦', '轻坦', MERGED_TD_SPG];
  if (cat !== 'WOT') typeOpts.push('防空车');
  typeOpts.push('工程车');
  let typeHtml = '<option value="">全部类型</option>';
  typeOpts.forEach(t => { typeHtml += `<option>${t}</option>`; });
  typeSel.innerHTML = typeHtml;

  if (cat === 'WOT') {
    fillSelect(nationSel, Object.entries(GAME_NATIONS), '全部国家');
    fillSelect(tierSel, WOT_TIERS.map(t => [t, t]), '全部等级');
    nationSel.disabled = false; tierSel.disabled = false;
  } else if (cat === 'WT') {
    fillSelect(nationSel, WT_NATION_OPTIONS, '全部国家');
    fillSelect(tierSel, WT_TIERS.map(t => [t, t]), '全部等级');
    nationSel.disabled = false; tierSel.disabled = false;
  } else if (cat === 'REAL') {
    fillSelect(nationSel, REAL_NATION_OPTIONS, '全部国家');
    fillSelect(tierSel, Object.entries(REAL_ERAS), '任意年代');
    nationSel.disabled = false; tierSel.disabled = false;
  } else {
    nationSel.innerHTML = '<option value="">全部国家</option>';
    tierSel.innerHTML = '<option value="">全部等级 / 年代</option>';
    nationSel.disabled = true; tierSel.disabled = true;
  }

  if (prevNation && Array.from(nationSel.options).some(o => o.value === prevNation)) {
    nationSel.value = prevNation;
  }
  if (prevTier && Array.from(tierSel.options).some(o => o.value === prevTier)) {
    tierSel.value = prevTier;
  }
  if (prevType && Array.from(typeSel.options).some(o => o.value === prevType)) {
    typeSel.value = prevType;
  }
}

// ==================== 展品列表 ====================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getTypeIcon(type) {
  const key = displayType(type);
  const inner = TYPE_ICONS[key];
  if (!inner) return '';
  return `<svg class="type-icon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

function getTankCategory(t) {
  return t.category || 'WOT';
}

function getCardInfoText(t) {
  const cat = getTankCategory(t);
  if (cat === 'REAL') {
    const era = REAL_ERAS[t.era] || t.era || '';
    const nation = REAL_NATIONS[t.nation] || t.nation || '';
    return `${era}${era && nation ? ' · ' : ''}${nation}`;
  }
  if (cat === 'WT') {
    const nation = WT_NATIONS[t.nation] || (t.nation === 'SU' ? WT_NATIONS.RU : t.nation) || '';
    return `${t.tier || ''}${t.tier && nation ? ' · ' : ''}${nation}`;
  }
  const nation = GAME_NATIONS[t.nation] || t.nation || '';
  return `${t.tier || ''}${t.tier && nation ? ' · ' : ''}${nation}`;
}

function drawTanks() {
  const grid = $('grid');
  if (!grid) return;

  const searchVal = $('search').value.trim().toLowerCase();
  const cat = $('category').value;
  const nationVal = $('nation').value;
  const tierVal = $('tier-or-era').value;
  const typeVal = $('type').value;

  const hint = $('author-filter-hint');
  if (state.currentAuthor && authors[state.currentAuthor]) {
    $('filter-hint-text').textContent = `正在浏览「${authors[state.currentAuthor].name}」的展品`;
    hint.classList.add('active');
  } else {
    hint.classList.remove('active');
  }

  const list = tanks.filter(t => {
    const tCat = getTankCategory(t);
    if (cat && tCat !== cat) return false;

    if (typeVal) {
      if (typeVal === MERGED_TD_SPG) {
        if (!isTDorSPG(t.type)) return false;
      } else {
        if (t.type !== typeVal) return false;
      }
    }

    if (nationVal) {
      if ((cat === 'WT' || cat === 'REAL') && nationVal === 'RU') {
        if (t.nation !== 'RU' && t.nation !== 'SU') return false;
      } else {
        if (t.nation !== nationVal) return false;
      }
    }

    if (tierVal) {
      if (cat === 'REAL') {
        if (t.era !== tierVal) return false;
      } else {
        if (t.tier !== tierVal) return false;
      }
    }

    if (searchVal && !t.name.toLowerCase().includes(searchVal)) return false;
    if (state.currentAuthor && t.authorId !== state.currentAuthor) return false;
    return true;
  });

  $('tank-empty').style.display = list.length === 0 ? 'block' : 'none';

  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  list.forEach(t => {
    const card = document.createElement('div');
    card.className = `card ${t.nation}`;
    const icon = getTypeIcon(t.type);

    if (state.layout === 'grid') {
      card.innerHTML = `
        <div class="title-container">${icon}<span>${escapeHtml(t.name)}</span></div>
        <img class="tank-preview" src="${t.imgs[0]}" loading="lazy" alt=""
             onerror="this.src='https://via.placeholder.com/200x120/1a1a1c/5a5a62?text=No+Image'">
      `;
    } else {
      card.innerHTML = `
        <div class="title-container">${icon}<span>${escapeHtml(t.name)}</span></div>
        <span class="type-badge">${escapeHtml(getCardInfoText(t))} · ${displayType(t.type)}</span>
      `;
    }
    card.addEventListener('click', () => showTankDetail(t));
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

function clickToViewAuthor(key) {
  state.currentAuthor = key;
  switchPage('tank-page');
  drawTanks();
}
function clearAuthorFilter() {
  state.currentAuthor = '';
  drawTanks();
}

// ==================== 作者 ====================
function renderAuthors() {
  const container = $('author-card-container');
  if (!container) return;
  container.innerHTML = Object.keys(authors).map(key => {
    const a = authors[key];
    return `
      <div class="author-card-box">
        <div class="author-main">
          <img class="author-avatar" src="${a.avatar}" alt=""
               onerror="this.src='https://via.placeholder.com/80'">
          <div class="author-right">
            <div class="author-name-row">
              <span class="author-name">${escapeHtml(a.name)}</span>
              <span class="author-title-badge">${escapeHtml(a.title)}</span>
              <span class="author-work-preview" data-author="${key}">查看作品</span>
            </div>
          </div>
        </div>
        <div class="author-footer">
          <span>${a.totalWorks} 件作品 · ${a.fansCount} 关注</span>
          <span>${escapeHtml(a.joinTime)}</span>
        </div>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.author-work-preview').forEach(el => {
    el.addEventListener('click', () => clickToViewAuthor(el.dataset.author));
  });
}

// ==================== 详情 ====================
function showTankDetail(t) {
  const detail = $('detail');
  const cat = getTankCategory(t);

  $('dtitle').textContent = t.name;
  $('desc').textContent = t.text || '暂无简介';

  let metaHtml = '';
  if (cat === 'REAL') {
    metaHtml += `<span class="meta-pill">${escapeHtml(REAL_ERAS[t.era] || t.era || '')}</span>`;
    metaHtml += `<span class="meta-pill">${escapeHtml(REAL_NATIONS[t.nation] || t.nation || '')}</span>`;
  } else if (cat === 'WT') {
    metaHtml += `<span class="meta-pill">${escapeHtml(t.tier || '')} 级</span>`;
    const wtNation = WT_NATIONS[t.nation] || (t.nation === 'SU' ? WT_NATIONS.RU : t.nation) || '';
    metaHtml += `<span class="meta-pill">${escapeHtml(wtNation)}</span>`;
  } else {
    metaHtml += `<span class="meta-pill">${escapeHtml(t.tier || '')} 级</span>`;
    metaHtml += `<span class="meta-pill">${escapeHtml(GAME_NATIONS[t.nation] || t.nation || '')}</span>`;
  }
  metaHtml += `<span class="meta-pill">${displayType(t.type)}</span>`;
  metaHtml += `<span class="meta-pill">${CATEGORY_LABELS[cat]}</span>`;
  $('detail-meta').innerHTML = metaHtml;

  $('gallery').innerHTML = t.imgs.map(src =>
    `<img src="${src}" alt="" onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">`
  ).join('');

  const tankAuthor = authors[t.authorId] || authors['cael'];
  $('detail-author-zone').innerHTML = `
    <div class="author-strip">
      <img src="${tankAuthor.avatar}" alt="" onerror="this.src='https://via.placeholder.com/40'">
      <div class="info">
        <div class="name">${escapeHtml(tankAuthor.name)}</div>
        <div class="role">${escapeHtml(tankAuthor.title)}</div>
      </div>
    </div>
  `;

  updateFavButton(t.name);
  detail.classList.add('active');
  detail.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeDetail() {
  $('detail').classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== 用户 ====================
function loadUserFromStorage() {
  const key = localStorage.getItem('tw_user');
  if (key && members[key]) {
    state.currentUser = { key, data: members[key] };
    showUserUI();
  }
}
function login() {
  const u = $('login-user').value.trim();
  const p = $('login-pass').value.trim();
  if (!u || !p) { toast('请输入用户名和密码'); return; }
  let foundKey = null;
  for (const k in members) {
    if ((k === u || members[k].username === u) && members[k].password === p) {
      foundKey = k; break;
    }
  }
  if (!foundKey) { toast('用户名或密码错误'); return; }
  state.currentUser = { key: foundKey, data: members[foundKey] };
  localStorage.setItem('tw_user', foundKey);
  $('login-user').value = ''; $('login-pass').value = '';
  showUserUI();
  toast('登录成功');
}
function logout() {
  state.currentUser = null;
  localStorage.removeItem('tw_user');
  $('login-box').style.display = 'block';
  const regTool = $('register-tool');
  if (regTool) regTool.style.display = 'block';
  $('user-info').style.display = 'none';
  if (state.currentPage === 'submit-page') updateSubmitVisibility();
}
function showUserUI() {
  $('login-box').style.display = 'none';
  const regTool = $('register-tool');
  if (regTool) regTool.style.display = 'none';
  $('user-info').style.display = 'block';
  const u = state.currentUser.data;
  $('welcome-user').textContent = u.nickname || u.username;
  $('user-role').textContent = u.role === 'admin' ? '管理员' : '成员';
  const author = authors[state.currentUser.key];
  if (author) $('user-avatar').src = author.avatar;
  updateFavUI();
  if (state.currentPage === 'submit-page') updateSubmitVisibility();
}

function updateSubmitVisibility() {
  const logged = !!state.currentUser;
  $('submit-need-login').style.display = logged ? 'none' : 'block';
  $('submit-content').style.display = logged ? 'block' : 'none';
}

// ==================== 收藏 ====================
function favKey() { return state.currentUser ? `tw_fav_${state.currentUser.key}` : null; }
function getFavs() {
  const k = favKey();
  if (!k) return [];
  try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; }
}
function saveFavs(list) {
  const k = favKey();
  if (!k) return;
  localStorage.setItem(k, JSON.stringify(list));
}
function toggleFavorite(name) {
  if (!state.currentUser) { toast('请先登录'); return; }
  const list = getFavs();
  const idx = list.indexOf(name);
  if (idx > -1) list.splice(idx, 1); else list.push(name);
  saveFavs(list); updateFavUI(); updateFavButton(name);
  toast(idx > -1 ? '已取消收藏' : '已收藏');
}
function updateFavUI() {
  if (!state.currentUser) return;
  $('fav-count').textContent = getFavs().length;
  const listDiv = $('favorites-list');
  const favs = getFavs();
  if (favs.length === 0) {
    listDiv.innerHTML = '<div class="empty-state" style="padding:20px;">暂无收藏</div>';
    return;
  }
  const items = favs.map(name => tanks.find(t => t.name === name)).filter(Boolean);
  listDiv.innerHTML = items.map(t => `
    <div class="author-card-box" data-tank="${escapeHtml(t.name)}"
         style="cursor:pointer; display:flex; align-items:center; gap:10px; padding:10px; margin-bottom:8px;">
      <img src="${t.imgs[0]}" alt=""
           style="width:44px; height:44px; object-fit:contain; border-radius:6px; background:var(--surface-2);"
           onerror="this.src='https://via.placeholder.com/44'">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:13px;">${escapeHtml(t.name)}</div>
        <div style="font-size:11px; color:var(--text-dim);">${escapeHtml(getCardInfoText(t))}</div>
      </div>
    </div>
  `).join('');
  listDiv.querySelectorAll('[data-tank]').forEach(el => {
    el.addEventListener('click', () => {
      const t = tanks.find(x => x.name === el.dataset.tank);
      if (t) showTankDetail(t);
    });
  });
}
function updateFavButton(name) {
  const container = $('detail-fav-container');
  if (!container) return;
  const isFav = getFavs().includes(name);
  container.innerHTML = `
    <button class="btn ${isFav ? 'btn-ghost' : 'btn-primary'}" style="width:100%;" id="btn-favorite">
      ${isFav ? '已收藏 · 点击取消' : '收藏此展品'}
    </button>
  `;
  $('btn-favorite').addEventListener('click', () => toggleFavorite(name));
}

// ==================== 全局事件 ====================
function bindGlobalEvents() {
  $('search').addEventListener('input', drawTanks);
  $('category').addEventListener('change', () => { updateFilterOptions(); drawTanks(); });
  $('nation').addEventListener('change', drawTanks);
  $('tier-or-era').addEventListener('change', drawTanks);
  $('type').addEventListener('change', drawTanks);
  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });
}

// ==================== Toast ====================
let toastTimer;
function toast(msg) {
  let el = $('tw-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tw-toast';
    el.style.cssText = `
      position: fixed; bottom: 40px; left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: var(--surface-2); color: var(--text);
      padding: 10px 18px; border-radius: 8px;
      border: 1px solid var(--border);
      font-size: 13px; z-index: 10000;
      opacity: 0; transition: opacity 0.2s, transform 0.2s;
      pointer-events: none; max-width: 80vw;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 1800);
}

// ==================== 图片压缩 ====================
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
function canvasToBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), 'image/jpeg', quality);
  });
}
async function compressImage(file, opts = {}) {
  const { maxSide = 1200, targetKB = 35, square = false } = opts;
  const img = await loadImage(file);
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  let w = img.width, h = img.height;
  if (square) {
    const s = Math.min(img.width, img.height);
    sx = (img.width - s) / 2; sy = (img.height - s) / 2;
    sw = sh = s; w = h = Math.min(maxSide, s);
  } else if (Math.max(w, h) > maxSide) {
    const r = maxSide / Math.max(w, h);
    w = Math.round(w * r); h = Math.round(h * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  let lo = 0.1, hi = 0.92, best = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, q);
    const kb = blob.size / 1024;
    if (kb > targetKB) hi = q;
    else {
      lo = q; best = blob;
      if (Math.abs(kb - targetKB) < 3) break;
    }
  }
  if (!best) best = await canvasToBlob(canvas, 0.1);
  return best;
}

// ==================== 投稿：坦克 ====================
let tankSubmission = { files: [], code: '' };

function setupSubmitInputs() {
  const fileInput = $('sub-imgs');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files).slice(0, 3);
      const preview = $('sub-preview');
      preview.innerHTML = '';
      files.forEach(f => {
        const url = URL.createObjectURL(f);
        const img = document.createElement('img');
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        preview.appendChild(img);
      });
      $('sub-imgs-label').textContent = files.length
        ? `已选 ${files.length} 张（可重新选择）`
        : '点击选择图片';
      tankSubmission.files = files;
    });
  }
  const avatarInput = $('reg-avatar');
  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      const preview = $('reg-preview');
      preview.innerHTML = '';
      if (file) {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        preview.appendChild(img);
        $('reg-avatar-label').textContent = '已选头像（可重新选择）';
      } else {
        $('reg-avatar-label').textContent = '点击选择头像';
      }
    });
  }
}

function updateSubmitOptions() {
  const cat = $('sub-category').value;
  const nationSel = $('sub-nation');
  const tierSel = $('sub-tier-or-era');
  const tierLabel = $('sub-tier-label');
  const typeSel = $('sub-type');

  const typeOpts = ['重坦', '中坦', '轻坦', MERGED_TD_SPG];
  if (cat !== 'WOT') typeOpts.push('防空车');
  typeOpts.push('工程车');
  let typeHtml = '';
  typeOpts.forEach(t => { typeHtml += `<option>${t}</option>`; });
  typeSel.innerHTML = typeHtml;

  if (cat === 'WOT') {
    fillSelect(nationSel, Object.entries(GAME_NATIONS), '请选择国家');
    fillSelect(tierSel, WOT_TIERS.map(t => [t, t]), '请选择等级');
    tierLabel.textContent = '等级';
  } else if (cat === 'WT') {
    fillSelect(nationSel, WT_NATION_OPTIONS, '请选择国家');
    fillSelect(tierSel, WT_TIERS.map(t => [t, t]), '请选择等级');
    tierLabel.textContent = '等级';
  } else if (cat === 'REAL') {
    fillSelect(nationSel, REAL_NATION_OPTIONS, '请选择国家');
    fillSelect(tierSel, Object.entries(REAL_ERAS), '请选择年代');
    tierLabel.textContent = '年代';
  }
}

function sanitizeFilename(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'tank';
}

async function generateTankSubmission() {
  if (!state.currentUser) { toast('请先登录'); return; }
  const name = $('sub-name').value.trim();
  if (!name) { toast('请填写坦克名称'); return; }
  if (tankSubmission.files.length === 0) { toast('请至少上传一张图片'); return; }

  const cat = $('sub-category').value;
  const nation = $('sub-nation').value;
  const tierOrEra = $('sub-tier-or-era').value;
  const type = $('sub-type').value;

  if (!nation) { toast('请选择国家'); return; }
  if (!tierOrEra) { toast(cat === 'REAL' ? '请选择年代' : '请选择等级'); return; }

  const progressTrack = $('sub-progress-track');
  const progressFill = $('sub-progress-fill');
  const progressText = $('sub-progress-text');
  progressTrack.style.display = 'block';
  progressText.style.display = 'block';
  $('sub-result').style.display = 'none';

  const total = tankSubmission.files.length;
  const outFiles = [];

  for (let i = 0; i < total; i++) {
    progressText.textContent = `压缩第 ${i + 1} / ${total} 张图片…`;
    progressFill.style.width = `${(i / total) * 100}%`;
    const blob = await compressImage(tankSubmission.files[i], { maxSide: 1200, targetKB: 35 });
    const fname = `${sanitizeFilename(name)}_${i + 1}.jpg`;
    outFiles.push(new File([blob], fname, { type: 'image/jpeg' }));
  }
  progressFill.style.width = '100%';
  progressText.textContent = '完成';

  const imgsList = outFiles.map(f => `"${f.name}"`).join(',');
  const authorId = state.currentUser.key;
  const text = $('sub-text').value.trim().replace(/\n/g, '\\n').replace(/"/g, '\\"');
  const typeValue = displayType(type);

  let code;
  if (cat === 'REAL') {
    code = `{ category:"REAL", name:"${name}", era:"${tierOrEra}", nation:"${nation}", type:"${typeValue}", authorId:"${authorId}", imgs:[${imgsList}], text:"${text}" }`;
  } else {
    code = `{ category:"${cat}", name:"${name}", nation:"${nation}", tier:"${tierOrEra}", type:"${typeValue}", authorId:"${authorId}", imgs:[${imgsList}], text:"${text}" }`;
  }

  tankSubmission.code = code;
  tankSubmission.outFiles = outFiles;

  $('sub-code').textContent = code;
  $('sub-imgs-info').textContent = `已生成 ${outFiles.length} 张图片：${outFiles.map(f => f.name).join('、')}`;
  $('sub-result').style.display = 'block';

  setTimeout(() => {
    progressTrack.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }, 800);
}

async function shareTankSubmission() {
  if (!tankSubmission.outFiles || tankSubmission.outFiles.length === 0) {
    toast('请先生成投稿'); return;
  }
  const files = tankSubmission.outFiles;
  const text = tankSubmission.code;
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text, title: 'TanksWall 坦克投稿' });
      toast('已发送');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  toast('当前浏览器不支持直接分享，改为下载图片 + 复制文本');
  files.forEach(f => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  copyText(text);
}

function copyTankCode() {
  if (!tankSubmission.code) { toast('请先生成投稿'); return; }
  copyText(tankSubmission.code);
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast('已复制'),
      () => fallbackCopy(text)
    );
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('已复制'); }
  catch { toast('复制失败，请长按选择'); }
  document.body.removeChild(ta);
}

// ==================== 投稿：注册 ====================
let regSubmission = { file: null, code: '' };

async function generateRegister() {
  const username = $('reg-username').value.trim();
  const password = $('reg-password').value.trim();
  const nickname = $('reg-nickname').value.trim();
  const avatar = $('reg-avatar').files[0];
  if (!username || !password || !nickname) { toast('请填写完整信息'); return; }
  if (!avatar) { toast('请上传头像'); return; }

  const progressTrack = $('reg-progress-track');
  const progressFill = $('reg-progress-fill');
  const progressText = $('reg-progress-text');
  progressTrack.style.display = 'block';
  progressText.style.display = 'block';
  $('reg-result').style.display = 'none';

  progressText.textContent = '压缩头像…';
  progressFill.style.width = '40%';
  const blob = await compressImage(avatar, { maxSide: 400, targetKB: 30, square: true });
  progressFill.style.width = '85%';

  const fname = `${sanitizeFilename(username)}_avatar.jpg`;
  const file = new File([blob], fname, { type: 'image/jpeg' });

  progressFill.style.width = '100%';
  progressText.textContent = '完成';

  const code = `"${username}": { username:"${username}", password:"${password}", role:"member", nickname:"${nickname}" }`;
  regSubmission.file = file;
  regSubmission.code = code;
  $('reg-code').textContent = code;
  $('reg-result').style.display = 'block';

  setTimeout(() => {
    progressTrack.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }, 800);
}

async function shareRegister() {
  if (!regSubmission.file) { toast('请先生成注册信息'); return; }
  const files = [regSubmission.file];
  const text = regSubmission.code;
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text, title: 'TanksWall 账号注册' });
      toast('已发送');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  toast('当前浏览器不支持直接分享，改为下载 + 复制');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(regSubmission.file);
  a.download = regSubmission.file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  copyText(text);
}
function copyRegCode() {
  if (!regSubmission.code) { toast('请先生成注册信息'); return; }
  copyText(regSubmission.code);
}

// ==================== 工具：装甲 ====================
function calculateArmor() {
  const act = parseFloat($('calc-act').value);
  const ang = parseFloat($('calc-ang').value);
  const eff = parseFloat($('calc-eff').value);
  if (!isNaN(act) && !isNaN(ang) && isNaN(eff)) {
    $('calc-eff').value = (act / Math.cos(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(eff) && !isNaN(ang) && isNaN(act)) {
    $('calc-act').value = (eff * Math.cos(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(act) && !isNaN(eff) && isNaN(ang)) {
    if (act > eff) { toast('实际厚度不能大于等效厚度'); return; }
    $('calc-ang').value = (Math.acos(act / eff) * 180 / Math.PI).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearCalc() {
  $('calc-act').value = ''; $('calc-ang').value = ''; $('calc-eff').value = '';
}

// ==================== 工具：推重比 ====================
function calculatePTW() {
  const w = parseFloat($('calc-weight').value);
  const hp = parseFloat($('calc-hp').value);
  const ptw = parseFloat($('calc-ptw').value);
  if (!isNaN(w) && !isNaN(hp) && isNaN(ptw)) $('calc-ptw').value = (hp / w).toFixed(2);
  else if (!isNaN(w) && !isNaN(ptw) && isNaN(hp)) $('calc-hp').value = (w * ptw).toFixed(2);
  else if (!isNaN(hp) && !isNaN(ptw) && isNaN(w)) $('calc-weight').value = (hp / ptw).toFixed(2);
  else toast('请填写且仅填写其中两项');
}
function clearPTW() {
  $('calc-weight').value = ''; $('calc-hp').value = ''; $('calc-ptw').value = '';
}

// ==================== 工具：转向 ====================
function calculateSteering() {
  const wb = parseFloat($('calc-wheelbase').value);
  const ang = parseFloat($('calc-steer-ang').value);
  const rad = parseFloat($('calc-steer-rad').value);
  if (!isNaN(wb) && !isNaN(ang) && isNaN(rad)) {
    $('calc-steer-rad').value = (wb / Math.sin(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(wb) && !isNaN(rad) && isNaN(ang)) {
    if (wb > rad) { toast('轴距不能大于转向半径'); return; }
    $('calc-steer-ang').value = (Math.asin(wb / rad) * 180 / Math.PI).toFixed(2);
  } else if (!isNaN(ang) && !isNaN(rad) && isNaN(wb)) {
    $('calc-wheelbase').value = (rad * Math.sin(ang * Math.PI / 180)).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearSteering() {
  $('calc-wheelbase').value = ''; $('calc-steer-ang').value = ''; $('calc-steer-rad').value = '';
}

// ==================== 工具：回转时间 ====================
function calculateTurnTime() {
  const rad = parseFloat($('calc-circle-rad').value);
  const spd = parseFloat($('calc-speed').value);
  const time = parseFloat($('calc-turn-time').value);
  if (!isNaN(rad) && !isNaN(spd) && isNaN(time)) {
    $('calc-turn-time').value = (2 * Math.PI * rad / (spd / 3.6)).toFixed(2);
  } else if (!isNaN(rad) && !isNaN(time) && isNaN(spd)) {
    $('calc-speed').value = ((2 * Math.PI * rad / time) * 3.6).toFixed(2);
  } else if (!isNaN(spd) && !isNaN(time) && isNaN(rad)) {
    $('calc-circle-rad').value = (((spd / 3.6) * time) / (2 * Math.PI)).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearTurnTime() {
  $('calc-circle-rad').value = ''; $('calc-speed').value = ''; $('calc-turn-time').value = '';
}

// ==================== 工具：DPM ====================
function toggleDpmMode() {
  const isAuto = $('calc-dpm-mode').checked;
  $('calc-item-reload').style.display = isAuto ? 'none' : 'flex';
  document.querySelectorAll('.dpm-auto-item').forEach(item => {
    item.style.display = isAuto ? 'flex' : 'none';
  });
  clearFirepower();
}
function calculateFirepower() {
  const isAuto = $('calc-dpm-mode').checked;
  let D = parseFloat($('calc-dmg').value);
  let R = parseFloat($('calc-rpm').value);
  let P = parseFloat($('calc-dpm').value);
  if (!isAuto) {
    let T = parseFloat($('calc-reload').value);
    if (!isNaN(R) && isNaN(T)) T = 60 / R;
    if (!isNaN(T) && isNaN(R)) R = 60 / T;
    if (!isNaN(D) && !isNaN(R) && isNaN(P)) P = D * R;
    else if (!isNaN(P) && !isNaN(R) && isNaN(D)) D = P / R;
    else if (!isNaN(P) && !isNaN(D) && isNaN(R)) R = P / D;
    if (!isNaN(D)) $('calc-dmg').value = Math.round(D);
    if (!isNaN(R)) $('calc-rpm').value = R.toFixed(2);
    if (!isNaN(P)) $('calc-dpm').value = Math.round(P);
    if (!isNaN(T)) $('calc-reload').value = T.toFixed(2);
    return;
  }
  let C = parseFloat($('calc-clip').value);
  let S = parseFloat($('calc-short').value);
  let L = parseFloat($('calc-long').value);
  if (!isNaN(D) && !isNaN(C) && !isNaN(S) && !isNaN(L) && isNaN(P)) {
    const cycle = L + (C - 1) * S;
    P = D * C * 60 / cycle;
    R = C * 60 / cycle;
  }
  if (!isNaN(D)) $('calc-dmg').value = Math.round(D);
  if (!isNaN(C)) $('calc-clip').value = Math.round(C);
  if (!isNaN(S)) $('calc-short').value = S.toFixed(2);
  if (!isNaN(L)) $('calc-long').value = L.toFixed(2);
  if (!isNaN(R)) $('calc-rpm').value = R.toFixed(2);
  if (!isNaN(P)) $('calc-dpm').value = Math.round(P);
}
function clearFirepower() {
  ['calc-dmg', 'calc-reload', 'calc-clip', 'calc-short', 'calc-long', 'calc-rpm', 'calc-dpm']
    .forEach(id => { const el = $(id); if (el) el.value = ''; });
}

// ==================== 工具：点亮 ====================
let manualCamoOverride = false;
function onStatusChange() {
  const status = $('calc-status').value;
  $('still-camo-row').style.display = status === 'still' ? 'flex' : 'none';
  $('moving-camo-row').style.display = status === 'moving' ? 'flex' : 'none';
  manualCamoOverride = false;
  $('calc-final-camo').value = '';
  autoCalcFinalCamo();
}
function onFinalCamoManual() { manualCamoOverride = true; }
function autoCalcFinalCamo() {
  if (manualCamoOverride) return;
  const status = $('calc-status').value;
  let camo = status === 'still'
    ? parseFloat($('calc-base-camo').value)
    : parseFloat($('calc-move-camo').value);
  if (isNaN(camo)) { $('calc-final-camo').value = ''; return; }
  const bushType = $('calc-bush').value;
  let bushBonus = bushType === 'sparse' ? 25 : bushType === 'single' ? 50 : bushType === 'double' ? 80 : 0;
  if ($('calc-high-optics').checked && bushBonus > 0) bushBonus = Math.max(0, bushBonus - 15);
  if ($('calc-camo-paint').checked) camo += 4;
  camo += (parseFloat($('calc-exhaust').value) || 0);
  camo += bushBonus;
  camo = Math.min(100, Math.max(0, camo));
  if ($('calc-cvs').checked) camo *= 0.85;
  $('calc-final-camo').value = camo.toFixed(1);
}
function setupSpottingAutoCalc() {
  ['calc-base-camo', 'calc-move-camo', 'calc-status', 'calc-bush',
   'calc-camo-paint', 'calc-exhaust', 'calc-cvs', 'calc-high-optics'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', autoCalcFinalCamo);
      el.addEventListener('change', autoCalcFinalCamo);
    }
  });
}
function calculateSpotting() {
  const finalCamo = parseFloat($('calc-final-camo').value);
  const viewRange = parseFloat($('calc-view-range').value);
  if (isNaN(finalCamo) || isNaN(viewRange)) { toast('请填写综合隐蔽值和敌方视野'); return; }
  if (viewRange <= 50) { $('spotting-result').textContent = '敌方视野必须大于 50 米'; return; }
  let L = viewRange - (viewRange - 50) * (finalCamo / 100);
  L = Math.min(445, Math.max(50, L));
  $('spotting-result').textContent = `点亮距离：${L.toFixed(1)} 米`;
}
function clearSpotting() {
  $('calc-base-camo').value = '';
  $('calc-move-camo').value = '';
  $('calc-status').value = 'still';
  $('calc-bush').value = 'none';
  $('calc-camo-paint').checked = false;
  $('calc-exhaust').value = '0';
  $('calc-cvs').checked = false;
  $('calc-high-optics').checked = false;
  $('calc-final-camo').value = '';
  $('calc-view-range').value = '';
  $('spotting-result').textContent = '';
  $('still-camo-row').style.display = 'flex';
  $('moving-camo-row').style.display = 'none';
  manualCamoOverride = false;
}

// ==================== 自定义下拉 ====================
function enhanceSelect(selectEl) {
  if (selectEl.dataset.enhanced === '1') return;
  selectEl.dataset.enhanced = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'cselect';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cselect-trigger';
  trigger.innerHTML = `<span class="cselect-label"></span>
    <svg class="cselect-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const menu = document.createElement('div');
  menu.className = 'cselect-menu';

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  selectEl.parentNode.insertBefore(wrapper, selectEl);
  selectEl.classList.add('cselect-native');

  function refresh() {
    const opts = Array.from(selectEl.options);
    const cur = selectEl.value;
    menu.innerHTML = '';
    opts.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'cselect-option';
      if (opt.value === cur) item.classList.add('selected');
      if (opt.disabled) item.classList.add('disabled');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.addEventListener('click', e => {
        e.stopPropagation();
        if (opt.disabled) return;
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      menu.appendChild(item);
    });
    const sel = selectEl.options[selectEl.selectedIndex];
    trigger.querySelector('.cselect-label').textContent = sel ? sel.textContent : '';
    wrapper.classList.toggle('disabled', selectEl.disabled);
  }

  function open() {
    document.querySelectorAll('.cselect.open').forEach(el => {
      if (el !== wrapper) el.classList.remove('open');
    });
    wrapper.classList.add('open');
  }
  function close() { wrapper.classList.remove('open'); }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (selectEl.disabled) return;
    if (wrapper.classList.contains('open')) close();
    else open();
  });

  selectEl.addEventListener('change', refresh);

  const mo = new MutationObserver(() => {
    refresh();
    wrapper.classList.toggle('disabled', selectEl.disabled);
  });
  mo.observe(selectEl, {
    childList: true,
    attributes: true,
    attributeFilter: ['disabled']
  });

  refresh();
}

document.addEventListener('click', () => {
  document.querySelectorAll('.cselect.open').forEach(el => el.classList.remove('open'));
});

function enhanceAllSelects() {
  document.querySelectorAll('select').forEach(enhanceSelect);
}