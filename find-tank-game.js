// ==================== find-tank-game.js — 剧情模式 v5 ====================

/* ============================================================
   全局状态
   ============================================================ */
const StoryGame = {
  // Three
  scene: null, camera: null, renderer: null,
  animId: null, clock: null, panel: null,
  phase: 'menu',   // menu | playing | dialog

  // 玩家
  playerTank: null,
  px: -75, pz: 95, ph: Math.PI,
  playerSpeed: 0,
  maxSpeed: 22,
  minSpeed: -8,

  // 视角
  camYaw: 0, camPitch: -0.12,
  menuAngle: 0,

  // 输入
  keys: { up: false, down: false, left: false, right: false },
  drag: null,

  // 游戏
  score: 0, missiles: 2,
  totalTargets: 0, capturedCount: 0,
  targetTanks: [],
  capturedIds: new Set(),

  // NPC
  npcTank: null,
  npcPos: { x: -60, z: 85 },
  npcRadius: 12,

  // 地图
  MAP_SIZE: 500,
  MAP_HALF: 250,
  SEA_RADIUS: 200,

  // 光照
  ambient: null, dir: null, hemi: null,

  // 小地图
  minimapCanvas: null,
  minimapCtx: null,
  minimapBg: null,

  dialogOpen: false,
  raycaster: null,
  pointer: null,
  clock_last: 0,
};

const GAME_LIB_PATHS = { three: 'three.min.js' };

/* ============================================================
   工具函数
   ============================================================ */
function _nextFrame() {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function _loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const ex = document.querySelector(`script[src="${src}"]`);
    if (ex) {
      if (ex.dataset.loaded === '1') return resolve();
      ex.addEventListener('load', () => resolve());
      ex.addEventListener('error', () => reject(new Error('加载失败: ' + src)));
      return;
    }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error('加载失败: ' + src));
    document.head.appendChild(s);
  });
}
async function ensureThreeLibs() {
  if (!window.THREE || typeof window.THREE.WebGLRenderer !== 'function') {
    await _loadScriptOnce(GAME_LIB_PATHS.three);
  }
  if (!window.THREE || typeof window.THREE.WebGLRenderer !== 'function') {
    throw new Error('Three.js 加载失败：请确认 three.min.js 在仓库根目录');
  }
}
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ============================================================
   地形高度函数（固定地图）
   ============================================================ */
function mountainFeature(x, z, cx, cz, radius, height) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > radius) return 0;
  const t = 1 - d / radius;
  return Math.pow(Math.sin(t * Math.PI / 2), 1.6) * height;
}
function basinFeature(x, z, cx, cz, radius, depth) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > radius) return 0;
  const t = 1 - d / radius;
  return Math.pow(t, 1.6) * depth;
}

// 河流路径（从西北山地 → 港口出海）
const RIVER_PATH = [
  [-100, 60], [-70, 40], [-40, 20], [-10, 0],
  [30, -20], [70, -45], [110, -75], [140, -100]
];
function distPointToSeg(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const apx = px - ax, apz = pz - az;
  const ab2 = abx * abx + abz * abz;
  const t = ab2 > 0 ? clamp((apx * abx + apz * abz) / ab2, 0, 1) : 0;
  const cx = ax + abx * t, cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}
function riverInfluence(x, z) {
  let minD = Infinity;
  for (let i = 0; i < RIVER_PATH.length - 1; i++) {
    const [ax, az] = RIVER_PATH[i];
    const [bx, bz] = RIVER_PATH[i + 1];
    const d = distPointToSeg(x, z, ax, az, bx, bz);
    if (d < minD) minD = d;
  }
  const w = 9;
  if (minD > w) return 0;
  return 1 - minD / w;
}

function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 0;

  // 基础丘陵
  h += Math.sin(x * 0.026) * Math.cos(z * 0.024) * 3.2;
  h += Math.sin(x * 0.062 + 1.2) * Math.cos(z * 0.058 + 0.5) * 1.5;
  h += Math.sin(x * 0.14 + 2.5) * Math.cos(z * 0.13 + 1.8) * 0.7;

  // 西北山脉（主峰群）
  h += mountainFeature(x, z, -140, -110, 110, 62);
  h += mountainFeature(x, z, -80, -140, 70, 38);
  h += mountainFeature(x, z, -170, -50, 55, 28);

  // 出生点附近的小悬崖（瀑布源头）
  h += mountainFeature(x, z, -85, 75, 22, 9);

  // 湖泊
  h -= basinFeature(x, z, -20, -60, 42, 9);

  // 沼泽地（西南）
  h -= basinFeature(x, z, 90, 140, 65, 4.5);

  // 工业区平坦化（东部）
  const indD = Math.hypot(x - 110, z - 60);
  if (indD < 55) {
    const t = 1 - indD / 55;
    h = h * (1 - t * 0.88) + 0.8 * t;
  }

  // 港口平地（东南沿海）
  const portD = Math.hypot(x - 150, z - 100);
  if (portD < 50) {
    const t = 1 - portD / 50;
    h = h * (1 - t * 0.9) + 0.5 * t;
  }

  // 河流下切
  h -= riverInfluence(x, z) * 3.2;

  // 海岸衰减
  const seaStart = StoryGame.SEA_RADIUS - 45;
  if (r > seaStart) {
    const t = Math.min(1, (r - seaStart) / 45);
    h = h * (1 - t * t) - 8 * t * t;
  }
  return h;
}

/* ============================================================
   地形着色
   ============================================================ */
function terrainColor(x, z, h) {
  if (h < 0.3) return [0.13, 0.28, 0.42];
  if (h < 1.2) return [0.72, 0.66, 0.5];

  // 沼泽
  if (Math.hypot(x - 90, z - 140) < 65 && h < 5) return [0.32, 0.4, 0.22];
  // 工业
  if (Math.hypot(x - 110, z - 60) < 55) return [0.42, 0.42, 0.44];
  // 港口
  if (Math.hypot(x - 150, z - 100) < 50) return [0.55, 0.55, 0.56];

  if (h < 6) return [0.38, 0.56, 0.28];
  if (h < 16) return [0.3, 0.48, 0.22];
  if (h < 30) return [0.42, 0.42, 0.32];
  if (h < 45) return [0.55, 0.54, 0.5];
  return [0.88, 0.9, 0.92];
}

/* ============================================================
   1. 面板
   ============================================================ */
function initPanel() {
  if (StoryGame.panel) return StoryGame.panel;
  const p = document.createElement('div');
  p.id = 'story-panel';
  p.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0b0b0e;display:none;overflow:hidden;font-family:inherit;';

  p.innerHTML = `
    <div id="story-canvas" style="position:absolute;inset:0;"></div>

    <!-- 主菜单 -->
    <div id="story-menu" style="position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:center;padding:0 60px;background:linear-gradient(90deg, rgba(11,11,14,0.86) 0%, rgba(11,11,14,0.4) 40%, rgba(11,11,14,0) 70%);color:#fff;">
      <h1 style="margin:0;font-size:44px;font-weight:800;letter-spacing:-0.03em;background:linear-gradient(135deg,#ffd83a,#c9a860);-webkit-background-clip:text;background-clip:text;color:transparent;max-width:520px;">寻找坦克</h1>
      <p style="color:#a8a8b0;font-size:14px;margin:10px 0 32px;max-width:480px;line-height:1.8;">
        一场关于失踪装甲部队的搜寻任务<br>
        穿越森林、山地、沼泽、工业区与港口<br>
        找到藏匿的坦克，凭积分兑换导弹
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;max-width:260px;">
        <button id="story-btn-start" style="padding:14px 32px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:0.05em;cursor:pointer;box-shadow:0 8px 28px rgba(255,216,58,0.35);">🚀 开始冒险</button>
        <button id="story-btn-quit" style="padding:12px 32px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.04);color:#c8c8d0;font-family:inherit;font-size:14px;cursor:pointer;">退出</button>
      </div>
      <div id="story-status" style="color:#8a8a92;font-size:12px;margin-top:24px;height:16px;"></div>
    </div>

    <!-- HUD -->
    <div id="story-hud" style="display:none;position:absolute;inset:0;z-index:15;pointer-events:none;">
      <!-- 左上：积分 / 导弹 -->
      <div style="position:absolute;top:14px;left:14px;display:flex;gap:10px;padding:10px 16px;border-radius:12px;background:rgba(10,10,14,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(10px);color:#fff;font-size:14px;pointer-events:auto;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#8a8a92;font-size:12px;">积分</span>
          <b id="story-score" style="color:#ffd83a;font-size:16px;font-family:ui-monospace,monospace;">0</b>
        </div>
        <div style="width:1px;background:rgba(255,255,255,0.15);"></div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:#8a8a92;font-size:12px;">导弹</span>
          <b id="story-missiles" style="color:#ff6a6a;font-size:16px;font-family:ui-monospace,monospace;">2</b>
        </div>
      </div>

      <!-- 右上：小地图 -->
      <div style="position:absolute;top:14px;right:14px;padding:8px;border-radius:12px;background:rgba(10,10,14,0.72);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(10px);pointer-events:auto;">
        <canvas id="story-minimap" width="160" height="160" style="display:block;border-radius:8px;"></canvas>
        <div style="text-align:center;color:#8a8a92;font-size:10px;margin-top:4px;font-family:ui-monospace,monospace;">MAP</div>
      </div>

      <!-- 底部：操作按钮 -->
      <div id="story-controls" style="position:absolute;bottom:20px;right:20px;pointer-events:auto;user-select:none;">
        <div style="display:grid;grid-template-columns:repeat(3, 52px);grid-template-rows:repeat(3, 52px);gap:6px;">
          <div></div>
          <button data-k="up" style="grid-column:2;grid-row:1;width:52px;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(20,20,26,0.75);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(8px);">▲</button>
          <div></div>
          <button data-k="left" style="grid-column:1;grid-row:2;width:52px;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(20,20,26,0.75);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(8px);">◀</button>
          <div></div>
          <button data-k="right" style="grid-column:3;grid-row:2;width:52px;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(20,20,26,0.75);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(8px);">▶</button>
          <div></div>
          <button data-k="down" style="grid-column:2;grid-row:3;width:52px;height:52px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);background:rgba(20,20,26,0.75);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(8px);">▼</button>
          <div></div>
        </div>
      </div>

      <!-- 右下：退出 -->
      <button id="story-btn-exit" style="position:absolute;bottom:20px;left:20px;pointer-events:auto;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);background:rgba(20,20,26,0.75);color:#c8c8d0;font-family:inherit;font-size:13px;cursor:pointer;backdrop-filter:blur(8px);">返回主菜单</button>

      <!-- 提示 -->
      <div id="story-hint" style="position:absolute;bottom:100px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:999px;background:rgba(10,10,14,0.82);border:1px solid rgba(255,216,58,0.4);color:#ffd83a;font-size:13px;white-space:nowrap;opacity:0;transition:opacity 0.3s;pointer-events:none;"></div>
    </div>

    <!-- 对话框 -->
    <div id="story-dialog" style="display:none;position:absolute;bottom:0;left:0;right:0;z-index:30;padding:24px;background:linear-gradient(to top, rgba(10,10,14,0.98) 0%, rgba(10,10,14,0.92) 70%, rgba(10,10,14,0) 100%);color:#fff;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ffd83a,#c9a860);display:flex;align-items:center;justify-content:center;font-size:18px;">🎖</div>
          <div style="font-weight:700;font-size:14px;">指挥官 · "先锋号"</div>
        </div>
        <div id="story-dialog-text" style="font-size:15px;line-height:1.75;color:#e8e8ea;margin-bottom:16px;white-space:pre-wrap;"></div>
        <div id="story-dialog-options" style="display:flex;gap:10px;flex-wrap:wrap;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(p);
  StoryGame.panel = p;
  StoryGame.minimapCanvas = p.querySelector('#story-minimap');
  StoryGame.minimapCtx = StoryGame.minimapCanvas.getContext('2d');

  // 事件
  p.querySelector('#story-btn-start').addEventListener('click', startAdventure);
  p.querySelector('#story-btn-quit').addEventListener('click', closeStoryGame);
  p.querySelector('#story-btn-exit').addEventListener('click', backToMenu);

  p.querySelectorAll('#story-controls [data-k]').forEach(btn => {
    const k = btn.dataset.k;
    const on = e => { e.preventDefault(); StoryGame.keys[k] = true; };
    const off = e => { e.preventDefault(); StoryGame.keys[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  });

  // 相机旋转（画布拖拽）
  const canvasWrap = p.querySelector('#story-canvas');
  canvasWrap.style.touchAction = 'none';
  canvasWrap.addEventListener('pointerdown', e => {
    if (StoryGame.phase !== 'playing') return;
    if (e.target.closest('#story-hud')) return;
    StoryGame.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  canvasWrap.addEventListener('pointermove', e => {
    if (!StoryGame.drag || StoryGame.drag.id !== e.pointerId) return;
    const dx = e.clientX - StoryGame.drag.x;
    const dy = e.clientY - StoryGame.drag.y;
    StoryGame.drag.x = e.clientX;
    StoryGame.drag.y = e.clientY;
    StoryGame.camYaw += dx * 0.005;
    StoryGame.camPitch = clamp(StoryGame.camPitch - dy * 0.005, -0.9, 0.5);
  });
  canvasWrap.addEventListener('pointerup', e => { StoryGame.drag = null; });
  canvasWrap.addEventListener('pointercancel', () => { StoryGame.drag = null; });

  // 画布点击（找坦克）
  canvasWrap.addEventListener('click', e => {
    if (StoryGame.phase !== 'playing') return;
    if (e.target.closest('#story-hud')) return;
    handleCanvasClick(e.clientX, e.clientY);
  });

  window.addEventListener('resize', () => {
    if (p.style.display !== 'none') resizeRenderer();
  });

  return p;
}

/* ============================================================
   2. 入口 / 退出
   ============================================================ */
async function startFindTankGame() {
  const p = initPanel();
  p.style.display = 'block';
  document.body.style.overflow = 'hidden';
  try { await ensureThreeLibs(); } catch (e) {}

  if (!StoryGame.renderer) {
    initScene();
    buildMap();
    buildPlayerTank();
    buildNpcTank();
    buildTargetTanks();
    buildMinimapBg();
  }
  StoryGame.phase = 'menu';
  p.querySelector('#story-menu').style.display = 'flex';
  p.querySelector('#story-hud').style.display = 'none';
  p.querySelector('#story-dialog').style.display = 'none';
  startLoop();
}

function closeStoryGame() {
  if (!StoryGame.panel) return;
  StoryGame.panel.style.display = 'none';
  document.body.style.overflow = '';
  stopLoop();
}

function backToMenu() {
  StoryGame.phase = 'menu';
  const p = StoryGame.panel;
  p.querySelector('#story-menu').style.display = 'flex';
  p.querySelector('#story-hud').style.display = 'none';
  p.querySelector('#story-dialog').style.display = 'none';
  StoryGame.dialogOpen = false;
}

async function startAdventure() {
  const p = StoryGame.panel;
  p.querySelector('#story-menu').style.display = 'none';
  p.querySelector('#story-hud').style.display = 'block';
  StoryGame.phase = 'playing';

  // 重置玩家到出生点
  StoryGame.px = -75;
  StoryGame.pz = 95;
  StoryGame.ph = Math.PI;
  StoryGame.playerSpeed = 0;
  StoryGame.camYaw = 0;
  StoryGame.camPitch = -0.12;

  // 重置资源
  StoryGame.score = 0;
  StoryGame.missiles = 2;
  StoryGame.capturedCount = 0;
  StoryGame.capturedIds.clear();
  updateHUD();

  // 重置目标坦克
  StoryGame.targetTanks.forEach(t => {
    t.tank.visible = true;
    t.phase = 'idle';
    t.t = 0;
  });

  await _nextFrame();
  resizeRenderer();

  // 开场对话（延迟 600ms，等场景稳定）
  setTimeout(() => {
    showIntroDialog();
  }, 800);
}

/* ============================================================
   3. Three 初始化
   ============================================================ */
function initScene() {
  const wrap = StoryGame.panel.querySelector('#story-canvas');

  StoryGame.scene = new THREE.Scene();
  StoryGame.scene.background = new THREE.Color(0x87ceeb);
  StoryGame.scene.fog = new THREE.Fog(0xa8c8dd, 80, 280);

  StoryGame.camera = new THREE.PerspectiveCamera(65, 1, 0.3, 800);
  StoryGame.camera.position.set(0, 80, 120);

  StoryGame.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  StoryGame.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  StoryGame.renderer.setClearColor(0x87ceeb, 1);
  // 关闭阴影以提高性能（移动端）
  StoryGame.renderer.shadowMap.enabled = false;
  wrap.appendChild(StoryGame.renderer.domElement);

  StoryGame.hemi = new THREE.HemisphereLight(0xcce0ff, 0x554433, 0.65);
  StoryGame.scene.add(StoryGame.hemi);
  StoryGame.ambient = new THREE.AmbientLight(0xffffff, 0.42);
  StoryGame.scene.add(StoryGame.ambient);
  StoryGame.dir = new THREE.DirectionalLight(0xfff3e0, 0.85);
  StoryGame.dir.position.set(80, 120, 60);
  StoryGame.scene.add(StoryGame.dir);

  StoryGame.raycaster = new THREE.Raycaster();
  StoryGame.pointer = new THREE.Vector2();
  StoryGame.clock = new THREE.Clock();

  resizeRenderer();
}

function resizeRenderer() {
  const wrap = StoryGame.panel.querySelector('#story-canvas');
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  StoryGame.renderer.setSize(w, h);
  StoryGame.camera.aspect = w / h;
  StoryGame.camera.updateProjectionMatrix();
}

/* ============================================================
   4. 生成地图（地形 + 水面 + 树 + 地标）
   ============================================================ */
function buildMap() {
  buildTerrain();
  buildWater();
  buildTrees();
  buildLandmarks();
  buildIndustrialZone();
  buildHarbor();
}

function buildTerrain() {
  const size = StoryGame.MAP_SIZE;
  const segs = 90;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = terrainColor(x, z, h);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  StoryGame.scene.add(mesh);
  StoryGame.terrain = mesh;
}

function buildWater() {
  // 海面（大圆盘）
  const seaGeo = new THREE.CircleGeometry(StoryGame.MAP_HALF + 40, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x1e4a70, roughness: 0.25, metalness: 0.35,
    transparent: true, opacity: 0.92,
  });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = -0.3;
  StoryGame.scene.add(sea);

  // 湖泊 / 河流 水面
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x2a5a80, roughness: 0.2, metalness: 0.4,
    transparent: true, opacity: 0.88,
  });

  // 湖泊
  const lakeGeo = new THREE.CircleGeometry(38, 32);
  lakeGeo.rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, pondMat);
  lake.position.set(-20, terrainHeight(-20, -60) + 0.4, -60);
  StoryGame.scene.add(lake);

  // 河流：按路径分段
  const riverMat = pondMat;
  for (let i = 0; i < RIVER_PATH.length - 1; i++) {
    const [ax, az] = RIVER_PATH[i];
    const [bx, bz] = RIVER_PATH[i + 1];
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const x0 = lerp(ax, bx, t0), z0 = lerp(az, bz, t0);
      const x1 = lerp(ax, bx, t1), z1 = lerp(az, bz, t1);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const angle = Math.atan2(x1 - x0, z1 - z0);
      const g = new THREE.PlaneGeometry(15, len * 1.2);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, riverMat);
      const y = terrainHeight(mx, mz) + 0.4;
      m.position.set(mx, y, mz);
      m.rotation.y = angle;
      StoryGame.scene.add(m);
    }
  }

  // 沼泽水面
  const swampGeo = new THREE.CircleGeometry(58, 24);
  swampGeo.rotateX(-Math.PI / 2);
  const swampMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a2a, roughness: 0.5, metalness: 0.1,
    transparent: true, opacity: 0.72,
  });
  const swamp = new THREE.Mesh(swampGeo, swampMat);
  swamp.position.set(90, terrainHeight(90, 140) + 0.3, 140);
  StoryGame.scene.add(swamp);
}

/* ---------- 树木（InstancedMesh，性能友好） ---------- */
function buildTrees() {
  const treePositions = [];

  // 森林区域：出生点周围 + 湖泊周围 + 山地山脚
  const densityZones = [
    { cx: -75, cz: 75, r: 55, n: 240 },
    { cx: -50, cz: 20, r: 50, n: 120 },
    { cx: -20, cz: -60, r: 45, n: 90 },
    { cx: 60, cz: 160, r: 45, n: 40 },   // 沼泽边
    { cx: 150, cz: 40, r: 45, n: 60 },   // 山脚
    { cx: -160, cz: 60, r: 40, n: 60 },
  ];

  for (const z of densityZones) {
    for (let i = 0; i < z.n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * z.r;
      const x = z.cx + Math.cos(a) * rr;
      const zz = z.cz + Math.sin(a) * rr;
      const h = terrainHeight(x, zz);
      if (h < 1 || h > 40) continue;
      // 避免水里 / 工业区
      if (riverInfluence(x, zz) > 0.4) continue;
      if (Math.hypot(x - 110, zz - 60) < 50) continue;
      if (Math.hypot(x - 150, zz - 100) < 45) continue;
      treePositions.push({ x, z: zz, y: h });
    }
  }

  const count = treePositions.length;
  if (count === 0) return;

  // 树干
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.5, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.95 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

  // 树冠
  const leafGeo = new THREE.ConeGeometry(1.6, 3.2, 7);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e5a2e, roughness: 0.9 });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = treePositions[i];
    const s = 0.8 + Math.random() * 0.7;

    dummy.position.set(t.x, t.y + 1.25 * s, t.z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.y + (2.5 + 1.6) * s, t.z);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  StoryGame.scene.add(trunkMesh);
  StoryGame.scene.add(leafMesh);
  StoryGame.trees = [trunkMesh, leafMesh];
}

/* ---------- 地标：瀑布 / 桥 / 山顶红旗 / 岩石 ---------- */
function buildLandmarks() {
  // === 出生点附近的小悬崖 + 瀑布 ===
  const wx = -85, wz = 75;
  const wy = terrainHeight(wx, wz);
  // 白色水流
  const fallMat = new THREE.MeshBasicMaterial({
    color: 0xeaf4ff, transparent: true, opacity: 0.78,
  });
  const fallGeo = new THREE.PlaneGeometry(3.2, wy + 2);
  const fall = new THREE.Mesh(fallGeo, fallMat);
  fall.position.set(wx + 5, (wy + 2) / 2 - 0.5, wz);
  fall.rotation.y = -Math.PI / 2;
  StoryGame.scene.add(fall);

  // 水花
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.55,
  });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(4, 16).rotateX(-Math.PI / 2), foamMat);
  foam.position.set(wx + 6, terrainHeight(wx + 6, wz) + 0.1, wz);
  StoryGame.scene.add(foam);

  // === 桥（横跨河流，靠近出生点方向） ===
  const bridgePos = { x: -55, z: 45 };
  const bridgeY = terrainHeight(bridgePos.x, bridgePos.z) + 1.2;
  const bridgeGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 5), woodMat);
  bridgeGroup.add(deck);
  // 栏杆
  for (let i = 0; i <= 6; i++) {
    const px = -12 + i * 4;
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), woodMat);
    rail1.position.set(px, 1.1, 2.4);
    bridgeGroup.add(rail1);
    const rail2 = rail1.clone();
    rail2.position.z = -2.4;
    bridgeGroup.add(rail2);
  }
  const topRail1 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.25, 0.25), woodMat);
  topRail1.position.set(0, 1.8, 2.4);
  bridgeGroup.add(topRail1);
  const topRail2 = topRail1.clone();
  topRail2.position.z = -2.4;
  bridgeGroup.add(topRail2);

  bridgeGroup.position.set(bridgePos.x, bridgeY, bridgePos.z);
  bridgeGroup.rotation.y = -0.5;
  StoryGame.scene.add(bridgeGroup);

  // === 山顶红旗 ===
  const summitX = -140, summitZ = -110;
  const summitY = terrainHeight(summitX, summitZ);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.7, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
  pole.position.set(summitX, summitY + 3, summitZ);
  StoryGame.scene.add(pole);

  const flagMat = new THREE.MeshStandardMaterial({ color: 0xdd3333, side: THREE.DoubleSide });
  const flagGeo = new THREE.PlaneGeometry(2.4, 1.4);
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(summitX + 1.2, summitY + 5, summitZ);
  flag.userData.isFlag = true;
  StoryGame.scene.add(flag);
  StoryGame.summitFlag = flag;

  // === 岩石（散布） ===
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a78, roughness: 0.95 });
  const rockGeo = new THREE.IcosahedronGeometry(1.2, 0);
  const rockCount = 80;
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let tries = 0;
  while (placed < rockCount && tries < 500) {
    tries++;
    const x = rand(-200, 200);
    const z = rand(-200, 200);
    const h = terrainHeight(x, z);
    if (h < 2 || h > 50) continue;
    if (riverInfluence(x, z) > 0.3) continue;
    if (Math.hypot(x - 110, z - 60) < 50) continue;
    dummy.position.set(x, h + 0.5, z);
    const s = 0.7 + Math.random() * 1.6;
    dummy.scale.set(s, s * 0.85, s);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.updateMatrix();
    rockMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  while (placed < rockCount) {
    dummy.position.set(0, -999, 0);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  StoryGame.scene.add(rockMesh);
}

/* ---------- 工业区 ---------- */
function buildIndustrialZone() {
  const cx = 110, cz = 60;
  const group = new THREE.Group();

  // 厂房
  const factoryCount = 4;
  for (let i = 0; i < factoryCount; i++) {
    const offsetX = (i % 2) * 36 - 18;
    const offsetZ = Math.floor(i / 2) * 36 - 18;
    const x = cx + offsetX;
    const z = cz + offsetZ;
    const y = terrainHeight(x, z);
    const w = 22 + Math.random() * 6;
    const d = 16 + Math.random() * 4;
    const h = 8 + Math.random() * 4;

    const mat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.85, metalness: 0.2 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y + h / 2, z);
    group.add(b);

    // 锯齿屋顶
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a7e84, roughness: 0.7, metalness: 0.28 });
    const toothN = 4;
    const tw = w / toothN;
    for (let k = 0; k < toothN; k++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.9, 1.4, d * 0.9), roofMat);
      t.position.set(x - w / 2 + tw / 2 + k * tw, y + h + 0.7, z);
      group.add(t);
    }
  }

  // 烟囱
  const chimMat = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.85, metalness: 0.2 });
  for (let i = 0; i < 4; i++) {
    const x = cx + (i - 1.5) * 22 + rand(-5, 5);
    const z = cz - 30 + rand(-5, 5);
    const y = terrainHeight(x, z);
    const h = 20 + Math.random() * 14;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, h, 10), chimMat);
    c.position.set(x, y + h / 2, z);
    group.add(c);
    // 顶部红环
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 0.7, 10),
      new THREE.MeshStandardMaterial({ color: 0xc04040, roughness: 0.6 })
    );
    band.position.set(x, y + h - 2, z);
    group.add(band);
  }

  // 仓库（有门洞，但剧情模式中不需要坦克藏进去，做简化处理）
  for (let i = 0; i < 2; i++) {
    const x = cx + (i * 44) - 22;
    const z = cz + 35;
    const y = terrainHeight(x, z);
    const w = 26, d = 18, h = 8;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.85, metalness: 0.2 });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    shell.position.set(x, y + h / 2, z);
    group.add(shell);
    // 屋顶
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.8 })
    );
    roof.position.set(x, y + h + 0.3, z);
    group.add(roof);
  }

  StoryGame.scene.add(group);
}

/* ---------- 港口 ---------- */
function buildHarbor() {
  const cx = 150, cz = 100;
  const group = new THREE.Group();

  // 码头（混凝土）
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.9 });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(50, 2, 30), dockMat);
  const dockY = terrainHeight(cx, cz);
  dock.position.set(cx, dockY + 0.8, cz);
  group.add(dock);

  // 集装箱
  const containerColors = [0xc0503a, 0x4a7ac0, 0x5aa050, 0xd0a030, 0x8a4aa0];
  for (let i = 0; i < 16; i++) {
    const x = cx + rand(-20, 20);
    const z = cz + rand(-10, 10);
    const y = dockY + 2;
    const w = 6, h = 2.8, d = 2.6;
    const color = containerColors[i % containerColors.length];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    // 堆叠
    const stack = Math.random() < 0.5 ? 0 : 1;
    box.position.set(x, y + h / 2 + stack * (h + 0.1), z);
    box.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
    group.add(box);
  }

  // 起重机（简化）
  for (let i = 0; i < 2; i++) {
    const x = cx - 15 + i * 30;
    const z = cz - 20;
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xd0a030, roughness: 0.7, metalness: 0.4 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2), towerMat);
    tower.position.set(x, dockY + 13, z);
    group.add(tower);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(20, 0.8, 0.8), towerMat);
    arm.position.set(x + 8, dockY + 24, z);
    group.add(arm);
  }

  StoryGame.scene.add(group);
}

/* ============================================================
   5. 坦克模型
   ============================================================ */
function createSimpleTank() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3f5a3a, roughness: 0.8, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3a28, roughness: 0.85, metalness: 0.12 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.5, metalness: 0.75 });

  // 履带
  for (const z of [-0.82, 0.82]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.42), trackMat);
    t.position.set(0, 0.4, z);
    g.add(t);
    // 负重轮
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), trackMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(-1.3 + i * 0.65, 0.4, z);
      g.add(w);
    }
  }

  // 车体
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 1.5), hullMat);
  hull.position.y = 0.9;
  g.add(hull);

  const hullTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 1.3), hullMat);
  hullTop.position.y = 1.35;
  g.add(hullTop);

  // 炮塔（前置）
  const turret = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.25), hullMat);
  turret.position.set(0.35, 1.8, 0);
  g.add(turret);

  const turretFront = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.1), darkMat);
  turretFront.position.set(1.05, 1.82, 0);
  g.add(turretFront);

  // 炮管
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), metalMat);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(2.5, 1.8, 0);
  g.add(barrel);

  // 车长塔（第一人称视角基点）
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.28, 10), hullMat);
  cupola.position.set(-0.2, 2.25, 0.4);
  g.add(cupola);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), darkMat);
  hatch.position.set(-0.2, 2.4, 0.4);
  g.add(hatch);

  // 天线
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), metalMat);
  antenna.position.set(-0.7, 2.8, -0.4);
  g.add(antenna);

  return g;
}

function buildPlayerTank() {
  const t = createSimpleTank();
  t.position.set(StoryGame.px, terrainHeight(StoryGame.px, StoryGame.pz), StoryGame.pz);
  StoryGame.scene.add(t);
  StoryGame.playerTank = t;
}

function buildNpcTank() {
  const t = createSimpleTank();
  // 换个颜色好识别（金色）
  t.traverse(c => {
    if (c.material && c.material.color) {
      const col = c.material.color.getHex();
      if (col === 0x3f5a3a) c.material = c.material.clone(), c.material.color.setHex(0x8a7a3a);
      else if (col === 0x2a3a28) c.material = c.material.clone(), c.material.color.setHex(0x6a5a2a);
    }
  });
  const np = StoryGame.npcPos;
  t.position.set(np.x, terrainHeight(np.x, np.z), np.z);
  t.rotation.y = Math.PI * 0.3;
  StoryGame.scene.add(t);
  StoryGame.npcTank = t;

  // 头顶黄色感叹号
  const sprite = makeMarkerSprite('!', '#ffd83a');
  sprite.position.set(np.x, terrainHeight(np.x, np.z) + 5, np.z);
  sprite.scale.set(2.2, 4.4, 1);
  StoryGame.scene.add(sprite);
  StoryGame.npcMarker = sprite;
}

/* ---------- 目标坦克（散布地图） ---------- */
function buildTargetTanks() {
  // 固定位置（分布在各个地形特征附近）
  const spots = [
    // 森林深处
    { x: -30, z: 100, area: 'forest' },
    { x: -100, z: 30, area: 'forest' },
    // 河边
    { x: 10, z: -10, area: 'river' },
    { x: 60, z: -30, area: 'river' },
    // 山地
    { x: -180, z: -90, area: 'mountain' },
    { x: -120, z: -150, area: 'mountain' },
    // 平原
    { x: 30, z: 40, area: 'plain' },
    { x: -40, z: -60, area: 'plain' },
    { x: 60, z: 30, area: 'plain' },
    // 工业
    { x: 110, z: 60, area: 'industrial' },
    { x: 130, z: 40, area: 'industrial' },
    // 港口
    { x: 150, z: 100, area: 'harbor' },
    // 沼泽
    { x: 90, z: 140, area: 'swamp' },
    { x: 120, z: 155, area: 'swamp' },
    // 湖泊边
    { x: -20, z: -25, area: 'lake' },
    // 沿海
    { x: 180, z: -60, area: 'coast' },
  ];

  StoryGame.targetTanks = [];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const t = createSimpleTank();
    // 目标坦克颜色随区域变化
    let col = 0x4a5a3a;
    if (s.area === 'industrial' || s.area === 'harbor') col = 0x4a4a50;
    if (s.area === 'mountain') col = 0x6a6a5a;
    if (s.area === 'swamp') col = 0x3a4a2a;
    t.traverse(c => {
      if (c.material && c.material.color && c.material.color.getHex() === 0x3f5a3a) {
        c.material = c.material.clone();
        c.material.color.setHex(col);
      }
    });

    const y = terrainHeight(s.x, s.z);
    t.position.set(s.x, y, s.z);
    t.rotation.y = Math.random() * Math.PI * 2;
    StoryGame.scene.add(t);

    StoryGame.targetTanks.push({
      id: i,
      tank: t,
      x: s.x, z: s.z,
      phase: 'idle',  // idle | alert | escape | gone
      t: 0,
      sprite: null,
      dir: new THREE.Vector3(),
    });
  }
  StoryGame.totalTargets = spots.length;
}

function makeMarkerSprite(char, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 220px -apple-system, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#1a1208';
  ctx.strokeText(char, 64, 128);
  ctx.fillStyle = color;
  ctx.fillText(char, 64, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex, depthTest: false, depthWrite: false, transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 999;
  return sprite;
}

/* ============================================================
   6. 玩家移动 / 相机
   ============================================================ */
function updatePlayerControls(dt) {
  if (StoryGame.dialogOpen) {
    StoryGame.playerSpeed *= 0.85;
    return;
  }

  const k = StoryGame.keys;
  let accel = 0;
  let turn = 0;
  if (k.up) accel += 1;
  if (k.down) accel -= 1;
  if (k.left) turn += 1;
  if (k.right) turn -= 1;

  // 速度
  if (accel !== 0) {
    StoryGame.playerSpeed += accel * 18 * dt;
  } else {
    StoryGame.playerSpeed *= 0.92;
    if (Math.abs(StoryGame.playerSpeed) < 0.05) StoryGame.playerSpeed = 0;
  }
  StoryGame.playerSpeed = clamp(StoryGame.playerSpeed, StoryGame.minSpeed, StoryGame.maxSpeed);

  // 转向
  StoryGame.ph += turn * 1.8 * dt;

  // 位置
  const nx = StoryGame.px + Math.sin(StoryGame.ph) * StoryGame.playerSpeed * dt;
  const nz = StoryGame.pz + Math.cos(StoryGame.ph) * StoryGame.playerSpeed * dt;

  // 地形限制：不能进水
  const nh = terrainHeight(nx, nz);
  if (nh > 0.2) {
    StoryGame.px = nx;
    StoryGame.pz = nz;
  } else {
    StoryGame.playerSpeed *= 0.4;
  }

  // 边界（不能出地图）
  const maxR = StoryGame.MAP_HALF - 15;
  const r = Math.hypot(StoryGame.px, StoryGame.pz);
  if (r > maxR) {
    const scale = maxR / r;
    StoryGame.px *= scale;
    StoryGame.pz *= scale;
  }

  // 更新坦克对象
  const py = terrainHeight(StoryGame.px, StoryGame.pz);
  StoryGame.playerTank.position.set(StoryGame.px, py, StoryGame.pz);
  StoryGame.playerTank.rotation.y = StoryGame.ph;

  // 车长塔世界坐标（用于相机）
  const cq = 0.4;
  const cupolaLocalX = -0.2;
  const cqx = StoryGame.px + Math.cos(StoryGame.ph) * cupolaLocalX + Math.sin(StoryGame.ph) * cq;
  const cqz = StoryGame.pz - Math.sin(StoryGame.ph) * cupolaLocalX + Math.cos(StoryGame.ph) * cq;
  StoryGame.cupolaX = cqx;
  StoryGame.cupolaY = py + 2.3;
  StoryGame.cupolaZ = cqz;
}

function updateCamera() {
  if (StoryGame.phase === 'menu') {
    // 菜单：环绕地图的第三人称相机
    StoryGame.menuAngle += 0.002;
    const r = 220;
    const cx = -75 + Math.cos(StoryGame.menuAngle) * r * 0.3;
    const cz = 75 + Math.sin(StoryGame.menuAngle) * r * 0.3;
    StoryGame.camera.position.set(cx, 90, cz + 60);
    StoryGame.camera.lookAt(-75, 0, 75);
    return;
  }
  if (StoryGame.phase === 'playing' || StoryGame.phase === 'dialog') {
    const totalYaw = StoryGame.ph + StoryGame.camYaw;
    const pitch = StoryGame.camPitch;
    const cx = StoryGame.cupolaX || StoryGame.px;
    const cy = StoryGame.cupolaY || (terrainHeight(StoryGame.px, StoryGame.pz) + 2.3);
    const cz = StoryGame.cupolaZ || StoryGame.pz;
    StoryGame.camera.position.set(cx, cy, cz);

    const lookDist = 50;
    const dx = Math.sin(totalYaw) * Math.cos(pitch) * lookDist;
    const dy = Math.sin(pitch) * lookDist;
    const dz = Math.cos(totalYaw) * Math.cos(pitch) * lookDist;
    StoryGame.camera.lookAt(cx + dx, cy + dy, cz + dz);
  }
}

/* ============================================================
   7. 点击处理（找坦克 / 交互）
   ============================================================ */
function handleCanvasClick(clientX, clientY) {
  if (StoryGame.phase !== 'playing') return;
  if (StoryGame.dialogOpen) return;

  const rect = StoryGame.renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  StoryGame.pointer.set(x, y);
  StoryGame.raycaster.setFromCamera(StoryGame.pointer, StoryGame.camera);

  // 先看 NPC
  if (StoryGame.npcTank) {
    const npcMeshes = [];
    StoryGame.npcTank.traverse(c => { if (c.isMesh) npcMeshes.push(c); });
    const hits = StoryGame.raycaster.intersectObjects(npcMeshes, false);
    if (hits.length > 0) {
      const dist = Math.hypot(StoryGame.px - StoryGame.npcPos.x, StoryGame.pz - StoryGame.npcPos.z);
      if (dist < StoryGame.npcRadius * 2) {
        showNpcDialog();
      } else {
        showHint('距离太远，靠近指挥官再交互');
      }
      return;
    }
  }

  // 再看目标坦克
  for (const tt of StoryGame.targetTanks) {
    if (tt.phase !== 'idle') continue;
    const meshes = [];
    tt.tank.traverse(c => { if (c.isMesh) meshes.push(c); });
    const hits = StoryGame.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const dist = Math.hypot(StoryGame.px - tt.x, StoryGame.pz - tt.z);
      if (dist > 90) {
        showHint('目标太远，靠近一点再攻击');
        return;
      }
      tryCaptureTank(tt);
      return;
    }
  }
}

/* ============================================================
   8. 捕获 / 积分 / 导弹
   ============================================================ */
function tryCaptureTank(tt) {
  if (StoryGame.missiles <= 0) {
    showHint('❌ 没有导弹了！回到指挥官处用积分兑换');
    return;
  }
  StoryGame.missiles--;
  StoryGame.score += 100;
  StoryGame.capturedCount++;
  StoryGame.capturedIds.add(tt.id);
  updateHUD();

  // 标记被找到
  tt.phase = 'alert';
  tt.t = 0;

  const sprite = makeMarkerSprite('!', '#ff4444');
  const p = tt.tank.position.clone();
  sprite.position.set(p.x, p.y + 6, p.z);
  sprite.scale.set(2.2, 4.4, 1);
  StoryGame.scene.add(sprite);
  tt.sprite = sprite;

  // 逃跑方向
  const half = StoryGame.MAP_HALF;
  const distToEdge = {
    px: half - p.x, nx: half + p.x, pz: half - p.z, nz: half + p.z,
  };
  let dirX = 0, dirZ = 0;
  const minKey = Object.keys(distToEdge).reduce((a, b) => distToEdge[a] < distToEdge[b] ? a : b);
  if (minKey === 'px') dirX = 1;
  else if (minKey === 'nx') dirX = -1;
  else if (minKey === 'pz') dirZ = 1;
  else dirZ = -1;
  tt.dir.set(dirX, 0, dirZ).normalize();

  if (typeof playSound === 'function') playSound('fav');
  showHint(`✅ 击毁目标 +100 积分  (剩余导弹 ${StoryGame.missiles})`);
}

function updateTargetTanks(dt) {
  for (const tt of StoryGame.targetTanks) {
    if (tt.phase === 'idle') {
      // 轻微摆动
      tt.tank.rotation.y += Math.sin(performance.now() * 0.001 + tt.id) * 0.004;
      continue;
    }
    if (tt.phase === 'gone') continue;

    tt.t += dt;

    if (tt.phase === 'alert') {
      if (tt.sprite) {
        const pulse = 1 + Math.sin(tt.t * 10) * 0.15;
        tt.sprite.scale.set(2.2 * pulse, 4.4 * pulse, 1);
        tt.sprite.position.y = tt.tank.position.y + 6 + Math.sin(tt.t * 6) * 0.4;
      }
      if (tt.t > 0.7) {
        tt.phase = 'escape';
        tt.t = 0;
      }
    } else if (tt.phase === 'escape') {
      const SPEED = 28;
      tt.tank.position.x += tt.dir.x * SPEED * dt;
      tt.tank.position.z += tt.dir.z * SPEED * dt;
      tt.tank.position.y = terrainHeight(tt.tank.position.x, tt.tank.position.z);

      const targetRot = Math.atan2(tt.dir.x, tt.dir.z);
      let diff = targetRot - tt.tank.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      tt.tank.rotation.y += diff * Math.min(1, dt * 5);

      if (tt.sprite) {
        tt.sprite.position.x = tt.tank.position.x;
        tt.sprite.position.y = tt.tank.position.y + 6;
        tt.sprite.position.z = tt.tank.position.z;
      }

      if (Math.hypot(tt.tank.position.x, tt.tank.position.z) > StoryGame.MAP_HALF + 20) {
        tt.phase = 'gone';
        tt.tank.visible = false;
        if (tt.sprite) {
          StoryGame.scene.remove(tt.sprite);
          tt.sprite = null;
        }
      }
    }
  }
}

function updateHUD() {
  const p = StoryGame.panel;
  if (!p) return;
  p.querySelector('#story-score').textContent = StoryGame.score;
  p.querySelector('#story-missiles').textContent = StoryGame.missiles;
}

/* ============================================================
   9. 对话框
   ============================================================ */
function showIntroDialog() {
  showDialog(
    '指挥官：\n「你好，士兵。我们派出的装甲部队在地图上失踪了。\n现在我给你 2 枚导弹和这个坐标——找到它们，用导弹标记位置。\n如果导弹用完了，回来找我，用积分兑换新的。」',
    [
      { label: '明白了', action: closeDialog },
    ]
  );
}

function showNpcDialog() {
  const canExchange = StoryGame.score >= 100;
  const opts = [];
  if (canExchange) {
    opts.push({
      label: `兑换 1 枚导弹 (-100 积分)`,
      action: () => {
        StoryGame.score -= 100;
        StoryGame.missiles += 1;
        updateHUD();
        showHint('✅ 兑换成功 +1 枚导弹');
        closeDialog();
      },
    });
  } else {
    opts.push({
      label: '积分不足（需要 100）',
      action: () => { showHint('还需要 ' + (100 - StoryGame.score) + ' 积分'); },
      disabled: true,
    });
  }
  opts.push({ label: '关闭', action: closeDialog });

  showDialog(
    `指挥官：\n「现在你有 ${StoryGame.score} 积分、${StoryGame.missiles} 枚导弹。\n找到的坦克总数：${StoryGame.capturedCount} / ${StoryGame.totalTargets}。」`,
    opts
  );
}

function showDialog(text, options) {
  StoryGame.dialogOpen = true;
  const p = StoryGame.panel;
  p.querySelector('#story-dialog-text').textContent = text;
  const optEl = p.querySelector('#story-dialog-options');
  optEl.innerHTML = '';
  for (const o of options) {
    const btn = document.createElement('button');
    btn.textContent = o.label;
    btn.style.cssText = 'padding:10px 20px;border-radius:999px;border:1px solid rgba(255,216,58,0.45);background:rgba(255,216,58,0.1);color:#ffd83a;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;' + (o.disabled ? 'opacity:0.45;' : '');
    if (!o.disabled) btn.addEventListener('click', o.action);
    optEl.appendChild(btn);
  }
  p.querySelector('#story-dialog').style.display = 'block';
}

function closeDialog() {
  StoryGame.dialogOpen = false;
  StoryGame.panel.querySelector('#story-dialog').style.display = 'none';
}

let __hintTimer = null;
function showHint(text) {
  const el = StoryGame.panel.querySelector('#story-hint');
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(__hintTimer);
  __hintTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

/* ============================================================
   10. 小地图
   ============================================================ */
function buildMinimapBg() {
  const W = 160, H = 160;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const half = StoryGame.MAP_HALF;
  const step = 3;
  for (let py = 0; py < H; py += step) {
    for (let px = 0; px < W; px += step) {
      const wx = (px / W) * half * 2 - half;
      const wz = (py / H) * half * 2 - half;
      const h = terrainHeight(wx, wz);
      const [r, g, b] = terrainColor(wx, wz, h);
      ctx.fillStyle = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      ctx.fillRect(px, py, step, step);
    }
  }
  StoryGame.minimapBg = canvas;
}

function drawMinimap() {
  const ctx = StoryGame.minimapCtx;
  const W = StoryGame.minimapCanvas.width;
  const H = StoryGame.minimapCanvas.height;
  const half = StoryGame.MAP_HALF;

  ctx.clearRect(0, 0, W, H);
  if (StoryGame.minimapBg) ctx.drawImage(StoryGame.minimapBg, 0, 0, W, H);

  const toMap = (wx, wz) => ({
    x: (wx + half) / (half * 2) * W,
    y: (wz + half) / (half * 2) * H,
  });

  // 已找到的目标坦克（小灰点）
  for (const tt of StoryGame.targetTanks) {
    if (tt.phase === 'gone') {
      const p = toMap(tt.x, tt.z);
      ctx.fillStyle = 'rgba(150,150,150,0.6)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // NPC
  if (StoryGame.npcTank) {
    const p = toMap(StoryGame.npcPos.x, StoryGame.npcPos.z);
    ctx.fillStyle = '#ffd83a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,216,58,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 玩家
  const pp = toMap(StoryGame.px, StoryGame.pz);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(StoryGame.ph + Math.PI);
  ctx.fillStyle = '#4aff4a';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(-5, 5);
  ctx.lineTo(0, 3);
  ctx.lineTo(5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   11. 主循环
   ============================================================ */
function startLoop() {
  if (StoryGame.animId) return;
  if (!StoryGame.clock) StoryGame.clock = new THREE.Clock();
  StoryGame.clock.getDelta();

  const loop = () => {
    StoryGame.animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, StoryGame.clock.getDelta());

    if (StoryGame.phase === 'playing' || StoryGame.phase === 'dialog') {
      updatePlayerControls(dt);
      updateTargetTanks(dt);
      if (StoryGame.npcMarker) {
        StoryGame.npcMarker.position.y = terrainHeight(StoryGame.npcPos.x, StoryGame.npcPos.z) + 5 + Math.sin(performance.now() * 0.003) * 0.3;
      }
      if (StoryGame.summitFlag) {
        StoryGame.summitFlag.rotation.y = Math.sin(performance.now() * 0.001) * 0.4;
      }
      updateCamera();
      drawMinimap();
    } else if (StoryGame.phase === 'menu') {
      updateCamera();
    }

    if (StoryGame.renderer) {
      StoryGame.renderer.render(StoryGame.scene, StoryGame.camera);
    }
  };
  StoryGame.animId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (StoryGame.animId) {
    cancelAnimationFrame(StoryGame.animId);
    StoryGame.animId = null;
  }
}

/* ============================================================
   12. 键盘
   ============================================================ */
document.addEventListener('keydown', e => {
  if (!StoryGame.panel || StoryGame.panel.style.display === 'none') return;
  if (e.repeat) return;
  switch (e.key) {
    case 'w': case 'W': case 'ArrowUp':    StoryGame.keys.up = true; break;
    case 's': case 'S': case 'ArrowDown':  StoryGame.keys.down = true; break;
    case 'a': case 'A': case 'ArrowLeft':  StoryGame.keys.left = true; break;
    case 'd': case 'D': case 'ArrowRight': StoryGame.keys.right = true; break;
    case 'e': case 'E':
      // 交互快捷键
      if (StoryGame.phase === 'playing') {
        const d = Math.hypot(StoryGame.px - StoryGame.npcPos.x, StoryGame.pz - StoryGame.npcPos.z);
        if (d < StoryGame.npcRadius * 2) showNpcDialog();
        else showHint('附近没有可交互单位');
      }
      break;
    case 'Escape':
      if (StoryGame.dialogOpen) closeDialog();
      else backToMenu();
      break;
  }
});

document.addEventListener('keyup', e => {
  if (!StoryGame.panel || StoryGame.panel.style.display === 'none') return;
  switch (e.key) {
    case 'w': case 'W': case 'ArrowUp':    StoryGame.keys.up = false; break;
    case 's': case 'S': case 'ArrowDown':  StoryGame.keys.down = false; break;
    case 'a': case 'A': case 'ArrowLeft':  StoryGame.keys.left = false; break;
    case 'd': case 'D': case 'ArrowRight': StoryGame.keys.right = false; break;
  }
});

/* ============================================================
   13. 导出
   ============================================================ */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeStoryGame;