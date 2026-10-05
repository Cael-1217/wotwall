// ==================== console.js — 管理员内置控制台 ====================

(function () {
  const AConsole = {
    messages: [],
    maxMessages: 200,
    visible: false,
    enabled: false,
    recentTimes: [],
  };

  // ---------- 值格式化 ----------
  function formatArg(a) {
    if (a === null) return 'null';
    if (a === undefined) return 'undefined';
    if (typeof a === 'string') return a;
    if (typeof a === 'function') return '[Function ' + (a.name || 'anonymous') + ']';
    if (typeof a === 'symbol') return a.toString();
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a, (k, v) => {
          if (typeof v === 'function') return '[Function]';
          if (typeof v === 'symbol') return v.toString();
          return v;
        }, 2);
      } catch (e) {
        return Object.prototype.toString.call(a);
      }
    }
    return String(a);
  }

  // ---------- 劫持 console ----------
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  function push(level, args) {
    const now = Date.now();
    AConsole.recentTimes.push(now);
    AConsole.recentTimes = AConsole.recentTimes.filter(t => now - t < 1000);
    if (AConsole.recentTimes.length > 100) return; // 限流

    const msg = {
      level,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      text: args.map(formatArg).join(' '),
    };
    AConsole.messages.push(msg);
    if (AConsole.messages.length > AConsole.maxMessages) {
      AConsole.messages.shift();
    }
    if (AConsole.visible) appendToDOM(msg);
  }

  console.log = (...args) => { push('log', args); orig.log(...args); };
  console.info = (...args) => { push('info', args); orig.info(...args); };
  console.warn = (...args) => { push('warn', args); orig.warn(...args); };
  console.error = (...args) => { push('error', args); orig.error(...args); };

  // ---------- 捕获全局错误 ----------
  window.addEventListener('error', e => {
    push('error', [`Uncaught: ${e.message} @ ${e.filename}:${e.lineno}`]);
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    push('error', ['Unhandled Promise: ' + (r && r.message ? r.message : String(r))]);
  });

  // ---------- DOM 渲染 ----------
  function appendToDOM(msg) {
    const logs = document.getElementById('admin-console-logs');
    if (!logs) return;
    const div = document.createElement('div');
    div.className = 'admin-console-log ' + msg.level;
    const timeEl = document.createElement('span');
    timeEl.className = 'time';
    timeEl.textContent = msg.time;
    const textEl = document.createElement('span');
    textEl.className = 'text';
    textEl.textContent = msg.text;
    div.appendChild(timeEl);
    div.appendChild(textEl);
    logs.appendChild(div);
    while (logs.childNodes.length > AConsole.maxMessages) {
      logs.removeChild(logs.firstChild);
    }
    logs.scrollTop = logs.scrollHeight;
  }

  function renderAll() {
    const logs = document.getElementById('admin-console-logs');
    if (!logs) return;
    logs.innerHTML = '';
    AConsole.messages.forEach(appendToDOM);
    logs.scrollTop = logs.scrollHeight;
  }

  // ---------- 面板控制 ----------
  function toggleConsole() {
    AConsole.visible = !AConsole.visible;
    const panel = document.getElementById('admin-console-panel');
    if (!panel) return;
    if (AConsole.visible) {
      panel.classList.add('visible');
      renderAll();
      setTimeout(() => {
        const input = document.getElementById('admin-console-cmd');
        if (input && window.innerWidth > 640) input.focus();
      }, 220);
    } else {
      panel.classList.remove('visible');
    }
  }

  function clearConsole() {
    AConsole.messages = [];
    const logs = document.getElementById('admin-console-logs');
    if (logs) logs.innerHTML = '';
  }

  function executeCommand(code) {
    push('info', ['> ' + code]);
    try {
      const result = (0, eval)(code);
      if (result && typeof result.then === 'function') {
        result.then(
          v => push('log', ['←', v]),
          err => push('error', ['✗ ' + (err && err.message ? err.message : String(err))])
        );
      } else {
        push('log', ['←', result]);
      }
    } catch (err) {
      push('error', ['✗ ' + err.message]);
    }
  }

  // ---------- 初始化 UI ----------
  function initAdminConsole() {
    if (document.getElementById('admin-console-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'admin-console-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '控制台');
    btn.textContent = '⌘';
    btn.style.display = 'none';
    btn.addEventListener('click', toggleConsole);
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'admin-console-panel';
    panel.innerHTML = `
      <div class="admin-console-header">
        <span>控制台</span>
        <button type="button" data-act="clear">清空</button>
        <button type="button" data-act="close">×</button>
      </div>
      <div class="admin-console-logs" id="admin-console-logs"></div>
      <div class="admin-console-input">
        <span>&gt;</span>
        <input type="text" id="admin-console-cmd"
               placeholder="输入 JS 并回车执行"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('[data-act="clear"]').addEventListener('click', clearConsole);
    panel.querySelector('[data-act="close"]').addEventListener('click', toggleConsole);

    const cmdInput = panel.querySelector('#admin-console-cmd');
    cmdInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const code = cmdInput.value.trim();
        if (!code) return;
        cmdInput.value = '';
        executeCommand(code);
      }
    });

    updateAdminConsole();
  }

  // ---------- 可见性 ----------
  function updateAdminConsole() {
    let isAdmin = false;
    try {
      isAdmin = typeof state !== 'undefined'
        && state.currentUser
        && state.currentUser.data
        && state.currentUser.data.role === 'admin';
    } catch (e) {}

    AConsole.enabled = !!isAdmin;
    const btn = document.getElementById('admin-console-btn');
    if (btn) btn.style.display = isAdmin ? 'flex' : 'none';

    if (!isAdmin && AConsole.visible) toggleConsole();
  }

  window.initAdminConsole = initAdminConsole;
  window.updateAdminConsole = updateAdminConsole;
  window.toggleAdminConsole = toggleConsole;
})();