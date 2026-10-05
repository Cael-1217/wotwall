// ==================== navigation.js — 页面切换 / 路由 / 键盘 / 回到顶部 ====================

function setupPageTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });
}
function switchPage(pageId) {
  if (state.currentPage === pageId) return;
  if (typeof playSound === 'function') playSound('tab');
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
  if (pageId !== 'tank-page') hideDestroyButton();
}

function setupBackToTop() {
  const btn = $('back-to-top');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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