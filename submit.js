// ==================== submit.js — 投稿 / 注册 ====================

function setupSubmitInputs() {
  const fileInput = $('sub-imgs');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files).slice(0, 3);
      tankSubmission.files = files;
      renderPreviewGrid();
      $('sub-imgs-label').textContent = files.length
        ? `已选 ${files.length} 张（可重新选择）`
        : '点击选择图片';
    });
  }
  const avatarInput = $('reg-avatar');
  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      const preview = $('reg-preview');
      preview.innerHTML = '';
      if (file) {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        preview.appendChild(img);
        $('reg-avatar-label').textContent = '已选头像（可重新选择）';
      } else {
        $('reg-avatar-label').textContent = '点击选择头像';
      }
    });
  }

  ['sub-category', 'sub-nation', 'sub-tier-or-era', 'sub-type', 'sub-name', 'sub-text']
    .forEach(id => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', saveDraft);
        el.addEventListener('change', saveDraft);
      }
    });
}

function renderPreviewGrid() {
  const preview = $('sub-preview');
  if (!preview) return;
  preview.innerHTML = '';
  tankSubmission.files.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.draggable = true;
    item.dataset.idx = i;
    item.innerHTML = `
      <img src="${url}" alt="" onload="URL.revokeObjectURL('${url}')">
      <div class="preview-actions">
        <button type="button" ${i === 0 ? 'disabled' : ''} data-act="prev" data-idx="${i}">◀</button>
        <button type="button" data-act="del" data-idx="${i}">✕</button>
        <button type="button" ${i === tankSubmission.files.length - 1 ? 'disabled' : ''} data-act="next" data-idx="${i}">▶</button>
      </div>
    `;
    preview.appendChild(item);
  });

  preview.querySelectorAll('.preview-actions button').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const idx = +btn.dataset.idx;
      if (act === 'prev') moveImg(idx, -1);
      else if (act === 'next') moveImg(idx, 1);
      else if (act === 'del') removeImg(idx);
    });
  });

  preview.querySelectorAll('.preview-item').forEach(item => {
    item.addEventListener('dragstart', () => {
      dragSrcIdx = +item.dataset.idx;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const dropIdx = +item.dataset.idx;
      if (dragSrcIdx === -1 || dragSrcIdx === dropIdx) return;
      const arr = tankSubmission.files;
      const [moved] = arr.splice(dragSrcIdx, 1);
      arr.splice(dropIdx, 0, moved);
      renderPreviewGrid();
    });
  });
}

function moveImg(idx, delta) {
  const arr = tankSubmission.files;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  renderPreviewGrid();
}
function removeImg(idx) {
  tankSubmission.files.splice(idx, 1);
  renderPreviewGrid();
  $('sub-imgs-label').textContent = tankSubmission.files.length
    ? `已选 ${tankSubmission.files.length} 张（可重新选择）`
    : '点击选择图片';
}

function updateSubmitOptions() {
  const cat = $('sub-category').value;
  const nationSel = $('sub-nation');
  const tierSel = $('sub-tier-or-era');
  const tierLabel = $('sub-tier-label');
  const typeSel = $('sub-type');

  let typeOpts;
  if (cat === 'WOT') {
    typeOpts = ['重坦', '中坦', '轻坦', '反坦', '火炮', '工程车'];
  } else {
    typeOpts = ['重坦', '中坦', '轻坦', MERGED_TD_SPG, '防空车', '工程车'];
  }
  let typeHtml = '';
  typeOpts.forEach(t => { typeHtml += `<option>${t}</option>`; });
  typeSel.innerHTML = typeHtml;

  if (cat === 'WOT') {
    fillSelect(nationSel, Object.entries(GAME_NATIONS), '请选择国家');
    fillSelect(tierSel, WOT_TIERS.map(t => [t, t]), '请选择等级');
    tierLabel.textContent = '等级';
  } else if (cat === 'WT') {
    fillSelect(nationSel, WT_NATION_OPTIONS, '请选择国家');
    fillSelect(tierSel, WT_TIERS.map(t => [t, t]), '请选择等级');
    tierLabel.textContent = '等级';
  } else if (cat === 'REAL') {
    fillSelect(nationSel, REAL_NATION_OPTIONS, '请选择国家');
    fillSelect(tierSel, Object.entries(REAL_ERAS), '请选择年代');
    tierLabel.textContent = '年代';
  }
}

function saveDraft() {
  const d = {
    category: $('sub-category')?.value || '',
    nation: $('sub-nation')?.value || '',
    tierOrEra: $('sub-tier-or-era')?.value || '',
    type: $('sub-type')?.value || '',
    name: $('sub-name')?.value || '',
    text: $('sub-text')?.value || '',
  };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
}
function loadDraft() {
  let d;
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { d = null; }
  if (!d) return;
  if (d.category) {
    $('sub-category').value = d.category;
    updateSubmitOptions();
  }
  if (d.nation) $('sub-nation').value = d.nation;
  if (d.tierOrEra) $('sub-tier-or-era').value = d.tierOrEra;
  if (d.type) $('sub-type').value = d.type;
  if (d.name) $('sub-name').value = d.name;
  if (d.text) $('sub-text').value = d.text;
  document.querySelectorAll('#sub-nation, #sub-tier-or-era, #sub-type, #sub-category')
    .forEach(el => el.dispatchEvent(new Event('change')));
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
}

async function generateTankSubmission() {
  if (!state.currentUser) { toast('请先登录'); return; }
  const name = $('sub-name').value.trim();
  if (!name) { toast('请填写坦克名称'); return; }
  if (tankSubmission.files.length === 0) { toast('请至少上传一张图片'); return; }

  const cat = $('sub-category').value;
  const nation = $('sub-nation').value;
  const tierOrEra = $('sub-tier-or-era').value;
  const type = $('sub-type').value;

  if (!nation) { toast('请选择国家'); return; }
  if (!tierOrEra) { toast(cat === 'REAL' ? '请选择年代' : '请选择等级'); return; }

  const progressTrack = $('sub-progress-track');
  const progressFill = $('sub-progress-fill');
  const progressText = $('sub-progress-text');
  progressTrack.style.display = 'block';
  progressText.style.display = 'block';
  $('sub-result').style.display = 'none';

  const total = tankSubmission.files.length;
  const outFiles = [];

  for (let i = 0; i < total; i++) {
    progressText.textContent = `压缩第 ${i + 1} / ${total} 张图片…`;
    progressFill.style.width = `${(i / total) * 100}%`;
    const blob = await compressImage(tankSubmission.files[i], { maxSide: 1200, targetKB: 35 });
    const fname = `${sanitizeFilename(name)}_${i + 1}.jpg`;
    outFiles.push(new File([blob], fname, { type: 'image/jpeg' }));
  }
  progressFill.style.width = '100%';
  progressText.textContent = '完成';

  const imgsList = outFiles.map(f => JSON.stringify(f.name)).join(',');
  const authorId = state.currentUser.key;
  const rawText = $('sub-text').value.trim();
  const typeValue = type;

  const nameSafe = JSON.stringify(name);
  const textSafe = JSON.stringify(rawText);

  let code;
  if (cat === 'REAL') {
    code = `{ category:"REAL", name:${nameSafe}, era:"${tierOrEra}", nation:"${nation}", type:"${typeValue}", authorId:"${authorId}", imgs:[${imgsList}], text:${textSafe} }`;
  } else {
    code = `{ category:"${cat}", name:${nameSafe}, nation:"${nation}", tier:"${tierOrEra}", type:"${typeValue}", authorId:"${authorId}", imgs:[${imgsList}], text:${textSafe} }`;
  }

  tankSubmission.code = code;
  tankSubmission.outFiles = outFiles;

  $('sub-code').textContent = code;
  $('sub-imgs-info').textContent = `已生成 ${outFiles.length} 张图片：${outFiles.map(f => f.name).join('、')}`;
  $('sub-result').style.display = 'block';

  clearDraft();

  setTimeout(() => {
    progressTrack.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }, 800);
}

async function shareTankSubmission() {
  if (!tankSubmission.outFiles || tankSubmission.outFiles.length === 0) {
    toast('请先生成投稿'); return;
  }
  const files = tankSubmission.outFiles;
  const text = tankSubmission.code;
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text, title: 'TanksWall 坦克投稿' });
      toast('已发送');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  toast('当前浏览器不支持直接分享，改为下载图片 + 复制文本');
  files.forEach(f => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  copyText(text);
}

function copyTankCode() {
  if (!tankSubmission.code) { toast('请先生成投稿'); return; }
  copyText(tankSubmission.code);
}

async function generateRegister() {
  const username = $('reg-username').value.trim();
  const password = $('reg-password').value.trim();
  const nickname = $('reg-nickname').value.trim();
  const avatar = $('reg-avatar').files[0];
  if (!username || !password || !nickname) { toast('请填写完整信息'); return; }
  if (!avatar) { toast('请上传头像'); return; }

  const progressTrack = $('reg-progress-track');
  const progressFill = $('reg-progress-fill');
  const progressText = $('reg-progress-text');
  progressTrack.style.display = 'block';
  progressText.style.display = 'block';
  $('reg-result').style.display = 'none';

  progressText.textContent = '压缩头像…';
  progressFill.style.width = '40%';
  const blob = await compressImage(avatar, { maxSide: 400, targetKB: 30, square: true });
  progressFill.style.width = '85%';

  const fname = `${sanitizeFilename(username)}_avatar.jpg`;
  const file = new File([blob], fname, { type: 'image/jpeg' });

  progressFill.style.width = '100%';
  progressText.textContent = '完成';

  const u = JSON.stringify(username);
  const p = JSON.stringify(password);
  const n = JSON.stringify(nickname);
  const code = `${u}: { username:${u}, password:${p}, role:"member", nickname:${n} }`;

  regSubmission.file = file;
  regSubmission.code = code;
  $('reg-code').textContent = code;
  $('reg-result').style.display = 'block';

  setTimeout(() => {
    progressTrack.style.display = 'none';
    progressText.style.display = 'none';
    progressFill.style.width = '0%';
  }, 800);
}

async function shareRegister() {
  if (!regSubmission.file) { toast('请先生成注册信息'); return; }
  const files = [regSubmission.file];
  const text = regSubmission.code;
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text, title: 'TanksWall 账号注册' });
      toast('已发送');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  toast('当前浏览器不支持直接分享，改为下载 + 复制');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(regSubmission.file);
  a.download = regSubmission.file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  copyText(text);
}
function copyRegCode() {
  if (!regSubmission.code) { toast('请先生成注册信息'); return; }
  copyText(regSubmission.code);
}