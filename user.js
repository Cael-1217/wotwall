// ==================== user.js — 用户 / 收藏 / 最近浏览 ====================

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
  if (typeof updateAdminConsole === 'function') updateAdminConsole();
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
  if (typeof updateAdminConsole === 'function') updateAdminConsole();
}
function updateSubmitVisibility() {
  const logged = !!state.currentUser;
  $('submit-need-login').style.display = logged ? 'none' : 'block';
  $('submit-content').style.display = logged ? 'block' : 'none';
}

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
  if (!state.currentUser) {
    if (typeof playSound === 'function') playSound('error');
    toast('请先登录');
    return;
  }
  const list = getFavs();
  const idx = list.indexOf(name);
  if (idx > -1) list.splice(idx, 1); else list.push(name);
  saveFavs(list); updateFavUI(); updateFavButton(name);
  if (typeof playSound === 'function') playSound('fav');
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