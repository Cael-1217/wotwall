// ==================== factory-ui.js ====================
// 主菜单 / 存档 / HUD / 左侧书签 / Canvas 渲染 / 交互 / 订单 / 结算 / 教程

const FUI = {
  panel: null, hud: null, canvas: null, ctx: null,
  canvasWrap: null, leftBar: null, leftPanel: null, bottomBar: null,
  currentLeftPanel: null,
  dragState: null,
  mouseScreen: { x: 0, y: 0 }, mouseWorld: { x: 0, y: 0 },
  isPanning: false, panStart: { x: 0, y: 0 }, panCamStart: { x: 0, y: 0 },
  hoverMachine: null, hoverTruck: null,
  machineMenu: null, truckMenu: null,
  tutorialStep: 0,
  pendingBuy: null,
  roundEndInfo: null,
  menuPreviewRAF: null,
  menuPreviewCam: 0,
};
const FM = { W: 220, H: 110, GRID: 40 };

// ==================== 入口 ====================
window.startTankFactory = function () {
  if (typeof state !== 'undefined' && !state.currentUser) {
    if (typeof toast === 'function') toast('请先在「我的」页面登录');
    else alert('请先登录');
    return;
  }
  fMigrateOldSave();
  fBuildPanel();
  FUI.panel.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  fShowMainMenu();
};

function fBuildPanel() {
  if (FUI.panel) return;
  const p = document.createElement('div');
  p.id = 'factory-panel';
  p.innerHTML = `
    <div id="fm-hud"></div>
    <div id="fm-body">
      <div id="fm-left"></div>
      <div id="fm-canvas-wrap"><canvas id="fm-canvas"></canvas></div>
      <div id="fm-left-panel"></div>
    </div>
    <div id="fm-bottom"></div>
    <div id="fm-toast"></div>
    <div id="fm-modal-wrap"></div>
    <div id="fm-mainmenu"></div>
  `;
  document.body.appendChild(p);
  FUI.panel = p;
  FUI.hud = p.querySelector('#fm-hud');
  FUI.canvas = p.querySelector('#fm-canvas');
  FUI.ctx = FUI.canvas.getContext('2d');
  FUI.canvasWrap = p.querySelector('#fm-canvas-wrap');
  FUI.leftBar = p.querySelector('#fm-left');
  FUI.leftPanel = p.querySelector('#fm-left-panel');
  FUI.bottomBar = p.querySelector('#fm-bottom');

  window.addEventListener('resize', fResizeCanvas);
  if (window.ResizeObserver) new ResizeObserver(() => fResizeCanvas()).observe(FUI.canvasWrap);
  fBindCanvasEvents();
}

// ==================== 主菜单 ====================
function fShowMainMenu() {
  fStopLoop();
  const mm = FUI.panel.querySelector('#fm-mainmenu');
  mm.style.display = 'flex';
  mm.classList.add('active');
  
  FUI.hud.style.display = 'none';
  FUI.leftBar.style.display = 'none';
  FUI.canvasWrap.style.display = 'none';
  FUI.leftPanel.style.display = 'none';
  FUI.bottomBar.style.display = 'none';

  const all = fLoadAll();
  const slots = all.slots || {};
  const lastSlot = Object.keys(slots).sort((a, b) =>
    (slots[b].savedAt || 0) - (slots[a].savedAt || 0))[0];

  mm.innerHTML = `
    <div class="fm-mm-left">
      <div class="fm-mm-logo">🏭 坦克工厂</div>
      <div class="fm-mm-sub">Tank Factory · 自动化经营</div>
      <div class="fm-mm-buttons">
        <button class="fm-mm-btn primary" id="fm-mm-new">新游戏</button>
        <button class="fm-mm-btn" id="fm-mm-continue" ${lastSlot ? '' : 'disabled'}>继续游戏</button>
        <button class="fm-mm-btn" id="fm-mm-saves">存档管理</button>
        <button class="fm-mm-btn" id="fm-mm-settings">设置</button>
        <button class="fm-mm-btn ghost" id="fm-mm-quit">退出</button>
      </div>
      <div class="fm-mm-tip">点击 <b>新游戏</b> 开始，第 1 轮从 1919 年（间战期）开始</div>
    </div>
    <div class="fm-mm-right">
      <canvas id="fm-mm-preview"></canvas>
      <div class="fm-mm-preview-label" id="fm-mm-preview-label">${lastSlot ? '最近存档：' + (slots[lastSlot].name || ('存档 ' + lastSlot)) : '尚无存档'}</div>
    </div>
  `;
  mm.querySelector('#fm-mm-new').onclick = () => fShowSaveScreen(true);
  mm.querySelector('#fm-mm-continue').onclick = () => { if (lastSlot) fContinueSlot(lastSlot); };
  mm.querySelector('#fm-mm-saves').onclick = () => fShowSaveScreen(false);
  mm.querySelector('#fm-mm-settings').onclick = () => fShowMainSettings();
  mm.querySelector('#fm-mm-quit').onclick = () => fExitGame();

  fStartMenuPreview(lastSlot ? slots[lastSlot] : null);
}

// 自定义提示框，解决手机浏览器不支持 prompt 的问题
function fShowPrompt(title, defaultValue, callback) {
  const modal = document.createElement('div');
  modal.className = 'fm-custom-prompt';
  modal.innerHTML = `
    <div class="fm-cp-box">
      <div class="fm-cp-title">${title}</div>
      <input type="text" class="fm-cp-input" value="${defaultValue || ''}" id="fm-cp-input">
      <div class="fm-cp-actions">
        <button class="fm-btn" id="fm-cp-cancel">取消</button>
        <button class="fm-btn primary" id="fm-cp-ok">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const input = modal.querySelector('#fm-cp-input');
  setTimeout(() => { input.focus(); input.select(); }, 50);
  
  const close = () => modal.remove();
  modal.querySelector('#fm-cp-cancel').onclick = close;
  modal.querySelector('#fm-cp-ok').onclick = () => {
    const val = input.value.trim();
    close();
    if (callback) callback(val);
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      close();
      if (callback) callback(val);
    }
    if (e.key === 'Escape') close();
  };
}

function fStartMenuPreview(saveData) {
  if (FUI.menuPreviewRAF) cancelAnimationFrame(FUI.menuPreviewRAF);
  const cv = FUI.panel.querySelector('#fm-mm-preview');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 300;
  const h = cv.clientHeight || 300;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  FUI.menuPreviewCam = 0;

  const loop = () => {
    FUI.menuPreviewRAF = requestAnimationFrame(loop);
    FUI.menuPreviewCam += 0.002;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0e16';
    ctx.fillRect(0, 0, w, h);

    // 网格
    const offX = Math.sin(FUI.menuPreviewCam) * 30;
    const offY = Math.cos(FUI.menuPreviewCam * 0.8) * 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = (offX % 40); x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = (offY % 40); y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 根据存档渲染缩略模型
    if (saveData) {
      const cx = w / 2, cy = h / 2;
      const scale = 0.5;
      
      if (saveData.machines) {
        saveData.machines.forEach((m) => {
          const mx = cx + (m.x - 0) * scale - 55;
          const my = cy + (m.y - 0) * scale - 27;
          ctx.fillStyle = (F_MACHINES[m.type] && F_MACHINES[m.type].c) || '#5a6a7a';
          ctx.globalAlpha = 0.6;
          ctx.fillRect(mx, my, 110, 54);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.strokeRect(mx, my, 110, 54);
        });
      }
      
      if (saveData.warehouses) {
        saveData.warehouses.forEach((wh) => {
          const mx = cx + (wh.x - 0) * scale - 60;
          const my = cy + (wh.y - 0) * scale - 40;
          ctx.fillStyle = '#5a5a8a';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(mx, my, 120, 80);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.strokeRect(mx, my, 120, 80);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('仓库', mx + 60, my + 44);
        });
      }
      
      if (saveData.trucks) {
        saveData.trucks.forEach(t => {
          const tx = cx + t.x * scale;
          const ty = cy + t.y * scale;
          ctx.fillStyle = '#c9a860';
          ctx.fillRect(tx - 8, ty - 5, 16, 10);
        });
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('尚无存档', w / 2, h / 2);
    }
  };
  loop();
}

function fShowMainSettings() {
  const mm = FUI.panel.querySelector('#fm-mainmenu');
  mm.innerHTML = `
    <div class="fm-mm-left">
      <div class="fm-mm-logo">设置</div>
      <div class="fm-mm-sub">Settings</div>
      <div class="fm-mm-buttons">
        <div class="fm-mm-row">
          <label>自动保存间隔</label>
          <select id="fm-mm-autosave">
            <option value="30">30 秒</option>
            <option value="60">60 秒</option>
            <option value="120">2 分钟</option>
            <option value="300">5 分钟</option>
          </select>
        </div>
        <button class="fm-mm-btn primary" id="fm-mm-save-settings">保存</button>
        <button class="fm-mm-btn ghost" id="fm-mm-back">返回</button>
      </div>
    </div>
    <div class="fm-mm-right"><div class="fm-mm-preview-placeholder">设置</div></div>
  `;
  const cur = (FGame.data && FGame.data.autoSaveInterval) || 60;
  mm.querySelector('#fm-mm-autosave').value = String(cur);
  mm.querySelector('#fm-mm-back').onclick = () => fShowMainMenu();
  mm.querySelector('#fm-mm-save-settings').onclick = () => {
    const v = parseInt(mm.querySelector('#fm-mm-autosave').value, 10) || 60;
    const all = fLoadAll();
    Object.keys(all.slots || {}).forEach(k => { all.slots[k].autoSaveInterval = v; });
    fSaveAll(all);
    fUIToast('设置已保存');
    fShowMainMenu();
  };
}

// ==================== 存档管理 ====================
function fShowSaveScreen(isNew) {
  const mm = FUI.panel.querySelector('#fm-mainmenu');
  if (!mm) return;
  if (FUI.menuPreviewRAF) { cancelAnimationFrame(FUI.menuPreviewRAF); FUI.menuPreviewRAF = null; }
  
  mm.innerHTML = `
    <div class="fm-mm-left" style="flex: 1; overflow-y: auto; padding: 24px; justify-content: flex-start;">
      <div class="fm-mm-logo" style="font-size: 24px; margin-bottom: 4px;">${isNew ? '选择存档位' : '存档管理'}</div>
      <div class="fm-mm-sub">每人共 3 个档位</div>
      <div class="fm-mm-saves-list" id="fm-saves-list" style="padding: 0; margin-top: 16px;"></div>
      <div style="margin-top: 20px;">
        <button class="fm-mm-btn ghost" id="fm-mm-back">返回主菜单</button>
      </div>
    </div>
    <div class="fm-mm-right">
      <canvas id="fm-mm-preview"></canvas>
      <div class="fm-mm-preview-label" id="fm-mm-preview-label">点击存档查看预览</div>
    </div>
  `;
  
  const back = mm.querySelector('#fm-mm-back');
  if (back) back.onclick = () => fShowMainMenu();
  
  fRenderSaveList(isNew);
  
  // 自动选中第一个存在的存档进行预览
  const all = fLoadAll();
  const slots = all.slots || {};
  let previewSlot = null;
  for(let i=1; i<=3; i++) { if (slots[i]) { previewSlot = slots[i]; break; } }
  if (previewSlot) {
    fStartMenuPreview(previewSlot);
    const l = mm.querySelector('#fm-mm-preview-label');
    if (l) l.textContent = '预览：' + (previewSlot.name || '存档');
  } else {
    fStartMenuPreview(null);
  }
}

function fRenderSaveList(isNew) {
  const container = FUI.panel.querySelector('#fm-saves-list');
  if (!container) return;
  const all = fLoadAll();
  const slots = all.slots || {};
  
  let html = '';
  for (let i = 1; i <= 3; i++) {
    const s = slots[i];
    if (s) {
      const round = s.round || 1;
      const year = 1918 + round;
      let eraName = '间战期';
      try { eraName = fGetEraByYear(year).name; } catch (e) {}
      html += `
        <div class="fm-save-card" data-slot="${i}">
          <div class="fm-save-name">${escapeHtml(s.name || ('存档 ' + i))}</div>
          <div class="fm-save-info">${eraName} · ${year} 年 · 第 ${round} 轮</div>
          <div class="fm-save-info">资金 ${s.money} · 已完成 ${s.completedOrders || 0} 单</div>
          <div class="fm-save-actions">
            ${isNew ? `<button class="fm-save-btn primary" data-act="new" data-slot="${i}">覆盖新建</button>`
                    : `<button class="fm-save-btn primary" data-act="enter" data-slot="${i}">进入</button>`}
            <button class="fm-save-btn" data-act="rename" data-slot="${i}">重命名</button>
            <button class="fm-save-btn danger" data-act="reset" data-slot="${i}">重置</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="fm-save-card empty" data-slot="${i}">
          <div class="fm-save-name">空档位 ${i}</div>
          <div class="fm-save-info dim">暂无存档</div>
          <div class="fm-save-actions">
            <button class="fm-save-btn primary" data-act="new" data-slot="${i}">新建存档</button>
          </div>
        </div>
      `;
    }
  }
  container.innerHTML = html;
  
  // 绑定事件：点击卡片预览
  container.querySelectorAll('.fm-save-card').forEach(card => {
    const slot = parseInt(card.dataset.slot, 10);
    card.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return; 
      const s = slots[slot];
      if (s) {
        fStartMenuPreview(s);
        const l = FUI.panel.querySelector('#fm-mm-preview-label');
        if (l) l.textContent = '预览：' + (s.name || '存档 ' + slot);
        
        container.querySelectorAll('.fm-save-card').forEach(c => c.style.borderColor = 'var(--f-border)');
        card.style.borderColor = 'var(--f-accent)';
      }
    };
  });

  container.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const slot = parseInt(btn.dataset.slot, 10);
      const act = btn.dataset.act;
      if (act === 'new') fCreateNewSave(slot);
      else if (act === 'enter') fContinueSlot(slot);
      else if (act === 'rename') fRenameSlot(slot);
      else if (act === 'reset') fResetSlot(slot);
    };
  });
}

function fCreateNewSave(slot) {
  const all = fLoadAll();
  if (all.slots && all.slots[slot]) {
    if (!confirm('该档位已有存档，确定覆盖？')) return;
  }
  fShowPrompt('给存档起个名字', '存档 ' + slot, (name) => {
    if (!name) name = '存档 ' + slot;
    const data = fNewState(slot, name);
    data.warehouses.push({ id: fUid(), x: 0, y: 0, items: {} });
    fSaveSlot(slot, data);
    FGame.data = data;
    fEnterGame();
    if (!data.tutorialDone) fStartTutorial();
  });
}

function fContinueSlot(slot) {
  const data = fLoadSlot(slot);
  if (!data) { fUIToast('存档不存在'); return; }
  FGame.data = data;
  FGame.data.paused = false;
  fEnterGame();
}

function fRenameSlot(slot) {
  const all = fLoadAll();
  if (!all.slots || !all.slots[slot]) return;
  fShowPrompt('输入新名称', all.slots[slot].name || ('存档 ' + slot), (name) => {
    if (name) {
      all.slots[slot].name = name;
      fSaveAll(all);
      fRenderSaveList(false);
    }
  });
}

function fResetSlot(slot) {
  const all = fLoadAll();
  if (!all.slots || !all.slots[slot]) return;
  fShowPrompt('重置会永久删除存档。\n请输入大写 RESET 确认删除：', '', (input) => {
    if (input !== 'RESET') { fUIToast('已取消'); return; }
    fShowPrompt('再确认一次：请输入存档名', all.slots[slot].name || ('存档 ' + slot), (input2) => {
      if (input2 !== (all.slots[slot].name || ('存档 ' + slot))) { fUIToast('已取消'); return; }
      fDeleteSlot(slot);
      fUIToast('已删除');
      fRenderSaveList(false);
      // 刷新预览
      fStartMenuPreview(null);
      const l = FUI.panel.querySelector('#fm-mm-preview-label');
      if (l) l.textContent = '点击存档查看预览';
    });
  });
}

// ==================== 进入游戏 ====================
function fEnterGame() {
  const mm = FUI.panel.querySelector('#fm-mainmenu');
  mm.classList.remove('active');
  mm.style.display = 'none';
  if (FUI.menuPreviewRAF) { cancelAnimationFrame(FUI.menuPreviewRAF); FUI.menuPreviewRAF = null; }

  FUI.hud.style.display = 'flex';
  FUI.leftBar.style.display = 'flex';
  FUI.canvasWrap.style.display = 'block';
  FUI.bottomBar.style.display = 'flex';

  fRenderHUD();
  fRenderLeftBar();

  // 重置相机到仓库
  const wh = FGame.data.warehouses[0];
  if (wh) {
    const w = FUI.canvasWrap.clientWidth;
    const h = FUI.canvasWrap.clientHeight;
    FGame.view.x = w / 2 - wh.x;
    FGame.view.y = h / 2 - wh.y;
  }
  fResizeCanvas();
  fStartLoop();

  if (FGame.data.activeOrders.length === 0) {
    setTimeout(() => fShowOrderSelector(), 300);
  }
}

function fExitGame() {
  if (FGame.data) fAutoSave();
  fStopLoop();
  FUI.panel.style.display = 'none';
  document.body.style.overflow = '';
  FGame.data = null;
}

// ==================== HUD & 左侧书签 & 其他渲染/交互（保持不变，直接拷贝原文件剩余的） ====================
// 因为篇幅限制，这里假设你已经有了原文件中 HUD、左侧面板、Canvas渲染等剩余代码。
// 如果你需要这部分完整代码，请继续往下复制。

function fRenderHUD() {
  const year = fCurYear();
  const era = fGetEraByYear(year);
  FUI.hud.innerHTML = `
    <div class="fm-hud-left">
      <span class="fm-hud-era">${era.name}</span>
      <span class="fm-hud-year">${year} 年</span>
      <span class="fm-hud-day" id="fm-hud-day">第 1 天</span>
    </div>
    <div class="fm-hud-mid">
      <span class="fm-hud-money" id="fm-hud-money">$ ${FGame.data.money}</span>
      <span class="fm-hud-orders" id="fm-hud-orders">订单 0</span>
    </div>
    <div class="fm-hud-right">
      <button class="fm-hud-btn" data-act="pause" id="fm-hud-pause">⏸</button>
      <button class="fm-hud-btn" data-act="1x" id="fm-hud-1x">1x</button>
      <button class="fm-hud-btn" data-act="2x" id="fm-hud-2x">2x</button>
      <button class="fm-hud-btn" data-act="4x" id="fm-hud-4x">4x</button>
      <button class="fm-hud-btn" data-act="save">💾 保存</button>
      <button class="fm-hud-btn" data-act="menu">☰ 菜单</button>
    </div>
  `;
  FUI.hud.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === 'pause') { FGame.data.paused = !FGame.data.paused; fUIUpdateHUD(); }
      else if (act === '1x') { FGame.data.timeScale = 1; fUIUpdateHUD(); }
      else if (act === '2x') { FGame.data.timeScale = 2; fUIUpdateHUD(); }
      else if (act === '4x') { FGame.data.timeScale = 4; fUIUpdateHUD(); }
      else if (act === 'save') { fAutoSave(); fUIToast('已保存'); }
      else if (act === 'menu') { fExitGame(); }
    };
  });
  fUIUpdateHUD();
}

function fUIUpdateHUD() {
  if (!FGame.data || !FUI.hud) return;
  const moneyEl = document.getElementById('fm-hud-money');
  if (moneyEl) {
    moneyEl.textContent = '$ ' + Math.round(FGame.data.money);
    moneyEl.style.color = FGame.data.money < 0 ? '#ff6060' : '#c9a860';
  }
  const orderEl = document.getElementById('fm-hud-orders');
  if (orderEl) orderEl.textContent = '订单 ' + FGame.data.activeOrders.length;
  const dayEl = document.getElementById('fm-hud-day');
  if (dayEl) dayEl.textContent = '第 ' + (Math.floor(FGame.data.gameTime) + 1) + ' 天';
  const pauseBtn = document.getElementById('fm-hud-pause');
  if (pauseBtn) pauseBtn.textContent = FGame.data.paused ? '▶' : '⏸';
  ['1x', '2x', '4x'].forEach(s => {
    const b = document.getElementById('fm-hud-' + s);
    if (b) b.classList.toggle('active', FGame.data.timeScale === parseInt(s));
  });
  if (FGame.data.activeOrders.length > 0) {
    FUI.bottomBar.style.display = 'flex';
    fRenderActiveOrdersBar();
  }
}

function fRenderActiveOrdersBar() {
  const orders = FGame.data.activeOrders;
  if (orders.length === 0) { FUI.bottomBar.innerHTML = ''; return; }
  let html = `<div class="fm-active-orders">`;
  orders.forEach(o => {
    const pct = Math.max(0, o.timeLeft / o.time);
    const color = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#ef4444';
    html += `
      <div class="fm-active-order">
        <div class="fm-ao-name">${escapeHtml(o.name)}</div>
        <div class="fm-ao-req">${Object.entries(o.tanks).map(([k,v]) => `${F_TANKS[k].n} ×${v}`).join(' + ')}</div>
        <div class="fm-ao-bar"><div style="width:${pct*100}%;background:${color}"></div></div>
        <div class="fm-ao-time">剩余 ${o.timeLeft.toFixed(1)} 天</div>
      </div>
    `;
  });
  html += `</div>`;
  FUI.bottomBar.innerHTML = html;
}

// 以下省略，请直接保留原来 factory-ui.js 里的以下函数：
// fRenderLeftBar, fToggleLeftPanel, fRenderLeftPanel, fRenderSourceList, fSignSource, fUnsignSource, fRenderMachineList, fRenderTruckList, fBuyTruck, fRenderWarehouseList, fBuyWarehouse, fRenderOrderList, fTakeOrder, fShowOrderSelector, fResizeCanvas, fRender, fDrawSource, fDrawWarehouse, fDrawMachine, fDrawTruck, fDrawGhost, fBindCanvasEvents, fScreenToWorld, fWorldToScreen, fFindMachineAt, fFindTruckAt, fStartDragPlace, fConfirmPlace, fShowMachineMenu, fShowTruckMenu, fCloseMenus, fUIShowRoundEnd, fRenderUpgradeRow, fBuyUpgrade, fUIToast, fStartTutorial, fShowTutorialStep.

// 因为全量代码太长，如果你需要这后半段，请把旧版 factory-ui.js 中对应函数保留即可，
// 只需要用我上面给的代码替换 `fShowMainMenu` 及它前面的部分即可。/ ==================== 左侧书签 ====================
function fRenderLeftBar() {
  const items = [
    { id: 'source', icon: '🏭', label: '原料' },
    { id: 'machine', icon: '⚙️', label: '机器' },
    { id: 'truck', icon: '🚚', label: '卡车' },
    { id: 'warehouse', icon: '📦', label: '仓库' },
    { id: 'order', icon: '📋', label: '订单' },
  ];
  FUI.leftBar.innerHTML = items.map(it => `
    <button class="fm-left-btn ${FUI.currentLeftPanel === it.id ? 'active' : ''}" data-panel="${it.id}">
      <span class="fm-lb-icon">${it.icon}</span>
      <span class="fm-lb-label">${it.label}</span>
    </button>
  `).join('');
  FUI.leftBar.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => fToggleLeftPanel(btn.dataset.panel);
  });
}

function fToggleLeftPanel(name) {
  if (FUI.currentLeftPanel === name) {
    FUI.currentLeftPanel = null;
    FUI.leftPanel.style.display = 'none';
    fRenderLeftBar();
    return;
  }
  FUI.currentLeftPanel = name;
  FUI.leftPanel.style.display = 'block';
  fRenderLeftBar();
  fRenderLeftPanel();
}

function fRenderLeftPanel() {
  if (!FUI.currentLeftPanel) { FUI.leftPanel.innerHTML = ''; return; }
  if (FUI.currentLeftPanel === 'source') fRenderSourceList();
  else if (FUI.currentLeftPanel === 'machine') fRenderMachineList();
  else if (FUI.currentLeftPanel === 'truck') fRenderTruckList();
  else if (FUI.currentLeftPanel === 'warehouse') fRenderWarehouseList();
  else if (FUI.currentLeftPanel === 'order') fRenderOrderList();
}

// ---------- 原料 ----------
function fRenderSourceList() {
  const year = fCurYear();
  const unlocked = Object.keys(F_SOURCES).filter(k => F_SOURCES[k].year <= year);
  const signed = FGame.data.sources.map(s => s.type);
  let html = `<div class="fm-lp-title">原料来源</div><div class="fm-lp-sub">签约后，卡车才能从此来源拉货</div>`;
  unlocked.forEach(k => {
    const def = F_SOURCES[k];
    const isSigned = signed.includes(k);
    html += `
      <div class="fm-card ${isSigned ? 'signed' : ''}" data-source="${k}">
        ${isSigned ? '<div class="fm-signed-stamp">已签约</div>' : ''}
        <div class="fm-card-title">${def.n}</div>
        <div class="fm-card-desc">产出：${F_ITEMS[def.item].n} · 行程 ${def.travel}s</div>
        <div class="fm-card-actions">
          ${isSigned
            ? `<button class="fm-btn" data-act="unsign" data-source="${k}">解除签约</button>`
            : `<button class="fm-btn primary" data-act="sign" data-source="${k}">签约</button>`}
        </div>
      </div>
    `;
  });
  FUI.leftPanel.innerHTML = html;
  FUI.leftPanel.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.source;
      if (btn.dataset.act === 'sign') fSignSource(k);
      else fUnsignSource(k);
    };
  });
}

function fSignSource(type) {
  const year = fCurYear();
  if (F_SOURCES[type].year > year) { fUIToast('尚未解锁'); return; }
  if (FGame.data.sources.some(s => s.type === type)) return;
  const idx = FGame.data.sources.length;
  const x = -600;
  const y = idx * 180 - ((FGame.data.sources.length) * 90);
  FGame.data.sources.push({ id: fUid(), type, x, y });
  fRenderLeftPanel();
  fUIToast('签约成功：' + F_SOURCES[type].n);
}

function fUnsignSource(type) {
  FGame.data.sources = FGame.data.sources.filter(s => s.type !== type);
  FGame.data.trucks.forEach(t => {
    if (!FGame.data.sources.find(s => s.id === t.sourceId)) t.sourceId = null;
  });
  fRenderLeftPanel();
  fUIToast('已解除签约');
}

// ---------- 机器 ----------
function fRenderMachineList() {
  const year = fCurYear();
  let html = `<div class="fm-lp-title">机器</div><div class="fm-lp-sub">拖到画布上放置</div>`;
  Object.keys(F_MACHINES).forEach(k => {
    const def = F_MACHINES[k];
    const locked = def.year > year;
    html += `
      <div class="fm-card ${locked ? 'locked' : ''} draggable" data-machine="${k}" draggable="${!locked}">
        <div class="fm-card-title">${def.n}</div>
        <div class="fm-card-desc">$${F_PRICES[k] || 2500}${locked ? ' · 未解锁' : ''}</div>
      </div>
    `;
  });
  FUI.leftPanel.innerHTML = html;

  FUI.leftPanel.querySelectorAll('.fm-card.draggable').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      const type = card.dataset.machine;
      e.dataTransfer.setData('text/plain', 'machine:' + type);
      fStartDragPlace('machine', type, F_PRICES[type] || 2500);
    });
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const type = card.dataset.machine;
      fStartDragPlace('machine', type, F_PRICES[type] || 2500);
    });
  });
}

// ---------- 卡车 ----------
function fRenderTruckList() {
  const year = fCurYear();
  const unlocked = Object.keys(F_TRUCKS).filter(k => F_TRUCKS[k].year <= year);
  let html = `<div class="fm-lp-title">卡车</div><div class="fm-lp-sub">购买后点击卡车绑定原料来源</div>`;
  unlocked.forEach(k => {
    const def = F_TRUCKS[k];
    html += `
      <div class="fm-card" data-truck="${k}">
        <div class="fm-card-title">${def.n}</div>
        <div class="fm-card-desc">载重 ${def.cap} · 速度 ${def.speed} · $${F_PRICES[k]}</div>
        <div class="fm-card-actions">
          <button class="fm-btn primary" data-act="buy-truck" data-truck="${k}">购买</button>
        </div>
      </div>
    `;
  });
  const locked = Object.keys(F_TRUCKS).filter(k => F_TRUCKS[k].year > year).length;
  if (locked > 0) html += `<div class="fm-lp-tip">${locked} 种卡车尚未解锁</div>`;
  FUI.leftPanel.innerHTML = html;
  FUI.leftPanel.querySelectorAll('button[data-act="buy-truck"]').forEach(btn => {
    btn.onclick = () => fBuyTruck(btn.dataset.truck);
  });
}

function fBuyTruck(type) {
  const price = F_PRICES[type];
  if (FGame.data.money < price) { fUIToast('资金不足'); return; }
  FGame.data.money -= price;
  const wh = FGame.data.warehouses[0];
  const x = wh ? wh.x : 0;
  const y = wh ? wh.y + 200 : 200;
  FGame.data.trucks.push({
    id: fUid(), type, x, y, sourceId: null,
    state: 'going', cargo: { item: null, qty: 0 }, timer: 0,
  });
  fUIToast('已购买卡车');
  fUIUpdateHUD();
  fRenderLeftPanel();
}

// ---------- 仓库 ----------
function fRenderWarehouseList() {
  const year = fCurYear();
  let html = `<div class="fm-lp-title">仓库</div><div class="fm-lp-sub">所有物流的中枢</div>`;
  const def = { n: '仓库', price: F_PRICES.warehouse };
  html += `
    <div class="fm-card">
      <div class="fm-card-title">${def.n}</div>
      <div class="fm-card-desc">容量 ${F_UPGRADES.warehouseCapacity.lv[FGame.data.permanent.warehouseCapacity || 0]} · $${def.price}</div>
      <div class="fm-card-actions">
        <button class="fm-btn primary" data-act="buy-wh">购买</button>
      </div>
    </div>
  `;
  FUI.leftPanel.innerHTML = html;
  FUI.leftPanel.querySelector('button[data-act="buy-wh"]').onclick = () => fBuyWarehouse();
}

function fBuyWarehouse() {
  if (FGame.data.money < F_PRICES.warehouse) { fUIToast('资金不足'); return; }
  FGame.data.money -= F_PRICES.warehouse;
  const x = 300 * (FGame.data.warehouses.length + 1);
  FGame.data.warehouses.push({ id: fUid(), x, y: 0, items: {} });
  fUIToast('已购买仓库');
  fUIUpdateHUD();
}

// ---------- 订单 ----------
function fRenderOrderList() {
  const orders = FGame.data.availableOrders;
  let html = `<div class="fm-lp-title">可用订单</div>`;
  if (!orders.length) {
    html += `<div class="fm-lp-tip">当前没有新订单，请先完成本轮</div>`;
  } else {
    orders.forEach(o => {
      const active = FGame.data.activeOrders.some(a => a.id === o.id);
      const req = Object.entries(o.tanks).map(([k, v]) => `${F_TANKS[k].n} ×${v}`).join('<br>');
      html += `
        <div class="fm-card ${active ? 'active-order' : ''}">
          <div class="fm-card-title">${escapeHtml(o.name)}</div>
          <div class="fm-card-desc">${req}</div>
          <div class="fm-card-desc">报酬 $${o.reward} · 时限 ${o.time} 天</div>
          <div class="fm-card-actions">
            ${active
              ? `<button class="fm-btn" disabled>已选择</button>`
              : `<button class="fm-btn primary" data-act="take-order" data-oid="${o.id}">选择此订单</button>`}
          </div>
        </div>
      `;
    });
  }
  FUI.leftPanel.innerHTML = html;
  FUI.leftPanel.querySelectorAll('button[data-act="take-order"]').forEach(btn => {
    btn.onclick = () => fTakeOrder(btn.dataset.oid);
  });
}

function fTakeOrder(oid) {
  const o = FGame.data.availableOrders.find(x => x.id === oid);
  if (!o) return;
  if (FGame.data.activeOrders.some(a => a.id === oid)) return;
  FGame.data.activeOrders.push(o);
  FGame.data.availableOrders = FGame.data.availableOrders.filter(x => x.id !== oid);
  fUIToast('已选择订单');
  fRenderLeftPanel();
  fUIUpdateHUD();
}

// ==================== 订单选择弹窗 ====================
function fShowOrderSelector() {
  if (!FGame.data || FGame.data.paused) return;
  if (FGame.data.availableOrders.length === 0) return;
  const orders = FGame.data.availableOrders;
  const modal = document.createElement('div');
  modal.className = 'fm-order-modal';
  modal.innerHTML = `
    <div class="fm-om-box">
      <div class="fm-om-title">选择订单 <span class="fm-om-sub">可选多个，前期建议先选一个</span></div>
      <div class="fm-om-list">
        ${orders.map(o => {
          const req = Object.entries(o.tanks).map(([k, v]) => `${F_TANKS[k].n} ×${v}`).join(' · ');
          const sel = FGame.data.activeOrders.some(a => a.id === o.id);
          return `
            <div class="fm-om-card ${sel ? 'picked' : ''}" data-oid="${o.id}">
              <div class="fm-om-name">${escapeHtml(o.name)}</div>
              <div class="fm-om-req">${req}</div>
              <div class="fm-om-info">报酬 <b>$${o.reward}</b> · 时限 <b>${o.time} 天</b></div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="fm-om-actions">
        <button class="fm-btn primary" data-act="confirm">开始生产（已选 <span id="fm-om-count">${FGame.data.activeOrders.length}</span> 个）</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelectorAll('.fm-om-card').forEach(card => {
    card.onclick = () => {
      const oid = card.dataset.oid;
      const isActive = FGame.data.activeOrders.some(a => a.id === oid);
      if (isActive) {
        FGame.data.activeOrders = FGame.data.activeOrders.filter(a => a.id !== oid);
        FGame.data.availableOrders.push(orders.find(o => o.id === oid));
        card.classList.remove('picked');
      } else {
        const o = FGame.data.availableOrders.find(x => x.id === oid);
        if (!o) return;
        FGame.data.activeOrders.push(o);
        FGame.data.availableOrders = FGame.data.availableOrders.filter(x => x.id !== oid);
        card.classList.add('picked');
      }
      document.getElementById('fm-om-count').textContent = FGame.data.activeOrders.length;
    };
  });
  modal.querySelector('[data-act="confirm"]').onclick = () => {
    if (FGame.data.activeOrders.length === 0) { fUIToast('请至少选择一个订单'); return; }
    modal.remove();
    FGame.data.paused = false;
    FUI.bottomBar.style.display = 'flex';
    fRenderActiveOrdersBar();
    fUIUpdateHUD();
    fAutoSave();
  };
}

// ==================== Canvas ====================
function fResizeCanvas() {
  if (!FUI.canvas || !FUI.canvasWrap) return;
  const w = FUI.canvasWrap.clientWidth;
  const h = FUI.canvasWrap.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  FUI.canvas.width = w * dpr;
  FUI.canvas.height = h * dpr;
  FUI.canvas.style.width = w + 'px';
  FUI.canvas.style.height = h + 'px';
  FUI.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fRender() {
  if (!FUI.ctx || !FGame.data || FUI.canvasWrap.style.display === 'none') return;
  const ctx = FUI.ctx;
  const w = FUI.canvasWrap.clientWidth;
  const h = FUI.canvasWrap.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(FGame.view.x, FGame.view.y);
  ctx.scale(FGame.view.scale, FGame.view.scale);

  // 背景网格
  const gx0 = Math.floor((-FGame.view.x) / FGame.view.scale / FM.GRID) * FM.GRID;
  const gy0 = Math.floor((-FGame.view.y) / FGame.view.scale / FM.GRID) * FM.GRID;
  const gx1 = gx0 + (w / FGame.view.scale) + FM.GRID * 2;
  const gy1 = gy0 + (h / FGame.view.scale) + FM.GRID * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1 / FGame.view.scale;
  for (let x = gx0; x <= gx1; x += FM.GRID) {
    ctx.beginPath(); ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); ctx.stroke();
  }
  for (let y = gy0; y <= gy1; y += FM.GRID) {
    ctx.beginPath(); ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); ctx.stroke();
  }

  // 原料来源
  FGame.data.sources.forEach(s => fDrawSource(ctx, s));

  // 连线（机器到仓库）
  const wh = FGame.data.warehouses[0];
  if (wh) {
    FGame.data.machines.forEach(m => {
      ctx.strokeStyle = 'rgba(201,168,96,0.12)';
      ctx.lineWidth = 1.5 / FGame.view.scale;
      ctx.beginPath();
      ctx.moveTo(m.x + FM.W / 2, m.y + FM.H / 2);
      ctx.lineTo(wh.x, wh.y);
      ctx.stroke();
    });
  }

  // 仓库
  FGame.data.warehouses.forEach(wh => fDrawWarehouse(ctx, wh));

  // 机器
  FGame.data.machines.forEach(m => fDrawMachine(ctx, m));

  // 卡车
  FGame.data.trucks.forEach(t => fDrawTruck(ctx, t));

  // 拖拽幽灵
  if (FUI.dragState) fDrawGhost(ctx);

  ctx.restore();
}

function fDrawSource(ctx, s) {
  const def = F_SOURCES[s.type];
  if (!def) return;
  ctx.fillStyle = def.c;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(s.x - 60, s.y - 40, 120, 80);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(s.x - 60, s.y - 40, 120, 80);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.n, s.x, s.y);
}

function fDrawWarehouse(ctx, wh) {
  ctx.fillStyle = '#2a3a5a';
  ctx.fillRect(wh.x - 60, wh.y - 40, 120, 80);
  ctx.strokeStyle = '#5a8adf';
  ctx.lineWidth = 2;
  ctx.strokeRect(wh.x - 60, wh.y - 40, 120, 80);
  ctx.fillStyle = '#c9a860';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('仓库', wh.x, wh.y - 18);
  // 容量
  const cap = fWhCapacity(wh);
  const total = fWhTotal(wh);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(total + ' / ' + cap, wh.x, wh.y + 8);
  // 库存条
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(wh.x - 50, wh.y + 22, 100, 6);
  ctx.fillStyle = total > cap * 0.9 ? '#ff6060' : '#5aa860';
  ctx.fillRect(wh.x - 50, wh.y + 22, 100 * Math.min(1, total / cap), 6);
}

function fDrawMachine(ctx, m) {
  const def = F_MACHINES[m.type];
  if (!def) return;
  const x = m.x - FM.W / 2, y = m.y - FM.H / 2;
  // 卡片底
  ctx.fillStyle = 'rgba(20,24,36,0.95)';
  ctx.fillRect(x, y, FM.W, FM.H);
  // 左侧色条
  ctx.fillStyle = def.c;
  ctx.fillRect(x, y, 4, FM.H);
  // 边框
  ctx.strokeStyle = m.producing ? 'rgba(90,168,96,0.7)' :
                    m.waiting ? 'rgba(251,191,36,0.6)' :
                    m.blocked ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = m.producing ? 2 : 1.5;
  ctx.strokeRect(x, y, FM.W, FM.H);

  // 标题
  ctx.fillStyle = '#e8e8ea';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(def.n, x + 14, y + 10);

  // 配方
  const rec = m.recipe ? def.recipes[m.recipe] : null;
  ctx.fillStyle = rec ? '#c9a860' : '#6a6a72';
  ctx.font = '11px sans-serif';
  ctx.fillText(rec ? rec.n : '未选择配方', x + 14, y + 32);

  // 进度条
  if (m.producing && rec) {
    const pct = Math.min(1, m.progress / rec.t);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 14, y + FM.H - 22, FM.W - 28, 6);
    ctx.fillStyle = def.c;
    ctx.fillRect(x + 14, y + FM.H - 22, (FM.W - 28) * pct, 6);
  }

  // 状态灯
  ctx.fillStyle = m.producing ? '#4ade80' :
                  m.waiting ? '#fbbf24' :
                  m.blocked ? '#ef4444' : '#5a5a62';
  ctx.beginPath();
  ctx.arc(x + FM.W - 14, y + 14, 5, 0, Math.PI * 2);
  ctx.fill();
}

function fDrawTruck(ctx, t) {
  const def = F_TRUCKS[t.type];
  if (!def) return;
  // 连接来源->仓库的虚线
  if (t.sourceId) {
    const src = FGame.data.sources.find(s => s.id === t.sourceId);
    const wh = FGame.data.warehouses[0];
    if (src && wh) {
      ctx.strokeStyle = 'rgba(201,168,96,0.15)';
      ctx.lineWidth = 1 / FGame.view.scale;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(wh.x, wh.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // 车身
  ctx.fillStyle = def.c;
  ctx.fillRect(t.x - 12, t.y - 7, 24, 14);
  // 车头
  ctx.fillStyle = '#c9a860';
  ctx.fillRect(t.x + 8, t.y - 7, 6, 14);
  // 绑定状态
  if (!t.sourceId) {
    ctx.fillStyle = 'rgba(255,96,96,0.9)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('未绑定', t.x, t.y - 12);
  }
  // 载重
  if (t.cargo.qty > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.cargo.qty + '', t.x, t.y + 3);
  }
}

function fDrawGhost(ctx) {
  const d = FUI.dragState;
  const wx = FUI.mouseWorld.x;
  const wy = FUI.mouseWorld.y;
  const x = wx - FM.W / 2, y = wy - FM.H / 2;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#1e2a3a';
  ctx.fillRect(x, y, FM.W, FM.H);
  ctx.strokeStyle = '#c9a860';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, FM.W, FM.H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(F_MACHINES[d.type]?.n || '?', wx, wy - 10);
  ctx.font = '12px sans-serif';
  ctx.fillText('$' + d.price, wx, wy + 12);
  ctx.globalAlpha = 1;
}

// ==================== Canvas 交互 ====================
function fBindCanvasEvents() {
  const cv = FUI.canvas;
  if (!cv || cv.dataset.bound === '1') return;
  cv.dataset.bound = '1';

  cv.addEventListener('mousedown', (e) => {
    if (!FGame.data) return;
    const rect = cv.getBoundingClientRect();
    FUI.mouseScreen.x = e.clientX - rect.left;
    FUI.mouseScreen.y = e.clientY - rect.top;
    FUI.mouseWorld = fScreenToWorld(FUI.mouseScreen.x, FUI.mouseScreen.y);

    if (e.button !== 0) return;

    if (FUI.dragState) {
      // 松手确认放置
      fConfirmPlace(FUI.mouseWorld.x, FUI.mouseWorld.y);
      return;
    }

    // 检测点击对象
    const clickedMachine = fFindMachineAt(FUI.mouseWorld.x, FUI.mouseWorld.y);
    if (clickedMachine) { fShowMachineMenu(clickedMachine); return; }

    const clickedTruck = fFindTruckAt(FUI.mouseWorld.x, FUI.mouseWorld.y);
    if (clickedTruck) { fShowTruckMenu(clickedTruck); return; }

    // 开始平移
    FUI.isPanning = true;
    FUI.panStart.x = e.clientX;
    FUI.panStart.y = e.clientY;
    FUI.panCamStart.x = FGame.view.x;
    FUI.panCamStart.y = FGame.view.y;
    cv.style.cursor = 'grabbing';
  });

  cv.addEventListener('mousemove', (e) => {
    if (!FGame.data) return;
    const rect = cv.getBoundingClientRect();
    FUI.mouseScreen.x = e.clientX - rect.left;
    FUI.mouseScreen.y = e.clientY - rect.top;
    FUI.mouseWorld = fScreenToWorld(FUI.mouseScreen.x, FUI.mouseScreen.y);

    if (FUI.isPanning) {
      FGame.view.x = FUI.panCamStart.x + (e.clientX - FUI.panStart.x);
      FGame.view.y = FUI.panCamStart.y + (e.clientY - FUI.panStart.y);
    } else if (FUI.dragState) {
      cv.style.cursor = 'crosshair';
    } else {
      const hm = fFindMachineAt(FUI.mouseWorld.x, FUI.mouseWorld.y);
      const ht = fFindTruckAt(FUI.mouseWorld.x, FUI.mouseWorld.y);
      cv.style.cursor = (hm || ht) ? 'pointer' : 'grab';
    }
  });

  cv.addEventListener('mouseup', () => {
    FUI.isPanning = false;
    if (FUI.canvas) FUI.canvas.style.cursor = 'grab';
  });

  cv.addEventListener('mouseleave', () => {
    FUI.isPanning = false;
  });

  cv.addEventListener('wheel', (e) => {
    if (!FGame.data) return;
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = fScreenToWorld(sx, sy);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(2.5, FGame.view.scale * factor));
    FGame.view.scale = newScale;
    const after = fScreenToWorld(sx, sy);
    FGame.view.x += (after.x - before.x) * newScale;
    FGame.view.y += (after.y - before.y) * newScale;
  }, { passive: false });

  // 右键取消拖拽/关闭菜单
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (FUI.dragState) { FUI.dragState = null; fUIToast('已取消'); return; }
    fCloseMenus();
  });
}

function fScreenToWorld(sx, sy) {
  return {
    x: (sx - FGame.view.x) / FGame.view.scale,
    y: (sy - FGame.view.y) / FGame.view.scale,
  };
}
function fWorldToScreen(wx, wy) {
  return {
    x: wx * FGame.view.scale + FGame.view.x,
    y: wy * FGame.view.scale + FGame.view.y,
  };
}

function fFindMachineAt(wx, wy) {
  for (let i = FGame.data.machines.length - 1; i >= 0; i--) {
    const m = FGame.data.machines[i];
    if (wx >= m.x - FM.W / 2 && wx <= m.x + FM.W / 2 &&
        wy >= m.y - FM.H / 2 && wy <= m.y + FM.H / 2) return m;
  }
  return null;
}
function fFindTruckAt(wx, wy) {
  for (const t of FGame.data.trucks) {
    if (Math.abs(wx - t.x) < 15 && Math.abs(wy - t.y) < 12) return t;
  }
  return null;
}

// ==================== 放置 ====================
function fStartDragPlace(type, subtype, price) {
  FUI.dragState = { type, subtype, price };
  fCloseMenus();
}
function fConfirmPlace(wx, wy) {
  const d = FUI.dragState;
  if (!d) return;
  const year = fCurYear();
  if (F_MACHINES[d.subtype] && F_MACHINES[d.subtype].year > year) {
    fUIToast('尚未解锁'); FUI.dragState = null; return;
  }
  if (FGame.data.money < d.price) {
    fUIToast('资金不足'); FUI.dragState = null; return;
  }
  FGame.data.money -= d.price;
  FGame.data.machines.push({
    id: fUid(), type: d.subtype, x: wx, y: wy,
    recipe: null, producing: false, progress: 0,
    waiting: false, blocked: false,
  });
  FUI.dragState = null;
  fUIToast('已放置' + (F_MACHINES[d.subtype]?.n || ''));
  fUIUpdateHUD();
}

// ==================== 机器菜单 ====================
function fShowMachineMenu(machine) {
  fCloseMenus();
  const year = fCurYear();
  const def = F_MACHINES[machine.type];
  if (!def) return;
  const opts = fMachineOptions(machine.type, year);
  const screen = fWorldToScreen(machine.x, machine.y);
  const menu = document.createElement('div');
  menu.className = 'fm-popup-menu';
  menu.style.left = Math.min(screen.x + 20, window.innerWidth - 260) + 'px';
  menu.style.top = Math.max(60, screen.y - 100) + 'px';
  let html = `<div class="fm-pm-title">${def.n}</div>`;
  if (opts.length === 0) {
    html += `<div class="fm-pm-item disabled">暂无可用配方</div>`;
  } else {
    opts.forEach(k => {
      const r = def.recipes[k];
      const isCur = machine.recipe === k;
      html += `
        <div class="fm-pm-item ${isCur ? 'active' : ''}" data-recipe="${k}">
          <div>${r.n}</div>
          <div class="fm-pm-sub">产出 ${Object.entries(r.out).map(([it, v]) => `${F_ITEMS[it].n}×${v}`).join(', ')}</div>
        </div>
      `;
    });
  }
  html += `<div class="fm-pm-sep"></div>
    <div class="fm-pm-item danger" data-act="delete">拆除机器</div>`;
  menu.innerHTML = html;
  document.body.appendChild(menu);
  FUI.machineMenu = menu;

  menu.querySelectorAll('[data-recipe]').forEach(el => {
    el.onclick = () => {
      machine.recipe = el.dataset.recipe;
      machine.producing = false;
      machine.progress = 0;
      fUIToast('已切换配方');
      fCloseMenus();
    };
  });
  menu.querySelector('[data-act="delete"]').onclick = () => {
    if (!confirm('拆除机器？不退款')) return;
    FGame.data.machines = FGame.data.machines.filter(m => m.id !== machine.id);
    fUIToast('已拆除');
    fCloseMenus();
  };
}

// ==================== 卡车菜单 ====================
function fShowTruckMenu(truck) {
  fCloseMenus();
  const screen = fWorldToScreen(truck.x, truck.y);
  const menu = document.createElement('div');
  menu.className = 'fm-popup-menu';
  menu.style.left = Math.min(screen.x + 20, window.innerWidth - 260) + 'px';
  menu.style.top = Math.max(60, screen.y - 80) + 'px';
  const def = F_TRUCKS[truck.type];
  let html = `<div class="fm-pm-title">${def.n}</div>
    <div class="fm-pm-sub" style="padding:0 10px 8px;">载重 ${fTruckCapacity(truck)}</div>`;
  html += `<div class="fm-pm-sep"></div><div class="fm-pm-label">绑定原料来源：</div>`;
  if (FGame.data.sources.length === 0) {
    html += `<div class="fm-pm-item disabled">请先签约原料来源</div>`;
  } else {
    FGame.data.sources.forEach(s => {
      const sdef = F_SOURCES[s.type];
      const isCur = truck.sourceId === s.id;
      html += `<div class="fm-pm-item ${isCur ? 'active' : ''}" data-sid="${s.id}">${sdef.n}</div>`;
    });
  }
  html += `<div class="fm-pm-sep"></div><div class="fm-pm-item danger" data-act="delete">出售卡车</div>`;
  menu.innerHTML = html;
  document.body.appendChild(menu);
  FUI.truckMenu = menu;

  menu.querySelectorAll('[data-sid]').forEach(el => {
    el.onclick = () => {
      truck.sourceId = el.dataset.sid;
      truck.state = 'going';
      fUIToast('已绑定');
      fCloseMenus();
    };
  });
  menu.querySelector('[data-act="delete"]').onclick = () => {
    if (!confirm('出售卡车？')) return;
    FGame.data.trucks = FGame.data.trucks.filter(t => t.id !== truck.id);
    fUIToast('已出售');
    fCloseMenus();
  };
}

function fCloseMenus() {
  if (FUI.machineMenu) { FUI.machineMenu.remove(); FUI.machineMenu = null; }
  if (FUI.truckMenu) { FUI.truckMenu.remove(); FUI.truckMenu = null; }
}

// ==================== 结算 ====================
function fUIShowRoundEnd(info) {
  fStopLoop();
  FUI.bottomBar.style.display = 'none';
  const { failed, bankrupt, year, round } = info;
  const wrap = FUI.panel.querySelector('#fm-modal-wrap');
  wrap.innerHTML = `
    <div class="fm-round-end">
      <div class="fm-re-title">${bankrupt ? '资金破产' : failed ? '本轮结束（订单失败）' : '本轮结束'}</div>
      <div class="fm-re-sub">${year} 年 · 第 ${round} 轮</div>
      <div class="fm-re-money">当前资金 <b>$${Math.round(FGame.data.money)}</b></div>
      <div class="fm-re-upgrades">
        <div class="fm-re-title2">永久升级（跨轮继承）</div>
        ${fRenderUpgradeRow('warehouseCapacity')}
        ${fRenderUpgradeRow('truckCapacity')}
      </div>
      <div class="fm-re-next">
        <button class="fm-btn primary" id="fm-next-round">进入第 ${round + 1} 轮</button>
      </div>
    </div>
  `;
  wrap.querySelectorAll('[data-upgrade]').forEach(btn => {
    btn.onclick = () => fBuyUpgrade(btn.dataset.upgrade);
  });
  wrap.querySelector('#fm-next-round').onclick = () => {
    wrap.innerHTML = '';
    fNextRound();
    FUI.bottomBar.style.display = 'flex';
    fStartLoop();
    setTimeout(() => fShowOrderSelector(), 300);
  };
}

function fRenderUpgradeRow(key) {
  const def = F_UPGRADES[key];
  if (!def) return '';
  const lv = FGame.data.permanent[key] || 0;
  const maxLv = def.lv.length - 1;
  const isMax = lv >= maxLv;
  const nextCost = isMax ? null : def.cost[lv + 1];
  const curVal = def.lv[lv];
  const nextVal = isMax ? null : def.lv[lv + 1];
  return `
    <div class="fm-re-up-row">
      <div>
        <div class="fm-re-up-name">${def.n}</div>
        <div class="fm-re-up-info">当前 ${curVal}${nextVal ? ' → ' + nextVal : ''}</div>
      </div>
      ${isMax
        ? '<span class="fm-re-max">已满级</span>'
        : `<button class="fm-btn primary" data-upgrade="${key}" ${FGame.data.money < nextCost ? 'disabled' : ''}>升级 $${nextCost}</button>`}
    </div>
  `;
}
function fBuyUpgrade(key) {
  const def = F_UPGRADES[key];
  const lv = FGame.data.permanent[key] || 0;
  if (lv >= def.lv.length - 1) return;
  const cost = def.cost[lv + 1];
  if (FGame.data.money < cost) { fUIToast('资金不足'); return; }
  FGame.data.money -= cost;
  FGame.data.permanent[key] = lv + 1;
  fAutoSave();
  // 刷新结算面板
  fUIShowRoundEnd({ failed: false, bankrupt: false, year: fCurYear(), round: FGame.data.round });
}

// ==================== Toast ====================
function fUIToast(msg) {
  const el = document.getElementById('fm-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ==================== 教程 ====================
const F_TUTORIAL_STEPS = [
  { text: '欢迎来到坦克工厂。你是工厂老板，目标：在时限内完成订单，赚取资金，升级产线。' },
  { text: '左侧「原料」书签 → 点开 → 签约「钢厂」。签约后卡车才能拉钢材。' },
  { text: '左侧「仓库」书签 → 购买一座仓库。所有物流都经过仓库。' },
  { text: '左侧「卡车」书签 → 购买一辆卡车。点画布上的卡车 → 绑定「钢厂」。' },
  { text: '左侧「机器」书签 → 拖出「焊接机」到画布。点机器 → 选择配方（比如「轻型车体」）。' },
  { text: '再放一台「组装台」。点它 → 选择「轻型坦克 Mk.I」配方。' },
  { text: '底部订单弹窗 → 选择一个订单 → 点击「开始生产」。' },
  { text: '产线会自动运转。耐心等待，或点 2x/4x 加速。祝你好运！' },
];
function fStartTutorial() {
  FUI.tutorialStep = 0;
  fShowTutorialStep();
}
function fShowTutorialStep() {
  const old = document.getElementById('fm-tutorial');
  if (old) old.remove();
  if (FUI.tutorialStep >= F_TUTORIAL_STEPS.length) {
    FGame.data.tutorialDone = true;
    fAutoSave();
    return;
  }
  const step = F_TUTORIAL_STEPS[FUI.tutorialStep];
  const el = document.createElement('div');
  el.id = 'fm-tutorial';
  el.innerHTML = `
    <div class="fm-tt-text">${step.text}</div>
    <div class="fm-tt-actions">
      <button class="fm-btn ghost" data-act="skip">跳过教程</button>
      <button class="fm-btn primary" data-act="next">${FUI.tutorialStep === F_TUTORIAL_STEPS.length - 1 ? '完成' : '下一步'}</button>
    </div>
    <div class="fm-tt-progress">${FUI.tutorialStep + 1} / ${F_TUTORIAL_STEPS.length}</div>
  `;
  FUI.panel.appendChild(el);
  el.querySelector('[data-act="next"]').onclick = () => {
    FUI.tutorialStep++;
    fShowTutorialStep();
  };
  el.querySelector('[data-act="skip"]').onclick = () => {
    FGame.data.tutorialDone = true;
    fAutoSave();
    el.remove();
  };
}

// ==================== 键盘 ====================
document.addEventListener('keydown', (e) => {
  if (!FUI.panel || FUI.panel.style.display === 'none') return;
  if (e.key === 'Escape') {
    if (FUI.dragState) { FUI.dragState = null; return; }
    fCloseMenus();
    if (FUI.currentLeftPanel) { FUI.currentLeftPanel = null; FUI.leftPanel.style.display = 'none'; fRenderLeftBar(); }
  }
});

// ==================== 暴露全局 ====================
window.fUIToast = fUIToast;
window.fUIUpdateHUD = fUIUpdateHUD;
window.fRender = fRender;
window.fUIShowRoundEnd = fUIShowRoundEnd;
window.fUIRefreshAll = function () { fRenderHUD(); fRenderLeftBar(); fUIUpdateHUD(); };