// ==================== audio.js — 轻音效 ====================

const AudioState = {
  enabled: true,
  ctx: null,
  master: null,
};

function initAudio() {
  try {
    const saved = localStorage.getItem('tw_sound');
    AudioState.enabled = saved !== '0';
  } catch (e) {}
  const toggle = document.getElementById('sound-toggle');
  if (toggle) toggle.checked = AudioState.enabled;

  const unlock = () => {
    if (!AudioState.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          AudioState.ctx = new AC();
          AudioState.master = AudioState.ctx.createGain();
          AudioState.master.gain.value = 0.35;
          AudioState.master.connect(AudioState.ctx.destination);
        }
      } catch (e) {}
    } else if (AudioState.ctx.state === 'suspended') {
      AudioState.ctx.resume();
    }
  };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
}

function setSoundEnabled(v) {
  AudioState.enabled = !!v;
  try { localStorage.setItem('tw_sound', v ? '1' : '0'); } catch (e) {}
  if (v) playSound('tab');
}

function toggleSound(v) { setSoundEnabled(v); }

function makeTone(opts) {
  const ctx = AudioState.ctx;
  if (!ctx) return;
  const {
    type = 'sine',
    from = 600,
    to = null,
    start = 0,
    attack = 0.003,
    hold = 0.01,
    release = 0.06,
    peak = 0.2,
  } = opts;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(AudioState.master);
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to && to !== from) {
    osc.frequency.exponentialRampToValueAtTime(to, t0 + attack + hold + release);
  }
  const g = gain.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.setValueAtTime(peak, t0 + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  osc.start(t0);
  osc.stop(t0 + attack + hold + release + 0.05);
}

function playSound(type) {
  if (!AudioState.enabled) return;
  const ctx = AudioState.ctx;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  switch (type) {
    case 'click':
      makeTone({ type: 'sine', from: 720, to: 480, attack: 0.002, hold: 0.01, release: 0.05, peak: 0.25 });
      break;
    case 'tab':
      makeTone({ type: 'triangle', from: 520, to: 760, attack: 0.004, hold: 0.02, release: 0.06, peak: 0.2 });
      break;
    case 'open':
      makeTone({ type: 'sine', from: 420, to: 700, attack: 0.006, hold: 0.03, release: 0.1, peak: 0.22 });
      break;
    case 'close':
      makeTone({ type: 'sine', from: 600, to: 360, attack: 0.004, hold: 0.015, release: 0.08, peak: 0.18 });
      break;
    case 'fav':
      makeTone({ type: 'sine', from: 660, to: 760, attack: 0.003, hold: 0.02, release: 0.08, peak: 0.22 });
      makeTone({ type: 'sine', from: 880, to: 1000, start: 0.07, attack: 0.003, hold: 0.02, release: 0.08, peak: 0.18 });
      break;
    case 'error':
      makeTone({ type: 'square', from: 220, to: 140, attack: 0.004, hold: 0.03, release: 0.1, peak: 0.14 });
      break;
  }
}