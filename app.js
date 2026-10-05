// ==================== TanksWall 主逻辑 ====================

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
  '反坦': `<polygon points="2,3 22,3 12,21" fill="currentColor"/>`,
  '火炮': `<rect x="4" y="4" width="16" height="16" rx="1.5" fill="currentColor"/>`,
  '自行火炮/歼击车': `<polygon points="2,3 22,3 12,21" fill="currentColor"/>`,
  '防空车': `<polygon points="12,3 22,21 2,21" fill="currentColor"/>`,
  '工程车': `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="currentColor"/>`,
};

const MERGED_TD_SPG = '自行火炮/歼击车';
const TD_SPG_ALIASES = ['反坦', '火炮', MERGED_TD_SPG];
function isTDorSPG(type) { return TD_SPG_ALIASES.includes(type); }
function displayType(type) { return isTDorSPG(type) ? MERGED_TD_SPG : type; }
function displayTypeFor(t) {
  if (!t.category || t.category === 'WOT') return t.type;
  return displayType(t.type);
}

const GAME_NATIONS = {
  FR: 'F系', DE: 'D系', US: 'M系', RU: 'S系', CN: 'C系', SE: 'V系',
  UK: 'Y系', PL: 'B系', JK: 'J系', JP: 'R系', SP: 'X系', IT: 'I系'
};
const WT_NATION_OPTIONS = [
  ['US', '美国'], ['DE', '德国'], ['RU', '俄罗斯 / 苏联'],
  ['UK', '英国'], ['FR', '法国'], ['IT', '意大利'],
  ['SE', '瑞典'], ['IL', '以色列'], ['OT', '其他']
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
  WW1: '一战时期', WW2: '二战时期', COLD: '冷战降临',
  MODERN: '现代战争', F2042: '未来先锋'
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

const DRAFT_KEY = 'tw_submit_draft';
const RECENT_KEY = 'tw_recent';
const ACCENT_KEY = 'tw_accent';

const ACCENT_PRESETS = {
  gold:   { dark: '#c9a860', light: '#8a6f3a' },
  blue:   { dark: '#4a90e2', light: '#2f6fbf' },
  green:  { dark: '#5aa860', light: '#3a7a40' },
  purple: { dark: '#a06ac0', light: '#7a4a90' },
  red:    { dark: '#c05a5a', light: '#903a3a' },
};

const state = {
  currentPage: 'tank-page',
  currentAuthor: '',
  currentUser: null,
  pageAnimEnabled: true,
  layout: 'grid',
  currentList: [],
  currentTank: null,
  lightboxIdx: 0,
  lightboxImgs: [],
  destroyMode: false,
};

const $ = id => document.getElementById(id);

// ==================== 初始化 ====================
(function init() {
  applyAccentFromStorage();
  applyThemeFromStorage();
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
  loadDraft();
  enhanceAllSelects();
  renderRecent();
  startLoadingScreen();
  setupAuthorCardClicks();
  setupShareCard();
  setupLightbox();
  setupBackToTop();
  setupKeyboard();
  setupDestroyEgg();
  if (typeof setupChangelogUI === 'function') setupChangelogUI();
  checkHash();

  if (typeof shouldShowChangelog === 'function' && shouldShowChangelog()) {
    setTimeout(() => {
      if (typeof showChangelogToast === 'function') showChangelogToast();
    }, 1500);
  }
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

// ==================== 主题色 ====================
function applyAccentFromStorage() {
  const name = localStorage.getItem(ACCENT_KEY) || 'gold';
  if (!ACCENT_PRESETS[name]) {
    localStorage.setItem(ACCENT_KEY, 'gold');
    applyAccent('gold');
    return;
  }
  applyAccent(name);
}
function applyAccent(name) {
  const preset = ACCENT_PRESETS[name] || ACCENT_PRESETS.gold;
  const isLight = document.documentElement.classList.contains('light');
  const color = isLight ? preset.light : preset.dark;
  const { r, g, b } = hexToRgb(color);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.14)`);
  document.documentElement.style.setProperty('--accent-bg', `rgba(${r},${g},${b},0.045)`);
  document.querySelectorAll('#accent-picker button').forEach(b => {
    b.classList.toggle('active', b.dataset.accent === name);
  });
}
function setAccent(name) {
  if (!ACCENT_PRESETS[name]) return;
  localStorage.setItem(ACCENT_KEY, name);
  applyAccent(name);
}

// ==================== 主题（含跟随系统） ====================
function getStoredTheme() { return localStorage.getItem('tw_theme') || 'auto'; }
function applyTheme(mode) {
  let isLight;
  if (mode === 'auto') {
    isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  } else {
    isLight = mode === 'light';
  }
  document.documentElement.classList.toggle('light', isLight);
  applyAccentFromStorage();
}
function applyThemeFromStorage() {
  const mode = getStoredTheme();
  applyTheme(mode);
  const seg = $('theme-seg');
  if (seg) {
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === mode);
    });
  }
}
function setTheme(mode) {
  localStorage.setItem('tw_theme', mode);
  applyThemeFromStorage();
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getStoredTheme() === 'auto') applyTheme('auto');
});

// ==================== 设置 ====================
function loadSettings() {
  const layout = localStorage.getItem('tw_layout') || 'grid';
  state.layout = layout;
  const sel = $('layout-select');
  if (sel) sel.value = layout;
  $('grid').className = layout === 'list' ? 'list-mode' : 'grid-mode';
  if (localStorage.getItem('tw_anim') === '0') {
    state.pageAnimEnabled = false;
    $('anim-toggle').checked = false;
  }
  const seg = $('theme-seg');
  if (seg && seg.dataset.bound !== '1') {
    seg.dataset.bound = '1';
    seg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => setTheme(b.dataset.theme));
    });
  }
  const accentPicker = $('accent-picker');
  if (accentPicker && accentPicker.dataset.bound !== '1') {
    accentPicker.dataset.bound = '1';
    accentPicker.addEventListener('click', e => {
      const btn = e.target.closest('button[data-accent]');
      if (!btn) return;
      e.stopPropagation();
      setAccent(btn.dataset.accent);
    });
    applyAccentFromStorage();
  }
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
  if (pageId === 'user-page') {
    if (state.currentUser) updateFavUI();
    renderRecent();
  }
  if (pageId === 'submit-page') updateSubmitVisibility();

  // 离开展品页时隐藏破坏按钮
  if (pageId !== 'tank-page') hideDestroyButton();
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

  let typeOpts;
  if (cat === 'WOT') {
    typeOpts = ['重坦', '中坦', '轻坦', '反坦', '火炮', '工程车'];
  } else {
    typeOpts = ['重坦', '中坦', '轻坦', MERGED_TD_SPG, '防空车', '工程车'];
  }
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

  if (prevNation && Array.from(nationSel.options).some(o => o.value === prevNation)) nationSel.value = prevNation;
  if (prevTier && Array.from(tierSel.options).some(o => o.value === prevTier)) tierSel.value = prevTier;
  if (prevType && Array.from(typeSel.options).some(o => o.value === prevType)) typeSel.value = prevType;
}

function resetAllFilters() {
  $('search').value = '';
  $('category').value = '';
  updateFilterOptions();
  $('nation').value = '';
  $('tier-or-era').value = '';
  $('type').value = '';
  state.currentAuthor = '';
  drawTanks();
}

// ==================== 展品列表 ====================
function getTypeIcon(type) {
  const key = displayType(type);
  const inner = TYPE_ICONS[key];
  if (!inner) return '';
  return `<svg class="type-icon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}
function getTankCategory(t) { return t.category || 'WOT'; }
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

function getFilteredList() {
  const searchVal = $('search').value.trim().toLowerCase();
  const cat = $('category').value;
  const nationVal = $('nation').value;
  const tierVal = $('tier-or-era').value;
  const typeVal = $('type').value;

  return tanks.filter(t => {
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
}

function renderCard(t) {
  const card = document.createElement('div');
  card.className = `card ${t.nation}`;
  const icon = getTypeIcon(t.type);

  if (state.layout === 'grid') {
    card.innerHTML = `
      <div class="title-container">${icon}<span>${escapeHtml(t.name)}</span></div>
      <img class="tank-preview" src="${t.imgs[0]}" loading="lazy" alt=""
           onerror="this.src='https://via.placeholder.com/200x120/1a1a1c/5a5a62?text=No+Image'">
    `;
    const img = card.querySelector('.tank-preview');
    fadeInImg(img);
  } else {
    card.innerHTML = `
      <div class="title-container">${icon}<span>${escapeHtml(t.name)}</span></div>
      <span class="type-badge">${escapeHtml(getCardInfoText(t))} · ${displayTypeFor(t)}</span>
    `;
  }
  card.addEventListener('click', () => showTankDetail(t));
  return card;
}

function drawTanks() {
  const grid = $('grid');
  if (!grid) return;

  const hint = $('author-filter-hint');
  if (state.currentAuthor && authors[state.currentAuthor]) {
    $('filter-hint-text').textContent = `正在浏览「${authors[state.currentAuthor].name}」的展品`;
    hint.classList.add('active');
  } else {
    hint.classList.remove('active');
  }

  const list = getFilteredList();
  state.currentList = list;

  $('tank-empty').style.display = list.length === 0 ? 'block' : 'none';

  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  list.forEach(t => frag.appendChild(renderCard(t)));
  grid.appendChild(frag);

  const deco = $('tank-end-deco');
  if (deco) deco.style.display = list.length === 0 ? 'none' : 'block';
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
      <div class="author-card-box" data-author-key="${key}">
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
  setupAuthorCardClicks();
}

function setupAuthorCardClicks() {
  const container = $('author-card-container');
  if (!container || container.dataset.bound === '1') return;
  container.dataset.bound = '1';
  container.addEventListener('click', e => {
    const previewBtn = e.target.closest('.author-work-preview');
    if (previewBtn) {
      e.stopPropagation();
      clickToViewAuthor(previewBtn.dataset.author);
      return;
    }
    const card = e.target.closest('.author-card-box');
    if (card && card.dataset.authorKey) showAuthorDetail(card.dataset.authorKey);
  });
}

// ==================== 作者主页 ====================
function showAuthorDetail(key) {
  const a = authors[key];
  if (!a) return;
  const works = tanks.filter(t => t.authorId === key);

  $('profile-avatar').src = a.avatar;
  $('profile-avatar').onerror = function() { this.src = 'https://via.placeholder.com/88'; };
  $('profile-name').textContent = a.name;
  $('profile-title').textContent = a.title;
  $('profile-works-count').textContent = works.length;
  $('profile-fans-count').textContent = a.fansCount;
  $('profile-join').textContent = `加入时间：${a.joinTime}`;

  const worksGrid = $('profile-works');
  worksGrid.innerHTML = '';
  const frag = document.createDocumentFragment();
  works.forEach(t => frag.appendChild(renderCard(t)));
  worksGrid.appendChild(frag);

  $('author-detail').classList.add('active');
  $('author-detail').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeAuthorDetail() {
  $('author-detail').classList.remove('active');
  document.body.style.overflow = '';
}

// ==================== 详情 ====================
function showTankDetail(t) {
  // 破坏模式下不允许进入详情
  if (state.destroyMode) return;

  const detail = $('detail');
  const cat = getTankCategory(t);

  state.currentTank = t;
  window.__currentTank = t;

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
  metaHtml += `<span class="meta-pill">${displayTypeFor(t)}</span>`;
  metaHtml += `<span class="meta-pill">${CATEGORY_LABELS[cat]}</span>`;
  $('detail-meta').innerHTML = metaHtml;

  const gallery = $('gallery');
  gallery.innerHTML = t.imgs.map((src, i) =>
    `<img class="gallery-img" src="${src}" alt=""
          onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'"
          onclick="openLightbox(${i})">`
  ).join('');
  gallery.querySelectorAll('.gallery-img').forEach(fadeInImg);
  gallery.scrollLeft = 0;

 ation renderGalleryDots(t.imgs.length, 0);
  gallery.removeEventListener('scroll', updateGalleryDots);
  gallery.addEventListener('scroll', updateGalleryDots, { passive: true });
  gallery.dataset.imgCount = t.imgs.length;

  const tankAuthor = authors[t.authorId] || authors['cael'];
  const authorZone = $('detail-author-zone');
  authorZone.innerHTML = `
    <div class="author-strip" data-author-key="${t.authorId}">
      <img src="${tankAuthor.avatar}" alt="" onerror="this.src='https://via.placeholder.com/40'">
      <div class="info">
        <div class="name">${escapeHtml(tankAuthor.name)}</div>
        <div class="role">${escapeHtml(tankAuthor.title)}</div>
      </div>
    </div>
  `;
  authorZone.querySelector('.author-strip').addEventListener('click', () => {
    showAuthorDetail(t.authorId);
  });

  renderRelated(t);

  updateFavButton(t.name);
  detail.classList.add('active');
  detail.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  addRecentView(t.name);
  window.location.hash = `tank=${encodeURIComponent(t.name)}`;
}
function closeDetail() {
  $('detail').classList.remove('active');
  document.body.style.overflow = '';
  state.currentTank = null;
  window.__currentTank = null;
  if (window.location.hash.startsWith('#tank=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// ==================== 多图指示器 ====================
function renderGalleryDots(count, activeIdx) {
  const dots = $('gallery-dots');
  if (!dots) return;
  if (count <= 1) {
    dots.style.display = 'none';
    dots.innerHTML = '';
    return;
  }
  dots.style.display = 'flex';
  dots.innerHTML = Array.from({ length: count }, (_, i) =>
    `<span class="dot${i === activeIdx ? ' active' : ''}"></span>`
  ).join('');
}
function updateGalleryDots() {
  const gallery = $('gallery');
  if (!gallery) return;
  const count = +gallery.dataset.imgCount || 0;
  if (count <= 1) return;
  const w = gallery.clientWidth;
  const idx = Math.round(gallery.scrollLeft / w);
  const dots = document.querySelectorAll('#gallery-dots .dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

// ==================== 相关推荐 ====================
function renderRelated(currentTank) {
  const zone = $('related-zone');
  if (!zone) return;
  const cat = getTankCategory(currentTank);

  const sameNation = tanks.filter(t =>
    t.name !== currentTank.name &&
    getTankCategory(t) === cat &&
    t.nation === currentTank.nation
  );
  const sameType = tanks.filter(t =>
    t.name !== currentTank.name &&
    getTankCategory(t) === cat &&
    t.nation !== currentTank.n &&
    t.type === currentTank.type
  );
  const combined = [...sameNation, ...sameType].slice(0, 4);

  if (combined.length === 0) {
    zone.innerHTML = '';
    return;
  }
  zone.innerHTML = `
    <div class="related-title">相关推荐</div>
    <div class="related-grid" id="related-grid"></div>
  `;
  const grid = $('related-grid');
  combined.forEach(t => grid.appendChild(renderCard(t)));
}

// ==================== 灯箱 ====================
function setupLightbox() {
  $('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
}
function openLightbox(idx) {
  if (!state.currentTank) return;
  state.lightboxImgs = state.currentTank.imgs;
  state.lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  $('lightbox').classList.remove('active');
  if (!state.currentTank) document.body.style.overflow = '';
}
function updateLightbox() {
  const imgs = state.lightboxImgs;
  if (!imgs.length) return;
  const idx = state.lightboxIdx;
  $('lb-img').src = imgs[idx];
  $('lb-counter').textContent = `${idx + 1} / ${imgs.length}`;
}
function lightboxPrev() {
  if (!state.lightboxImgs.length) return;
  state.lightboxIdx = (state.lightboxIdx - 1 + state.lightboxImgs.length) % state.lightboxImgs.length;
  updateLightbox();
}
function lightboxNext() {
  if (!state.lightboxImgs.length) return;
  state.lightboxIdx = (state.lightboxIdx + 1) % state.lightboxImgs.length;
  updateLightbox();
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

// ==================== 最近浏览 ====================
function addRecentView(name) {
  let recent;
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { recent = []; }
  recent = recent.filter(n => n !== name);
  recent.unshift(name);
  recent = recent.slice(0, 10);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
}

function renderRecent() {
  const div = $('recent-list');
  if (!div) return;
  let recent;
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { recent = []; }
  const items = recent.map(name => tanks.find(t => t.name === name)).filter(Boolean);
  if (items.length === 0) {
    div.innerHTML = '<div class="empty-state" style="padding:20px;">暂无浏览记录</div>';
    return;
  }
  div.innerHTML = items.map(t => `
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
  div.querySelectorAll('[data-tank]').forEach(el => {
    el.addEventListener('click', () => {
      const t = tanks.find(x => x.name === el.dataset.tank);
      if (t) showTankDetail(t);
    });
  });
}

// ==================== 回到顶部 ====================
function setupBackToTop() {
  const btn = $('back-to-top');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== 键盘快捷键 ====================
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.key === 'Escape') {
      if (state.destroyMode) { exitDestroyMode(); return; }
      if ($('lightbox').classList.contains('active')) { closeLightbox(); return; }
      if ($('changelog-modal').classList.contains('active')) { closeChangelog(); return; }
      if ($('detail').classList.contains('active')) { closeDetail(); return; }
      if ($('author-detail').classList.contains('active')) { closeAuthorDetail(); return; }
    }

    if ($('lightbox').classList.contains('active')) {
      if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'ArrowRight') lightboxNext();
    }
  });
}

// ==================== 哈希路由 ====================
function checkHash() {
  const m = window.location.hash.match(/^#tank=(.+)$/);
  if (!m) return;
  const name = decodeURIComponent(m[1]);
  const tank = tanks.find(t => t.name === name);
  if (tank) {
    setTimeout(() => showTankDetail(tank), 200);
  }
}
window.addEventListener('hashchange', () => {
  const m = window.location.hash.match(/^#tank=(.+)$/);
  if (!m) return;
  const name = decodeURIComponent(m[1]);
  const tank = tanks.find(t => t.name === name);
  if (tank && (!state.currentTank || state.currentTank.name !== name)) {
    showTankDetail(tank);
  }
});

// ==================== 全局事件 ====================
function bindGlobalEvents() {
  $('search').addEventListener('input', drawTanks);
  $('category').addEventListener('change', () => { updateFilterOptions(); drawTanks(); });
  $('nation').addEventListener('change', drawTanks);
  $('tier-or-era').addEventListener('change', drawTanks);
  $('type').addEventListener('change', drawTanks);
  document.addEventListener('dragstart', e => {
    if (e.target.tagName === 'IMG' && !e.target.closest('.preview-item')) e.preventDefault();
  });
}

// ==================== 分享图按钮绑定 ====================
function setupShareCard() {
  const btn = $('btn-share-card');
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      if (typeof onShareCardClick === 'function') onShareCardClick();
    });
  }
}

// ==================== 彩蛋：破坏模式 ====================
let __overscrollCounter = 0;
let __eggButtonShown = false;
let __overscrollResetTimer = null;

function setupDestroyEgg() {
  // 桌面端：滚轮
  window.addEventListener('wheel', (e) => {
    if (state.destroyMode) return;
    if (state.currentPage !== 'tank-page') return;
    if (__eggButtonShown) return;
    if ($('detail')?.classList.contains('active')) return;
    if ($('author-detail')?.classList.contains('active')) return;

    const atBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 4);

    if (atBottom && e.deltaY > 0) {
      __overscrollCounter += e.deltaY;
      clearTimeout(__overscrollResetTimer);
      __overscrollResetTimer = setTimeout(() => { __overscrollCounter = 0; }, 420);
      if (__overscrollCounter > 600) showDestroyButton();
    } else {
      __overscrollCounter = 0;
      clearTimeout(__overscrollResetTimer);
    }
  }, { passive: true });

  // 移动端：触摸滑动
  let lastTouchY = 0;
  window.addEventListener('touchstart', (e) => {
    if (state.destroyMode) return;
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (state.destroyMode) return;
    if (state.currentPage !== 'tank-page') return;
    if (__eggButtonShown) return;
    if ($('detail')?.classList.contains('active')) return;
    if ($('author-detail')?.classList.contains('active')) return;

    const y = e.touches[0].clientY;
    const dy = lastTouchY - y;
    lastTouchY = y;

    const atBottom = (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 4);

    if (atBottom && dy > 0) {
      __overscrollCounter += dy * 1.6;
      clearTimeout(__overscrollResetTimer);
      __overscrollResetTimer = setTimeout(() => { __overscrollCounter = 0; }, 420);
      if (__overscrollCounter > 400) showDestroyButton();
    } else if (dy < 0) {
      __overscrollCounter = 0;
      clearTimeout(__overscrollResetTimer);
    }
  }, { passive: true });
}

function showDestroyButton() {
  if (__eggButtonShown) return;
  __eggButtonShown = true;
  __overscrollCounter = 0;
  const btn = $('destroy-egg-btn');
  if (btn) btn.classList.add('visible');
  if (typeof toast === 'function') toast('……你发现了什么');
}

function hideDestroyButton() {
  __eggButtonShown = false;
  __overscrollCounter = 0;
  const btn = $('destroy-egg-btn');
  if (btn) btn.classList.remove('visible');
}

function enterDestroyMode() {
  if (state.destroyMode) return;
  const grid = $('grid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.card'));
  if (cards.length === 0) return;

  // 先记录每个卡片当前在屏幕上的位置
  const rects = cards.map(el => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left, y: r.top, w: r.width, h: r.height };
  });

  state.destroyMode = true;
  document.body.classList.add('destroy-mode');

  hideDestroyButton();
  if (typeof dismissChangelogToast === 'function') dismissChangelogToast();

  // 承载层
  let layer = $('destroy-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'destroy-layer';
    layer.className = 'destroy-layer';
    document.body.appendChild(layer);
  }
  layer.innerHTML = '';

  rects.forEach(({ el, x, y, w, h }) => {
    el.remove();
    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.margin = '0';
    el.style.zIndex = '1';
    layer.appendChild(el);
    bindDestroyDrag(el);
  });

  const bar = $('destroy-bar');
  if (bar) bar.classList.add('visible');

  if (typeof toast === 'function') toast('拖动卡片，扔出屏幕 ✦');
}

function exitDestroyMode() {
  if (!state.destroyMode) return;
  state.destroyMode = false;
  document.body.classList.remove('destroy-mode');

  const layer = $('destroy-layer');
  if (layer) layer.innerHTML = '';

  const bar = $('destroy-bar');
  if (bar) bar.classList.remove('visible');

  // 重新渲染列表
  drawTanks();
}

function getPointerPos(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function bindDestroyDrag(el) {
  let isDragging = false;
  let offsetX = 0, offsetY = 0;
  let lastX = 0, lastY = 0, lastT = 0;
  let vx = 0, vy = 0;

  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (el._physicsActive) el._physicsActive = false;

    const rect = el.getBoundingClientRect();
    const p = getPointerPos(e);
    offsetX = p.x - rect.left;
    offsetY = p.y - rect.top;
    lastX = p.x;
    lastY = p.y;
    lastT = performance.now();
    vx = 0; vy = 0;
    isDragging = true;

    el.classList.add('dragging');
    el.style.zIndex = '9999';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.transform = '';

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const onMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const p = getPointerPos(e);
    const now = performance.now();
    const dt = now - lastT;
    if (dt > 0) {
      vx = (p.x - lastX) / dt * 16;
      vy = (p.y - lastY) / dt * 16;
      lastX = p.x; lastY = p.y; lastT = now;
    }
    el.style.left = (p.x - offsetX) + 'px';
    el.style.top = (p.y - offsetY) + 'px';
  };

  const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);

    // 速度太小就不飞，避免轻点导致误飞
    if (Math.abs(vx) < 0.4 && Math.abs(vy) < 0.4) return;

    startDestroyPhysics(el, vx, vy);
  };

  el.addEventListener('pointerdown', onDown);
}

function startDestroyPhysics(el, vx, vy) {
  let x = parseFloat(el.style.left) || 0;
  let y = parseFloat(el.style.top) || 0;
  let rot = 0;
  let vrot = (vx + vy) * 0.12 + (Math.random() - 0.5) * 4;
  let frames = 0;
  el._physicsActive = true v;

  const step = () => {
    if (!el._physicsActive) return;
    vx *= 0.99;
    vy *= 0.99;
    vy += 0.6;   // 重力
    x += vx;
    y += vy;
    rot +=rot;
    vrot *= 0.99;
    frames++;

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = `rotate(${rot}deg)`;

    const w = el.offsetWidth || 100;
    const h = el.offsetHeight || 100;
    if (x + w < -140 || x > window.innerWidth + 140 || y > window.innerHeight + 220 || frames > 900) {
      el._physicsActive = false;
      el.remove();
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ==================== 投稿：坦克 ====================
let tankSubmission = { files: [], code: '' };
let dragSrcIdx = -1;

function setupSubmitInputs() {
  const fileInput = $('sub-imgs');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files).slice(0, 3);
      tankSubmission.files = files;
      renderPreviewGrid();
      $('sub-imgs-label').textContent = files.length
        ? `已选 ${files.length} 张（可重新选择）`
        : '点击选择图片';
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

  ['sub-category', 'sub-nation', 'sub-tier-or-era', 'sub-type', 'sub-name', 'sub-text']
    .forEach(id => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', saveDraft);
        el.addEventListener('change', saveDraft);
      }
    });
}

function renderPreviewGrid() {
  const preview = $('sub-preview');
  if (!preview) return;
  preview.innerHTML = '';
  tankSubmission.files.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.draggable = true;
    item.dataset.idx = i;
    item.innerHTML = `
      <img src="${url}" alt="" onload="URL.revokeObjectURL('${url}')">
      <div class="preview-actions">
        <button type="button" ${i === 0 ? 'disabled' : ''} data-act="prev" data-idx="${i}">◀</button>
        <button type="button" data-act="del" data-idx="${i}">✕</button>
        <button type="button" ${i === tankSubmission.files.length - 1 ? 'disabled' : ''} data-act="next" data-idx="${i}">▶</button>
      </div>
    `;
    preview.appendChild(item);
  });

  preview.querySelectorAll('.preview-actions button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const idx = +btn.dataset.idx;
      if (act === 'prev') moveImg(idx, -1);
      else if (act === 'next') moveImg(idx, 1);
      else if (act === 'del') removeImg(idx);
    });
  });

  preview.querySelectorAll('.preview-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrcIdx = +item.dataset.idx;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const dropIdx = +item.dataset.idx;
      if (dragSrcIdx === -1 || dragSrcIdx === dropIdx) return;
      const arr = tankSubmission.files;
      const [moved] = arr.splice(dragSrcIdx, 1);
      arr.splice(dropIdx, 0, moved);
      renderPreviewGrid();
    });
  });
}

function moveImg(idx, delta) {
  const arr = tankSubmission.files;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderPreviewGrid();
}
function removeImg(idx) {
  tankSubmission.files.splice(idx, 1);
  renderPreviewGrid();
  $('sub-imgs-label').textContent = tankSubmission.files.length
    ? `已选 ${tankSubmission.files.length} 张（可重新选择）`
    : '点击选择图片';
}

function updateSubmitOptions() {
  const cat = $('sub-category').value;
  const nationSel = $('sub-nation');
  const tierSel = $('sub-tier-or-era');
  const tierLabel = $('sub-tier-label');
  const typeSel = $('sub-type');

  let typeOpts;
  if (cat === 'WOT') {
    typeOpts = ['重坦', '中坦', '轻坦', '反坦', '火炮', '工程车'];
  } else {
    typeOpts = ['重坦', '中坦', '轻坦', MERGED_TD_SPG, '防空车', '工程车'];
  }
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

// ---- 草稿 ----
function saveDraft() {
  const d = {
    category: $('sub-category')?.value || '',
    nation: $('sub-nation')?.value || '',
    tierOrEra: $('sub-tier-or-era')?.value || '',
    type: $('sub-type')?.value || '',
    name: $('sub-name')?.value || '',
    text: $('sub-text')?.value || '',
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
}
function loadDraft() {
  let d;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { d = null; }
  if (!d) return;
  if (d.category) {
    $('sub-category').value = d.category;
    updateSubmitOptions();
  }
  if (d.nation) $('sub-nation').value = d.nation;
  if (d.tierOrEra) $('sub-tier-or-era').value = d.tierOrEra;
  if (d.type) $('sub-type').value = d.type;
  if (d.name) $('sub-name').value = d.name;
  if (d.text) $('sub-text').value = d.text;
  document.querySelectorAll('#sub-nation, #sub-tier-or-era, #sub-type, #sub-category')
    .forEach(el => el.dispatchEvent(new Event('change')));
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
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
  const typeValue = type;

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

  clearDraft();

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