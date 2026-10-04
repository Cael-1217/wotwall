// ==================== TanksWall v2.0 ====================
// 坦克展品墙 · 无游戏 · 无抽卡

const TYPE_ICONS = {
  "重坦": "ht.PNG",
  "中坦": "mt.PNG",
  "轻坦": "lt.PNG",
  "反坦": "td.PNG",
  "火炮": "spg.PNG",
  "工程车": "eng.PNG",
};

const NATION_NAMES = {
  FR: 'F系', DE: 'D系', US: 'M系', RU: 'S系', CN: 'C系',
  SE: 'V系', UK: 'Y系', PL: 'B系', JK: 'J系', JP: 'R系',
  SP: 'X系', IT: 'I系'
};

const state = {
  currentPage: 'tank-page',
  currentAuthor: '',
  currentUser: null,       // { key, data }
  pageAnimEnabled: true,
  layout: 'grid',
};

const $ = id => document.getElementById(id);

// ==================== 启动 ====================
(function init() {
  loadSettings();
  loadUserFromStorage();
  bindGlobalEvents();
  renderAuthors();
  drawTanks();
  setupPageTabs();
  setupSpottingAutoCalc();
  simulateLoading();
})();

// ==================== 设置持久化 ====================
function loadSettings() {
  // 主题
  if (localStorage.getItem('tw_theme') === 'light') {
    document.documentElement.classList.add('light');
    $('theme-toggle').checked = true;
  }
  // 布局
  const layout = localStorage.getItem('tw_layout') || 'grid';
  state.layout = layout;
  $('layout-select').value = layout;
  $('grid').className = layout === 'list' ? 'list-mode' : 'grid-mode';
  // 动画
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

  // 筛选栏只在展品页显示
  $('header-filters').style.display = pageId === 'tank-page' ? 'grid' : 'none';

  document.querySelectorAll('.page-content').forEach(p => {
    const isTarget = p.id === pageId;
    p.classList.toggle('active', isTarget);
    p.classList.toggle('no-anim', !state.pageAnimEnabled);
  });

  window.scrollTo(0, 0);

  if (pageId === 'user-page' && state.currentUser) {
    updateFavUI();
  }
}

// ==================== 展品列表 ====================
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function getTypeIcon(type) {
  const png = TYPE_ICONS[type];
  if (!png) return '';
  return `<img class="type-icon" src="${png}" alt="" onerror="this.style.display='none'">`;
}

function drawTanks() {
  const grid = $('grid');
  if (!grid) return;

  const searchVal = $('search').value.trim().toLowerCase();
  const nationVal = $('nation').value;
  const tierVal = $('tier').value;
  const typeVal = $('type').value;

  // 过滤提示条
  const hint = $('author-filter-hint');
  if (state.currentAuthor && authors[state.currentAuthor]) {
    $('filter-hint-text').textContent = `正在浏览「${authors[state.currentAuthor].name}」的展品`;
    hint.classList.add('active');
  } else {
    hint.classList.remove('active');
  }

  const list = tanks.filter(t => {
    if (nationVal && t.nation !== nationVal) return false;
    if (tierVal && t.tier !== tierVal) return false;
    if (typeVal && t.type !== typeVal) return false;
    if (state.currentAuthor && t.authorId !== state.currentAuthor) return false;
    if (searchVal && !t.name.toLowerCase().includes(searchVal)) return false;
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
        <span class="type-badge">${t.tier} · ${t.type}</span>
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

// ==================== 作者列表 ====================
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

  $('dtitle').textContent = t.name;
  $('desc').textContent = t.text || '暂无简介';
  $('detail-meta').innerHTML = `
    <span class="meta-pill">${t.tier} 级</span>
    <span class="meta-pill">${t.type}</span>
    <span class="meta-pill">${NATION_NAMES[t.nation] || t.nation}</span>
  `;

  const gallery = $('gallery');
  gallery.innerHTML = t.imgs.map(src =>
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
      foundKey = k;
      break;
    }
  }

  if (!foundKey) { toast('用户名或密码错误'); return; }

  state.currentUser = { key: foundKey, data: members[foundKey] };
  localStorage.setItem('tw_user', foundKey);
  $('login-user').value = '';
  $('login-pass').value = '';
  showUserUI();
  toast('登录成功');
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('tw_user');
  $('login-box').style.display = 'block';
  $('user-info').style.display = 'none';
}

function showUserUI() {
  $('login-box').style.display = 'none';
  $('user-info').style.display = 'block';

  const u = state.currentUser.data;
  $('welcome-user').textContent = u.nickname || u.username;
  $('user-role').textContent = u.role === 'admin' ? '管理员' : '成员';

  const author = authors[state.currentUser.key];
  if (author) $('user-avatar').src = author.avatar;

  updateFavUI();
}

// ==================== 收藏 ====================
function favKey() {
  return state.currentUser ? `tw_fav_${state.currentUser.key}` : null;
}

function getFavs() {
  const k = favKey();
  if (!k) return [];
  try { return JSON.parse(localStorage.getItem(k)) || []; }
  catch { return []; }
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
  saveFavs(list);
  updateFavUI();
  updateFavButton(name);
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
        <div style="font-size:11px; color:var(--text-dim);">${t.tier} · ${t.type}</div>
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

// ==================== 加载动画 ====================
function simulateLoading() {
  const bar = $('progress-bar');
  const text = $('loading-text');
  const screen = $('loading-screen');

  const steps = [
    { p: 25, t: '连接服务器…' },
    { p: 55, t: '加载展品数据…' },
    { p: 85, t: '渲染界面…' },
    { p: 100, t: '完成' },
  ];

  let i = 0;
  const next = () => {
    if (i >= steps.length) {
      setTimeout(() => {
        screen.classList.add('hidden');
        setTimeout(() => { screen.style.display = 'none'; }, 400);
      }, 180);
      return;
    }
    bar.style.width = steps[i].p + '%';
    text.textContent = steps[i].t;
    i++;
    setTimeout(next, 220 + Math.random() * 180);
  };
  next();
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
  }, 170