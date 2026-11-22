// Monster-Hüpfen: Jump and Run nur zum Spaß. Schreibt nichts in die Lernstatistik.
// Retro-Pixel-Look: Die Welt wird in niedriger Auflösung (1 Einheit = 1 Pixel) gezeichnet
// und mit ganzzahligem Faktor ohne Glättung hochskaliert. Welt 144 px hoch, Boden bei y = 120.

import { makeBaker, drawDigits, numWidth } from './pixel.js';

const WORLD_H = 144;
const GROUND = 120;
const GRAVITY = 420;                         // px/s²
const JUMP_V = Math.sqrt(2 * GRAVITY * 60);  // volle Sprunghöhe ca. 60 px (Monster: 16 px)
const MIN_V = Math.sqrt(2 * GRAVITY * 40);   // kurzes Tippen: mindestens ca. 40 px, reicht sicher über ein Monster
const PX = 20;                               // x-Position der Figur
const HIT = { pl: 3, pr: 13 };               // Hitbox der Figur relativ zum Sprite
const MW = 16, MH = 16;                      // Monster-Sprite
const PIXEL_FONT = '"Press Start 2P", monospace';

const PAL = {
  k: '#000000', w: '#fcfcfc', p: '#ff9cbf', P: '#e4407a', y: '#f8b800', o: '#c86c00',
  b: '#c84c0c', l: '#fcbcb0', s: '#5c94fc', c: '#a4e4fc', g: '#00a800', G: '#005800', B: '#3cbcfc',
  r: '#e40058',
};

/* ---------- Sprites als Pixelkarten ---------- */
const AXO_TOP = [
  '..........P.P...',
  '.........P.P.P..',
  '........kkkkkk..',
  '.......kppppppk.',
  '.......kppppwek.',
  'kk.....kpppppppk',
  'kpkkkkkkpppkkppk',
  '.kppppppppppppk.',
  '..kpppppppppppk.',
  '...kppppppppkk..',
  '...kkkkkkkkk....',
];
const AXO = [
  AXO_TOP.concat(['....kp...kp.....', '....kk...kk.....']),
  AXO_TOP.concat(['.....kp.kp......', '.....kk.kk......']),
];
const AXO_JUMP = AXO_TOP.concat(['...kpk..kpk.....', '................']);

const MON_BODY = [
  '.....kkkkkk.....',
  '...kkyyyyyykk...',
  '..kykkyyyykkyk..',
  '.kyyykyyyykyyyk.',
  '.kyywwyyyywwyyk.',
  'kyyywkyyyykwyyyk',
  'kyyyyyyyyyyyyyyk',
  'kyywwwwwwwwwwyyk',
  'kyywwwwwwwwwwyyk',
  'kyywwwwwwwwwwyyk',
  'kyywwwwwwwwwwyyk',
  'kyywwwwwwwwwwyyk',
  'kyyyyyyyyyyyyyyk',
  '.kyyyyyyyyyyyyk.',
  '..kkkkkkkkkkkk..',
];
const MON = [MON_BODY.concat(['.kkk........kkk.']), MON_BODY.concat(['..kkk......kkk..'])];
const MON_SQUISH = [
  '....kkkkkkkk....',
  '..kkyyyyyyyykk..',
  '.kyykyyyyyykyyk.',
  'kyyyyyyyyyyyyyyk',
  '.kkkkkkkkkkkkkk.',
];
const COIN = [
  ['.kkkk.', 'kyyyyk', 'kywyyk', 'kywyyk', 'kywyyk', 'kywyyk', 'kyyyyk', '.kkkk.'],
  ['..kk..', '.kyyk.', '.kwyk.', '.kwyk.', '.kwyk.', '.kwyk.', '.kyyk.', '..kk..'],
  ['..kk..', '..kk..', '..kk..', '..kk..', '..kk..', '..kk..', '..kk..', '..kk..'],
];
const HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const HEART_EMPTY = HEART.map(r => r.replace(/[rw]/g, 'l'));
const CLOUD = [
  '..........kkkk..........',
  '........kkwwwwkk........',
  '...kkkkkwwwwwwwwk.......',
  '..kwwwwwwwwwwwwwwkkkk...',
  '.kwwwwwwwwwwwwwwwwwwwk..',
  'kwwwwwwwwwwwwwwwwwwwwwk.',
  'kwwwccwwwwwwwwwwwcwwwwwk',
  '.kwccccwwwwccwwwcccwwwk.',
  '..kkkkkkkkkkkkkkkkkkkkk.',
];
const BUSH = [
  '.....kkkk.......',
  '...kkggggk.kkk..',
  '..kgggggggkgggk.',
  '.kggggGgggggggGk',
  'kggggggggGgggggk',
];
const bake = makeBaker(PAL);

const CHEERS = ['ZACK!', 'BÄMM!', 'PLOPP!', 'STARK!', 'PLATT!'];
const OUCH = ['AUTSCH!', 'NOPE!', 'HOPPLA!', 'UFF!'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} root  Container, wird gefüllt
 * @param {{nextQuestion: () => {tok: Array, ans: number, opts: number[]}, best: number, onBest: (n:number)=>void, onExit: ()=>void}} cfg
 */
export function createRunner(root, cfg) {
  root.innerHTML = `<div class="runner">
    <canvas class="r-canvas" aria-label="Monster-Hüpfen: tippen zum Springen"></canvas>
    <button class="x r-exit" data-r="exit" aria-label="Spiel verlassen"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="r-over" hidden></div>
  </div>`;
  const wrap = root.querySelector('.runner');
  const cv = root.querySelector('canvas');
  const over = root.querySelector('.r-over');
  const ctx = cv.getContext('2d');
  const lc = document.createElement('canvas');   // Low-Res-Puffer
  const lx = lc.getContext('2d');
  let W = 0, H = 0, dpr = 1, s = 1, k = 1, LW = 120, LH = 150, oy = 0;
  let best = cfg.best || 0;
  let raf = 0, last = 0, alive = true;
  let G;

  function resize() {
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);
    cv.width = Wd; cv.height = Hd;
    s = Math.max(1, Math.floor(Math.min(Hd / 150, Wd / 108)));  // ganzzahlige Skalierung
    k = s / dpr;                                                // CSS-px pro Weltpixel
    LW = Math.ceil(Wd / s); LH = Math.ceil(Hd / s);
    lc.width = LW; lc.height = LH;
    oy = LH - WORLD_H;
  }

  function reset() {
    G = {
      state: 'ready', t: 0, speed: 34, scroll: 0, coins: 0, hearts: 3, combo: 0, stomps: 0,
      wave: null, cooldown: 0.6, banner: null, mons: [], parts: [], pops: [], shake: 0, inv: 0, overT: 0,
      p: { y: GROUND, vy: 0, ground: true, coyote: 0, buffer: 0, held: false, cut: true, run: 0 },
    };
    over.hidden = true;
  }

  /* ---------- Spielablauf ---------- */
  function spawnWave() {
    const q = cfg.nextQuestion();
    const air = (2 * JUMP_V) / GRAVITY;
    const gap = G.speed * air * 1.2 + MW;
    const wave = { q, resolved: false };
    G.mons = G.mons.filter(m => m.state !== 'walk');
    q.opts.forEach((val, i) => G.mons.push({ x: LW + 6 + i * gap, val, correct: val === q.ans, state: 'walk', t: Math.random() * 6, wave }));
    G.wave = wave;
  }

  function resolve(ok, msg, sub) {
    const w = G.wave;
    if (!w || w.resolved) return;
    w.resolved = true;
    for (const m of G.mons) if (m.wave === w && m.state === 'walk') { m.state = 'flee'; m.t = 0; }
    G.banner = { ok, text: msg, sub, t: ok ? 0.9 : 1.8 };
    G.cooldown = ok ? 0.5 : 1.0;
  }

  const solution = q => q.tok.map(t => (t === null ? q.ans : t)).join(' ');

  function stomp(m) {
    const p = G.p;
    p.vy = -JUMP_V * 0.72; p.cut = true; p.y = GROUND - MH + 1;
    if (m.correct) {
      m.state = 'squish'; m.t = 0;
      G.combo++; G.stomps++;
      const gain = 1 + Math.floor(G.combo / 3);
      G.coins += gain;
      burst(m.x + MW / 2, GROUND - MH, gain + 3);
      G.pops.push({ x: m.x + MW / 2, y: GROUND - MH - 6, text: `+${gain}`, t: 0 });
      resolve(true, pick(CHEERS), G.combo >= 3 ? `${G.combo}ER-KETTE` : '');
      buzz(10);
    } else {
      m.state = 'poof'; m.t = 0;
      hurt();
      resolve(false, solution(m.wave.q), `${pick(OUCH)} RICHTIG WÄRE:`);
    }
  }

  function hurt() {
    G.hearts--; G.combo = 0; G.inv = 1.2;
    if (!reduceMotion()) G.shake = 0.3;
    buzz([30, 40, 30]);
    if (G.hearts <= 0) { G.state = 'dying'; G.overT = 1.1; G.p.vy = -JUMP_V * 0.8; }
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const v = 70 + Math.random() * 50;
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.9 + Math.random() * 0.4 });
    }
  }

  function buzz(pat) { try { navigator.vibrate && navigator.vibrate(pat); } catch { /* nicht unterstützt */ } }

  function update(dt) {
    const p = G.p;
    if (G.state === 'run') {
      G.t += dt;
      G.speed = Math.min(50, 34 + G.t * 0.12);
      G.scroll += G.speed * dt;
      p.run += dt * 8;
    }
    if (G.state === 'dying') {
      p.vy += GRAVITY * dt; p.y += p.vy * dt;
      G.overT -= dt;
      if (G.overT <= 0) gameOver();
    }
    if (G.state !== 'run') { stepParticles(dt); return; }

    // Springen mit Puffer und Coyote-Zeit
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && (p.ground || p.coyote > 0)) {
      p.vy = -JUMP_V; p.ground = false; p.coyote = 0; p.buffer = 0; p.cut = false;
    }
    if (!p.held && p.vy < 0 && !p.cut) { p.vy = Math.max(p.vy, -MIN_V); p.cut = true; }
    const prevY = p.y;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.ground = true; p.coyote = 0.08; }
    else p.ground = false;
    G.inv = Math.max(0, G.inv - dt);
    G.shake = Math.max(0, G.shake - dt);

    // Monster bewegen und Kollisionen prüfen
    for (const m of G.mons) {
      m.t += dt;
      if (m.state === 'walk') m.x -= (G.speed + 4) * dt;
      else if (m.state === 'flee') m.x -= (G.speed - 120) * dt;
      else m.x -= G.speed * dt;

      if (m.state !== 'walk') continue;
      const overlapX = PX + HIT.pr > m.x + 3 && PX + HIT.pl < m.x + MW - 3;
      if (!overlapX) continue;
      const top = GROUND - MH + 1;
      if (p.vy > 0 && prevY <= top + 4 && p.y >= top) stomp(m);
      else if (p.y > top + 4 && G.inv <= 0) {
        m.state = 'poof'; m.t = 0;
        hurt();
        resolve(false, solution(m.wave.q), `${pick(OUCH)} RICHTIG WÄRE:`);
      }
    }
    // Verpasst: alle Monster der Welle hinter der Figur
    const w = G.wave;
    if (w && !w.resolved) {
      const rest = G.mons.filter(m => m.wave === w && m.state === 'walk');
      if (rest.every(m => m.x + MW < PX)) {
        G.combo = 0;
        resolve(false, solution(w.q), 'VERPASST! RICHTIG WÄRE:');
      }
    }
    G.mons = G.mons.filter(m => m.x > -30 && m.x < LW + 300 && !((m.state === 'squish' || m.state === 'poof') && m.t > 0.6));

    if (!G.wave || G.wave.resolved) {
      G.cooldown -= dt;
      if (G.cooldown <= 0 && G.state === 'run') spawnWave();
    }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    stepParticles(dt);
  }

  function stepParticles(dt) {
    for (const q of G.parts) { q.t += dt; q.vy += 260 * dt; q.x += (q.vx - G.speed * 0.3) * dt; q.y += q.vy * dt; }
    G.parts = G.parts.filter(q => q.t < q.life);
    for (const q of G.pops) { q.t += dt; q.y -= 20 * dt; }
    G.pops = G.pops.filter(q => q.t < 0.9);
  }

  function gameOver() {
    G.state = 'over';
    const record = G.coins > best;
    if (record) { best = G.coins; cfg.onBest(best); }
    over.innerHTML = `<div class="r-card">
      <h2>${record && G.coins > 0 ? 'NEUER REKORD!' : 'GAME OVER'}</h2>
      <div class="tiles">
        <div class="stat"><b>${G.coins}</b><span>Münzen</span></div>
        <div class="stat"><b>${best}</b><span>Bestwert</span></div>
        <div class="stat"><b>${G.stomps}</b><span>Monster geplättet</span></div>
        <div class="stat"><b>${Math.round(G.scroll / 16)} m</b><span>gelaufen</span></div>
      </div>
      <p class="small">Nur zum Spaß: Das zählt nicht für Album und Statistik.</p>
      <div class="btns"><button class="btn" data-r="exit">Zurück</button><button class="btn primary" data-r="again">Nochmal</button></div>
    </div>`;
    over.hidden = false;
  }

  /* ---------- Zeichnen (Low-Res) ---------- */
  const R = Math.round;
  const put = (img, x, y) => lx.drawImage(img, R(x), R(y));

  const drawNum = (str, x, y, color, scale = 1) => drawDigits(lx, bake, str, x, y, color, scale);

  function drawWorld() {
    lx.imageSmoothingEnabled = false;
    lx.fillStyle = PAL.s;
    lx.fillRect(0, 0, LW, LH);
    lx.save();
    let sx = 0, sy = 0;
    if (G.shake > 0) { sx = R((Math.random() - 0.5) * 4); sy = R((Math.random() - 0.5) * 4); }
    lx.translate(sx, oy + sy);

    // Wolken (langsam)
    const cloud = bake(CLOUD);
    const cs = G.scroll * 0.25;
    for (let i = -1; i < LW / 70 + 2; i++) put(cloud, i * 70 - (cs % 70), 18 + ((i + 10) % 3) * 12 - (oy > 40 ? 20 : 0));

    // Hügel (mittel)
    const hs = G.scroll * 0.5;
    for (let i = -1; i < LW / 90 + 2; i++) {
      const cx = R(i * 90 - (hs % 90) + 40), hh = i % 2 ? 34 : 22, hw = i % 2 ? 40 : 30;
      for (let x = -hw; x <= hw; x++) {
        const h = R(hh * Math.sqrt(1 - (x / hw) ** 2));
        if (h <= 0) continue;
        lx.fillStyle = PAL.G;
        lx.fillRect(cx + x, GROUND - h, 1, h);
        lx.fillStyle = PAL.g;
        lx.fillRect(cx + x, GROUND - h + 1, 1, h - 1);
      }
      lx.fillStyle = PAL.G;
      lx.fillRect(cx - 6, GROUND - hh + 10, 1, 3); lx.fillRect(cx + 5, GROUND - hh + 12, 1, 3);
    }
    // Büsche (Bodenebene)
    const bush = bake(BUSH);
    for (let i = -1; i < LW / 110 + 2; i++) put(bush, i * 110 - (G.scroll % 110) + 60, GROUND - 5);

    // Ziegelboden
    const ts = R(G.scroll) % 16;
    for (let x = -ts; x < LW + 16; x += 16) {
      for (let y = GROUND; y < WORLD_H; y += 16) brick(x, y);
    }

    for (const m of G.mons) drawMonster(m);
    drawPlayer();
    drawParticles();
    lx.restore();
    drawHudPixels();
  }

  function brick(x, y) {
    lx.fillStyle = PAL.b; lx.fillRect(x, y, 16, 16);
    lx.fillStyle = PAL.l;
    lx.fillRect(x, y + 1, 15, 1); lx.fillRect(x, y + 9, 15, 1);
    lx.fillRect(x + 1, y + 1, 1, 7); lx.fillRect(x + 9, y + 9, 1, 7);
    lx.fillStyle = PAL.k;
    lx.fillRect(x, y, 16, 1); lx.fillRect(x, y + 8, 16, 1);
    lx.fillRect(x + 15, y, 1, 8); lx.fillRect(x + 7, y + 8, 1, 8);
  }

  function drawPlayer() {
    const p = G.p;
    if (G.inv > 0 && Math.floor(G.inv * 12) % 2 === 0 && G.state === 'run') return;
    const map = !p.ground || G.state !== 'run' ? AXO_JUMP : AXO[Math.floor(p.run) % 2];
    const img = bake(map);
    const y = p.y - map.length;
    if (G.state === 'dying' || G.state === 'over') {
      lx.save(); lx.translate(R(PX), R(y + map.length)); lx.scale(1, -1); lx.drawImage(img, 0, 0); lx.restore();
    } else put(img, PX, y);
  }

  function drawMonster(m) {
    const top = GROUND - MH;
    if (m.state === 'poof') {
      if (m.t >= 0.5) return;
      const r = 2 + R(m.t * 18);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + m.t * 4;
        const px = R(m.x + MW / 2 + Math.cos(a) * r), py = R(top + 8 + Math.sin(a) * r * 0.7);
        lx.fillStyle = PAL.w; lx.fillRect(px - 1, py - 1, 3, 3);
        lx.fillStyle = PAL.c; lx.fillRect(px, py, 1, 1);
      }
      return;
    }
    if (m.state === 'squish') { put(bake(MON_SQUISH), m.x, GROUND - MON_SQUISH.length); return; }
    const frame = Math.floor(m.t * 6) % 2;
    const flee = m.state === 'flee';
    put(bake(MON[frame], flee), m.x, top + (flee && frame ? -1 : 0));
    if (flee) {
      lx.fillStyle = PAL.B;
      lx.fillRect(R(m.x) - 2, top + 3, 1, 2); lx.fillRect(R(m.x) - 3, top + 4, 1, 1);
    } else {
      const str = String(m.val);
      drawNum(str, R(m.x + (MW - numWidth(str)) / 2), top + 7, PAL.k);
    }
  }

  function drawParticles() {
    for (const q of G.parts) put(bake(COIN[Math.floor(q.t * 12) % 3]), q.x - 3, q.y - 4);
    for (const q of G.pops) drawNum(q.text, R(q.x - numWidth(q.text) / 2), R(q.y), PAL.w);
  }

  function drawHudPixels() {
    // Herzen rechts neben dem Schließen-Knopf, Münzen rechts oben
    const hx = Math.ceil(58 / k), hy = Math.max(3, Math.round(24 / k) - 3);
    for (let i = 0; i < 3; i++) put(bake(i < G.hearts ? HEART : HEART_EMPTY), hx + i * 9, hy);
    const str = String(G.coins);
    const nw = numWidth(str, 2);
    drawNum(str, LW - 4 - nw, hy - 1, PAL.w, 2);
    put(bake(COIN[0]), LW - 4 - nw - 9, hy);
  }

  /* ---------- Zeichnen (Text in voller Auflösung) ---------- */
  function text(str, x, y, size, color) {
    ctx.font = `${size}px ${PIXEL_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sh = Math.max(2, Math.round(size / 8));
    ctx.fillStyle = '#000'; ctx.fillText(str, x + sh, y + sh);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  // Größte Pixelschrift (Vielfaches von 8 Weltpixeln, wenn möglich), die in die Breite passt
  function fitSize(str, maxW, maxSize) {
    const n = Math.floor(maxW / (str.length * k * 8));
    if (n >= 1) return Math.min(maxSize, n * k * 8);
    return Math.max(8, Math.floor(maxW / str.length));
  }

  function draw() {
    drawWorld();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lc, 0, 0, LW * s, LH * s);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const qy = Math.max(84, (oy * k) * 0.42 + 40);
    const w = G.wave, b = G.banner;
    if (b) {
      if (b.sub) text(b.sub, W / 2, qy - 34, fitSize(b.sub, W * 0.92, 14), '#fcfcfc');
      text(b.text, W / 2, qy, fitSize(b.text, W * 0.9, 48), b.ok ? '#b8f818' : '#fc7460');
    } else if (w && !w.resolved) {
      const q = w.q.tok.map(t => (t === null ? '?' : t)).join(' ');
      text(q, W / 2, qy, fitSize(q, W * 0.9, 48), '#fcfcfc');
    }
    if (G.state === 'ready' || G.state === 'paused') drawIntro();
  }

  function drawIntro() {
    const top = Math.max(110, H * 0.24);
    const title = 'MONSTER-HÜPFEN';
    text(title, W / 2, top, fitSize(title, W * 0.92, 32), '#fcfcfc');
    const lines = G.state === 'paused'
      ? ['PAUSE']
      : ['SPRING AUF DAS MONSTER', 'MIT DER RICHTIGEN ZAHL.', 'ÜBER DIE ANDEREN', 'SPRINGST DU DRÜBER.', 'LANGE DRÜCKEN = HÖHER'];
    const ls = Math.min(...lines.map(l => fitSize(l, W * 0.9, 12)));
    lines.forEach((l, i) => text(l, W / 2, top + 44 + i * (ls + 10), ls, '#fcfcfc'));
    const cta = G.state === 'paused' ? 'TIPPEN ZUM WEITERSPIELEN' : 'TIPPEN ZUM STARTEN';
    if (Math.floor(performance.now() / 500) % 2 === 0 || reduceMotion()) {
      text(cta, W / 2, top + 60 + lines.length * (ls + 10), fitSize(cta, W * 0.9, 16), '#f8b800');
    }
  }

  /* ---------- Steuerung ---------- */
  function press() {
    if (G.state === 'ready' || G.state === 'paused') { G.state = 'run'; return; }
    if (G.state !== 'run') return;
    G.p.buffer = 0.12; G.p.held = true;
  }
  function release() { if (G) G.p.held = false; }

  function onDown(e) {
    if (e.target.closest('[data-r]') || !over.hidden) return;
    e.preventDefault();
    press();
  }
  function onKey(e) {
    if (e.code === 'Space' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.type === 'keydown') { if (!e.repeat) press(); } else release();
    }
    if (e.key === 'Escape' && e.type === 'keydown') cfg.onExit();
  }
  function onClick(e) {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    if (b.dataset.r === 'exit') cfg.onExit();
    if (b.dataset.r === 'again') { reset(); G.state = 'run'; }
  }
  function onVis() { if (document.hidden && G.state === 'run') G.state = 'paused'; }

  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  wrap.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  wrap.addEventListener('click', onClick);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);

  resize();
  reset();
  if (document.fonts && document.fonts.load) document.fonts.load(`16px ${PIXEL_FONT}`).catch(() => {});
  raf = requestAnimationFrame(t => { last = t; frame(t); });

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
