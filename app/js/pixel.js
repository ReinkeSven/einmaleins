// Gemeinsame Pixel-Art-Helfer für Monster-Hüpfen und Wald.
// Pixelkarten: Array von Strings gleicher Länge, '.' ist transparent, jedes andere Zeichen ein Palettenschlüssel.

/** 3×5-Ziffern plus '+' */
export const DIGITS = {
  0: ['kkk', 'k.k', 'k.k', 'k.k', 'kkk'], 1: ['.k.', 'kk.', '.k.', '.k.', 'kkk'],
  2: ['kkk', '..k', 'kkk', 'k..', 'kkk'], 3: ['kkk', '..k', 'kkk', '..k', 'kkk'],
  4: ['k.k', 'k.k', 'kkk', '..k', '..k'], 5: ['kkk', 'k..', 'kkk', '..k', 'kkk'],
  6: ['kkk', 'k..', 'kkk', 'k.k', 'kkk'], 7: ['kkk', '..k', '.k.', '.k.', '.k.'],
  8: ['kkk', 'k.k', 'kkk', 'k.k', 'kkk'], 9: ['kkk', 'k.k', 'kkk', '..k', 'kkk'],
  '+': ['...', '.k.', 'kkk', '.k.', '...'],
};

/** Breite einer Ziffernfolge in Pixeln (3 px pro Zeichen, 1 px Abstand) */
export const numWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;

/** Liefert eine bake-Funktion, die Pixelkarten mit der Palette in kleine Canvas backt (mit Cache) */
export function makeBaker(pal) {
  const cache = new Map();
  return function bake(map, flip = false, recolor = null) {
    const key = map.join('|') + flip + (recolor ? JSON.stringify(recolor) : '');
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = map[0].length;
    c.height = map.length;
    const x = c.getContext('2d');
    map.forEach((row, r) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      x.fillStyle = (recolor && recolor[ch]) || pal[ch];
      x.fillRect(flip ? row.length - 1 - i : i, r, 1, 1);
    }));
    cache.set(key, c);
    return c;
  };
}

/** Zeichnet eine Ziffernfolge in Farbe color auf ctx (Low-Res-Koordinaten) */
export function drawDigits(ctx, bake, str, x, y, color, scale = 1) {
  let cx = x;
  for (const ch of String(str)) {
    const g = DIGITS[ch];
    if (g) ctx.drawImage(bake(g, false, { k: color }), Math.round(cx), Math.round(y), 3 * scale, 5 * scale);
    cx += 4 * scale;
  }
}

/** Kleines Canvas w×h, das per px(x, y, farbe) bemalt wird */
export function sprite(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  paint((px, py, color) => { x.fillStyle = color; x.fillRect(px, py, 1, 1); });
  return c;
}

/** Deterministischer Hash (FNV-1a) für reproduzierbare Varianten */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
