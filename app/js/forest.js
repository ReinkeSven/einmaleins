// Wald-Panorama in Pixel-Art. Zeichnet den von forest-model berechneten Wald:
// 10 Haine nebeneinander, Bäume (Malaufgaben) und Blumen (Teilaufgaben), Bewohner, Tag und Nacht.
// Low-Res-Welt (1 Einheit = 1 Pixel), ganzzahlig und ohne Glättung hochskaliert.
// Das Aussehen kommt aus dem gewählten Motiv (forest-themes.js).

import { makeBaker, drawDigits, numWidth, sprite, hash } from './pixel.js';
import { THEME_STYLES } from './forest-themes.js';
import { isChristmasEve } from './forest-model.js';

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
  B: '#2a7ae8', c: '#bfe4ff', y: '#ffd84a', g: '#9aa4b0', G: '#5a5a6a', p: '#ff8ad0', t: '#6af0e0',
};
const bake = makeBaker(PAL);
const FADED = '#cbbf93', STEM_DRY = '#8a8a40';
const LIGHTS = ['#ff4040', '#ffd84a', '#40a0ff', '#ffffff', '#ff8ad0'];

/* ---------- Pflanzen-Sprites (prozedural, je Motiv gecacht) ---------- */
const plantCache = new Map();

function crownColor(st, C, x, y, cx, cy, r, seed, kind) {
  if (st.pattern === 'swirl') {                        // Lutscher: Spirale, Tannen: Streifen
    if (kind === 1) return y % 4 < 2 ? C.m : C.l;
    const a = Math.atan2(y - cy, x - cx), d = Math.hypot(x - cx, y - cy);
    return Math.floor(a / (Math.PI / 2) + d * 0.7) % 2 === 0 ? C.m : C.l;
  }
  const t = (x - cx) + (y - cy);
  if (hash(`${seed}:${x}:${y}`) % 9 === 0) return C.s;
  if (t < -r * 0.5) return C.l;
  if (t > r * 0.6) return C.s;
  return C.m;
}

function makeTree(st, id, stage, kind, thirsty, seed) {
  const key = `${id}t${stage}${kind}${thirsty}${stage >= 2 ? seed % 7 : ''}`;
  if (plantCache.has(key)) return plantCache.get(key);
  const C = thirsty ? st.dry : kind === 1 ? st.fir : kind === 2 && st.leaf2 ? st.leaf2 : st.leaf;
  let img;
  if (stage === 0) {
    img = sprite(5, 3, px => { [1, 2, 3].forEach(x => px(x, 2, st.soil)); px(2, 1, st.soil); });
  } else if (stage === 1) {
    img = sprite(5, 6, px => {
      for (let y = 2; y < 6; y++) px(2, y, thirsty ? STEM_DRY : st.stem);
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
    const cy = kind === 2 ? r * 1.3 : r;
    img = sprite(w, h, px => {
      const tx = r - Math.floor(trunkW / 2);
      for (let y = crownH - 2; y < h; y++) for (let x = 0; x < trunkW; x++) px(tx + x, y, st.trunk[x === trunkW - 1 && trunkW > 1 ? 0 : 1]);
      for (let y = 0; y < crownH; y++) {
        for (let x = 0; x < w; x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          let col = edge ? C.d : crownColor(st, C, x, y, r, cy, r, seed, kind);
          const hv = hash(`b${seed}:${x}:${y}`) % 11;
          if (!edge && !thirsty) {
            if (st.firLights && kind === 1 && hv < 2) col = LIGHTS[hash(`l${seed}${x}${y}`) % LIGHTS.length];
            else if (stage === 4) {
              if (kind === 1) { if (hv === 0) col = st.blossom.accent; else if (hv === 1) col = st.blossom.fir; }
              else if (hv < 2) col = st.blossom.round[hv];
              else if (hv === 2 && y < crownH / 2) col = st.blossom.accent;
            }
          }
          if (st.snowCap && edge && !inside(x, y - 1) && y < crownH * 0.7) col = '#ffffff';
          px(x, y, col);
        }
      }
    });
  }
  plantCache.set(key, img);
  return img;
}

function makeFlower(st, id, stage, color, thirsty) {
  const key = `${id}f${stage}${color}${thirsty}`;
  if (plantCache.has(key)) return plantCache.get(key);
  const pet = thirsty ? FADED : st.petals[color % st.petals.length];
  const stc = thirsty ? STEM_DRY : st.stem;
  const cen = thirsty ? '#b0a070' : st.center;
  let img;
  if (stage === 0) img = sprite(3, 2, px => px(1, 1, st.soil));
  else if (stage === 1) img = sprite(3, 4, px => { for (let y = 1; y < 4; y++) px(1, y, stc); px(0, 2, stc); });
  else if (stage === 2) img = sprite(3, 6, px => { for (let y = 2; y < 6; y++) px(1, y, stc); px(0, 4, stc); px(1, 1, pet); px(1, 0, pet); });
  else if (stage === 3) {
    img = sprite(5, 8, px => {
      for (let y = 3; y < 8; y++) px(2, y, stc);
      px(1, 5, stc); px(3, 6, stc);
      px(2, 0, pet); px(1, 1, pet); px(3, 1, pet); px(2, 2, pet); px(2, 1, cen);
    });
  } else {
    img = sprite(7, 10, px => {
      for (let y = 5; y < 10; y++) px(3, y, stc);
      px(2, 7, stc); px(1, 6, stc); px(4, 8, stc); px(5, 7, stc);
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

/* ---------- Bewohner und Deko ---------- */
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
const REINDEER = DEER.map((row, i) => (i === 3 ? 'rkbb........' : row));
const BIRD = [['k...k', '.k.k.', '..k..'], ['.....', 'kk.kk', '..k..']];
const FISH = [['..oo.o', '.ooooo', 'okoo.o'], ['..oo..', '.ooooo', 'okoooo']];
const UFO = [['..ttt..', '.ttttt.', 'GGGGGGG', '.y.y.y.'], ['..ttt..', '.ttttt.', 'GGGGGGG', 'y.y.y.y']];
const MUSHROOM = ['.rrr.', 'rwrwr', 'rrrrr', '.www.', '.www.'];
const GLOWSHROOM = ['.ttt.', 'twtwt', 'ttttt', '.www.', '.www.'];
const DROP = ['.B.', 'BcB', 'BcB', '.B.'];
const CLOUD = ['....wwww....', '..wwwwwwww..', '.wwwwwwwwwww', 'wwwwwwwwwwww', '.wwwwwwwwww.'];
const SNOWMAN = [
  '..kkk..', '..kkk..', '.kkkkk.', '.wwwww.', 'wwkwkww', 'wwwoOww', '.wwwww.',
  'wwwwwww', 'wwwkwww', 'gwwwwwg', 'wwwkwww', '.gwwwg.',
];
const CANE = ['.rww', 'w..r', 'r..w', '...r', '...w', '...r', '...w', '...r', '...w', '...r', '...w', '...r'];

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
const showAt = (mode, ph) => mode === 'always' || (mode === 'night' && ph === 'night');

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{forest: object, theme?: string, interactive?: boolean, focus?: number, onPlant?: (k:string)=>void, now?: () => Date}} opt
 */
export function createForestView(canvas, opt) {
  const ctx = canvas.getContext('2d');
  const lc = document.createElement('canvas');
  const lx = lc.getContext('2d');
  const interactive = opt.interactive !== false;
  const now = opt.now || (() => new Date());
  const themeId = THEME_STYLES[opt.theme] ? opt.theme : 'standard';
  const st = THEME_STYLES[themeId];
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
        const img = makeTree(st, themeId, p.stage, kind, p.thirsty, h);
        const x = gx + SIGN_W + j * SLOT + (h % 3) - 1 + Math.floor((SLOT - img.width) / 2);
        layout.push({ type: 'tree', k: p.k, img, x, y: GY - img.height, thirsty: p.thirsty, stage: p.stage, kind, h });
      });
      g.flowers.forEach((p, j) => {
        const h = hash(p.k);
        const img = makeFlower(st, themeId, p.stage, h % 5, p.thirsty);
        const x = gx + SIGN_W + j * SLOT + 6 + (h % 3);
        const base = GY + 9 + (j % 2) * 3;
        layout.push({ type: 'flower', k: p.k, img, x, y: base - img.height, thirsty: p.thirsty, stage: p.stage, h });
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
  const dot = (x, y, color, w = 1, h = 1) => { lx.fillStyle = color; lx.fillRect(Math.round(x - camX), Math.round(y), w, h); };
  const visible = (x, w) => x + w >= camX - 2 && x <= camX + LW + 2;

  function draw() {
    if (!LW) return;
    const t = (performance.now() - t0) / 1000;
    const date = now();
    const ph = phase(date.getHours());
    const oy = LH - WH;  // Welt unten ausrichten, darüber Himmel
    lx.imageSmoothingEnabled = false;

    // Himmel in Bändern
    const bands = st.sky[ph];
    const bh = Math.ceil((oy + GY) / bands.length);
    bands.forEach((c, i) => { lx.fillStyle = c; lx.fillRect(0, i * bh, LW, bh + 1); });

    lx.save();
    lx.translate(0, oy);
    if (showAt(st.stars, ph) && !st.tint[ph]) drawStars(t, oy);
    if (st.deco.includes('planets')) drawPlanets(t, oy);
    if (st.clouds && ph !== 'night') {
      const cloud = bake(CLOUD, false, { w: st.clouds });
      for (let i = 0; i < 14; i++) {
        const cx = ((i * 157 + t * 2) % (WORLD_W + 40)) - 20;
        put(cloud, cx - camX * 0.3 + camX, 6 + (i % 3) * 9);  // langsamere Ebene
      }
    }
    // Hügel im Hintergrund (halbe Geschwindigkeit)
    for (let x = 0; x < LW; x++) {
      const wx = x + camX * 0.5;
      const h = Math.round(16 + 7 * Math.sin(wx * 0.021) + 4 * Math.sin(wx * 0.053));
      lx.fillStyle = st.hills[0]; lx.fillRect(x, GY - h, 1, h);
      lx.fillStyle = st.hills[1]; lx.fillRect(x, GY - h, 1, 1);
    }
    // Boden
    const [ground, top, tuft] = st.meadow;
    lx.fillStyle = ground; lx.fillRect(0, GY - 1, LW, WH - GY + 1);
    lx.fillStyle = top; lx.fillRect(0, GY - 1, LW, 1);
    for (let x = Math.floor(camX / 7) * 7; x < camX + LW; x += 7) {
      const h = hash(`g${x}`) % 4;
      if (!h) continue;
      const color = tuft === 'sprinkles' ? st.petals[hash(`c${x}`) % st.petals.length] : tuft;
      dot(x, GY + 3 + ((h * 5) % 18), color, 1, 2);
    }
    // Bach
    if (forest.creatures.bach) {
      for (let x = 0; x < LW; x++) {
        const wx = x + camX;
        const y = GY + 20 + Math.round(Math.sin(wx * 0.05) * 1.5);
        lx.fillStyle = st.brook.water; lx.fillRect(x, y, 1, 4);
        const g = st.brook.frozen ? wx % 11 === 0 : (wx + Math.floor(t * 6)) % 9 === 0;
        if (g) { lx.fillStyle = st.brook.glint; lx.fillRect(x, y + 1, 2, 1); }
      }
      if (st.deco.includes('koi')) {
        for (let i = 0; i < 6; i++) {
          const kx = ((t * (8 + i * 2) + i * 270) % WORLD_W);
          const ky = GY + 21 + Math.round(Math.sin(kx * 0.05) * 1.5);
          if (visible(kx, 4)) { dot(kx, ky, i % 2 ? '#ff7a2a' : '#ffffff', 3, 1); dot(kx + 1, ky, '#ff7a2a'); }
        }
      }
    }
    drawSigns();
    // Pflanzen: erst Bäume, dann Blumen davor
    for (const p of layout) if (p.type === 'tree' && visible(p.x, p.img.width)) put(p.img, p.x, p.y);
    if (st.firLights) drawTwinkle(t);
    if (st.deco.includes('gifts')) drawGifts();
    for (const p of layout) if (p.type === 'flower' && visible(p.x, p.img.width)) put(p.img, p.x, p.y);
    if (st.deco.includes('snowmen')) for (const n of [1, 4, 7, 10]) put(bake(SNOWMAN), groveX(n) + GROVE_W - 8, GY - SNOWMAN.length + 3);
    if (st.deco.includes('glowShrooms')) drawGlowShrooms(t);
    // Durst-Tropfen über durstigen Pflanzen
    const bob = Math.round(Math.sin(t * 3));
    for (const p of layout) if (p.thirsty && visible(p.x, p.img.width)) put(bake(DROP), p.x + Math.floor(p.img.width / 2) - 1, p.y - 6 + bob);
    drawCreatures(t);
    if (st.deco.includes('fishSchool')) drawFishSchool(t);

    if (st.tint[ph]) {
      lx.globalCompositeOperation = 'multiply';
      lx.fillStyle = st.tint[ph];
      lx.fillRect(0, -oy, LW, LH);
      lx.globalCompositeOperation = 'source-over';
      if (showAt(st.stars, ph)) drawStars(t, oy);
    }
    if (showAt(st.moon, ph)) drawMoon(oy);
    if (st.deco.includes('xmasStar') && ph === 'night' && isChristmasEve(date)) drawBigStar(t, oy);
    if (showAt(st.fireflies, ph)) drawFireflies(t);
    drawParticles(t, oy);
    lx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lc, 0, 0, LW * s, LH * s);
  }

  function drawSigns() {
    for (const g of forest.groves) {
      const sx = groveX(g.n) + 5;
      if (!visible(sx - 6, 24)) continue;
      const str = String(g.n);
      if (st.sign.torii) {                                // rotes Tor mit Nummer auf dem oberen Balken
        dot(sx + 1, GY - 16, '#000', 3, 16); dot(sx + 13, GY - 16, '#000', 3, 16);
        dot(sx + 2, GY - 16, st.sign.post, 1, 16); dot(sx + 14, GY - 16, st.sign.post, 1, 16);
        dot(sx - 2, GY - 23, '#000', 21, 8);
        dot(sx - 1, GY - 22, g.gold ? st.sign.gold : st.sign.board, 19, 6);
        dot(sx, GY - 14, '#000', 17, 2);
        drawDigits(lx, bake, str, Math.round(sx - camX) + 8 - Math.round(numWidth(str) / 2), GY - 22, g.gold ? '#000' : '#ffffff');
      } else {
        dot(sx + 7, GY - 10, st.sign.post, 2, 10);
        const bw = 15, by = GY - 20;
        dot(sx, by, '#000', bw + 2, 10);
        dot(sx + 1, by + 1, g.gold ? st.sign.gold : st.sign.board, bw, 8);
        if (st.sign.snow) dot(sx, by - 1, '#ffffff', bw + 2, 2);
        drawDigits(lx, bake, str, Math.round(sx - camX) + 1 + Math.round((bw - numWidth(str)) / 2), by + 2, '#000');
      }
      if (st.deco.includes('canes')) put(bake(CANE), sx + 19, GY - CANE.length);
      if (g.gold) put(bake(st.reindeer ? REINDEER : DEER), sx - 4, GY - DEER.length + 1);
    }
  }

  function drawStars(t, oy) {
    for (let i = 0; i < 50; i++) {
      const sx = (hash(`s${i}`) % WORLD_W) - camX * 0.2;
      const xx = ((sx % LW) + LW) % LW, yy = (hash(`y${i}`) % (oy + 60)) - oy;
      lx.fillStyle = (i + Math.floor(t * 2)) % 7 === 0 ? '#8890c0' : '#fcfcfc';
      lx.fillRect(xx, yy, 1, 1);
    }
  }

  function drawMoon(oy) {
    lx.fillStyle = '#f8f0c0';
    const mx = LW - 22, my = -oy + 10;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      if (x * x + y * y <= 17 && (x + 2) ** 2 + (y - 1) ** 2 > 10) lx.fillRect(mx + x, my + y, 1, 1);
    }
  }

  // Stern von Bethlehem ab Heiligabend: großer Stern mit Schweif, leicht funkelnd
  function drawBigStar(t, oy) {
    const cx = Math.round(LW / 2), cy = -oy + 14;
    const glow = Math.sin(t * 2) > 0 ? '#fff8c0' : '#ffe880';
    lx.fillStyle = glow;
    for (let i = -5; i <= 5; i++) { lx.fillRect(cx + i, cy, 1, 1); lx.fillRect(cx, cy + i, 1, 1); }
    for (let i = -3; i <= 3; i++) { lx.fillRect(cx + i, cy + i, 1, 1); lx.fillRect(cx + i, cy - i, 1, 1); }
    lx.fillStyle = '#ffffff'; lx.fillRect(cx - 1, cy - 1, 3, 3);
    lx.fillStyle = 'rgba(255,240,180,0.5)';
    for (let i = 1; i < 14; i++) lx.fillRect(cx + i, cy + i * 0.5, 1, 1);
  }

  function drawPlanets(t, oy) {
    const px = LW - 30 - camX * 0.05 % 20, py = -oy + 16;
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      if (x * x + y * y > 50) continue;
      lx.fillStyle = (y + 7) % 5 < 2 ? '#e0a050' : x + y < -4 ? '#f8d090' : '#c87830';
      lx.fillRect(Math.round(px + x), py + y, 1, 1);
    }
    lx.fillStyle = '#d8c8f0';
    for (let x = -12; x <= 12; x++) {
      const y = Math.round(x * 0.25);
      if (Math.abs(x) > 6 || y > 0) lx.fillRect(Math.round(px + x), py + y + 1, 1, 1);
    }
    lx.fillStyle = '#b8c0d0';
    const mx = 26, my = -oy + 26;
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) lx.fillRect(mx + x, my + y, 1, 1);
    const cyc = t % 7;                                    // Sternschnuppe alle 7 Sekunden
    if (cyc < 0.8) {
      const sx = 20 + cyc * 120, sy = -oy + 6 + cyc * 30;
      lx.fillStyle = '#ffffff'; lx.fillRect(Math.round(sx), Math.round(sy), 2, 1);
      lx.fillStyle = 'rgba(255,255,255,0.5)'; lx.fillRect(Math.round(sx - 6), Math.round(sy - 1.5), 6, 1);
    }
  }

  function drawTwinkle(t) {
    for (const p of layout) {
      if (p.type !== 'tree' || p.kind !== 1 || p.stage < 2 || p.thirsty || !visible(p.x, p.img.width)) continue;
      const phaseT = Math.floor(t * 3 + p.h % 5);
      const hx = hash(`tw${p.h}${phaseT}`);
      if (hx % 3) continue;
      dot(p.x + 2 + (hx % Math.max(1, p.img.width - 4)), p.y + 2 + ((hx >> 4) % Math.max(1, p.img.height - 8)), '#ffffff');
    }
  }

  function drawGifts() {
    const colors = [['#e0302a', '#ffd84a'], ['#2a8a50', '#ffd84a'], ['#ffd84a', '#e0302a'], ['#b07cff', '#ffd84a']];
    for (const p of layout) {
      if (p.type !== 'tree' || p.stage !== 4 || !visible(p.x, p.img.width + 6)) continue;
      const [box, ribbon] = colors[p.h % colors.length];
      const gx = p.x + p.img.width - 3, gy = GY - 4;
      dot(gx, gy, '#000', 6, 5);
      dot(gx + 1, gy + 1, box, 4, 4);
      dot(gx + 3, gy + 1, ribbon, 1, 4);
      dot(gx + 1, gy + 2, ribbon, 4, 1);
      dot(gx + 2, gy - 1, ribbon, 1, 1); dot(gx + 4, gy - 1, ribbon, 1, 1);
    }
  }

  function drawGlowShrooms(t) {
    for (let n = 1; n <= 10; n++) {
      for (const off of [40, 100]) {
        const x = groveX(n) + off + (n * 7) % 11;
        if (!visible(x, 6)) continue;
        put(bake(GLOWSHROOM), x, GY + 1);
        if (Math.sin(t * 2 + n + off) > 0) { dot(x - 1, GY - 1, '#bffff6'); dot(x + 5, GY, '#bffff6'); }
      }
    }
  }

  function drawFishSchool(t) {
    const colors = ['#ffd23f', '#ff7a5a', '#6af0e0', '#ff8ad0'];
    for (let i = 0; i < 8; i++) {
      const fx = ((t * (10 + i * 2) + i * 230) % (WORLD_W + 40)) - 20;
      const fy = 14 + (i * 9) % 46 + Math.sin(t * 1.5 + i) * 2;
      put(bake(FISH[Math.floor(t * 4 + i) % 2], true, { o: colors[i % colors.length] }), fx, fy);
    }
  }

  function drawFireflies(t) {
    for (let i = 0; i < 24; i++) {
      const wx = (hash(`f${i}`) % WORLD_W) + Math.sin(t * 0.7 + i) * 6;
      const wy = GY - 6 - (hash(`h${i}`) % 26) + Math.sin(t * 1.3 + i * 2) * 3;
      if (!visible(wx, 1) || Math.sin(t * 2 + i * 1.7) < 0.2) continue;
      dot(wx, wy, '#e8ff60');
    }
  }

  // Wetter in Bildschirmkoordinaten
  function drawParticles(t, oy) {
    const kind = st.particles;
    if (!kind) return;
    const top = -oy, height = LH;
    const wrapY = v => top + (((v % height) + height) % height);
    const wrapX = v => ((v % LW) + LW) % LW;
    const n = { snow: 90, petals: 30, bubbles: 30, sparkles: 40, sprinkles: 30 }[kind];
    for (let i = 0; i < n; i++) {
      const h1 = hash(`p${i}`), h2 = hash(`q${i}`);
      const sp = 6 + (h1 % 7);
      if (kind === 'snow') {
        const x = wrapX(h1 + Math.sin(t * 0.8 + i) * 4 - camX * 0.3), y = wrapY(h2 + t * sp);
        lx.fillStyle = '#ffffff'; lx.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
      } else if (kind === 'petals') {
        const x = wrapX(h1 + t * 9 - camX * 0.3), y = wrapY(h2 + t * sp * 0.8);
        lx.fillStyle = i % 3 ? '#ffc0d8' : '#ffffff'; lx.fillRect(Math.round(x), Math.round(y), 2, 1);
      } else if (kind === 'bubbles') {
        const x = wrapX(h1 + Math.sin(t + i) * 2 - camX * 0.3), y = wrapY(h2 - t * sp);
        lx.fillStyle = '#bfefff'; lx.fillRect(Math.round(x), Math.round(y), 2, 1); lx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
      } else if (kind === 'sparkles') {
        if (Math.sin(t * 3 + i * 1.3) < 0.5) continue;
        const x = wrapX(h1 - camX * 0.5), y = top + (h2 % (height - 10));
        lx.fillStyle = ['#7af8e8', '#fff080', '#ff8af0'][i % 3]; lx.fillRect(Math.round(x), Math.round(y), 1, 1);
      } else if (kind === 'sprinkles') {
        const x = wrapX(h1 - camX * 0.3), y = wrapY(h2 + t * sp * 0.6);
        lx.fillStyle = st.petals[i % st.petals.length]; lx.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }
  }

  function drawCreatures(t) {
    const c = forest.creatures;
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
    const flyer = { bird: BIRD, fish: FISH, ufo: UFO }[st.bird];
    for (let i = 0; i < c.voegel; i++) {
      const bx = ((t * (14 + i * 3) + i * 300) % (WORLD_W + 60)) - 30;
      put(bake(flyer[Math.floor(t * 5 + i) % 2], st.bird === 'fish'), bx, 18 + i * 7 + Math.sin(t * 2 + i) * 2);
    }
    const blooming = layout.filter(p => p.stage === 4 && p.type === 'tree');
    for (let i = 0; i < c.schmetterlinge; i++) {
      const anchor = blooming.length ? blooming[(i * 7) % blooming.length] : { x: groveX(1 + i) + 40, y: GY - 20 };
      const bx = anchor.x + 6 + Math.sin(t * 1.7 + i) * 8, by = anchor.y + 2 + Math.cos(t * 2.3 + i) * 5;
      put(bake(Math.floor(t * 8 + i) % 2 ? ['y.y', '.k.'] : ['.y.', '.k.'], false, { y: st.petals[i % 4] }), bx, by);
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
    theme: themeId,
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
