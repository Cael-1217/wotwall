// ==================== app.js — 入口初始化 ====================

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
  initWeather();
  initAudio();
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

function setupShareCard() {
  const btn = $('btn-share-card');
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      if (typeof onShareCardClick === 'function') onShareCardClick();
    });
  }
}