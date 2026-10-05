// ==================== 分享卡片 ====================

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getAccentColor() {
  const isLight = document.documentElement.classList.contains('light');
  const name = localStorage.getItem('tw_accent') || 'gold';
  const presets = {
    gold:   { dark: '#c9a860', light: '#8a6f3a' },
    blue:   { dark: '#4a90e2', light: '#2f6fbf' },
    green:  { dark: '#5aa860', light: '#3a7a40' },
    purple: { dark: '#a06ac0', light: '#7a4a90' },
    red:    { dark: '#c05a5a', light: '#903a3a' },
    gray:   { dark: '#8a8a92', light: '#66666e' },
  };
  const p = presets[name] || presets.gold;
  return isLight ? p.light : p.dark;
}

async function generateShareCard(tank) {
  const W = 750, H = 1100, DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const isLight = document.documentElement.classList.contains('light');
  const bg = isLight ? '#f4f3f0' : '#17171a';
  const surface = isLight ? '#ffffff' : '#1e1e22';
  const text = isLight ? '#1a1a1c' : '#e8e8ea';
  const textDim = isLight ? '#66666e' : '#8a8a92';
  const accent = getAccentColor();
  const border = isLight ? '#e0dfda' : '#2a2a2e';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 顶部 logo
  ctx.font = 'bold 26px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = text;
  ctx.fillText('Tanks', 40, 68);
  const tanksW = ctx.measureText('Tanks').width;
  ctx.fillStyle = accent;
  ctx.fillText('Wall', 40 + tanksW, 68);

  ctx.font = '16px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = textDim;
  ctx.fillText(new Date().toLocaleDateString('zh-CN'), W - 40, 68);

  // 图片区
  const imgBox = { x: 40, y: 100, w: W - 80, h: 540 };
  ctx.fillStyle = surface;
  drawRoundedRect(ctx, imgBox.x, imgBox.y, imgBox.w, imgBox.h, 16);
  ctx.fill();

  try {
    const img = await loadImageFromUrl(tank.imgs[0]);
    const scale = Math.min((imgBox.w - 40) / img.width, (imgBox.h - 40) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, imgBox.x + (imgBox.w - dw) / 2, imgBox.y + (imgBox.h - dh) / 2, dw, dh);
  } catch (e) {
    ctx.fillStyle = textDim;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('图片加载失败', W / 2, imgBox.y + imgBox.h / 2);
  }

  // 名称
  ctx.textAlign = 'center';
  ctx.fillStyle = text;
  let nameFontSize = 44;
  ctx.font = `bold ${nameFontSize}px -apple-system, sans-serif`;
  let nameW = ctx.measureText(tank.name).width;
  while (nameW > W - 80 && nameFontSize > 24) {
    nameFontSize -= 2;
    ctx.font = `bold ${nameFontSize}px -apple-system, sans-serif`;
    nameW = ctx.measureText(tank.name).width;
  }
  ctx.fillText(tank.name, W / 2, 718);

  // meta
  ctx.font = '22px sans-serif';
  ctx.fillStyle = textDim;
  ctx.fillText(getCardInfoText(tank), W / 2, 758);

  ctx.font = '20px sans-serif';
  ctx.fillText(displayTypeFor(tank), W / 2, 790);

  // 分隔线
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 848);
  ctx.lineTo(W - 80, 848);
  ctx.stroke();

  // 作者
  const author = (typeof authors !== 'undefined' && authors[tank.authorId]) || null;
  if (author) {
    const ar = 30;
    const ax = W / 2 - 130, ay = 892;
    try {
      const avImg = await loadImageFromUrl(author.avatar);
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avImg, ax, ay, ar * 2, ar * 2);
      ctx.restore();
    } catch (e) {
      ctx.beginPath();
      ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2);
      ctx.fillStyle = surface;
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = text;
    ctx.font = 'bold 22px -apple-system, sans-serif';
    ctx.fillText(author.name, ax + ar * 2 + 16, ay + 26);
    ctx.fillStyle = textDim;
    ctx.font = '16px sans-serif';
    ctx.fillText(author.title, ax + ar * 2 + 16, ay + 50);
  }

  // 底部水印
  ctx.textAlign = 'center';
  ctx.fillStyle = textDim;
  ctx.font = '16px monospace';
  ctx.fillText('TanksWall · 坦克墙', W / 2, H - 40);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('生成失败')); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${sanitizeFilename(tank.name)}_分享.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        resolve();
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

async function onShareCardClick() {
  const t = window.__currentTank;
  if (!t) { toast('请先打开一个展品'); return; }
  const btn = document.getElementById('btn-share-card');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    await generateShareCard(t);
    toast('已生成');
  } catch (e) {
    console.error(e);
    toast('生成失败：' + (e.message || '未知错误'));
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}