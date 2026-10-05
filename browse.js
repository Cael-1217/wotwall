// ==================== browse.js — 展品 / 作者 / 详情 / 灯箱 / 推荐 ====================

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

function showAuthorDetail(key) {
  const a = authors[key];
  if (!a) return;
  if (typeof playSound === 'function') playSound('open');
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
  if (typeof playSound === 'function') playSound('close');
  $('author-detail').classList.remove('active');
  document.body.style.overflow = '';
}

function showTankDetail(t) {
  if (state.destroyMode) return;
  if (typeof playSound === 'function') playSound('open');

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

  renderGalleryDots(t.imgs.length, 0);
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
  if (typeof playSound === 'function') playSound('close');
  $('detail').classList.remove('active');
  document.body.style.overflow = '';
  state.currentTank = null;
  window.__currentTank = null;
  if (window.location.hash.startsWith('#tank=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

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
    t.nation !== currentTank.nation &&
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

function setupLightbox() {
  $('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
}
function openLightbox(idx) {
  if (!state.currentTank) return;
  if (typeof playSound === 'function') playSound('open');
  state.lightboxImgs = state.currentTank.imgs;
  state.lightboxIdx = idx;
  updateLightbox();
  $('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  if (typeof playSound === 'function') playSound('close');
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