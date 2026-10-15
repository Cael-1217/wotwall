// ==================== last-stand.js — 背水一战 v1.0 ====================
(function () {
  'use strict';

  // ============ 常量 ============
  const MAP_W = 1000;
  const MAP_H = 600;
  const WAREHOUSE = { x: 380, y: 220, w: 240, h: 160 };
  const DEPLOY_PAD = 80;

  // ============ 坦克数据库 ============
  const TANK_DB = {
    VKEA40: {
      name: 'VKEA40', category: '防空车', color: '#4a90e2',
      hp: 1200, size: 20,
      weapon: { type: 'auto', damage: 18, fireRate: 0.26, range: 180, projSpeed: 460, twin: true },
      ability: 'radar',
      abilityDesc: '雷达：正前方 60° 的敌人受到伤害 +25%',
      summary: '双联 40mm 高炮 · 雷达支援',
    },
    T58: {
      name: 'T58', category: '重坦', color: '#c9a860',
      hp: 2400, size: 24,
      weapon: { type: 'clip', damage: 420, clip: 6, shortReload: 1.3, longReload: 11, range: 210, projSpeed: 340 },
      ability: 'hesh',
      abilityDesc: 'HESH：命中产生 12% 溅射伤害',
      summary: '6 发 152mm 弹鼓炮 · 高爆发',
    },
    BAT4M: {
      name: 'BAT-4M', category: '工程车', color: '#5aa860',
      hp: 2600, size: 26,
      weapon: { type: 'auto', damage: 35, fireRate: 1.15, range: 130, projSpeed: 360 },
      ability: 'shield',
      abilityDesc: '盾：正面免疫（周期性护盾）· 周围队友持续回血',
      summary: '护盾工程车 · 团队奶妈',
    },
    HUS57: {
      name: '护卫57', category: '轻坦', color: '#a06ac0',
      hp: 1000, size: 18,
      weapon: { type: 'auto', damage: 22, fireRate: 0.22, range: 165, projSpeed: 470 },
      ability: 'missile',
      abilityDesc: '导弹：每 15s 发射高伤 + 溅射导弹',
      summary: '57mm 机炮 + 导弹',
    },
    CHAR25T: {
      name: '查迪伦25T', category: '中坦', color: '#c05a5a',
      hp: 1500, size: 20,
      weapon: { type: 'clip', damage: 220, clip: 5, shortReload: 0.8, longReload: 12, range: 185, projSpeed: 400 },
      ability: 'aphe',
      abilityDesc: 'APHE：命中有概率造成起火（持续伤害）',
      summary: '5 发 105mm 弹夹炮',
    },
    LEOPARD: {
      name: '豹1A1A1', category: '中坦', color: '#7a8a4a',
      hp: 1400, size: 20,
      weapon: { type: 'single', damage: 340, reload: 7, range: 290, projSpeed: 540 },
      ability: 'sniper',
      abilityDesc: '狙击：命中标记敌人，再次受击秒杀（Boss 无效）',
      summary: '120mm 远程狙击',
    },
    T62M: {
      name: 'T-62M', category: '中坦', color: '#4a6b8a',
      hp: 1600, size: 20,
      weapon: { type: 'single', damage: 280, reload: 4, range: 205, projSpeed: 440 },
      ability: 'armor',
      abilityDesc: '护甲：免疫 3 次攻击',
      summary: '115mm 单发炮 · 附加装甲',
    },
    M1150: {
      name: 'M1150', category: '重坦', color: '#8a5a3a',
      hp: 2800, size: 26,
      weapon: { type: 'flame', damage: 45, fireRate: 0.14, range: 95 },
      ability: 'flame',
      abilityDesc: '喷火：近身撞击高伤 + 击退路径敌人',
      summary: '突击破障 · 喷火',
    },
  };

  const TANK_ORDER = ['VKEA40', 'T58', 'BAT4M', 'HUS57', 'CHAR25T', 'LEOPARD', 'T62M', 'M1150'];

  // ============ 敌人类型 ============
  const ENEMY_DB = {
    grunt:    { name: '步兵车',    hp: 300,  dmg: 15,  range: 130, fireRate: 1.6, speed: 55, size: 14, color: '#e74c3c' },
    tank:     { name: '中型坦克',  hp: 850,  dmg: 55,  range: 160, fireRate: 2.2, speed: 40, size: 20, color: '#c0392b' },
    heavy:    { name: '重型坦克',  hp: 1700, dmg: 95,  range: 180, fireRate: 2.6, speed: 28, size: 24, color: '#8e2a2a' },
    miniboss: { name: '小 BOSS',  hp: 3600, dmg: 140, range: 200, fireRate: 2.0, speed: 22, size: 32, color: '#a02020' },
    boss:     { name: '大 BOSS',  hp: 9000, dmg: 240, range: 230, fireRate: 1.8, speed: 16, size: 44, color: '#6a1a1a' },
  };

  // ============ 5 个通道 ============
  const LANES = [
    { id: 'N',  entry: { x: 500, y: -40 },       target: { x: 500, y: 200 },  invade: true  },
    { id: 'S',  entry: { x: 500, y: MAP_H + 40 }, target: { x: 500, y: 400 },  invade: true  },
    { id: 'W',  entry: { x: -40, y: 300 },       target: { x: 360, y: 300 },  invade: true  },
    { id: 'NE', entry: { x: MAP_W + 40, y: 110 }, target: { x: 640, y: 220 }, invade: false }, // 只能射击
    { id: 'SE', entry: { x: MAP_W + 40, y: 490 }, target: { x: 640, y: 380 }, invade: false },
  ];
  const INVADE_LANES = LANES.filter(l => l.invade);

  // ============ 全局状态 ============
  const LS = {
    panel: null, canvas: null, ctx: null, wrap: null,
    overlay: null, squadEl: null, headerEl: null,
    animId: null, lastTime: 0,
    phase: 'menu',              // menu | select | deploy | playing | waveClear | gameover | victory
    difficulty: 'normal',       // normal | hard
    wave: 0,
    squad: [],
    enemies: [],
    projectiles: [],
    effects: [],
    covers: [],
    selectedQueue: [],          // 已选择待部署的 tank id
    maxSelect: 3,
    pendingAdd: 0,              // 每 2 波新增额度
    spawnQueue: [],
    supportQueue: [],
    supportSpawned: false,
    spawnTimer: 0,
    waveTotal: 0,
    waveKilled: 0,
    waveBossActive: false,
    placingIndex: -1,           // 部署阶段：当前放置的 squad 下标
    mouseX: 0, mouseY: 0,
    hoverCardIdx: -1,
    scaling: 1,                 // 画布缩放
    viewW: 0, viewH: 0,
  };

  // ============ 工具函数 ============
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function lsToast(msg) {
    let el = document.getElementById('ls-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ls-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1600);
  }

  // ============ 地图与实体构造 ============
  function buildCovers() {
    // 固定 + 随机掩体
    const fixed = [
      { x: 260, y: 120, w: 60, h: 26 },
      { x: 680, y: 120, w: 60, h: 26 },
      { x: 260, y: 460, w: 60, h: 26 },
      { x: 680, y: 460, w: 60, h: 26 },
      { x: 140, y: 290, w: 26, h: 60 },
      { x: 840, y: 290, w: 26, h: 60 },
      { x: 460, y: 100, w: 80, h: 22 },
      { x: 460, y: 478, w: 80, h: 22 },
    ];
    const more = [];
    for (let i = 0; i < 6; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) { x = rand(80, 280); y = rand(80, 200); }
      else if (side === 1) { x = rand(720, 920); y = rand(80, 200); }
      else if (side === 2) { x = rand(80, 280); y = rand(400, 520); }
      else { x = rand(720, 920); y = rand(400, 520); }
      more.push({ x, y, w: rand(40, 70), h: rand(20, 40) });
    }
    LS.covers = fixed.concat(more);
  }

  function isValidDeployPos(x, y) {
    const dz = {
      x: WAREHOUSE.x - DEPLOY_PAD,
      y: WAREHOUSE.y - DEPLOY_PAD,
      w: WAREHOUSE.w + DEPLOY_PAD * 2,
      h: WAREHOUSE.h + DEPLOY_PAD * 2,
    };
    if (x < dz.x + 15 || x > dz.x + dz.w - 15) return false;
    if (y < dz.y + 15 || y > dz.y + dz.h - 15) return false;
    // 仓库本体
    if (x > WAREHOUSE.x - 8 && x < WAREHOUSE.x + WAREHOUSE.w + 8 &&
        y > WAREHOUSE.y - 8 && y < WAREHOUSE.y + WAREHOUSE.h + 8) return false;
    // 掩体
    for (const c of LS.covers) {
      if (x > c.x - 12 && x < c.x + c.w + 12 &&
          y > c.y - 12 && y < c.y + c.h + 12) return false;
    }
    // 其他友军
    for (const t of LS.squad) {
      if (t.dead && t.permanentDead) continue;
      if (t.placed && Math.hypot(t.x - x, t.y - y) < 44) return false;
    }
    return true;
  }

  // ============ 创建坦克实例 ============
  function createTankInstance(id, waveBonus) {
    const def = TANK_DB[id];
    const bonus = waveBonus || 0;
    return {
      id, def,
      x: 0, y: 0,
      hp: def.hp * (1 + bonus * 0.05),
      maxHp: def.hp * (1 + bonus * 0.05),
      aimAngle: -Math.PI / 2,
      weaponCd: 0,
      clipState: null,
      missileCd: 0,
      abilityCd: 0,
      armorCharges: def.ability === 'armor' ? 3 : 0,
      shieldHp: def.ability === 'shield' ? 1200 : 0,
      shieldMaxHp: 1200,
      shieldRegenCd: 0,
      placed: false,
      dead: false,
      permanentDead: false,
      deathCount: 0,
      charging: false,
      chargeT: 0,
      chargeDir: 0,
      hitThisCharge: new Set(),
      flashT: 0,
    };
  }

  // ============ 面板构建 ============
  function buildPanel() {
    if (LS.panel) return LS.panel;

    const panel = document.createElement('div');
    panel.id = 'ls-panel';
    panel.innerHTML = `
      <div class="ls-header" id="ls-header">
        <span class="ls-title">🛡️ 背水一战</span>
        <span class="ls-stat">波次<b id="ls-wave">0</b></span>
        <span class="ls-stat">敌人<b id="ls-enemy">0</b></span>
        <span class="ls-stat">击杀<b id="ls-kill">0</b></span>
        <span class="ls-spacer"></span>
        <button id="ls-quit">退出</button>
      </div>
      <div class="ls-canvas-wrap" id="ls-wrap">
        <canvas id="ls-canvas"></canvas>
        <div class="ls-overlay active" id="ls-overlay"></div>
      </div>
      <div class="ls-ui">
        <div class="ls-ui-top">
          <span>小队状态</span>
          <span id="ls-boss-tag" class="ls-boss-tag" style="display:none;">BOSS 波次</span>
          <span class="ls-spacer"></span>
          <span id="ls-tip" style="color:#c9a860;"></span>
        </div>
        <div class="ls-squad" id="ls-squad"></div>
      </div>
    `;
    document.body.appendChild(panel);
    LS.panel = panel;
    LS.canvas = panel.querySelector('#ls-canvas');
    LS.ctx = LS.canvas.getContext('2d');
    LS.wrap = panel.querySelector('#ls-wrap');
    LS.overlay = panel.querySelector('#ls-overlay');
    LS.squadEl = panel.querySelector('#ls-squad');
    LS.headerEl = panel.querySelector('#ls-header');

    panel.querySelector('#ls-quit').addEventListener('click', quitGame);

    // 鼠标/触摸
    const canvas = LS.canvas;
    canvas.addEventListener('mousemove', e => {
      const p = screenToMap(e);
      LS.mouseX = p.x; LS.mouseY = p.y;
    });
    canvas.addEventListener('click', e => {
      const p = screenToMap(e);
      handleCanvasClick(p.x, p.y);
    });
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        const p = screenToMap(e.touches[0]);
        LS.mouseX = p.x; LS.mouseY = p.y;
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      if (e.changedTouches.length === 1) {
        const p = screenToMap(e.changedTouches[0]);
        handleCanvasClick(p.x, p.y);
      }
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', resizeCanvas);
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (panel.classList.contains('active')) resizeCanvas();
      }).observe(LS.wrap);
    }
    return panel;
  }

  function resizeCanvas() {
    if (!LS.canvas || !LS.wrap) return;
    const w = LS.wrap.clientWidth;
    const h = LS.wrap.clientHeight;
    const ratio = MAP_W / MAP_H;
    let cw = w - 8, ch = cw / ratio;
    if (ch > h - 8) { ch = h - 8; cw = ch * ratio; }
    cw = Math.max(200, cw);
    ch = Math.max(120, ch);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    LS.canvas.style.width = cw + 'px';
    LS.canvas.style.height = ch + 'px';
    LS.canvas.width = Math.round(cw * dpr);
    LS.canvas.height = Math.round(ch * dpr);
    const sx = (cw * dpr) / MAP_W;
    const sy = (ch * dpr) / MAP_H;
    LS.ctx.setTransform(sx, 0, 0, sy, 0, 0);
    LS.viewW = cw;
    LS.viewH = ch;
  }

  function screenToMap(e) {
    const rect = LS.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_W,
      y: ((e.clientY - rect.top) / rect.height) * MAP_H,
    };
  }

  // ============ 流程：开始 ============
  function startLastStand() {
    const panel = buildPanel();
    panel.classList.add('active');
    document.body.style.overflow = 'hidden';

    LS.difficulty = 'normal';
    LS.wave = 0;
    LS.squad = [];
    LS.enemies = [];
    LS.projectiles = [];
    LS.effects = [];
    LS.selectedQueue = [];
    LS.maxSelect = 3;
    LS.pendingAdd = 0;
    buildCovers();

    requestAnimationFrame(() => {
      resizeCanvas();
      showMenu();
      startLoop();
    });
  }

  function showMenu() {
    LS.phase = 'menu';
    LS.overlay.classList.add('active');
    LS.overlay.innerHTML = `
      <h2>背水一战</h2>
      <p>部署你的小队，死守中央废弃仓库。<br>敌人会从 3 条通道涌入，NE 与 SE 通道只能射击不能进入。</p>
      <div class="ls-diff-row">
        <button class="ls-diff-btn selected" data-diff="normal">普通</button>
        <button class="ls-diff-btn" data-diff="hard">困难</button>
      </div>
      <div class="ls-btn-row">
        <button class="ls-btn" id="ls-btn-start">开始组队</button>
        <button class="ls-btn ghost" id="ls-btn-exit">退出</button>
      </div>
      <p style="margin-top:20px; font-size:11px; color:#5a5a62; max-width:460px;">
        提示：每 5 波出现小 BOSS，每 10 波出现大 BOSS；每 2 波可获得 1 台新增坦克；
        阵亡后波次结束会以半血复活，连续阵亡 2 次将彻底死亡。
      </p>
    `;
    LS.overlay.querySelectorAll('.ls-diff-btn').forEach(b => {
      b.addEventListener('click', () => {
        LS.difficulty = b.dataset.diff;
        LS.overlay.querySelectorAll('.ls-diff-btn').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
      });
    });
    LS.overlay.querySelector('#ls-btn-start').addEventListener('click', showSelect);
    LS.overlay.querySelector('#ls-btn-exit').addEventListener('click', quitGame);
  }

  // ============ 流程：选坦克 ============
  function showSelect() {
    LS.phase = 'select';
    LS.overlay.classList.add('active');
    renderSelectUI();
  }

  function renderSelectUI() {
    const remain = LS.maxSelect - LS.selectedQueue.length;
    LS.overlay.innerHTML = `
      <h2>组建小队</h2>
      <p>${LS.pendingAdd > 0
        ? `新增 ${LS.pendingAdd} 台坦克的额度（可重复选择）`
        : `选择 ${LS.maxSelect} 台坦克投入战斗（可重复选择）`}</p>
      <div class="ls-select-hint">
        已选 ${LS.selectedQueue.length} / ${LS.maxSelect + LS.pendingAdd} 台
        ${remain > 0 ? `· 还需选择 ${remain} 台` : ''}
      </div>
      <div class="ls-select-grid" id="ls-sel-grid"></div>
      <div class="ls-btn-row">
        <button class="ls-btn" id="ls-btn-confirm" ${LS.selectedQueue.length < (LS.maxSelect + LS.pendingAdd) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>确认阵容</button>
        <button class="ls-btn ghost" id="ls-btn-clear">清空</button>
      </div>
    `;

    const grid = LS.overlay.querySelector('#ls-sel-grid');
    TANK_ORDER.forEach(id => {
      const d = TANK_DB[id];
      const card = document.createElement('div');
      card.className = 'ls-select-card';
      card.innerHTML = `
        <div class="lsc-name">${d.name}</div>
        <div class="lsc-cat">${d.category} · ${d.summary}</div>
        <div class="lsc-ability">${d.abilityDesc}</div>
        <div class="lsc-stat">
          <span>HP ${Math.round(d.hp)}</span>
          <span>${
            d.weapon.type === 'clip' ? `弹夹 ${d.weapon.clip}` :
            d.weapon.type === 'single' ? `单发 ${d.weapon.reload}s` :
            d.weapon.type === 'flame' ? '喷火' : `射速 ${d.weapon.fireRate}s`
          }</span>
        </div>
      `;
      card.addEventListener('click', () => {
        const totalLimit = LS.maxSelect + LS.pendingAdd;
        if (LS.selectedQueue.length >= totalLimit) {
          lsToast('已达选择上限，可点击"清空"重新选');
          return;
        }
        LS.selectedQueue.push(id);
        renderSelectUI();
      });
      grid.appendChild(card);
    });

    LS.overlay.querySelector('#ls-btn-confirm').addEventListener('click', () => {
      if (LS.selectedQueue.length < (LS.maxSelect + LS.pendingAdd)) return;
      beginDeploy();
    });
    LS.overlay.querySelector('#ls-btn-clear').addEventListener('click', () => {
      LS.selectedQueue = [];
      renderSelectUI();
    });
  }

  // ============ 流程：部署 ============
  function beginDeploy() {
    LS.phase = 'deploy';
    // 如果是第一波，从 0 开始构造 squad
    if (LS.squad.length === 0) {
      LS.selectedQueue.forEach(id => LS.squad.push(createTankInstance(id, LS.wave)));
    } else {
      // 新增的坦克追加
      LS.selectedQueue.forEach(id => LS.squad.push(createTankInstance(id, LS.wave)));
    }
    LS.selectedQueue = [];
    LS.pendingAdd = 0;
    // 找到第一个未放置的坦克
    LS.placingIndex = LS.squad.findIndex(t => !t.placed);
    if (LS.placingIndex < 0) {
      startWave();
      return;
    }
    updateDeployOverlay();
  }

  function updateDeployOverlay() {
    const total = LS.squad.filter(t => !t.placed).length;
    LS.overlay.innerHTML = `
      <h2>部署阶段</h2>
      <p>点击地图放置你的坦克。仓库周围 80px 环带内、避开掩体即可。</p>
      <div class="ls-select-hint">
        剩余 ${total} 台待部署
        ${LS.placingIndex >= 0 ? `· 当前：<b>${LS.squad[LS.placingIndex].def.name}</b>` : ''}
      </div>
      <div class="ls-btn-row">
        <button class="ls-btn" id="ls-btn-auto">自动部署剩余</button>
        <button class="ls-btn ghost" id="ls-btn-restart-deploy">重新部署</button>
      </div>
    `;
    LS.overlay.querySelector('#ls-btn-auto').addEventListener('click', autoDeployAll);
    LS.overlay.querySelector('#ls-btn-restart-deploy').addEventListener('click', () => {
      LS.squad.forEach(t => { t.placed = false; });
      LS.placingIndex = 0;
      updateDeployOverlay();
    });
  }

  function autoDeployAll() {
    // 简单策略：把剩余坦克围绕仓库均匀放置
    const unplaced = LS.squad.filter(t => !t.placed);
    for (let i = 0; i < unplaced.length; i++) {
      const t = unplaced[i];
      let ok = false;
      for (let tries = 0; tries < 300 && !ok; tries++) {
        const ang = Math.random() * Math.PI * 2;
        const rx = WAREHOUSE.w / 2 + DEPLOY_PAD * 0.55;
        const ry = WAREHOUSE.h / 2 + DEPLOY_PAD * 0.55;
        const x = WAREHOUSE.x + WAREHOUSE.w / 2 + Math.cos(ang) * rx;
        const y = WAREHOUSE.y + WAREHOUSE.h / 2 + Math.sin(ang) * ry;
        if (isValidDeployPos(x, y)) {
          t.x = x; t.y = y; t.placed = true;
          ok = true;
        }
      }
    }
    LS.placingIndex = -1;
    startWave();
  }

  function handleCanvasClick(x, y) {
    if (LS.phase === 'deploy') {
      if (LS.placingIndex < 0) return;
      const t = LS.squad[LS.placingIndex];
      if (!isValidDeployPos(x, y)) {
        lsToast('此处不能放置（与仓库/掩体/友军重叠）');
        return;
      }
      t.x = x; t.y = y; t.placed = true;
      // 找下一个未放置
      const nextIdx = LS.squad.findIndex(tt => !tt.placed);
      LS.placingIndex = nextIdx;
      if (nextIdx < 0) {
        startWave();
      } else {
        updateDeployOverlay();
      }
      return;
    }
    if (LS.phase === 'playing') {
      // 战斗中点击无用
    }
  }

  // ============ 波次开始 ============
  function startWave() {
    LS.wave++;
    LS.phase = 'playing';
    LS.enemies = [];
    LS.projectiles = [];
    LS.effects = [];
    LS.spawnQueue = [];
    LS.supportQueue = [];
    LS.supportSpawned = false;
    LS.waveKilled = 0;
    LS.spawnTimer = 0;
    LS.waveBossActive = false;

    // 波次结束：所有坦克恢复到满血 / 复位
    LS.squad.forEach(t => {
      if (t.permanentDead) return;
      t.placed = true;
      if (t.dead) {
        // 半血复活
        t.hp = t.maxHp * 0.5;
        t.dead = false;
      } else {
        t.hp = t.maxHp;
      }
      t.weaponCd = 0;
      t.missileCd = 0;
      t.clipState = null;
      if (t.def.ability === 'armor') t.armorCharges = 3;
      if (t.def.ability === 'shield') {
        t.shieldHp = t.shieldMaxHp;
      }
      t.charging = false;
    });

    // 敌人数量
    const baseCount = 6 + LS.wave * 2;
    const diff = LS.difficulty === 'hard' ? 1.35 : 1;
    const total = Math.round(baseCount * diff);
    const isBossWave = LS.wave % 10 === 0;
    const isMiniBoss = !isBossWave && LS.wave % 5 === 0;

    // 填充 spawn 队列（从 3 个入侵通道）
    const waveHpMul = 1 + (LS.wave - 1) * 0.08;
    const waveDmgMul = 1 + (LS.wave - 1) * 0.06;

    for (let i = 0; i < total; i++) {
      let type;
      const r = Math.random();
      if (LS.wave < 3) type = 'grunt';
      else if (r < 0.5) type = 'grunt';
      else if (r < 0.85) type = 'tank';
      else type = 'heavy';
      LS.spawnQueue.push({ type, lane: pick(INVADE_LANES), hpMul: waveHpMul, dmgMul: waveDmgMul });
    }
    // 一半的支援
    LS.supportQueue = [];
    for (let i = 0; i < Math.round(total * 0.4); i++) {
      let type;
      const r = Math.random();
      if (r < 0.55) type = 'grunt';
      else type = 'tank';
      LS.supportQueue.push({ type, lane: pick(INVADE_LANES), hpMul: waveHpMul, dmgMul: waveDmgMul });
    }

    if (isMiniBoss) {
      LS.spawnQueue.push({ type: 'miniboss', lane: pick(INVADE_LANES), hpMul: waveHpMul, dmgMul: waveDmgMul });
      LS.waveBossActive = true;
    }
    if (isBossWave) {
      LS.spawnQueue.push({ type: 'boss', lane: pick(INVADE_LANES), hpMul: waveHpMul * 1.15, dmgMul: waveDmgMul * 1.1 });
      LS.waveBossActive = true;
    }

    LS.waveTotal = LS.spawnQueue.length + LS.supportQueue.length;
    LS.overlay.classList.remove('active');

    // 提示
    if (isBossWave) lsToast('⚔ 第 ' + LS.wave + ' 波 · 大 BOSS 来袭！');
    else if (isMiniBoss) lsToast('⚔ 第 ' + LS.wave + ' 波 · 小 BOSS 出现');
    else lsToast('第 ' + LS.wave + ' 波开始');

    updateHeader();
    updateSquadUI();
  }

  // ============ 敌人生成 ============
  function spawnEnemyFromQueue(item) {
    const def = ENEMY_DB[item.type];
    const lane = item.lane;
    const off = rand(-30, 30);
    const x = lane.entry.x + (lane.id === 'N' || lane.id === 'S' ? off : 0);
    const y = lane.entry.y + (lane.id === 'W' ? off : 0);
    LS.enemies.push({
      type: item.type,
      def,
      x, y,
      hp: def.hp * item.hpMul,
      maxHp: def.hp * item.hpMul,
      dmg: def.dmg * item.dmgMul,
      range: def.range,
      fireRate: def.fireRate,
      speed: def.speed,
      size: def.size,
      color: def.color,
      lane,
      target: null,
      cd: rand(0, 0.6),
      marked: false,
      burning: 0,
      radarBuff: false,
      isBoss: item.type === 'boss' || item.type === 'miniboss',
      flashT: 0,
    });
  }

  function updateSpawning(dt) {
    // 主批次
    if (LS.spawnQueue.length > 0) {
      LS.spawnTimer -= dt;
      if (LS.spawnTimer <= 0) {
        LS.spawnTimer = 0.55;
        const item = LS.spawnQueue.shift();
        spawnEnemyFromQueue(item);
      }
    }
    // 一半支援
    if (!LS.supportSpawned && LS.waveTotal > 0) {
      const killedRatio = LS.waveKilled / Math.max(1, LS.waveTotal);
      if (killedRatio >= 0.5) {
        LS.supportSpawned = true;
        const extra = LS.supportQueue.length;
        LS.supportQueue.forEach(item => {
          // 从"另一个方向"刷
          const otherLanes = INVADE_LANES;
          item.lane = pick(otherLanes);
          spawnEnemyFromQueue(item);
        });
        LS.supportQueue = [];
        if (extra > 0) lsToast('⚠ 敌方增援！');
      }
    }
  }

  // ============ 主循环 ============
  function startLoop() {
    if (LS.animId) return;
    LS.lastTime = performance.now();
    const loop = (t) => {
      LS.animId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - LS.lastTime) / 1000);
      LS.lastTime = t;

      if (LS.phase === 'playing') {
        update(dt);
      }

      render();
    };
    LS.animId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (LS.animId) {
      cancelAnimationFrame(LS.animId);
      LS.animId = null;
    }
  }

  // ============ 更新 ============
  function update(dt) {
    // 生成敌人
    updateSpawning(dt);

    // 雷达 buff 计算
    computeRadarBuff();

    // 更新玩家坦克
    for (const t of LS.squad) {
      if (t.dead || t.permanentDead || !t.placed) continue;
      updateTank(t, dt);
    }

    // 更新敌人
    for (const e of LS.enemies) {
      if (e.hp <= 0) continue;
      updateEnemy(e, dt);
    }

    // 更新子弹
    updateProjectiles(dt);

    // 更新特效
    for (const fx of LS.effects) fx.t -= dt;
    LS.effects = LS.effects.filter(fx => fx.t > 0);

    // 清理死亡敌人
    for (let i = LS.enemies.length - 1; i >= 0; i--) {
      if (LS.enemies[i].hp <= 0) {
        LS.enemies[i].dead = true;
        LS.waveKilled++;
        // 爆炸效果
        LS.effects.push({ x: LS.enemies[i].x, y: LS.enemies[i].y, t: 0.4, maxT: 0.4, type: 'boom', size: LS.enemies[i].size });
        LS.enemies.splice(i, 1);
      }
    }

    // 波次结束
    if (LS.spawnQueue.length === 0 && LS.supportQueue.length === 0 &&
        LS.enemies.length === 0 && LS.waveKilled >= LS.waveTotal) {
      waveClear();
    }

    updateHeader();
    updateSquadUI();
  }

  function computeRadarBuff() {
    for (const e of LS.enemies) e.radarBuff = false;
    for (const t of LS.squad) {
      if (t.dead || t.permanentDead || !t.placed) continue;
      if (t.def.ability !== 'radar') continue;
      for (const e of LS.enemies) {
        if (e.hp <= 0) continue;
        const ea = Math.atan2(e.y - t.y, e.x - t.x);
        let diff = ea - t.aimAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= Math.PI / 3) e.radarBuff = true;
      }
    }
  }

  function updateTank(t, dt) {
    t.flashT = Math.max(0, t.flashT - dt);

    // 盾回复
    if (t.def.ability === 'shield') {
      if (t.shieldHp < t.shieldMaxHp) {
        t.shieldRegenCd -= dt;
        if (t.shieldRegenCd <= 0) {
          t.shieldHp = Math.min(t.shieldMaxHp, t.shieldHp + 200);
          t.shieldRegenCd = 0.4;
        }
      } else {
        t.shieldRegenCd = 0;
      }
      // 治疗周围队友
      t.healCd = (t.healCd || 0) - dt;
      if (t.healCd <= 0) {
        t.healCd = 1.0;
        for (const o of LS.squad) {
          if (o === t || o.dead || o.permanentDead || !o.placed) continue;
          if (Math.hypot(o.x - t.x, o.y - t.y) < 140) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.05);
          }
        }
        // 自己也回一点
        t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.02);
      }
    }

    // M1150 特殊：撞击
    if (t.def.ability === 'flame') {
      if (t.charging) {
        t.chargeT -= dt;
        const spd = 380;
        t.x += Math.cos(t.chargeDir) * spd * dt;
        t.y += Math.sin(t.chargeDir) * spd * dt;
        for (const e of LS.enemies) {
          if (e.hp <= 0 || t.hitThisCharge.has(e)) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) < e.size + t.def.size + 6) {
            t.hitThisCharge.add(e);
            damageEnemy(e, 800, t, 'crush');
            // 击退
            const kx = e.x - t.x, ky = e.y - t.y;
            const kd = Math.hypot(kx, ky) || 1;
            e.x += kx / kd * 90;
            e.y += ky / kd * 90;
            e.x = clamp(e.x, 30, MAP_W - 30);
            e.y = clamp(e.y, 30, MAP_H - 30);
          }
        }
        if (t.chargeT <= 0) {
          t.charging = false;
          t.hitThisCharge.clear();
        }
      } else {
        // 检测近身敌人
        for (const e of LS.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) < 70) {
            t.charging = true;
            t.chargeT = 0.35;
            t.chargeDir = Math.atan2(e.y - t.y, e.x - t.x);
            break;
          }
        }
      }
    }

    // 目标搜索
    const target = findNearestEnemy(t, t.def.weapon.range);
    if (target) {
      t.aimAngle = Math.atan2(target.y - t.y, target.x - t.x);
    }

    // 武器逻辑
    updateTankWeapon(t, dt, target);

    // 特殊：导弹
    if (t.def.ability === 'missile') {
      t.missileCd -= dt;
      if (t.missileCd <= 0) {
        const mt = findNearestEnemy(t, 320);
        if (mt) {
          fireProjectile(t, mt, 900, 240, 'missile', { splash: 80, splashDmg: 0.5 });
          t.missileCd = 15;
          LS.effects.push({ x: t.x, y: t.y, t: 0.3, maxT: 0.3, type: 'muzzle', color: '#a06ac0' });
        } else {
          t.missileCd = 0.3;
        }
      }
    }
  }

  function updateTankWeapon(t, dt, target) {
    const w = t.def.weapon;

    if (w.type === 'auto') {
      t.weaponCd -= dt;
      if (t.weaponCd <= 0) {
        if (target) {
          fireProjectile(t, target, w.damage, w.projSpeed, 'normal');
          if (w.twin) {
            // 双联错开发射
            t.weaponCd = w.fireRate / 2;
            t.twinToggle = !t.twinToggle;
          } else {
            t.weaponCd = w.fireRate;
          }
        } else {
          t.weaponCd = 0.08;
        }
      }
    } else if (w.type === 'single') {
      t.weaponCd -= dt;
      if (t.weaponCd <= 0 && target) {
        fireProjectile(t, target, w.damage, w.projSpeed, 'normal');
        t.weaponCd = w.reload;
      }
    } else if (w.type === 'clip') {
      if (!t.clipState) t.clipState = { ammo: w.clip, shortCd: 0, longCd: 0, reloading: false, perRoundCd: 0 };
      const cs = t.clipState;
      if (cs.reloading) {
        cs.longCd -= dt;
        if (cs.longCd <= 0) {
          cs.ammo = w.clip;
          cs.reloading = false;
        }
      } else if (cs.shortCd > 0) {
        cs.shortCd -= dt;
      } else if (target && cs.ammo > 0) {
        fireProjectile(t, target, w.damage, w.projSpeed, 'normal');
        cs.ammo--;
        if (cs.ammo > 0) {
          cs.shortCd = w.shortReload;
        } else {
          cs.reloading = true;
          cs.longCd = w.longReload;
        }
      } else if (!target && cs.ammo < w.clip) {
        cs.perRoundCd -= dt;
        if (cs.perRoundCd <= 0) {
          cs.ammo++;
          cs.perRoundCd = w.longReload / w.clip;
        }
      }
    } else if (w.type === 'flame') {
      t.weaponCd -= dt;
      if (t.weaponCd <= 0 && target) {
        damageEnemy(target, w.damage, t, 'flame');
        LS.effects.push({ x: t.x, y: t.y, x2: target.x, y2: target.y, t: 0.15, maxT: 0.15, type: 'flame' });
        t.weaponCd = w.fireRate;
      }
    }
  }

  function findNearestEnemy(t, range) {
    let best = null, bd = Infinity;
    for (const e of LS.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < range && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function findNearestTank(e, range) {
    let best = null, bd = Infinity;
    for (const t of LS.squad) {
      if (t.dead || t.permanentDead || !t.placed) continue;
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d < range && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ============ 子弹 ============
  function fireProjectile(from, target, dmg, speed, kind, opts) {
    const ang = Math.atan2(target.y - from.y, target.x - from.x);
    LS.projectiles.push({
      x: from.x, y: from.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      dmg, kind: kind || 'normal',
      owner: from,
      splash: opts && opts.splash || 0,
      splashDmg: opts && opts.splashDmg || 0,
      ttl: 3,
      color: kind === 'missile' ? '#ff9944' : (from.isEnemy ? '#ff6666' : '#ffe066'),
      size: kind === 'missile' ? 6 : 3,
      trail: [],
    });
  }

  function updateProjectiles(dt) {
    for (let i = LS.projectiles.length - 1; i >= 0; i--) {
      const p = LS.projectiles[i];
      p.ttl -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 追踪导弹简单跟踪
      if (p.kind === 'missile' && p.owner && !p.owner.isEnemy) {
        const t = findNearestEnemy(p, 600);
        if (t) {
          const ang = Math.atan2(t.y - p.y, t.x - p.x);
          const desired = { x: Math.cos(ang), y: Math.sin(ang) };
          const cur = { x: p.vx, y: p.vy };
          const cl = Math.hypot(cur.x, cur.y);
          const cx = cur.x / cl, cy = cur.y / cl;
          const k = 3.5 * dt;
          const nx = cx + (desired.x - cx) * k;
          const ny = cy + (desired.y - cy) * k;
          const nl = Math.hypot(nx, ny) || 1;
          p.vx = nx / nl * cl;
          p.vy = ny / nl * cl;
        }
      }

      // 命中检测
      let hit = false;
      if (p.owner && p.owner.isEnemy === true) {
        // 敌人子弹打玩家
        for (const t of LS.squad) {
          if (t.dead || t.permanentDead || !t.placed) continue;
          if (Math.hypot(t.x - p.x, t.y - p.y) < t.def.size + 6) {
            damageTank(t, p.dmg);
            hit = true;
            break;
          }
        }
      } else {
        // 玩家子弹打敌人
        for (const e of LS.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.size + 6) {
            onProjectileHit(e, p);
            hit = true;
            break;
          }
        }
      }

      if (hit || p.ttl <= 0 || p.x < -50 || p.x > MAP_W + 50 || p.y < -50 || p.y > MAP_H + 50) {
        if (hit && p.kind === 'missile' && p.splash) {
          for (const e of LS.enemies) {
            if (e.hp <= 0) continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < p.splash) {
              damageEnemy(e, p.dmg * p.splashDmg, p.owner, 'splash');
            }
          }
          LS.effects.push({ x: p.x, y: p.y, t: 0.5, maxT: 0.5, type: 'boom', size: 60 });
        }
        LS.projectiles.splice(i, 1);
      }
    }
  }

  function onProjectileHit(e, p) {
    const owner = p.owner;
    let dmg = p.dmg;

    // 雷达：伤害 +25%
    if (e.radarBuff) dmg *= 1.25;

    // 豹1A1A1 狙击标记
    if (owner && owner.def && owner.def.ability === 'sniper') {
      if (!e.isBoss && e.marked) {
        // 二次命中：秒杀
        e.hp = 0;
        LS.effects.push({ x: e.x, y: e.y, t: 0.6, maxT: 0.6, type: 'boom', size: 50 });
        LS.effects.push({ x: e.x, y: e.y, t: 0.6, maxT: 0.6, type: 'mark', color: '#ff4444' });
        return;
      } else if (!e.isBoss) {
        e.marked = true;
      }
    }

    // 查迪伦25T：APHE 起火
    if (owner && owner.def && owner.def.ability === 'aphe') {
      if (Math.random() < 0.4) {
        e.burning = Math.max(e.burning, 4);
      }
    }

    // T58：HESH 溅射
    if (owner && owner.def && owner.def.ability === 'hesh') {
      for (const o of LS.enemies) {
        if (o === e || o.hp <= 0) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < 70) {
          damageEnemy(o, dmg * 0.12, owner, 'splash');
        }
      }
    }

    damageEnemy(e, dmg, owner, 'hit');
  }

  // ============ 伤害 ============
  function damageEnemy(e, dmg, source, kind) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flashT = 0.12;
    if (source && source.def && source.def.ability === 'radar') {
      // 雷达击杀标记（视觉）
    }
    LS.effects.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), t: 0.25, maxT: 0.25, type: 'hit', color: kind === 'flame' ? '#ff9944' : '#ffe066' });
  }

  function damageTank(t, dmg) {
    if (t.dead || t.permanentDead) return;

    // 护盾（BAT-4M）
    if (t.def.ability === 'shield' && t.shieldHp > 0) {
      t.shieldHp -= dmg;
      if (t.shieldHp < 0) {
        const overflow = -t.shieldHp;
        t.shieldHp = 0;
        // 溢出部分扣血
        t.hp -= overflow;
      }
      t.shieldRegenCd = 2.0;
    } else if (t.def.ability === 'armor' && t.armorCharges > 0) {
      // 护甲：完全免疫
      t.armorCharges--;
      LS.effects.push({ x: t.x, y: t.y, t: 0.3, maxT: 0.3, type: 'shield' });
    } else {
      t.hp -= dmg;
    }

    t.flashT = 0.12;
    LS.effects.push({ x: t.x + rand(-6, 6), y: t.y + rand(-6, 6), t: 0.22, maxT: 0.22, type: 'hit', color: '#ff6666' });

    if (t.hp <= 0) {
      t.hp = 0;
      t.dead = true;
      t.deathCount++;
      LS.effects.push({ x: t.x, y: t.y, t: 0.6, maxT: 0.6, type: 'boom', size: t.def.size + 10 });
      if (t.deathCount >= 2) {
        t.permanentDead = true;
        lsToast(t.def.name + ' 彻底阵亡');
      } else {
        lsToast(t.def.name + ' 阵亡');
      }
    }
  }

  // ============ 敌人 AI ============
  function updateEnemy(e, dt) {
    e.flashT = Math.max(0, e.flashT - dt);

    // 燃烧
    if (e.burning > 0) {
      e.burning -= dt;
      e.hp -= 15 * dt;
      if (Math.random() < 0.15) {
        LS.effects.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), t: 0.3, maxT: 0.3, type: 'hit', color: '#ff9944' });
      }
      if (e.hp <= 0) return;
    }

    // 寻找目标
    const target = findNearestTank(e, 9999);
    if (!target) return;

    // 移动到仓库附近（避免站在掩体里，简化处理）
    const inRange = Math.hypot(target.x - e.x, target.y - e.y) < e.range * 0.85;
    if (!inRange) {
      const ang = Math.atan2(target.y - e.y, target.x - e.x);
      // 简单避障：向仓库中心走
      const cx = WAREHOUSE.x + WAREHOUSE.w / 2;
      const cy = WAREHOUSE.y + WAREHOUSE.h / 2;
      const avoid = Math.atan2(cy - e.y, cx - e.x);
      const dir = ang + (avoid - ang) * 0.15;
      e.x += Math.cos(dir) * e.speed * dt;
      e.y += Math.sin(dir) * e.speed * dt;
      e.x = clamp(e.x, 20, MAP_W - 20);
      e.y = clamp(e.y, 20, MAP_H - 20);
    }

    // 攻击
    e.cd -= dt;
    if (e.cd <= 0 && Math.hypot(target.x - e.x, target.y - e.y) < e.range) {
      const ang = Math.atan2(target.y - e.y, target.x - e.x);
      LS.projectiles.push({
        x: e.x, y: e.y,
        vx: Math.cos(ang) * 260,
        vy: Math.sin(ang) * 260,
        dmg: e.dmg,
        kind: 'enemy',
        owner: { isEnemy: true },
        ttl: 3,
        color: '#ff5555',
        size: 3,
      });
      e.cd = e.fireRate;
    }
  }

  // ============ 波次结束 ============
  function waveClear() {
    if (LS.phase !== 'playing') return;
    LS.phase = 'waveClear';

    // 复活机制
    let needNewSelect = false;
    if (LS.wave % 2 === 0) {
      LS.pendingAdd = 1;
      needNewSelect = true;
    }

    // 提示
    const isBoss = LS.wave % 10 === 0;
    lsToast(isBoss ? '大 BOSS 已被击退！' : '第 ' + LS.wave + ' 波已完成');

    // 弹出结算
    LS.overlay.classList.add('active');
    LS.overlay.innerHTML = `
      <h2>第 ${LS.wave} 波已完成</h2>
      <p>小队击杀 ${LS.waveKilled} 个敌人。</p>
      <div class="ls-btn-row">
        ${needNewSelect
          ? `<button class="ls-btn" id="ls-btn-next-select">选择新增坦克 (+1)</button>
             <button class="ls-btn ghost" id="ls-btn-next">跳过新增，直接下一波</button>`
          : `<button class="ls-btn" id="ls-btn-next">进入第 ${LS.wave + 1} 波</button>`}
      </div>
    `;

    const nextBtn = LS.overlay.querySelector('#ls-btn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      LS.pendingAdd = 0;
      beginNextWave();
    });

    const selBtn = LS.overlay.querySelector('#ls-btn-next-select');
    if (selBtn) selBtn.addEventListener('click', () => {
      LS.selectedQueue = [];
      LS.maxSelect = 1;
      showSelect();
      // 选完后 beginNextWave
      LS._afterSelectCallback = beginNextWave;
    });

    // 检查彻底死亡情况
    const permDead = LS.squad.filter(t => t.permanentDead).length;
    if (permDead > 0) {
      const tip = document.createElement('p');
      tip.style.color = '#ff6b6b';
      tip.style.fontSize = '12px';
      tip.textContent = `已永久损失 ${permDead} 台坦克。`;
      LS.overlay.appendChild(tip);
    }
  }

  function beginNextWave() {
    // 清场：保留小队，清空敌人和子弹
    LS.enemies = [];
    LS.projectiles = [];
    LS.effects = [];
    LS.spawnQueue = [];
    LS.supportQueue = [];
    LS.waveTotal = 0;
    LS.waveKilled = 0;

    // 处理永久死亡：从 squad 中彻底移除？还是保留占位？这里从 squad 中移除
    LS.squad = LS.squad.filter(t => !t.permanentDead);

    if (LS.squad.length === 0) {
      gameOver();
      return;
    }

    startWave();
  }

  function gameOver() {
    LS.phase = 'gameover';
    stopLoop();
    LS.overlay.classList.add('active');
    LS.overlay.innerHTML = `
      <h2 style="background:linear-gradient(135deg,#e74c3c,#c0392b);-webkit-background-clip:text;background-clip:text;color:transparent;">小队全灭</h2>
      <p>你在第 ${LS.wave} 波被击溃。</p>
      <div class="ls-btn-row">
        <button class="ls-btn" id="ls-btn-again">再来一局</button>
        <button class="ls-btn ghost" id="ls-btn-quit2">退出</button>
      </div>
    `;
    LS.overlay.querySelector('#ls-btn-again').addEventListener('click', () => {
      startLastStand();
    });
    LS.overlay.querySelector('#ls-btn-quit2').addEventListener('click', quitGame);
  }

  // ============ 更新 UI ============
  function updateHeader() {
    if (!LS.headerEl) return;
    LS.headerEl.querySelector('#ls-wave').textContent = LS.wave;
    LS.headerEl.querySelector('#ls-enemy').textContent = LS.enemies.length + LS.spawnQueue.length + LS.supportQueue.length;
    LS.headerEl.querySelector('#ls-kill').textContent = LS.waveKilled;
    const bossTag = document.getElementById('ls-boss-tag');
    if (bossTag) {
      bossTag.style.display = LS.waveBossActive && LS.enemies.some(e => e.isBoss) ? 'inline-block' : 'none';
    }
  }

  function updateSquadUI() {
    if (!LS.squadEl) return;
    // 保持 DOM 与 squad 一一对应
    while (LS.squadEl.children.length > LS.squad.length) {
      LS.squadEl.removeChild(LS.squadEl.lastChild);
    }
    while (LS.squadEl.children.length < LS.squad.length) {
      const d = document.createElement('div');
      d.className = 'ls-card';
      d.innerHTML = `
        <div class="ls-dead-mark">已阵亡</div>
        <div class="ls-card-name"></div>
        <div class="ls-card-cat"></div>
        <div class="ls-armor" style="display:none;"></div>
        <div class="ls-hpbar"><div class="ls-hpbar-fill"></div></div>
        <div class="ls-hptext"><span class="ls-hp-num"></span><span class="ls-hp-max"></span></div>
        <div class="ls-reload"><div class="ls-reload-fill"></div></div>
        <div class="ls-ability"></div>
      `;
      LS.squadEl.appendChild(d);
    }
    LS.squad.forEach((t, i) => {
      const el = LS.squadEl.children[i];
      const w = t.def.weapon;
      el.classList.toggle('dead', t.dead || t.permanentDead);
      const pct = t.hp / t.maxHp;
      el.classList.toggle('warn', pct < 0.5 && pct > 0.25 && !t.dead);
      el.classList.toggle('danger', pct <= 0.25 && !t.dead);
      el.querySelector('.ls-card-name').textContent = t.def.name;
      el.querySelector('.ls-card-cat').textContent = t.def.category;
      const hpFill = el.querySelector('.ls-hpbar-fill');
      hpFill.style.width = Math.max(0, pct * 100) + '%';
      el.querySelector('.ls-hp-num').textContent = Math.round(t.hp);
      el.querySelector('.ls-hp-max').textContent = '/' + Math.round(t.maxHp);
      // 装填进度
      const rfill = el.querySelector('.ls-reload-fill');
      let rpct = 1;
      if (w.type === 'single') {
        rpct = 1 - Math.min(1, t.weaponCd / w.reload);
      } else if (w.type === 'clip') {
        const cs = t.clipState;
        if (cs) {
          if (cs.reloading) {
            rpct = 1 - Math.min(1, cs.longCd / w.longReload);
          } else if (cs.shortCd > 0) {
            rpct = 1 - Math.min(1, cs.shortCd / w.shortReload);
          } else if (cs.ammo >= w.clip) {
            rpct = 1;
          } else {
            rpct = cs.ammo / w.clip;
          }
        } else rpct = 1;
      } else {
        rpct = 1 - Math.min(1, t.weaponCd / (w.fireRate || 1));
      }
      rfill.style.width = Math.max(0, rpct * 100) + '%';
      // 特殊状态
      const armor = el.querySelector('.ls-armor');
      if (t.def.ability === 'armor' && t.armorCharges > 0) {
        armor.style.display = 'block';
        armor.textContent = '🛡 ' + t.armorCharges;
      } else if (t.def.ability === 'shield' && t.shieldHp > 0) {
        armor.style.display = 'block';
        armor.textContent = '🔷 ' + Math.round(t.shieldHp);
        armor.style.color = '#5aa860';
      } else {
        armor.style.display = 'none';
      }
      // 弹药显示
      const ab = el.querySelector('.ls-ability');
      if (w.type === 'clip' && t.clipState) {
        ab.textContent = `弹夹 ${t.clipState.ammo}/${w.clip}`;
      } else if (t.def.ability === 'missile') {
        ab.textContent = t.missileCd > 0 ? `导弹 ${t.missileCd.toFixed(1)}s` : '导弹就绪';
      } else {
        ab.textContent = t.def.abilityDesc.slice(0, 12) + '…';
      }
    });
  }

  // ============ 渲染 ============
  function render() {
    const ctx = LS.ctx;
    if (!ctx) return;

    // 背景
    ctx.fillStyle = '#14141a';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < MAP_W; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
    }
    for (let y = 0; y < MAP_H; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
    }

    // 通道
    for (const lane of LANES) {
      const w = lane.invade ? 90 : 70;
      ctx.fillStyle = lane.invade ? 'rgba(200,60,60,0.08)' : 'rgba(80,160,220,0.08)';
      // 从 entry 到 target 的矩形带
      const ang = Math.atan2(lane.target.y - lane.entry.y, lane.target.x - lane.entry.x);
      ctx.save();
      ctx.translate(lane.entry.x, lane.entry.y);
      ctx.rotate(ang);
      const len = Math.hypot(lane.target.x - lane.entry.x, lane.target.y - lane.entry.y);
      ctx.fillRect(0, -w / 2, len, w);
      // 边框
      ctx.strokeStyle = lane.invade ? 'rgba(200,60,60,0.4)' : 'rgba(80,160,220,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -w / 2, len, w);
      ctx.restore();
      // 标记
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = lane.invade ? '#ff8888' : '#88c8ff';
      const mx = lane.entry.x + (lane.target.x - lane.entry.x) * 0.35;
      const my = lane.entry.y + (lane.target.y - lane.entry.y) * 0.35;
      ctx.fillText(lane.invade ? '入侵' : '射击位', mx, my);
    }

    // 部署区（虚线框）
    if (LS.phase === 'deploy') {
      ctx.strokeStyle = 'rgba(201,168,96,0.4)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(
        WAREHOUSE.x - DEPLOY_PAD, WAREHOUSE.y - DEPLOY_PAD,
        WAREHOUSE.w + DEPLOY_PAD * 2, WAREHOUSE.h + DEPLOY_PAD * 2
      );
      ctx.setLineDash([]);
    }

    // 掩体
    for (const c of LS.covers) {
      ctx.fillStyle = '#3a3a42';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, 3);
    }

    // 中央仓库
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(WAREHOUSE.x, WAREHOUSE.y, WAREHOUSE.w, WAREHOUSE.h);
    ctx.strokeStyle = '#4a4a52';
    ctx.lineWidth = 2;
    ctx.strokeRect(WAREHOUSE.x, WAREHOUSE.y, WAREHOUSE.w, WAREHOUSE.h);
    // 仓库顶棚纹理
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < WAREHOUSE.h; i += 20) {
      ctx.fillRect(WAREHOUSE.x, WAREHOUSE.y + i, WAREHOUSE.w, 2);
    }
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6a6a72';
    ctx.fillText('废弃仓库', WAREHOUSE.x + WAREHOUSE.w / 2, WAREHOUSE.y + WAREHOUSE.h / 2 + 5);

    // 部署预览
    if (LS.phase === 'deploy' && LS.placingIndex >= 0) {
      const t = LS.squad[LS.placingIndex];
      const ok = isValidDeployPos(LS.mouseX, LS.mouseY);
      ctx.beginPath();
      ctx.arc(LS.mouseX, LS.mouseY, t.def.size, 0, Math.PI * 2);
      ctx.fillStyle = ok ? 'rgba(90,220,130,0.35)' : 'rgba(220,80,80,0.35)';
      ctx.fill();
      ctx.strokeStyle = ok ? '#5aff8a' : '#ff5050';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 特效（底层）
    for (const fx of LS.effects) {
      const k = fx.t / fx.maxT;
      if (fx.type === 'hit') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 8 * k + 2, 0, Math.PI * 2);
        ctx.fillStyle = fx.color || '#ffe066';
        ctx.globalAlpha = k;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'boom') {
        const r = (fx.size || 30) * (1.2 - k);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,140,60,${k * 0.5})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,120,${k * 0.7})`;
        ctx.fill();
      } else if (fx.type === 'muzzle') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 20 * (1 - k) + 4, 0, Math.PI * 2);
        ctx.fillStyle = fx.color || '#ffe066';
        ctx.globalAlpha = k;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (fx.type === 'shield') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 26 * (1 - k) + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(90,200,255,${k})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (fx.type === 'flame') {
        ctx.strokeStyle = `rgba(255,${150 + k * 100},60,${k})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
      } else if (fx.type === 'mark') {
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 30 * (1 - k) + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,60,60,${k})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 玩家坦克
    for (const t of LS.squad) {
      if (!t.placed) continue;
      drawTank(ctx, t, false);
    }

    // 敌人
    for (const e of LS.enemies) {
      drawEnemy(ctx, e);
    }

    // 子弹
    for (const p of LS.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (p.kind === 'missile') {
        // 拖尾
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
        ctx.strokeStyle = 'rgba(255,180,80,0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  function drawTank(ctx, t, isEnemy) {
    const size = t.def.size;
    const color = t.def.color;

    // 阴影
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + size * 0.4, size * 1.05, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 底盘
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.aimAngle);

    // 炮管
    ctx.beginPath();
    ctx.moveTo(size * 0.5, -2.5);
    ctx.lineTo(size * 1.7, -1.5);
    ctx.lineTo(size * 1.7, 1.5);
    ctx.lineTo(size * 0.5, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#2a2a30';
    ctx.fill();

    ctx.rotate(-t.aimAngle);

    // 车体
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fillStyle = t.dead ? '#333' : color;
    if (t.flashT > 0) ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 炮塔
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 护盾
    if (t.def.ability === 'shield' && t.shieldHp > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(90,200,255,${0.3 + 0.3 * (t.shieldHp / t.shieldMaxHp)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // 护甲
    if (t.def.ability === 'armor' && t.armorCharges > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, size + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(80,140,220,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 雷达指示
    if (t.def.ability === 'radar' && !t.dead) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, t.def.weapon.range * 0.6, t.aimAngle - Math.PI / 6, t.aimAngle + Math.PI / 6);
      ctx.closePath();
      ctx.fillStyle = 'rgba(74,144,226,0.08)';
      ctx.fill();
    }

    ctx.restore();

    // 血条
    if (!t.dead) {
      const hpPct = t.hp / t.maxHp;
      const bw = size * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(t.x - bw / 2, t.y - size - 8, bw, 4);
      ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : (hpPct > 0.25 ? '#fbbf24' : '#ef4444');
      ctx.fillRect(t.x - bw / 2, t.y - size - 8, bw * hpPct, 4);
    }

    // 阵亡标记
    if (t.dead) {
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5050';
      ctx.fillText('✕', t.x, t.y + 4);
    }
  }

  function drawEnemy(ctx, e) {
    // 阴影
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.size * 0.4, e.size * 1.05, e.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // 主体
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fillStyle = e.flashT > 0 ? '#ffffff' : e.color;
    ctx.fill();
    ctx.strokeStyle = e.isBoss ? '#ffdd44' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = e.isBoss ? 3 : 2;
    ctx.stroke();

    // 内部
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // BOSS 标记
    if (e.isBoss) {
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffdd44';
      ctx.fillText('★', e.x, e.y + 5);
    }

    // 雷达 buff 提示
    if (e.radarBuff) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74,144,226,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 燃烧
    if (e.burning > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,140,60,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 标记（豹1）
    if (e.marked) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size + 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,60,60,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 血条
    const hpPct = e.hp / e.maxHp;
    const bw = e.size * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - bw / 2, e.y - e.size - 8, bw, 4);
    ctx.fillStyle = e.isBoss ? '#ffdd44' : '#ff5050';
    ctx.fillRect(e.x - bw / 2, e.y - e.size - 8, bw * Math.max(0, hpPct), 4);
  }

  // ============ 退出 ============
  function quitGame() {
    if (LS.panel) LS.panel.classList.remove('active');
    document.body.style.overflow = '';
    stopLoop();
    LS.phase = 'menu';
  }

  // ============ 键盘 ============
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (LS.panel && LS.panel.classList.contains('active')) {
        quitGame();
      }
    }
  });

  // ============ 暴露到全局 ============
  window.startLastStand = startLastStand;
})();