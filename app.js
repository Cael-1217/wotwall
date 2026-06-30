// ==================== app.js ====================
let isTransitioning = false;
let currentUser = null;

// 全局变量
const grid = document.getElementById("grid");
const filters = document.getElementById("header-filters");
let currentAuthorFilter = "";
let pageAnimEnabled = true;
let pageAnimColor = '#5aa9ff';

// 预加载主角图片
const playerImg = new Image(); playerImg.src = "player.PNG";
playerImg.onload = () => { console.log("主角图片已优先加载完成！"); };

(function () {
    let savedUser = localStorage.getItem("loginUser");
    if (savedUser && members[savedUser]) { currentUser = members[savedUser]; showUser(); }
})();

// ========== 登录/退出系统 ==========
function login() {
    let u = document.getElementById("login-user").value.trim();
    let p = document.getElementById("login-pass").value.trim();
    
    // 1. 先判断是否直接输入了键名（兼容旧用法，不报错）
    if (members[u] && members[u].password === p) {
        currentUser = members[u];
        localStorage.setItem("loginUser", u);
        showUser();
        return;
    }

    // 2. 【核心修复】遍历查找，支持用成员的真实用户名（例如 ALAN, Xian, NEW WAY）登录
    let foundKey = null;
    for (let key in members) {
        if (members[key].username === u && members[key].password === p) {
            foundKey = key;
            break;
        }
    }
    
    // 3. 成功登录并保存状态
    if (foundKey) {
        currentUser = members[foundKey];
        localStorage.setItem("loginUser", foundKey); // 注意：这里必须存键（如 "admin"），因为收藏系统的 localStorage 用的是键
        showUser();
    } else {
        alert("账号或密码错误");
    }
}
function logout() { currentUser = null; localStorage.removeItem("loginUser"); document.getElementById("login-box").style.display="block"; document.getElementById("user-info").style.display="none"; }
function showUser() { 
    document.getElementById("login-box").style.display="none"; 
    document.getElementById("user-info").style.display="block"; 
    document.getElementById("welcome-user").innerHTML="欢迎回来，"+currentUser.nickname; 
    document.getElementById("user-role").innerHTML = currentUser.role==="admin"?"管理员":"成员"; 
    updateFavCount();
    renderFavoritesList();
}

// ========== 收藏系统 ==========
function getUserFavorites() {
    if (!currentUser) return [];
    const key = 'fav_' + currentUser.username;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}
function saveUserFavorites(favs) {
    if (!currentUser) return;
    const key = 'fav_' + currentUser.username;
    localStorage.setItem(key, JSON.stringify(favs));
}
function isTankFavorited(tankName) {
    const favs = getUserFavorites();
    return favs.includes(tankName);
}
function toggleFavorite(tankName) {
    if (!currentUser) { alert("请先登录"); return; }
    const favs = getUserFavorites();
    const index = favs.indexOf(tankName);
    if (index > -1) { favs.splice(index, 1); } else { favs.push(tankName); }
    saveUserFavorites(favs);
    const btn = document.getElementById("btn-favorite");
    if (btn) {
        const isFav = favs.includes(tankName);
        btn.style.background = isFav ? '#ff8c00' : '#5aa9ff';
        btn.textContent = isFav ? '★ 已收藏' : '☆ 收藏';
    }
    updateFavCount();
    renderFavoritesList();
}
function updateFavCount() {
    const countSpan = document.getElementById("fav-count");
    if (countSpan) { countSpan.textContent = getUserFavorites().length; }
}
function renderFavoritesList() {
    const listDiv = document.getElementById("favorites-list");
    if (!listDiv || !currentUser) return;
    const favs = getUserFavorites();
    if (favs.length === 0) { listDiv.innerHTML = '<p style="opacity:0.6; text-align:center;">暂无收藏</p>'; return; }
    const favTanks = tanks.filter(t => favs.includes(t.name));
    listDiv.innerHTML = favTanks.map(t => `
        <div class="author-card-box" style="margin-bottom:10px; padding:10px; display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="showTank(tanks.find(x=>x.name==='${t.name}'))">
            <img src="${t.imgs[0]}" style="width:50px; height:50px; object-fit:contain; border-radius:6px;" onerror="this.src='https://via.placeholder.com/50'">
            <div style="flex:1;">
                <div style="font-weight:bold;">${t.name}</div>
                <div style="font-size:12px; opacity:0.7;">${t.nation} ${t.tier} ${t.type}</div>
            </div>
            <button onclick="event.stopPropagation(); toggleFavorite('${t.name}')" style="background:none; border:none; color:#ff8c00; font-size:20px; cursor:pointer;">★</button>
        </div>
    `).join('');
}

// ========== 切换标签页与动画 ==========
(function initPageAnimSettings() {
    const saved = JSON.parse(localStorage.getItem('tankwall_pageAnim'));
    if (saved) { pageAnimEnabled = saved.enabled !== false; pageAnimColor = saved.color || '#5aa9ff'; }
    const toggle = document.getElementById('anim-toggle');
    const colorSel = document.getElementById('anim-color');
    if (toggle) toggle.checked = pageAnimEnabled;
    if (colorSel) colorSel.value = pageAnimColor;
})();
function togglePageAnim(enabled) { pageAnimEnabled = enabled; localStorage.setItem('tankwall_pageAnim', JSON.stringify({ enabled: pageAnimEnabled, color: pageAnimColor })); }
function changeAnimColor(color) { pageAnimColor = color; localStorage.setItem('tankwall_pageAnim', JSON.stringify({ enabled: pageAnimEnabled, color: pageAnimColor })); }
function playTransitionAnimation(color, callback) {
    if (isTransitioning) { if (callback) callback(); return; }
    isTransitioning = true;
    const overlay = document.getElementById('page-transition-overlay');
    const animContainer = document.getElementById('transition-animation');
    const isLight = document.documentElement.classList.contains('light-mode');
    overlay.style.display = 'block'; overlay.style.background = 'transparent'; overlay.style.opacity = '1'; overlay.style.transition = 'none'; animContainer.innerHTML = '';
    const finishTransition = () => {
        if (!isTransitioning) return;
        overlay.style.display = 'none'; animContainer.innerHTML = ''; overlay.style.opacity = '1'; overlay.style.transition = 'none'; overlay.style.background = isLight ? '#f5f5f5' : '#111'; isTransitioning = false;
    };
    const barCount = 30; const barColor = isLight ? 'rgba(80,80,80,0.85)' : 'rgba(255,255,255,0.85)';
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.style.position = 'absolute'; bar.style.width = '200%'; bar.style.height = '20px'; bar.style.background = barColor; bar.style.left = '-50%'; bar.style.transform = 'rotate(-25deg)'; bar.style.top = '-20%'; bar.style.opacity = '0';
        const targetTop = (i / (barCount - 1)) * 100; bar.style.transition = 'top 0.7s ease-out, opacity 0.4s linear'; animContainer.appendChild(bar);
        setTimeout(() => { bar.style.opacity = '1'; bar.style.top = targetTop + '%'; }, i * 60);
    }
    const lastBarDelay = (barCount - 1) * 60; const barAnimDuration = 700; const totalBarTime = lastBarDelay + barAnimDuration + 100;
    setTimeout(() => {
        overlay.style.background = isLight ? '#f5f5f5' : '#111';
        const stripe = document.createElement('div');
        stripe.style.position = 'absolute'; stripe.style.top = '50%'; stripe.style.left = '120%'; stripe.style.width = '200%'; stripe.style.height = '60px'; stripe.style.backgroundColor = color; stripe.style.borderRadius = '0'; stripe.style.transform = 'translateY(-50%) scaleX(0)'; stripe.style.opacity = '0'; stripe.style.transition = 'left 0.45s ease, transform 0.45s ease, opacity 0.3s ease'; animContainer.appendChild(stripe);
        requestAnimationFrame(() => { requestAnimationFrame(() => { stripe.style.opacity = '1'; stripe.style.left = '50%'; stripe.style.transform = 'translate(-50%, -50%) scaleX(1)'; }); });
        stripe.addEventListener('transitionend', function handler1(e) {
            if (e.propertyName === 'left' && stripe.style.left === '50%') {
                stripe.removeEventListener('transitionend', handler1);
                setTimeout(() => {
                    stripe.style.transition = 'all 0.5s ease'; stripe.style.top = '0'; stripe.style.left = '0'; stripe.style.width = '100vw'; stripe.style.height = '100vh'; stripe.style.transform = 'none'; stripe.style.borderRadius = '0';
                    stripe.addEventListener('transitionend', function handler2(e2) {
                        if (e2.propertyName === 'width') {
                            stripe.removeEventListener('transitionend', handler2);
                            if (callback) callback();
                            overlay.style.transition = 'opacity 0.4s ease'; overlay.style.opacity = '0';
                            overlay.addEventListener('transitionend', function handler3() { overlay.removeEventListener('transitionend', handler3); finishTransition(); });
                            setTimeout(() => { if (overlay.style.display !== 'none') { finishTransition(); } }, 500);
                        }
                    });
                }, 400);
            }
        });
        setTimeout(() => { if (overlay.style.display !== 'none') { finishTransition(); if (callback) callback(); } }, totalBarTime + 2500);
    }, totalBarTime);
}
function switchTab(pageId, btn, keepFilter = false) {
    const doSwitch = () => {
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(pageId).classList.add('active'); btn.classList.add('active');
        if(pageId === 'tank-page') { filters.style.display = 'grid'; if(!keepFilter) currentAuthorFilter = ""; draw(); } 
        else { filters.style.display = 'none'; }
        if (pageId === 'user-page' && currentUser) { updateFavCount(); renderFavoritesList(); }
    };
    if (pageAnimEnabled) { playTransitionAnimation(pageAnimColor, doSwitch); } else { doSwitch(); }
}

function getIconHtml(type) {
    const config = typeIcons[type];
    if (!config) return `<span style="color:#ffcd38; font-weight:bold; margin-right:4px;">•</span>`;
    return `<img src="${config.png}" class="type-icon-png" style="margin-right:4px;" onerror="this.style.display='none'; if(this.nextElementSibling){this.nextElementSibling.style.display='inline-block';}"><span style="display:none; color:#ffcd38; font-weight:bold; margin-right:4px;">${config.fallback}</span>`;
}
function draw(){
    if(!grid) return; grid.innerHTML="";
    const currentLayout = document.getElementById("layout-select")?.value || "grid";
    const hintBar = document.getElementById("author-filter-hint");
    const hintText = document.getElementById("filter-hint-text");
    if(currentAuthorFilter && authors[currentAuthorFilter]) {
        hintBar.style.display = "flex";
        hintText.innerText = `🔍 正在浏览 [${authors[currentAuthorFilter].name}] 的作品`;
    } else { hintBar.style.display = "none"; }
    tanks.forEach(t=>{
        if((!nation.value||t.nation===nation.value)&&(!tier.value||t.tier===tier.value)&&(!type.value||t.type===type.value)&&(!currentAuthorFilter||t.authorId===currentAuthorFilter)&&t.name.toLowerCase().includes(search.value.toLowerCase())){
            let card=document.createElement("div");
            card.className="card "+t.nation;
            let iconHtml = getIconHtml(t.type);
            if(currentLayout === 'grid') { card.innerHTML = `<div class='title-container'>${iconHtml}<span>${t.name}</span></div><img class="tank-preview" src='${t.imgs[0]}' loading="lazy" onerror="this.src='https://via.placeholder.com/120x80?text=No+Image'">`; } 
            else { card.innerHTML = `<div class='title-container'>${iconHtml}<span>${t.name}</span></div><span class='type-badge'>${t.tier} / ${t.type}</span>`; }
            card.onclick=()=>showTank(t); grid.appendChild(card);
        }
    });
}
function clickToViewAuthor(authorKey) { currentAuthorFilter = authorKey; const tankTabBtn = document.querySelector(".tabs .tab-btn"); switchTab('tank-page', tankTabBtn, true); }
function clearAuthorFilter() { currentAuthorFilter = ""; draw(); }

function renderAllAuthors() {
    const container = document.getElementById("author-card-container");
    if(!container) return; container.innerHTML = "";
    Object.keys(authors).forEach(key => {
        const author = authors[key];
        container.innerHTML += `<div class="author-card-box"><div class="author-main"><img src="${author.avatar}" class="author-avatar" onerror="this.src='https://via.placeholder.com/80'"><div class="author-right"><div class="author-name-row"><span class="author-name">${author.name}</span><span class="author-title-badge">${author.title}</span><span class="author-work-preview" onclick="clickToViewAuthor('${key}')">${author.workText}</span></div></div></div><div class="author-stats"><div class="stat-item"><span class="num green">${author.fansCount}</span><span>粉丝</span></div></div><div class="author-footer"><div>加入时间：${author.joinTime}</div><div class="lollipop-box"><span>作品数</span><span style="margin-left:4px;">${author.totalWorks}</span></div></div></div>`;
    });
}

function toggleTheme(isLight) { if(isLight) document.documentElement.classList.add('light-mode'); else document.documentElement.classList.remove('light-mode'); }
function toggleLayout(mode) { const gridEl = document.getElementById("grid"); if(!gridEl) return; gridEl.className = (mode === 'list') ? "list-mode" : "grid-mode"; draw(); }

function showTank(t){
    const doShow = () => {
        detail.style.display="block"; dtitle.innerText=t.name; desc.innerText=t.text; gallery.innerHTML="";
        t.imgs.forEach(i=>{ gallery.innerHTML+="<img src='"+i+"' onerror=\"this.src='https://via.placeholder.com/300x200?text=No+Image'\">"; });
        const authorZone = document.getElementById("detail-author-zone");
        if(authorZone) {
            const tankAuthor = authors[t.authorId] || authors["cael"];
            authorZone.innerHTML = `<div class="setting-item" style="border:none; background: var(--header-bg); margin: 10px; border-radius: 8px;"><div style="display:flex; align-items:center; gap:10px;"><img src="${tankAuthor.avatar}" style="width:40px; height:40px; border-radius:50%;" onerror="this.src='https://via.placeholder.com/40'"><div><div style="font-weight:bold; font-size:16px;">${tankAuthor.name}</div><div style="font-size:12px; opacity:0.6;">${tankAuthor.title}</div></div></div></div>`;
        }
        const favContainer = document.getElementById("detail-fav-container");
        if (favContainer) {
            const isFav = isTankFavorited(t.name);
            favContainer.innerHTML = `<button id="btn-favorite" onclick="toggleFavorite('${t.name}')" style="width:100%; padding:10px; background:${isFav?'#ff8c00':'#5aa9ff'}; color:#fff; border:none; border-radius:6px; font-weight:bold;">${isFav ? '★ 已收藏' : '☆ 收藏'}</button>`;
        }
    };
    if (pageAnimEnabled) { detail.style.display = 'none'; playTransitionAnimation(pageAnimColor, doShow); } else { doShow(); }
}

back.onclick=()=>{ if (pageAnimEnabled) { playTransitionAnimation(pageAnimColor, () => { detail.style.display="none"; }); } else { detail.style.display="none"; } };
search.oninput=draw; nation.onchange=draw; tier.onchange=draw; type.onchange=draw;
renderAllAuthors(); draw();

// ========== 加载页面动画 ==========
function skipLoading() { const ls=document.getElementById('loading-screen'); ls.style.opacity="0"; setTimeout(()=>{ls.style.display="none";},500); }
window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');
    const loadingImage = document.getElementById('loading-image');
    const loadingBgs = ["bg1.PNG","bg2.JPG","bg3.JPG","tank_load.JPG"];
    loadingImage.src = loadingBgs[Math.floor(Math.random() * loadingBgs.length)];
    const steps = [ { progress:15, text:"正在连接potato2服务器..." }, { progress:40, text:"正在解析车辆图片与文本..." }, { progress:75, text:"正在获取创作者数据..." }, { progress:95, text:"正在渲染画面..." }, { progress:100, text:"加载完成！" } ];
    let stepIndex = 0;
    function simulateLoading() {
        if(stepIndex < steps.length) { progressBar.style.width = steps[stepIndex].progress+"%"; loadingText.innerText = steps[stepIndex].text; stepIndex++; setTimeout(simulateLoading, Math.random()*400+200); }
        else { setTimeout(()=>{ loadingScreen.style.opacity="0"; setTimeout(()=>{loadingScreen.style.display="none";},500); },300); }
    }
    simulateLoading();
});

// ========== 装甲计算器 ==========
function calculateArmor() { let act=parseFloat(document.getElementById('calc-act').value), ang=parseFloat(document.getElementById('calc-ang').value), eff=parseFloat(document.getElementById('calc-eff').value); if(!isNaN(act)&&!isNaN(ang)&&isNaN(eff)) document.getElementById('calc-eff').value = (act / Math.cos(ang*Math.PI/180)).toFixed(2); else if(!isNaN(eff)&&!isNaN(ang)&&isNaN(act)) document.getElementById('calc-act').value = (eff * Math.cos(ang*Math.PI/180)).toFixed(2); else if(!isNaN(act)&&!isNaN(eff)&&isNaN(ang)) { if(act>eff){alert("物理常识错误：实际厚度不能大于等效厚度！");return;} document.getElementById('calc-ang').value = (Math.acos(act/eff)*180/Math.PI).toFixed(2); } else alert("请正确填写：必须且只能填写其中的两项数值！"); }
function clearCalc() { document.getElementById('calc-act').value=''; document.getElementById('calc-ang').value=''; document.getElementById('calc-eff').value=''; }

// ========== 小游戏 ==========
let gameLoop, ctx, canvas; let player = { lane:1, img: playerImg }; let obstacles=[], gameSpeed=5, score=0, frames=0, isGameOver=false;
async function enterFullscreenGame() { const container=document.getElementById('game-container'); container.style.display='flex'; try{await container.requestFullscreen();}catch(e){} try{await screen.orientation.lock('landscape');}catch(e){} initGame(); }
async function exitFullscreenGame() { isGameOver=true; document.getElementById('game-container').style.display='none'; if(document.fullscreenElement) await document.exitFullscreen(); if(screen.orientation&&screen.orientation.unlock) screen.orientation.unlock(); }
function initGame() { canvas=document.getElementById('gameCanvas'); ctx=canvas.getContext('2d'); player.lane=1; obstacles=[]; gameSpeed=6; score=0; frames=0; isGameOver=false; document.getElementById('game-score').innerText=0; runGame(); }
function runGame() {
    if(isGameOver)return; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=4;ctx.setLineDash([20,20]);
    ctx.beginPath();ctx.moveTo(0,133);ctx.lineTo(800,133);ctx.stroke(); ctx.beginPath();ctx.moveTo(0,266);ctx.lineTo(800,266);ctx.stroke(); ctx.setLineDash([]);
    frames++; if(frames%Math.max(1,Math.floor(150/gameSpeed))===0){score++;document.getElementById('game-score').innerText=score;} if(frames%200===0)gameSpeed+=0.8;
    if(frames%Math.max(25,Math.floor(120-gameSpeed*6))===0){ let l1=Math.floor(Math.random()*3),l2=Math.floor(Math.random()*3); obstacles.push({x:800,lane:l1}); if(Math.random()>(gameSpeed>10?0.25:0.5)&&l1!==l2)obstacles.push({x:800,lane:l2}); }
    for(let i=0;i<obstacles.length;i++){ let obs=obstacles[i]; obs.x-=Math.round(gameSpeed); ctx.fillStyle="#ff4757";ctx.fillRect(Math.round(obs.x),30+obs.lane*133,60,60);
        if(obs.x<110&&obs.x+60>50&&obs.lane===player.lane){ isGameOver=true; ctx.fillStyle="rgba(0,0,0,0.7)";ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#fff";ctx.font="40px Arial";ctx.fillText("游戏结束! 分数: "+score,250,200); ctx.font="20px Arial";ctx.fillText("点击屏幕重试",330,250); } }
    obstacles=obstacles.filter(obs=>obs.x>-60);
    let playerY=30+player.lane*133;
    if(player.img.complete&&player.img.naturalHeight!==0){ let pH=40,pW=(1167/455)*pH; ctx.drawImage(player.img,50,playerY+10,pW,pH); }
    else{ctx.fillStyle="#5aa9ff";ctx.fillRect(50,playerY+10,102,40);}
    if(!isGameOver)requestAnimationFrame(runGame);
}
document.getElementById('game-container').addEventListener('mousedown',(e)=>{ if(isGameOver){initGame();return;} if(e.target.tagName==="BUTTON")return; let rect=canvas.getBoundingClientRect(); let clickY=e.clientY-rect.top; if(clickY<rect.height/2&&player.lane>0)player.lane--; else if(clickY>=rect.height/2&&player.lane<2)player.lane++; });

// ========== 其它工具计算器 ==========
function calculatePTW() { let w=parseFloat(document.getElementById('calc-weight').value),hp=parseFloat(document.getElementById('calc-hp').value),ptw=parseFloat(document.getElementById('calc-ptw').value); if(!isNaN(w)&&!isNaN(hp)&&isNaN(ptw))document.getElementById('calc-ptw').value=(hp/w).toFixed(2); else if(!isNaN(w)&&!isNaN(ptw)&&isNaN(hp))document.getElementById('calc-hp').value=(w*ptw).toFixed(2); else if(!isNaN(hp)&&!isNaN(ptw)&&isNaN(w))document.getElementById('calc-weight').value=(hp/ptw).toFixed(2); else alert("请正确填写：必须且只能填写其中的两项数值！"); }
function clearPTW(){document.getElementById('calc-weight').value='';document.getElementById('calc-hp').value='';document.getElementById('calc-ptw').value='';}
function calculateSteering() { let wb=parseFloat(document.getElementById('calc-wheelbase').value),ang=parseFloat(document.getElementById('calc-steer-ang').value),rad=parseFloat(document.getElementById('calc-steer-rad').value); if(!isNaN(wb)&&!isNaN(ang)&&isNaN(rad))document.getElementById('calc-steer-rad').value=(wb/Math.sin(ang*Math.PI/180)).toFixed(2); else if(!isNaN(wb)&&!isNaN(rad)&&isNaN(ang)){if(wb>rad){alert("物理限制：轴距不能大于转向半径！");return;}document.getElementById('calc-steer-ang').value=(Math.asin(wb/rad)*180/Math.PI).toFixed(2);} else if(!isNaN(ang)&&!isNaN(rad)&&isNaN(wb))document.getElementById('calc-wheelbase').value=(rad*Math.sin(ang*Math.PI/180)).toFixed(2); else alert("请正确填写：必须且只能填写其中的两项数值！"); }
function clearSteering(){document.getElementById('calc-wheelbase').value='';document.getElementById('calc-steer-ang').value='';document.getElementById('calc-steer-rad').value='';}
function calculateTurnTime() { let rad=parseFloat(document.getElementById('calc-circle-rad').value),spd=parseFloat(document.getElementById('calc-speed').value),time=parseFloat(document.getElementById('calc-turn-time').value); if(!isNaN(rad)&&!isNaN(spd)&&isNaN(time)){let c=2*Math.PI*rad;document.getElementById('calc-turn-time').value=(c/(spd/3.6)).toFixed(2);} else if(!isNaN(rad)&&!isNaN(time)&&isNaN(spd)){let c=2*Math.PI*rad;document.getElementById('calc-speed').value=((c/time)*3.6).toFixed(2);} else if(!isNaN(spd)&&!isNaN(time)&&isNaN(rad)){let c=(spd/3.6)*time;document.getElementById('calc-circle-rad').value=(c/(2*Math.PI)).toFixed(2);} else alert("请正确填写：必须且只能填写其中的两项数值！"); }
function clearTurnTime(){document.getElementById('calc-circle-rad').value='';document.getElementById('calc-speed').value='';document.getElementById('calc-turn-time').value='';}
function toggleDpmMode(){ let isAuto=document.getElementById('calc-dpm-mode').checked; document.getElementById('calc-item-reload').style.display=isAuto?'none':'flex'; document.querySelectorAll('.dpm-auto-item').forEach(item=>item.style.display=isAuto?'flex':'none'); clearFirepower(); }
function calculateFirepower() { let isAuto=document.getElementById('calc-dpm-mode').checked,D=parseFloat(document.getElementById('calc-dmg').value),R=parseFloat(document.getElementById('calc-rpm').value),P=parseFloat(document.getElementById('calc-dpm').value); for(let i=0;i<3;i++){ if(!isNaN(D)&&!isNaN(R)&&isNaN(P))P=D*R; if(!isNaN(P)&&!isNaN(R)&&isNaN(D))D=P/R; if(!isNaN(P)&&!isNaN(D)&&isNaN(R))R=P/D; if(isAuto){ let C=parseFloat(document.getElementById('calc-clip').value),S=parseFloat(document.getElementById('calc-short').value),L=parseFloat(document.getElementById('calc-long').value),cycle=NaN; if(!isNaN(C)&&!isNaN(R))cycle=C*60/R; if(isNaN(cycle)&&!isNaN(L)&&!isNaN(C)&&!isNaN(S))cycle=L+(C-1)*S; if(!isNaN(cycle)){ if(isNaN(R)&&!isNaN(C))R=C*60/cycle; if(isNaN(L)&&!isNaN(C)&&!isNaN(S))L=cycle-(C-1)*S; if(isNaN(S)&&!isNaN(C)&&!isNaN(L)&&C>1)S=(cycle-L)/(C-1); } if(!isNaN(C))document.getElementById('calc-clip').value=C; if(!isNaN(S))document.getElementById('calc-short').value=S; if(!isNaN(L))document.getElementById('calc-long').value=L; } else{ let T=parseFloat(document.getElementById('calc-reload').value); if(!isNaN(R)&&isNaN(T))T=60/R; if(!isNaN(T)&&isNaN(R))R=60/T; if(!isNaN(T))document.getElementById('calc-reload').value=T; } } if(!isNaN(D))document.getElementById('calc-dmg').value=Math.round(D); if(!isNaN(R))document.getElementById('calc-rpm').value=R.toFixed(2); if(!isNaN(P))document.getElementById('calc-dpm').value=Math.round(P); if(isAuto){ let C=parseFloat(document.getElementById('calc-clip').value),S=parseFloat(document.getElementById('calc-short').value),L=parseFloat(document.getElementById('calc-long').value); if(!isNaN(C))document.getElementById('calc-clip').value=Math.round(C); if(!isNaN(S))document.getElementById('calc-short').value=S.toFixed(2); if(!isNaN(L))document.getElementById('calc-long').value=L.toFixed(2); } else{ let T=parseFloat(document.getElementById('calc-reload').value); if(!isNaN(T))document.getElementById('calc-reload').value=T.toFixed(2); } }
function clearFirepower(){ document.getElementById('calc-dmg').value=''; document.getElementById('calc-reload').value=''; document.getElementById('calc-clip').value=''; document.getElementById('calc-short').value=''; document.getElementById('calc-long').value=''; document.getElementById('calc-rpm').value=''; document.getElementById('calc-dpm').value=''; }

// ========== 点亮距离计算器 ==========
let manualCamoOverride = false;
function onStatusChange() { let status = document.getElementById('calc-status').value; document.getElementById('still-camo-row').style.display = (status==='still')?'flex':'none'; document.getElementById('moving-camo-row').style.display = (status==='moving')?'flex':'none'; manualCamoOverride=false; document.getElementById('calc-final-camo').value=''; autoCalcFinalCamo(); }
function onFinalCamoManual() { manualCamoOverride = true; }
function autoCalcFinalCamo() { if(manualCamoOverride)return; let status=document.getElementById('calc-status').value; let camo; if(status==='still') camo=parseFloat(document.getElementById('calc-base-camo').value); else camo=parseFloat(document.getElementById('calc-move-camo').value); if(isNaN(camo)){document.getElementById('calc-final-camo').value='';return;} let bushType=document.getElementById('calc-bush').value, bushBonus=0; if(bushType==='sparse')bushBonus=25; else if(bushType==='single')bushBonus=50; else if(bushType==='double')bushBonus=80; if(document.getElementById('calc-high-optics').checked&&bushBonus>0) bushBonus=Math.max(0,bushBonus-15); if(document.getElementById('calc-camo-paint').checked)camo+=4; camo+= (parseFloat(document.getElementById('calc-exhaust').value)||0); camo+=bushBonus; camo=Math.min(100,Math.max(0,camo)); if(document.getElementById('calc-cvs').checked)camo*=0.85; document.getElementById('calc-final-camo').value=camo.toFixed(1); }
document.addEventListener('DOMContentLoaded', function() { const ids=['calc-base-camo','calc-move-camo','calc-status','calc-bush','calc-camo-paint','calc-exhaust','calc-cvs','calc-high-optics']; ids.forEach(id=>{ let el=document.getElementById(id); if(el){ el.addEventListener('input',autoCalcFinalCamo); el.addEventListener('change',autoCalcFinalCamo); } }); });
function calculateSpotting() { let finalCamo=parseFloat(document.getElementById('calc-final-camo').value), viewRange=parseFloat(document.getElementById('calc-view-range').value); if(isNaN(finalCamo)||isNaN(viewRange)){alert('请填写综合隐蔽值和敌方视野！');return;} if(viewRange<=50){document.getElementById('spotting-result').innerHTML='敌方视野必须大于 50 米';return;} let L=viewRange-(viewRange-50)*(finalCamo/100); L=Math.min(445,Math.max(50,L)); document.getElementById('spotting-result').innerHTML=`🔭 点亮距离：${L.toFixed(1)} 米`; }
function clearSpotting() { document.getElementById('calc-base-camo').value=''; document.getElementById('calc-move-camo').value=''; document.getElementById('calc-status').value='still'; document.getElementById('calc-bush').value='none'; document.getElementById('calc-camo-paint').checked=false; document.getElementById('calc-exhaust').value='0'; document.getElementById('calc-cvs').checked=false; document.getElementById('calc-high-optics').checked=false; document.getElementById('calc-final-camo').value=''; document.getElementById('calc-view-range').value=''; document.getElementById('spotting-result').innerHTML=''; document.getElementById('still-camo-row').style.display='flex'; document.getElementById('moving-camo-row').style.display='none'; manualCamoOverride=false; }

// ========== 运势抽卡系统 ==========
const fortuneGrades = [ { name: '橙黄金', color: '#FF8C00', lightColor: '#FFD700', text: '大吉' }, { name: '紫砂', color: '#8A2BE2', lightColor: '#DDA0DD', text: '吉' }, { name: '青蓝', color: '#00CED1', lightColor: '#AFEEEE', text: '半吉' }, { name: '墨绿', color: '#006400', lightColor: '#90EE90', text: '小吉' }, { name: '浅白', color: '#B0C4DE', lightColor: '#E6E6FA', text: '平' } ];
const fortuneTexts = { '大吉': ['今日综合运势极佳！\n幸运数字：7\n幸运颜色：橙金\n幸运方向：东北\n宜：冲锋陷阵、带队推进\n忌：蹲坑死守','鸿运当头，炮炮穿敌！\n幸运数字：3\n幸运颜色：赤红\n幸运方向：西南\n宜：卖头输出、抢点\n忌：贪炮换血'], '吉': ['运势不错，稳扎稳打。\n幸运数字：11\n幸运颜色：紫色\n幸运方向：东\n宜：支援队友、转场\n忌：孤军深入'], '半吉': ['中规中矩，考验技术。\n幸运数字：5\n幸运颜色：青色\n幸运方向：南\n宜：黑枪、点亮\n忌：冲动开炮'], '小吉': ['小心行事，保存血量。\n幸运数字：2\n幸运颜色：墨绿\n幸运方向：北\n宜：卡点防守\n忌：主动进攻'], '平': ['平淡一日，无惊无喜。\n幸运数字：9\n幸运颜色：浅灰\n幸运方向：西北\n宜：随意游玩\n忌：强求胜率'] };
function getDeviceId(){ let id=localStorage.getItem('deviceId'); if(!id){id='dev-'+Math.random().toString(36).substr(2,9);localStorage.setItem('deviceId',id);} return id; }
function getToday(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function hashString(str){ let hash=0; for(let i=0;i<str.length;i++){hash=((hash<<5)-hash)+str.charCodeAt(i);hash|=0;} return Math.abs(hash); }
let currentFortuneTank = null, currentGrade = null;
function generateFortune() {
    const today=getToday(), deviceId=getDeviceId(), seedStr=today+deviceId, seed=hashString(seedStr);
    const tankIndex=seed%tanks.length; currentFortuneTank=tanks[tankIndex];
    const gradeRandom=(seed*31+17)%100; let gradeIdx;
    if(gradeRandom<30)gradeIdx=0; else if(gradeRandom<55)gradeIdx=1; else if(gradeRandom<75)gradeIdx=2; else if(gradeRandom<90)gradeIdx=3; else gradeIdx=4;
    currentGrade=fortuneGrades[gradeIdx];
    const texts=fortuneTexts[currentGrade.text], textIndex=(seed*7+13)%texts.length;
    return { tank:currentFortuneTank, grade:currentGrade, fortuneText: texts[textIndex] };
}
function getTodayFortune() {
    const today=getToday(); const saved=JSON.parse(localStorage.getItem('fortuneData'));
    if(saved&&saved.date===today){ currentFortuneTank=tanks.find(t=>t.name===saved.tankName); currentGrade=fortuneGrades.find(g=>g.name===saved.gradeName); return { tank:currentFortuneTank, grade:currentGrade, fortuneText: saved.fortuneText }; }
    const fortune=generateFortune(); localStorage.setItem('fortuneData',JSON.stringify({date:today,tankName:fortune.tank.name,gradeName:fortune.grade.name,fortuneText:fortune.fortuneText}));
    return fortune;
}
function openFortune(forceAnimation=false) {
    const overlay=document.getElementById('fortune-overlay'), card=document.getElementById('fortune-card'), anim=document.getElementById('fortune-animation'), btn=document.getElementById('btn-draw-fortune');
    const fortune=getTodayFortune(); const today=getToday(); const saved=JSON.parse(localStorage.getItem('fortuneData'));
    if(saved&&saved.date===today&&!forceAnimation){ displayFortuneCard(fortune); overlay.style.display='flex'; anim.innerHTML=''; card.style.display='block'; btn.textContent='查看今日运势'; return; }
    overlay.style.display='flex'; card.style.display='none'; anim.innerHTML=''; btn.textContent='抽取中...';
    for(let i=0;i<20;i++){ const bar=document.createElement('div'); bar.className='white-bar'; bar.style.left=(Math.random()*100-10)+'%'; bar.style.animationDelay=(Math.random()*0.5)+'s'; anim.appendChild(bar); }
    const stripe=document.createElement('div'); stripe.className='color-stripe'; stripe.style.backgroundColor=fortune.grade.color; anim.appendChild(stripe);
    stripe.addEventListener('animationend',()=>{ anim.innerHTML=''; displayFortuneCard(fortune); card.style.display='block'; btn.textContent='查看今日运势'; });
}
function displayFortuneCard(fortune) {
    document.getElementById('f-tank-name').textContent=fortune.tank.name; document.getElementById('f-tank-img').src=fortune.tank.imgs[0];
    document.getElementById('f-tank-img').onerror=function(){this.src='https://via.placeholder.com/300x160?text=No+Image';};
    document.getElementById('f-tank-img').setAttribute('draggable', 'false'); document.getElementById('f-fortune-text').innerText=fortune.fortuneText;
    const card=document.getElementById('fortune-card'); card.style.setProperty('--grade-color',fortune.grade.color);
    card.querySelector('.corner-grade').style.background=`linear-gradient(135deg, ${fortune.grade.color} 0%, transparent 70%)`;
    const wmDiv=document.getElementById('watermark-text'); wmDiv.innerHTML=''; for(let i=0;i<50;i++) wmDiv.innerHTML+='坦克墙 ';
}
function closeFortune(){ document.getElementById('fortune-overlay').style.display='none'; document.getElementById('fortune-card').style.display='none'; }
function goToTankDetail(){ if(currentFortuneTank){ closeFortune(); const tankTabBtn=document.querySelector(".tabs .tab-btn"); switchTab('tank-page',tankTabBtn); setTimeout(()=>showTank(currentFortuneTank),100); } }
function shareFortune(){
    if (typeof html2canvas === 'undefined') { alert('分享功能加载失败，请检查网络后重试。'); return; }
    const card=document.getElementById('fortune-card');
    html2canvas(card,{backgroundColor:'#2a2a2a',scale:2}).then(canvas=>{ canvas.toBlob(blob=>{ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`坦克运势_${getToday()}.png`; a.click(); URL.revokeObjectURL(url); }); });
}
(function(){ const today=getToday(); const saved=JSON.parse(localStorage.getItem('fortuneData')); const btn=document.getElementById('btn-draw-fortune'); if(saved&&saved.date===today&&btn) btn.textContent='查看今日运势'; })();

// 禁止长按图片和拖拽
document.addEventListener('touchstart', function(e) { if (e.target.tagName === 'IMG') { e.preventDefault(); } }, { passive: false });
document.addEventListener('dragstart', function(e) { if (e.target.tagName === 'IMG') { e.preventDefault(); return false; } });