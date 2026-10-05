// ==================== theme.js — 主题 / 主题色 / 设置 ====================

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