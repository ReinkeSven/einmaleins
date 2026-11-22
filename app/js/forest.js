// Wald-Panorama in Pixel-Art. Zeichnet den von forest-model berechneten Wald:
// 10 Haine nebeneinander, Bäume (Malaufgaben) und Blumen (Teilaufgaben), Bewohner, Tag und Nacht.
// Low-Res-Welt (1 Einheit = 1 Pixel), ganzzahlig und ohne Glättung hochskaliert.

import { makeBaker, drawDigits, numWidth, sprite, hash } from './pixel.js';

const WH = 112;                     // Welthöhe
const GY = 86;                      // Fußlinie der Bäume
const SLOT = 13;                    // Baumabstand
const SIGN_W = 26;
const GROVE_W = SIGN_W + 10 * SLOT + 6;
const PAD = 10;
export const WORLD_W = PAD * 2 + 10 * GROVE_W;
export const groveX = n => PAD + (n - 1) * GROVE_W;

const PAL = {
  k: '#000000', w: '#fcfcfc', o: '#c8702a', O: '#e8842e', b: '#a0642c', a: '#e0cfa0', r: '#e0302a',
  B: '#2a7ae8', c: '#bfe4ff', y: '#ffd84a', g: '#9a9a9a',
};
const bake = makeBaker(PAL);

const LEAF = { d: '#14431c', m: '#2f9a3a', l: '#6fd060', s: '#237a2e' };
const FIR = { d: '#103a26', m: '#2a8a50', l: '#5cc07a', s: '#1d6a3e' };
const DRY = { d: '#4a4418', m: '#a39a3a', l: '#d2c66a', s: '#7e7428' };
const TRUNK = ['#6b3e1e', '#8a5530'];
const PETALS = ['#ff6fa8', '#6fa8ff', '#ffd23f', '#b07cff', '#ffffff'];
const FADED = '#cbbf93';
const STEM = '#2f9a3a', STEM_DRY = '#8a8a40';

/* ---------- Pflanzen-Sprites (prozedural, gecacht) ---------- */
const plantCache = new Map();

function crownShade(C, x, y, cx, cy, r, seed) {
  const t = (x - cx) + (y - cy);
  if (hash(`${seed}:${x}:${y}`) % 9 === 0) return C.s;
  if (t < -r * 0.5) return C.l;
  if (t > r * 0.6) return C.s;
  return C.m;
}

function makeTree(stage, kind, thirsty, seed) {
  const key = `t${stage}${kind}${thirsty}${stage === 4 ? seed % 7 : ''}`;
  if (plantCache.has(key)) return plantCache.get(key);
  const C = thirsty ? DRY : kind === 1 ? FIR : LEAF;
  let img;
  if (stage === 0) {
    img = sprite(5, 3, px => { [1, 2, 3].forEach(x => px(x, 2, '#6b4a2a')); px(2, 1, '#8a6a3a'); });
  } else if (stage === 1) {
    img = sprite(5, 6, px => {
      for (let y = 2; y < 6; y++) px(2, y, thirsty ? STEM_DRY : STEM);
      px(1, 2, C.l); px(0, 1, C.l); px(3, 2, C.m); px(4, 1, C.m); px(2, 1, C.l);
    });
  } else {
    const big = stage >= 3;
    const r = big ? 7 : 4;
    const w = 2 * r + 1;
    const trunkH = big ? 7 : 4, trunkW = big ? 3 : 1;
    const crownH = kind === 1 ? (big ? 17 : 10) : kind === 2 ? Math.round(2 * r * 1.3) + 1 : w;
    const h = crownH + trunkH - 1;
    const inside = (x, y) => {
      if (kind === 1) {                                   // Tanne: Stufen-Dreiecke
        const tiers = big ? 3 : 2, th = crownH / tiers;
        const ti = Math.min(tiers - 1, Math.floor(y / th));
        const rel = (y - ti * th) / th;
        const half = ((ti + 1) / tiers) * r * (0.35 + 0.65 * rel);
        return Math.abs(x - r) <= half + 0.2;
      }
      const ry = kind === 2 ? r * 1.3 : r;               // rund oder hoch-oval
      return ((x - r) / (r + 0.3)) ** 2 + ((y - ry) / (ry + 0.3)) ** 2 <= 1;
    };
    img = sprite(w, h, px => {
      const tx = r - Math.floor(trunkW / 2);
      for (let y = crownH - 2; y < h; y++) for (let x = 0; x < trunkW; x++) px(tx + x, y, TRUNK[x === trunkW - 1 && trunkW > 1 ? 0 : 1]);
      for (let y = 0; y < crownH; y++) {
        for (let x = 0; x < w; x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          let col = edge ? C.d : crownShade(C, x, y, r, crownH / 2, r, seed);
          if (stage === 4 && !edge) {
            const hv = hash(`b${seed}:${x}:${y}`) % 11;
            if (kind === 1) { if (hv === 0) col = '#ffd84a'; else if (hv === 1) col = '#e0302a'; }
            else if (hv < 2) col = hv ? '#fff0f6' : '#ffb0cc';
            else if (hv === 2 && y < crownH / 2) col = '#ffd84a';
          }
          px(x, y, col);
        }
      }
    });
  }
  plantCache.set(key, img);
  return img;
}

function makeFlower(stage, color, thirsty) {
  const key = `f${stage}${color}${thirsty}`;
  if (plantCache.has(key)) return plantCache.get(key);
  const pet = thirsty ? FADED : PETALS[color];
  const st = thirsty ? STEM_DRY : STEM;
  const cen = thirsty ? '#b0a070' : '#ffd23f';
  let img;
  if (stage === 0) img = sprite(3, 2, px => px(1, 1, '#6b4a2a'));
  else if (stage === 1) img = sprite(3, 4, px => { for (let y = 1; y < 4; y++) px(1, y, st); px(0, 2, st); });
  else if (stage === 2) img = sprite(3, 6, px => { for (let y = 2; y < 6; y++) px(1, y, st); px(0, 4, st); px(1, 1, pet); px(1, 0, pet); });
  else if (stage === 3) {
    img = sprite(5, 8, px => {
      for (let y = 3; y < 8; y++) px(2, y, st);
      px(1, 5, st); px(3, 6, st);
      px(2, 0, pet); px(1, 1, pet); px(3, 1, pet); px(2, 2, pet); px(2, 1, cen);
    });
  } else {
    img = sprite(7, 10, px => {
      for (let y = 5; y < 10; y++) px(3, y, st);
      px(2, 7, st); px(1, 6, st); px(4, 8, st); px(5, 7, st);
      for (let y = 0; y < 5; y++) for (let x = 1; x < 6; x++) {
        if ((x === 1 || x === 5) && (y === 0 || y === 4)) continue;
        px(x, y, pet);
      }
      px(3, 2, cen); px(3, 1, cen); px(2, 2, cen); px(4, 2, cen); px(3, 3, cen);
      if (!thirsty) px(6, 0, '#ffffff');
    });
  }
  plantCache.set(key, img);
  return img;
}

/* ---------- Bewohner ---------- */
const SQUIRREL = ['.oo.....', 'oooo....', 'oo..oo..', 'oo.oook.', '.ooooooo', '..ooooo.', '..oo.oo.'];
const FOX = [
  ['.........o.o', '.........ooo', 'oo......ooko', 'ooooooooooow', '.wooooooooo.', '..o.o..o.o..', '..k.k..k.k..'],
  ['.........o.o', '.........ooo', 'oo......ooko', 'ooooooooooow', '.wooooooooo.', '...o.o..o.o.', '...k.k..k.k.'],
];
const RABBIT = ['..w.w...', '..w.w...', '.wwww...', 'wwkwwww.', '.wwwwwww', '..wwwwww', '..w..w..'];
const DEER = [
  'a..a........', '.aa.........', '.bbb........', 'bkbb........', '.bbbbbbbbb..',
  '..bbbbbbbbbw', '..bbbbbbbbb.', '..b.b...b.b.', '..b.b...b.b.', '..k.k...k.k.',
];
const BIRD = [['k...k', '.k.k.', '..k..'], ['.....', 'kk.kk', '..k..']];
const MUSHROOM = ['.rrr.', 'rwrwr', 'rrrrr', '.www.', '.www.'];
const DROP = ['.B.', 'BcB', 'BcB', '.B.'];
const CLOUD = [
  '....wwww....', '..wwwwwwww..', '.wwwwwwwwwww', 'wwwwwwwwwwww', '.wwwwwwwwww.',
];

/** Sprites für die Bewohner-Liste in der App (als Bilder) */
export function creatureIcon(id) {
  const maps = {
    eichhoernchen: SQUIRREL, fuchs: FOX[0], hase: RABBIT, voegel: BIRD[0], pilze: MUSHROOM, hirsch: DEER,
    schmetterlinge: ['y.y', '.k.'], bach: ['....BB..', '..BBccBB', 'BBcc..BB', 'cc......'],
  };
  return bake(maps[id]).toDataURL();
}

/* ---------- Ansicht ---------- */
const phase = h => (h < 6 || h >= 21 ? 'night' : h < 8 || h >= 18 ? 'dusk' : 'day');
const SKY = {
  day: ['#6cb8f0', '#86c8f4', '#a2d8f8', '#bfe6fb'],
  dusk: ['#5a5aa0', '#c07890', '#f0a070', '#f8cc90'],
  night: ['#0e1230', '#151a40', '#1c2250', '#242a5c'],
};
const TINT = { dusk: '#f0c8b0', night: '#6870b0' };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{forest: object, interactive?: boolean, focus?: number, onPlant?: (k:string)=>void, now?: () => Date}} opt
 */
export function createForestView(canvas, opt) {
  const ctx = canvas.getContext('2d');
  const lc = document.createElement('canvas');
  const lx = lc.getContext('2d');
  const interactive = opt.interactive !== false;
  const now = opt.now || (() => new Date());
  let forest = opt.forest;
  let layout = [];
  let W = 0, H = 0, dpr = 1, s = 1, k = 1, LW = 100, LH = WH;
  let camX = 0, camTarget = null, vel = 0;
  let raf = 0, alive = true;
  const t0 = performance.now();
  let drag = null;

  function buildLayout() {
    layout = [];
    for (const g of forest.groves) {
      const gx = groveX(g.n);
      g.trees.forEach((p, j) => {
        const h = hash(p.k + j);
        const kind = h % 3;
        const img = makeTree(p.stage, kind, p.thirsty, h);
        const x = gx + SIGN_W + j * SLOT + (h % 3) - 1 + Math.floor((SLOT - img.width) / 2);
        layout.push({ type: 'tree', k: p.k, img, x, y: GY - img.height, thirsty: p.thirsty, stage: p.stage });
      });
      g.flowers.forEach((p, j) => {
        const h = hash(p.k);
        const img = makeFlower(p.stage, h % PETALS.length, p.thirsty);
        const x = gx + SIGN_W + j * SLOT + 6 + (h % 3);
        const base = GY + 9 + (j % 2) * 3;
        layout.push({ type: 'flower', k: p.k, img, x, y: base - img.height, thirsty: p.thirsty, stage: p.stage });
      });
    }
  }

  function resize() {
    // Zeichenfläche ohne Rahmen
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    const Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);
    canvas.width = Wd; canvas.height = Hd;
    s = Math.max(1, Math.floor(Hd / WH));
    k = s / dpr;
    LW = Math.ceil(Wd / s); LH = Math.ceil(Hd / s);
    lc.width = LW; lc.height = LH;
    camX = clamp(camX);
    draw();
  }

  const clamp = x => Math.max(0, Math.min(WORLD_W - LW, x));
  const focusX = n => clamp(groveX(n) - 4);

  /* ---------- Zeichnen ---------- */
  const put = (img, x, y) => lx.drawImage(img, Math.round(x - camX), Math.round(y));
  const visible = (x, w) => x + w >= camX - 2 && x <= camX + LW + 2;

  function draw() {
    if (!LW) return;
    const t = (performance.now() - t0) / 1000;
    const ph = phase(now().getHours());
    const oy = LH - WH;  // Welt unten ausrichten, darüber Himmel
    lx.imageSmoothingEnabled = false;

    // Himmel in Bändern
    const bands = SKY[ph];
    const bh = Math.ceil((oy + GY) / bands.length);
    bands.forEach((c, i) => { lx.fillStyle = c; lx.fillRect(0, i * bh, LW, bh + 1); });

    lx.save();
    lx.translate(0, oy);
    if (ph !== 'night') {
      const cloud = bake(CLOUD);
      for (let i = 0; i < 14; i++) {
        const cx = ((i * 157 + t * 2) % (WORLD_W + 40)) - 20;
        const sx = cx - camX * 0.3 + camX;  // langsamere Ebene
        put(cloud, sx, 6 + (i % 3) * 9);
      }
    }
    // Hügel im Hintergrund (halbe Geschwindigkeit)
    for (let x = 0; x < LW; x++) {
      const wx = x + camX * 0.5;
      const h = Math.round(16 + 7 * Math.sin(wx * 0.021) + 4 * Math.sin(wx * 0.053));
      lx.fillStyle = '#5aa06a'; lx.fillRect(x, GY - h, 1, h);
      lx.fillStyle = '#4a8a5a'; lx.fillRect(x, GY - h, 1, 1);
    }
    // Wiese
    lx.fillStyle = '#3fae46'; lx.fillRect(0, GY - 1, LW, WH - GY + 1);
    lx.fillStyle = '#5cc85a'; lx.fillRect(0, GY - 1, LW, 1);
    lx.fillStyle = '#2f8a36';
    for (let x = Math.floor(camX / 7) * 7; x < camX + LW; x += 7) {
      const h = hash(`g${x}`) % 4;
      if (h) lx.fillRect(Math.round(x - camX), GY + 3 + ((h * 5) % 18), 1, 2);
    }
    // Bach
    if (forest.creatures.bach) {
      for (let x = 0; x < LW; x++) {
        const wx = x + camX;
        const y = GY + 20 + Math.round(Math.sin(wx * 0.05) * 1.5);
        lx.fillStyle = '#2a7ae8'; lx.fillRect(x, y, 1, 4);
        if ((wx + Math.floor(t * 6)) % 9 === 0) { lx.fillStyle = '#bfe4ff'; lx.fillRect(x, y + 1, 2, 1); }
      }
    }
    // Schilder
    for (const g of forest.groves) {
      const sx = groveX(g.n) + 5;
      if (!visible(sx, 16)) continue;
      lx.fillStyle = '#6b3e1e'; lx.fillRect(Math.round(sx + 7 - camX), GY - 10, 2, 10);
      const bw = 15, bx = Math.round(sx - camX), by = GY - 20;
      lx.fillStyle = '#000'; lx.fillRect(bx, by, bw + 2, 10);
      lx.fillStyle = g.gold ? '#ffd84a' : '#c8915a'; lx.fillRect(bx + 1, by + 1, bw, 8);
      const str = String(g.n);
      drawDigits(lx, bake, str, bx + 1 + Math.round((bw - numWidth(str)) / 2), by + 2, '#000');
      if (g.gold) put(bake(DEER), sx - 4, GY - DEER.length + 1);
    }
    // Pflanzen: erst Bäume, dann Blumen davor
    for (const p of layout) {
      if (p.type !== 'tree' || !visible(p.x, p.img.width)) continue;
      put(p.img, p.x, p.y);
    }
    for (const p of layout) {
      if (p.type !== 'flower' || !visible(p.x, p.img.width)) continue;
      put(p.img, p.x, p.y);
    }
    // Durst-Tropfen über durstigen Pflanzen
    const bob = Math.round(Math.sin(t * 3)) ;
    for (const p of layout) {
      if (!p.thirsty || !visible(p.x, p.img.width)) continue;
      put(bake(DROP), p.x + Math.floor(p.img.width / 2) - 1, p.y - 6 + bob);
    }
    drawCreatures(t);

    if (TINT[ph]) {
      lx.globalCompositeOperation = 'multiply';
      lx.fillStyle = TINT[ph];
      lx.fillRect(0, -oy, LW, LH);
      lx.globalCompositeOperation = 'source-over';
    }
    if (ph === 'night') {
      for (let i = 0; i < 40; i++) {
        const sx = (hash(`s${i}`) % WORLD_W) - camX * 0.2;
        const xx = ((sx % LW) + LW) % LW, yy = (hash(`y${i}`) % (oy + 50)) - oy;
        lx.fillStyle = (i + Math.floor(t * 2)) % 7 === 0 ? '#8890c0' : '#fcfcfc';
        lx.fillRect(xx, yy, 1, 1);
      }
      lx.fillStyle = '#f8f0c0';
      const mx = LW - 22, my = -oy + 10;
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17 && (x + 2) ** 2 + (y - 1) ** 2 > 10) lx.fillRect(mx + x, my + y, 1, 1);
      for (let i = 0; i < 24; i++) {                     // Glühwürmchen
        const wx = (hash(`f${i}`) % WORLD_W) + Math.sin(t * 0.7 + i) * 6;
        const wy = GY - 6 - (hash(`h${i}`) % 26) + Math.sin(t * 1.3 + i * 2) * 3;
        if (!visible(wx, 1) || Math.sin(t * 2 + i * 1.7) < 0.2) continue;
        lx.fillStyle = '#e8ff60'; lx.fillRect(Math.round(wx - camX), Math.round(wy), 1, 1);
      }
    }
    lx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lc, 0, 0, LW * s, LH * s);
  }

  function drawCreatures(t) {
    const c = forest.creatures;
    // Pilze, fest verteilt
    for (let i = 0; i < c.pilze; i++) put(bake(MUSHROOM), groveX(1 + ((i * 3) % 10)) + 18 + (i % 4) * 40, GY + 1);
    if (c.eichhoernchen) put(bake(SQUIRREL), groveX(2) + 60, GY - SQUIRREL.length + (Math.floor(t * 1.5) % 4 === 0 ? -2 : 0));
    if (c.hase) {
      const hop = Math.max(0, Math.sin(t * 5)) * 4;
      put(bake(RABBIT), groveX(8) + 50 + ((t * 6) % 60), GY - RABBIT.length + 4 - hop);
    }
    if (c.fuchs) {
      const range = 90, pos = (t * 12) % (2 * range), dir = pos < range;
      const fx = groveX(5) + 30 + (dir ? pos : 2 * range - pos);
      put(bake(FOX[Math.floor(t * 6) % 2], !dir), fx, GY - FOX[0].length + 3);
    }
    for (let i = 0; i < c.voegel; i++) {
      const bx = ((t * (14 + i * 3) + i * 300) % (WORLD_W + 60)) - 30;
      put(bake(BIRD[Math.floor(t * 5 + i) % 2]), bx, 18 + i * 7 + Math.sin(t * 2 + i) * 2);
    }
    const blooming = layout.filter(p => p.stage === 4 && p.type === 'tree');
    for (let i = 0; i < c.schmetterlinge; i++) {
      const anchor = blooming.length ? blooming[(i * 7) % blooming.length] : { x: groveX(1 + i) + 40, y: GY - 20 };
      const bx = anchor.x + 6 + Math.sin(t * 1.7 + i) * 8, by = anchor.y + 2 + Math.cos(t * 2.3 + i) * 5;
      put(bake(Math.floor(t * 8 + i) % 2 ? ['y.y', '.k.'] : ['.y.', '.k.'], false, { y: PETALS[i % 4] }), bx, by);
    }
  }

  /* ---------- Bewegung ---------- */
  function tick() {
    if (!alive) return;
    if (camTarget !== null) {
      camX += (camTarget - camX) * 0.18;
      if (Math.abs(camTarget - camX) < 0.5) { camX = camTarget; camTarget = null; }
    } else if (!drag && Math.abs(vel) > 0.05) {
      camX = clamp(camX + vel);
      vel *= 0.9;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }

  // offsetX/offsetY: relativ zur Zeichenfläche (ohne Rahmen)
  function hitTest(ox, oy) {
    const wx = ox / k + camX;
    const wy = oy / k - (LH - WH);
    const hit = list => list.find(p => wx >= p.x - 2 && wx <= p.x + p.img.width + 2 && wy >= p.y - 3 && wy <= p.y + p.img.height + 1);
    return hit(layout.filter(p => p.type === 'flower')) || hit(layout.filter(p => p.type === 'tree'));
  }

  function onDown(e) {
    drag = { x: e.clientX, y: e.clientY, cam: camX, moved: false, lastX: e.clientX, lastT: performance.now() };
    camTarget = null; vel = 0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) {
      camX = clamp(drag.cam - dx / k);
      const nowT = performance.now();
      vel = -((e.clientX - drag.lastX) / k) * (16 / Math.max(1, nowT - drag.lastT));
      drag.lastX = e.clientX; drag.lastT = nowT;
    }
  }
  function onUp(e) {
    if (!drag) return;
    const wasTap = !drag.moved;
    drag = null;
    if (wasTap) {
      vel = 0;
      const p = hitTest(e.offsetX, e.offsetY);
      if (p && opt.onPlant) opt.onPlant(p.k);
    }
  }
  function onWheel(e) {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();
    camTarget = null;
    camX = clamp(camX + d / k);
  }

  buildLayout();
  resize();
  camX = focusX(opt.focus || 1);
  draw();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  if (interactive) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    raf = requestAnimationFrame(tick);
  }

  const api = {
    focus(n) { camTarget = focusX(n); vel = 0; },
    /** Bildschirmposition (CSS-px relativ zum Canvas) der Pflanze k im aktuellen Ausschnitt, für Tests */
    plantPoint(key, type = 'tree') {
      const p = layout.find(q => q.k === key && q.type === type && visible(q.x, q.img.width));
      if (!p) return null;
      return { x: (p.x + p.img.width / 2 - camX) * k, y: (p.y + p.img.height / 2 + (LH - WH)) * k };
    },
    update(f) { forest = f; buildLayout(); draw(); },
    get camX() { return camX; },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    },
  };
  canvas.forestApi = api;
  return api;
}
