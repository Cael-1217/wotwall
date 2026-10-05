// ==================== destroy.js — 破坏模式彩蛋 ====================

function setupDestroyEgg() {
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

  const rects = cards.map(el => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left, y: r.top, w: r.width, h: r.height };
  });

  state.destroyMode = true;
  document.body.classList.add('destroy-mode');

  hideDestroyButton();
  if (typeof dismissChangelogToast === 'function') dismissChangelogToast();

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
  el._physicsActive = true;

  const step = () => {
    if (!el._physicsActive) return;
    vx *= 0.99;
    vy *= 0.99;
    vy += 0.6;
    x += vx;
    y += vy;
    rot += vrot;
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