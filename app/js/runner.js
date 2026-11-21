// Monster-Hüpfen: Jump and Run nur zum Spaß. Schreibt nichts in die Lernstatistik.
// Welt in Einheiten u (mindestens 75 u breit, damit Monster früh sichtbar sind); Boden bei y = 82.
// Die Welt sitzt unten im Canvas, darüber ist Himmel. Die Figur läuft automatisch, Tippen springt.

const GROUND = 82;
const GRAVITY = 320;               // u/s²
const JUMP_V = Math.sqrt(2 * GRAVITY * 28);
const CUT = 0.45;                  // Sprung abkürzen beim Loslassen
const PLAYER = { x: 14, w: 8, h: 9 };
const MON = { w: 9.5, h: 9.5 };
const COL = {
  paper: '#f2eee4', paper2: '#e8e1d1', ink: '#1e2a66', soft: '#5d6596', pink: '#ff4a8d',
  mint: '#0f9e83', sun: '#ffbf1f', gold: '#f2b705', axo: '#ff9cbf', axoDark: '#e9608f', white: '#fff',
};
const CHEERS = ['Zack!', 'Bämm!', 'Plopp!', 'Volltreffer!', 'Stark!', 'Platt!'];
const OUCH = ['Autsch!', 'Nope!', 'Hoppla!', 'Uff!'];
const FONT = '"Dela Gothic One", "Arial Black", sans-serif';

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
  let W = 0, H = 0, u = 1, Wu = 75, oy = 0;
  let best = cfg.best || 0;
  let raf = 0, last = 0, alive = true;
  let G;

  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = r.width; H = r.height; u = Math.min(H / 100, W / 75); Wu = W / u; oy = H - 100 * u;
  }

  function reset() {
    G = {
      state: 'ready', t: 0, speed: 30, scroll: 0, coins: 0, hearts: 3, combo: 0, stomps: 0,
      wave: null, cooldown: 0.6, banner: null, mons: [], parts: [], pops: [], shake: 0, inv: 0, overT: 0,
      p: { y: GROUND, vy: 0, ground: true, coyote: 0, buffer: 0, held: false, cut: true, run: 0 },
    };
    over.hidden = true;
  }

  /* ---------- Spielablauf ---------- */
  function spawnWave() {
    const q = cfg.nextQuestion();
    const opts = q.opts.slice();
    const air = (2 * JUMP_V) / GRAVITY;
    const gap = G.speed * air * 1.2 + MON.w;
    const wave = { q, resolved: false };
    G.mons = G.mons.filter(m => m.state !== 'walk');
    opts.forEach((val, i) => G.mons.push({ x: Wu + 4 + i * gap, val, correct: val === q.ans, state: 'walk', t: Math.random() * 6, wave }));
    G.wave = wave;
  }

  function resolve(ok, text, sub) {
    const w = G.wave;
    if (!w || w.resolved) return;
    w.resolved = true;
    for (const m of G.mons) if (m.wave === w && m.state === 'walk') { m.state = 'flee'; m.t = 0; }
    G.banner = { ok, text, sub, t: ok ? 0.9 : 1.8 };
    G.cooldown = ok ? 0.5 : 1.0;
  }

  const solution = q => q.tok.map(t => (t === null ? q.ans : t)).join(' ');

  function stomp(m) {
    const p = G.p;
    p.vy = -JUMP_V * 0.72; p.cut = true; p.y = GROUND - MON.h;
    if (m.correct) {
      m.state = 'squish'; m.t = 0;
      G.combo++; G.stomps++;
      const gain = 1 + Math.floor(G.combo / 3);
      G.coins += gain;
      burst(m.x + MON.w / 2, GROUND - MON.h, gain + 3);
      G.pops.push({ x: m.x + MON.w / 2, y: GROUND - MON.h - 4, text: `+${gain}`, t: 0 });
      resolve(true, pick(CHEERS), G.combo >= 3 ? `${G.combo}er-Kette` : '');
      buzz(10);
    } else {
      m.state = 'poof'; m.t = 0;
      hurt();
      resolve(false, solution(m.wave.q), pick(OUCH) + ' Richtig wäre:');
    }
  }

  function hurt() {
    G.hearts--; G.combo = 0; G.inv = 1.2;
    if (!reduceMotion()) G.shake = 0.3;
    buzz([30, 40, 30]);
    if (G.hearts <= 0) { G.state = 'dying'; G.overT = 1.1; }
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 40 + Math.random() * 35;
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.9 + Math.random() * 0.4 });
    }
  }

  function buzz(pat) { try { navigator.vibrate && navigator.vibrate(pat); } catch { /* nicht unterstützt */ } }

  function update(dt) {
    const p = G.p;
    if (G.state === 'run' || G.state === 'dying') {
      G.t += dt;
      if (G.state === 'run') G.speed = Math.min(46, 30 + G.t * 0.2);
      G.scroll += G.speed * dt;
      p.run += dt * G.speed * 0.35;
    }
    if (G.state !== 'run') {
      if (G.state === 'dying') {
        G.overT -= dt;
        if (G.overT <= 0) gameOver();
      }
      stepParticles(dt);
      return;
    }

    // Springen mit Puffer und Coyote-Zeit
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && (p.ground || p.coyote > 0)) {
      p.vy = -JUMP_V; p.ground = false; p.coyote = 0; p.buffer = 0; p.cut = false;
    }
    if (!p.held && p.vy < 0 && !p.cut) { p.vy *= CUT; p.cut = true; }
    const prevY = p.y;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) {
      p.y = GROUND; p.vy = 0;
      if (!p.ground) p.coyote = 0;
      p.ground = true; p.coyote = 0.08;
    } else if (p.ground) {
      p.ground = false;
    }
    G.inv = Math.max(0, G.inv - dt);
    G.shake = Math.max(0, G.shake - dt);

    // Monster bewegen und Kollisionen prüfen
    for (const m of G.mons) {
      m.t += dt;
      if (m.state === 'walk') m.x -= (G.speed + 6) * dt;
      else if (m.state === 'flee') m.x -= (G.speed - 75) * dt;
      else m.x -= G.speed * dt;

      if (m.state !== 'walk') continue;
      const overlapX = PLAYER.x + PLAYER.w - 1.2 > m.x + 1 && PLAYER.x + 1.2 < m.x + MON.w - 1;
      if (!overlapX) continue;
      const top = GROUND - MON.h;
      if (p.vy > 0 && prevY <= top + 2.5 && p.y >= top) stomp(m);
      else if (p.y > top + 2.5 && G.inv <= 0) {
        m.state = 'poof'; m.t = 0;
        hurt();
        resolve(false, solution(m.wave.q), pick(OUCH) + ' Richtig wäre:');
      }
    }
    // Verpasst: alle Monster der Welle hinter der Figur
    const w = G.wave;
    if (w && !w.resolved) {
      const rest = G.mons.filter(m => m.wave === w && m.state === 'walk');
      if (rest.every(m => m.x + MON.w < PLAYER.x - 1)) {
        G.combo = 0;
        resolve(false, solution(w.q), 'Verpasst! Richtig wäre:');
      }
    }
    G.mons = G.mons.filter(m => m.x > -20 && m.x < Wu + 60 && !((m.state === 'squish' || m.state === 'poof') && m.t > 0.6));

    if (!G.wave || G.wave.resolved) {
      G.cooldown -= dt;
      if (G.cooldown <= 0 && G.state === 'run') spawnWave();
    }
    if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
    stepParticles(dt);
  }

  function stepParticles(dt) {
    for (const q of G.parts) { q.t += dt; q.vy += 140 * dt; q.x += (q.vx - G.speed * 0.3) * dt; q.y += q.vy * dt; }
    G.parts = G.parts.filter(q => q.t < q.life);
    for (const q of G.pops) { q.t += dt; q.y -= 14 * dt; }
    G.pops = G.pops.filter(q => q.t < 0.9);
  }

  function gameOver() {
    G.state = 'over';
    const record = G.coins > best;
    if (record) { best = G.coins; cfg.onBest(best); }
    over.innerHTML = `<div class="r-card">
      <h2>${record && G.coins > 0 ? 'Neuer Rekord!' : 'Game over'}</h2>
      <div class="tiles">
        <div class="stat"><b>${G.coins}</b><span>Münzen</span></div>
        <div class="stat"><b>${best}</b><span>Bestwert</span></div>
        <div class="stat"><b>${G.stomps}</b><span>Monster geplättet</span></div>
        <div class="stat"><b>${Math.round(G.t * G.speed / 10)} m</b><span>gelaufen</span></div>
      </div>
      <p class="small">Nur zum Spaß: Das zählt nicht für Album und Statistik.</p>
      <div class="btns"><button class="btn" data-r="exit">Zurück</button><button class="btn primary" data-r="again">Nochmal</button></div>
    </div>`;
    over.hidden = false;
  }

  /* ---------- Zeichnen ---------- */
  const X = v => v * u;

  function draw() {
    ctx.fillStyle = COL.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(0, oy);
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    drawBackground();
    for (const m of G.mons) drawMonster(m);
    drawPlayer();
    drawParticles();
    ctx.restore();
    drawHud();
    if (G.state === 'ready' || G.state === 'paused') drawIntro();
  }

  function drawBackground() {
    // Hügel (langsame Ebene)
    ctx.fillStyle = COL.paper2;
    const hs = G.scroll * 0.25;
    for (let i = -1; i < Wu / 30 + 2; i++) {
      const cx = i * 30 - (hs % 30) + 15;
      ctx.beginPath();
      ctx.ellipse(X(cx), X(GROUND), X(16), X(i % 2 ? 14 : 10), 0, Math.PI, 0);
      ctx.fill();
    }
    // Wolken mit Riso-Versatz
    const cs = G.scroll * 0.4;
    for (let i = -1; i < Wu / 40 + 2; i++) {
      const cx = i * 40 - (cs % 40) + 20, cy = 24 + (i % 3) * 7;
      cloud(cx + 0.7, cy + 0.6, COL.pink);
      cloud(cx, cy, COL.white);
    }
    // Boden
    ctx.fillStyle = COL.ink;
    ctx.fillRect(0, X(GROUND), W, X(100 - GROUND) + 2);
    ctx.fillStyle = COL.mint;
    ctx.fillRect(0, X(GROUND), W, X(1.6));
    ctx.strokeStyle = 'rgba(242,238,228,.18)';
    ctx.lineWidth = 1;
    const ts = G.scroll % 8;
    for (let row = 0; row < 3; row++) {
      const y = GROUND + 1.6 + row * 5.5;
      ctx.beginPath();
      ctx.moveTo(0, X(y)); ctx.lineTo(W, X(y));
      for (let x = -ts + (row % 2) * 4; x < Wu + 8; x += 8) { ctx.moveTo(X(x), X(y)); ctx.lineTo(X(x), X(y + 5.5)); }
      ctx.stroke();
    }
  }

  function cloud(cx, cy, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(X(cx), X(cy), X(6), X(2.6), 0, 0, Math.PI * 2);
    ctx.ellipse(X(cx - 3), X(cy + 0.4), X(3.5), X(2.4), 0, 0, Math.PI * 2);
    ctx.ellipse(X(cx + 2.5), X(cy - 1.2), X(3.5), X(2.6), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Axolotl: Körper, Kiemen, Beinchen
  function drawPlayer() {
    const p = G.p;
    if (G.inv > 0 && Math.floor(G.inv * 12) % 2 === 0 && G.state === 'run') return;
    const x = PLAYER.x, top = p.y - PLAYER.h;
    const bob = p.ground && G.state === 'run' ? Math.abs(Math.sin(p.run)) * 0.6 : 0;
    ctx.save();
    ctx.translate(X(x + PLAYER.w / 2), X(top + PLAYER.h / 2 - bob));
    if (G.state === 'dying' || G.state === 'over') ctx.rotate(Math.PI);
    ctx.lineWidth = Math.max(1.5, u * 0.35);
    ctx.strokeStyle = COL.ink;
    // Schwanz
    ctx.fillStyle = COL.axo;
    ctx.beginPath();
    ctx.moveTo(X(-3), X(1)); ctx.quadraticCurveTo(X(-7.5), X(-1 + Math.sin(p.run * 2) * 0.8), X(-6.5), X(2.5)); ctx.lineTo(X(-3), X(3));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Beine
    const leg = p.ground ? Math.sin(p.run * 2) * 1.2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(X(-1.5), X(3.5)); ctx.lineTo(X(-1.5 - leg), X(5));
    ctx.moveTo(X(2), X(3.5)); ctx.lineTo(X(2 + leg), X(5));
    ctx.stroke();
    // Körper
    ctx.beginPath();
    ctx.ellipse(0, X(1.2), X(4), X(3), 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Kopf
    ctx.beginPath();
    ctx.ellipse(X(1.8), X(-2), X(3.6), X(3), 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Kiemen
    ctx.strokeStyle = COL.axoDark;
    ctx.lineWidth = Math.max(2, u * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of [[-2.2, -4.8], [-0.8, -5.6], [0.8, -5.2]]) { ctx.moveTo(X(a + 0.6), X(-3.5)); ctx.lineTo(X(a - 0.6), X(b)); }
    ctx.stroke();
    // Gesicht
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.arc(X(3.2), X(-2.6), X(0.6), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = Math.max(1.2, u * 0.3);
    ctx.beginPath(); ctx.arc(X(3.4), X(-1.3), X(0.9), 0.2, Math.PI - 0.6); ctx.stroke();
    ctx.restore();
  }

  function drawMonster(m) {
    const top = GROUND - MON.h;
    const cx = m.x + MON.w / 2;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, u * 0.35);
    ctx.strokeStyle = COL.ink;
    if (m.state === 'poof') {
      const r = 3 + m.t * 14, a = Math.max(0, 1 - m.t / 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = COL.paper2;
      for (let i = 0; i < 5; i++) {
        const ang = i * 1.256 + m.t * 3;
        ctx.beginPath(); ctx.arc(X(cx + Math.cos(ang) * r * 0.5), X(top + 4 + Math.sin(ang) * r * 0.4), X(2.5), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (m.state === 'squish') {
      ctx.globalAlpha = Math.max(0, 1 - m.t / 0.6);
      ctx.fillStyle = COL.sun;
      ctx.beginPath(); ctx.ellipse(X(cx), X(GROUND - 1.5), X(MON.w / 2 + 1.5), X(1.5), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.ink;
      ctx.font = `${X(2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('x  x', X(cx), X(GROUND - 1.6));
      ctx.restore();
      return;
    }
    const bob = Math.sin(m.t * 10) * 0.5;
    const flip = m.state === 'flee' ? -1 : 1;
    ctx.translate(X(cx), X(top + bob));
    ctx.scale(flip, 1);
    // Füße
    const step = Math.sin(m.t * 12) * 0.8;
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.ellipse(X(-2.4 + step), X(MON.h - 0.3 - bob), X(1.6), X(0.9), 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(X(2.4 - step), X(MON.h - 0.3 - bob), X(1.6), X(0.9), 0, 0, Math.PI * 2); ctx.fill();
    // Körper (Tropfenform)
    ctx.fillStyle = COL.sun;
    ctx.beginPath();
    ctx.moveTo(X(-4.6), X(MON.h - 1));
    ctx.quadraticCurveTo(X(-5.2), X(0.5), X(0), X(0));
    ctx.quadraticCurveTo(X(5.2), X(0.5), X(4.6), X(MON.h - 1));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Augen und Brauen
    ctx.fillStyle = COL.white;
    ctx.beginPath(); ctx.arc(X(-1.6), X(2.8), X(1.2), 0, Math.PI * 2); ctx.arc(X(1.8), X(2.8), X(1.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.ink;
    ctx.beginPath(); ctx.arc(X(-1.9), X(3), X(0.55), 0, Math.PI * 2); ctx.arc(X(1.5), X(3), X(0.55), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    if (m.state === 'flee') { ctx.moveTo(X(-2.8), X(1.2)); ctx.lineTo(X(-0.8), X(1.7)); ctx.moveTo(X(2.8), X(1.2)); ctx.lineTo(X(0.8), X(1.7)); }
    else { ctx.moveTo(X(-2.8), X(1.1)); ctx.lineTo(X(-0.7), X(1.9)); ctx.moveTo(X(3), X(1.1)); ctx.lineTo(X(0.9), X(1.9)); }
    ctx.stroke();
    if (m.state === 'flee') {
      ctx.fillStyle = '#7fc8ff';
      ctx.beginPath(); ctx.ellipse(X(-4.2), X(1.5), X(0.6), X(1), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Zahl auf dem Bauch (nicht gespiegelt)
    if (m.state === 'walk') {
      const fs = String(m.val).length > 2 ? 3.4 : 4.2;
      ctx.font = `${X(fs)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = COL.ink;
      ctx.fillText(String(m.val), X(cx), X(top + bob + 6.6));
    }
  }

  function drawParticles() {
    for (const q of G.parts) {
      const s = Math.abs(Math.cos(q.t * 10));
      ctx.fillStyle = COL.gold; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(X(q.x), X(q.y), X(1.3 * s + 0.2), X(1.3), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const q of G.pops) {
      ctx.globalAlpha = 1 - q.t / 0.9;
      ctx.font = `${X(4)}px ${FONT}`;
      ctx.fillStyle = COL.mint;
      ctx.fillText(q.text, X(q.x), X(q.y));
      ctx.globalAlpha = 1;
    }
  }

  function drawHud() {
    // Herzen (rechts neben dem Schließen-Knopf)
    for (let i = 0; i < 3; i++) heart(64 + i * 28, 30, 11, i < G.hearts);
    // Münzen rechts
    ctx.font = `20px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.ink;
    ctx.fillText(String(G.coins), W - 16, 31);
    const tw = ctx.measureText(String(G.coins)).width;
    ctx.fillStyle = COL.gold; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W - 30 - tw, 30, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Aufgabe oder Rückmeldung
    const w = G.wave, b = G.banner;
    let main = null, sub = null, color = COL.ink, shadow = COL.pink;
    if (b) { main = b.text; sub = b.sub; color = b.ok ? COL.mint : COL.pink; shadow = b.ok ? COL.ink : COL.ink; }
    else if (w && !w.resolved) { main = w.q.tok.map(t => (t === null ? '?' : t)).join(' '); }
    if (!main) return;
    const fs = Math.min(54, W / (main.length * 0.62 + 2));
    const cy = Math.max(96, oy * 0.45 + 40);
    if (sub) {
      ctx.font = '600 15px Figtree, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = COL.soft;
      ctx.fillText(sub, W / 2, cy - fs * 0.75);
    }
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = shadow; ctx.fillText(main, W / 2 + 3, cy + 3);
    ctx.fillStyle = color; ctx.fillText(main, W / 2, cy);
  }

  function heart(cx, cy, s, full) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.8);
    ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.8);
    ctx.fillStyle = full ? COL.pink : COL.paper2;
    ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawIntro() {
    const top = Math.max(70, H * 0.2), lh = 26;
    ctx.fillStyle = 'rgba(242,238,228,.85)';
    ctx.fillRect(0, top - 40, W, 230);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.min(40, W / 9);
    ctx.font = `${fs}px ${FONT}`;
    ctx.fillStyle = COL.pink; ctx.fillText('Monster-Hüpfen', W / 2 + 3, top + 3);
    ctx.fillStyle = COL.ink; ctx.fillText('Monster-Hüpfen', W / 2, top);
    ctx.font = '600 16px Figtree, system-ui, sans-serif';
    ctx.fillStyle = COL.ink;
    const lines = G.state === 'paused'
      ? ['Pause.', 'Tippen zum Weiterspielen']
      : ['Spring auf das Monster mit der richtigen Zahl.', 'Über die anderen springst du drüber.', 'Länger drücken = höher springen.', 'Tippen zum Starten'];
    lines.forEach((l, i) => {
      if (i === lines.length - 1) { ctx.font = `20px ${FONT}`; ctx.fillStyle = COL.pink; }
      ctx.fillText(l, W / 2, top + 46 + i * lh + (i === lines.length - 1 ? 12 : 0));
    });
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
  function onUp() { release(); }
  function onKey(e) {
    if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); if (e.type === 'keydown') { if (!e.repeat) press(); } else release(); }
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
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  wrap.addEventListener('click', onClick);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);

  resize();
  reset();
  if (document.fonts && document.fonts.load) document.fonts.load(`20px ${FONT}`).catch(() => {});
  raf = requestAnimationFrame(t => { last = t; frame(t); });

  return {
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
