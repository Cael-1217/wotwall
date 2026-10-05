// ==================== 通用工具函数 ====================

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function sanitizeFilename(name) {
  return String(name).trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'tank';
}

// ---- Toast ----
let __toastTimer;
function toast(msg) {
  let el = document.getElementById('tw-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tw-toast';
    el.style.cssText = `
      position: fixed; bottom: 40px; left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: var(--surface-2); color: var(--text);
      padding: 10px 18px; border-radius: 8px;
      border: 1px solid var(--border);
      font-size: 13px; z-index: 10000;
      opacity: 0; transition: opacity 0.2s, transform 0.2s;
      pointer-events: none; max-width: 80vw;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 1800);
}

// ---- 复制 ----
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast('已复制'),
      () => fallbackCopy(text)
    );
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('已复制'); }
  catch { toast('复制失败，请长按选择'); }
  document.body.removeChild(ta);
}

// ---- 图片加载 ----
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(b => resolve(b), 'image/jpeg', quality);
  });
}

// ---- 图片压缩 ----
async function compressImage(file, opts = {}) {
  const { maxSide = 1200, targetKB = 35, square = false } = opts;
  const img = await loadImage(file);
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  let w = img.width, h = img.height;
  if (square) {
    const s = Math.min(img.width, img.height);
    sx = (img.width - s) / 2; sy = (img.height - s) / 2;
    sw = sh = s; w = h = Math.min(maxSide, s);
  } else if (Math.max(w, h) > maxSide) {
    const r = maxSide / Math.max(w, h);
    w = Math.round(w * r); h = Math.round(h * r);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  let lo = 0.1, hi = 0.92, best = null;
  for (let i = 0; i < 8; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, q);
    const kb = blob.size / 1024;
    if (kb > targetKB) hi = q;
    else {
      lo = q; best = blob;
      if (Math.abs(kb - targetKB) < 3) break;
    }
  }
  if (!best) best = await canvasToBlob(canvas, 0.1);
  return best;
}