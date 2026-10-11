// ==================== 3d-preview.js — 实验性 3D 概览 ====================
// 用 Three.js + OpenCV.js 在浏览器本地把图纸轮廓"拉伸"成灰色 2.5D 模型
// 仅用于视觉预览，不导出、不上传

(function () {
  'use strict';

  const Three3D = {
    loaded: false,
    loadingPromise: null,
    panel: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentMesh: null,
    animId: null,
    currentTank: null,
    resizeHandler: null,
    groundObjects: [],
  };

const LIB_CDNS = {
    three: 'three.min.js',
    orbit: 'OrbitControls.js',
    opencv: 'opencv.js',
  };

  // ---------- 按需加载脚本 ----------
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('加载失败: ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  function waitForCvReady(timeout) {
    timeout = timeout || 60000;
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (window.cv && typeof window.cv.Mat === 'function' && typeof window.cv.imread === 'function') {
          return resolve();
        }
        if (Date.now() - start > timeout) return reject(new Error('OpenCV 初始化超时'));
        setTimeout(check, 200);
      };
      check();
    });
  }

  async function ensure3DLibs() {
    if (Three3D.loaded) return;
    if (Three3D.loadingPromise) return Three3D.loadingPromise;

    Three3D.loadingPromise = (async () => {
      set3DLoadingMsg('正在加载 3D 引擎…');
      if (!window.THREE) await loadScriptOnce(LIB_CDNS.three);
      if (window.THREE && !window.THREE.OrbitControls) {
        try { await loadScriptOnce(LIB_CDNS.orbit); } catch (e) { /* 可选 */ }
      }
      if (!window.cv) {
        set3DLoadingMsg('正在加载图像识别模块（约 8MB，首次较慢）…');
        await loadScriptOnce(LIB_CDNS.opencv);
        set3DLoadingMsg('正在初始化图像识别…');
        await waitForCvReady();
      }
      Three3D.loaded = true;
    })();

    try {
      await Three3D.loadingPromise;
    } finally {
      Three3D.loadingPromise = null;
    }
  }

  // ---------- 注入样式 ----------
  function inject3DStyles() {
    if (document.getElementById('tw-3d-styles')) return;
    const style = document.createElement('style');
    style.id = 'tw-3d-styles';
    style.textContent = `
      #tw-3d-panel {
        position: fixed; inset: 0; z-index: 300;
        background: #1a1a1e; display: none;
        flex-direction: column;
        animation: tw3dIn 0.22s ease both;
        font-family: inherit;
      }
      #tw-3d-panel.active { display: flex; }
      @keyframes tw3dIn { from { opacity: 0; } to { opacity: 1; } }

      .tw-3d-header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 16px;
        padding-top: calc(12px + env(safe-area-inset-top));
        background: #131316;
        border-bottom: 1px solid #2a2a2e;
        color: #e8e8ea;
        flex-shrink: 0;
      }
      .tw-3d-title {
        flex: 1; font-size: 14px; font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .tw-3d-title span { color: #c9a860; }
      .tw-3d-badge {
        font-size: 11px; color: #6ab0ff;
        border: 1px solid #2a4a6a; padding: 1px 6px;
        border-radius: 4px;
        font-family: ui-monospace, monospace;
      }
      .tw-3d-close {
        background: transparent; border: 1px solid #3a3a40;
        color: #8a8a92; width: 32px; height: 32px;
        border-radius: 50%; font-size: 18px; line-height: 1;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-family: inherit;
      }
      .tw-3d-close:hover { color: #e8e8ea; border-color: #5a5a62; }

      .tw-3d-canvas-wrap {
        flex: 1; position: relative;
        overflow: hidden;
        background: radial-gradient(circle at 50% 40%, #2a2a30, #131316 80%);
      }
      .tw-3d-canvas-wrap canvas { display: block; }

      .tw-3d-hint {
        position: absolute; bottom: 16px; left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.55);
        color: rgba(255,255,255,0.65);
        font-size: 12px; padding: 6px 14px;
        border-radius: 999px;
        pointer-events: none;
        font-family: ui-monospace, monospace;
        white-space: nowrap;
      }

      .tw-3d-overlay {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px; background: rgba(19, 19, 22, 0.85);
        color: #8a8a92; font-size: 13px;
        transition: opacity 0.25s;
        pointer-events: none;
      }
      .tw-3d-overlay.hidden { opacity: 0; }
      .tw-3d-overlay.error { color: #ff5a5a; }
      .tw-3d-spinner {
        width: 36px; height: 36px;
        border: 3px solid #2a2a2e;
        border-top-color: #c9a860;
        border-radius: 50%;
        animation: tw3dSpin 0.9s linear infinite;
      }
      .tw-3d-overlay.error .tw-3d-spinner { display: none; }
      @keyframes tw3dSpin { to { transform: rotate(360deg); } }

      .tw-3d-msg { max-width: 80%; text-align: center; line-height: 1.6; }

      .tw-3d-actions {
        position: absolute; top: 12px; right: 12px;
        display: flex; gap: 6px;
      }
      .tw-3d-actions button {
        background: rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.15);
        color: #e8e8ea;
        padding: 6px 12px;
        border-radius: 6px;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .tw-3d-actions button:hover { background: rgba(0,0,0,0.75); }
    `;
    document.head.appendChild(style);
  }

  // ---------- 创建面板 ----------
  function getOrCreate3DPanel() {
    if (Three3D.panel) return Three3D.panel;
    inject3DStyles();

    const panel = document.createElement('div');
    panel.id = 'tw-3d-panel';
    panel.innerHTML = `
      <div class="tw-3d-header">
        <span class="tw-3d-badge">BETA</span>
        <div class="tw-3d-title">3D 概览 · <span id="tw-3d-tank-name">—</span></div>
        <button class="tw-3d-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="tw-3d-canvas-wrap">
        <div class="tw-3d-overlay" id="tw-3d-overlay">
          <div class="tw-3d-spinner"></div>
          <div class="tw-3d-msg" id="tw-3d-msg">准备中…</div>
        </div>
        <div class="tw-3d-actions" id="tw-3d-actions" style="display:none;">
          <button type="button" id="tw-3d-reset">重置视角</button>
        </div>
        <div class="tw-3d-hint">拖动旋转 · 滚轮缩放 · 右键平移</div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.tw-3d-close').addEventListener('click', close3DPreview);
    panel.querySelector('#tw-3d-reset').addEventListener('click', reset3DCamera);

    Three3D.panel = panel;
    return panel;
  }

  function set3DLoadingMsg(msg) {
    const el = document.getElementById('tw-3d-msg');
    if (el) el.textContent = msg;
  }

  function show3DLoading(msg) {
    const ov = document.getElementById('tw-3d-overlay');
    const act = document.getElementById('tw-3d-actions');
    if (ov) ov.classList.remove('hidden', 'error');
    if (act) act.style.display = 'none';
    set3DLoadingMsg(msg || '加载中…');
  }

  function hide3DLoading() {
    const ov = document.getElementById('tw-3d-overlay');
    const act = document.getElementById('tw-3d-actions');
    if (ov) ov.classList.add('hidden');
    if (act) act.style.display = 'flex';
  }

  function show3DError(msg) {
    const ov = document.getElementById('tw-3d-overlay');
    if (ov) {
      ov.classList.remove('hidden');
      ov.classList.add('error');
    }
    set3DLoadingMsg(msg);
    const act = document.getElementById('tw-3d-actions');
    if (act) act.style.display = 'none';
  }

  // ---------- 初始化 Three.js 场景 ----------
  function init3DScene() {
    const container = Three3D.panel.querySelector('.tw-3d-canvas-wrap');
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (Three3D.renderer) {
      Three3D.renderer.setSize(w, h);
      Three3D.camera.aspect = w / h;
      Three3D.camera.updateProjectionMatrix();
      return;
    }

    Three3D.scene = new THREE.Scene();

    Three3D.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    Three3D.camera.position.set(9, 6, 11);

    Three3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    Three3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    Three3D.renderer.setSize(w, h);
    Three3D.renderer.shadowMap.enabled = true;
    Three3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Three3D.renderer.setClearColor(0x000000, 0);

    const oldCanvas = container.querySelector('canvas');
    if (oldCanvas) oldCanvas.remove();
    container.insertBefore(Three3D.renderer.domElement, container.firstChild);

    // 灯光
    Three3D.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(10, 18, 12);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    Three3D.scene.add(key);

    const rim = new THREE.DirectionalLight(0x88aaff, 0.45);
    rim.position.set(-12, 6, -10);
    Three3D.scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffddaa, 0.25);
    fill.position.set(-4, -8, 6);
    Three3D.scene.add(fill);

    // 阴影地面
    const planeGeom = new THREE.PlaneGeometry(40, 40);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.32 });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    plane.receiveShadow = true;
    Three3D.scene.add(plane);
    Three3D.groundObjects.push(plane);

    // 网格辅助线
    const grid = new THREE.GridHelper(24, 24, 0x3a3a40, 0x25252a);
    grid.material.transparent = true;
    grid.material.opacity = 0.85;
    Three3D.scene.add(grid);
    Three3D.groundObjects.push(grid);

    // 控制器
    if (THREE.OrbitControls) {
      Three3D.controls = new THREE.OrbitControls(Three3D.camera, Three3D.renderer.domElement);
      Three3D.controls.enableDamping = true;
      Three3D.controls.dampingFactor = 0.08;
      Three3D.controls.minDistance = 3;
      Three3D.controls.maxDistance = 40;
      Three3D.controls.maxPolarAngle = Math.PI / 2 + 0.1;
      Three3D.controls.target.set(0, 0, 0);
    }

    if (!Three3D.resizeHandler) {
      Three3D.resizeHandler = () => {
        if (!Three3D.renderer || !Three3D.panel.classList.contains('active')) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        Three3D.renderer.setSize(cw, ch);
        Three3D.camera.aspect = cw / ch;
        Three3D.camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', Three3D.resizeHandler);
    }
  }

  // ---------- 轮廓提取 ----------
  function extractContourPoints(img) {
    const maxW = 1000;
    let w = img.width, h = img.height;
    if (w > maxW) {
      h = Math.round(h * maxW / w);
      w = maxW;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    let src = cv.imread(canvas);
    let gray = new cv.Mat();
    let binary = new cv.Mat();
    let opened = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    let kernel = null;
    let approx = null;

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.threshold(gray, binary, 235, 255, cv.THRESH_BINARY_INV);

      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(binary, opened, cv.MORPH_OPEN, kernel);

      cv.findContours(opened, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0, maxIdx = -1;
      for (let i = 0; i < contours.size(); i++) {
        const a = cv.contourArea(contours.get(i));
        if (a > maxArea) { maxArea = a; maxIdx = i; }
      }
      if (maxIdx === -1) return null;

      const contour = contours.get(maxIdx);
      approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 3, true);

      const rect = cv.boundingRect(approx);
      if (rect.width < 20 || rect.height < 20) return null;

      const maxDim = Math.max(rect.width, rect.height);
      const scale = 6 / maxDim;

      const points = [];
      for (let i = 0; i < approx.rows; i++) {
        const px = approx.data32S[i * 2];
        const py = approx.data32S[i * 2 + 1];
        points.push({
          x: (px - rect.x) * scale,
          y: -(py - rect.y) * scale,
        });
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const widthUnits = maxX - minX;
      const heightUnits = maxY - minY;

      return {
        points: points.map(p => ({ x: p.x - cx, y: p.y - cy })),
        width: widthUnits,
        height: heightUnits,
      };
    } finally {
      src.delete(); gray.delete(); binary.delete();
      opened.delete(); contours.delete(); hierarchy.delete();
      if (kernel) kernel.delete();
      if (approx) approx.delete();
    }
  }

  // ---------- 构建网格 ----------
  function build3DMesh(contourData) {
    if (Three3D.currentMesh) {
      Three3D.scene.remove(Three3D.currentMesh);
      if (Three3D.currentMesh.geometry) Three3D.currentMesh.geometry.dispose();
      if (Three3D.currentMesh.material) Three3D.currentMesh.material.dispose();
      Three3D.currentMesh = null;
    }

    const { points, width, height } = contourData;
    if (!points || points.length < 3) return;

    const depth = width * 0.47;

    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: false,
      curveSegments: 2,
    });

    geometry.computeBoundingBox();
    const b = geometry.boundingBox;
    geometry.translate(
      -(b.max.x + b.min.x) / 2,
      -(b.max.y + b.min.y) / 2,
      -(b.max.z + b.min.z) / 2
    );

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0xb8b8bc,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    Three3D.scene.add(mesh);
    Three3D.currentMesh = mesh;

    // 把地面/网格放在模型底部
    const bottomY = -height / 2 - 0.01;
    Three3D.groundObjects.forEach(obj => {
      obj.position.y = bottomY;
    });

    if (Three3D.controls) {
      Three3D.controls.target.set(0, 0, 0);
      Three3D.controls.update();
    }
    reset3DCamera();
  }

  // ---------- 渲染循环 ----------
  function start3DLoop() {
    if (Three3D.animId) return;
    const loop = () => {
      Three3D.animId = requestAnimationFrame(loop);
      if (Three3D.controls) Three3D.controls.update();
      if (Three3D.renderer && Three3D.scene && Three3D.camera) {
        Three3D.renderer.render(Three3D.scene, Three3D.camera);
      }
    };
    Three3D.animId = requestAnimationFrame(loop);
  }

  function stop3DLoop() {
    if (Three3D.animId) {
      cancelAnimationFrame(Three3D.animId);
      Three3D.animId = null;
    }
  }

  function reset3DCamera() {
    if (!Three3D.camera || !Three3D.controls) return;
    Three3D.camera.position.set(9, 6, 11);
    Three3D.controls.target.set(0, 0, 0);
    Three3D.controls.update();
  }

  // ---------- 打开 / 关闭 ----------
  async function open3DPreview(tank) {
    tank = tank || (typeof window !== 'undefined' ? window.__currentTank : null);
    if (!tank) {
      if (typeof toast === 'function') toast('请先打开一个展品');
      return;
    }
    if (!tank.imgs || !tank.imgs.length) {
      if (typeof toast === 'function') toast('该展品没有可用图纸');
      return;
    }

    Three3D.currentTank = tank;
    const panel = getOrCreate3DPanel();
    panel.classList.add('active');
    document.body.style.overflow = 'hidden';

    document.getElementById('tw-3d-tank-name').textContent = tank.name || '未命名';

    if (Three3D.currentMesh) {
      Three3D.scene.remove(Three3D.currentMesh);
      if (Three3D.currentMesh.geometry) Three3D.currentMesh.geometry.dispose();
      if (Three3D.currentMesh.material) Three3D.currentMesh.material.dispose();
      Three3D.currentMesh = null;
    }

    show3DLoading('准备中…');

    // 1) 加载依赖
    try {
      await ensure3DLibs();
    } catch (e) {
      show3DError('依赖加载失败：' + (e.message || '网络错误'));
      return;
    }

    // 2) 加载图纸
    show3DLoading('正在读取图纸…');
    let img;
    try {
      if (typeof loadImageFromUrl !== 'function') throw new Error('工具函数未加载');
      img = await loadImageFromUrl(tank.imgs[0]);
    } catch (e) {
      show3DError('图纸加载失败：' + (e.message || tank.imgs[0]));
      return;
    }

    // 3) 提取轮廓
    show3DLoading('正在分析图纸轮廓…');
    let contourData;
    try {
      await new Promise(r => setTimeout(r, 50));
      contourData = extractContourPoints(img);
    } catch (e) {
      show3DError('轮廓分析失败：' + (e.message || e));
      return;
    }

    if (!contourData || !contourData.points || contourData.points.length < 3) {
      show3DError('未能识别出坦克轮廓，可能图纸对比度太低或格式不兼容');
      return;
    }

    // 4) 构建 3D
    show3DLoading('正在构建 3D 模型…');
    await new Promise(r => setTimeout(r, 30));

    init3DScene();
    build3DMesh(contourData);
    start3DLoop();

    hide3DLoading();
    if (typeof playSound === 'function') playSound('open');
  }

  function close3DPreview() {
    if (!Three3D.panel) return;
    Three3D.panel.classList.remove('active');
    stop3DLoop();
    document.body.style.overflow = '';
    if (typeof playSound === 'function') playSound('close');
  }

  window.open3DPreview = open3DPreview;
  window.close3DPreview = close3DPreview;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && Three3D.panel && Three3D.panel.classList.contains('active')) {
      if (document.getElementById('lightbox')?.classList.contains('active')) return;
      close3DPreview();
    }
  });
})();