// Lernmodell der Einmaleins-Arena: reine Funktionen ohne DOM-Zugriff, damit testbar.
// Zustand S wird immer explizit übergeben; Zeit (now) und Zufall (rand) sind injizierbar.

export const MIN = 6e4;
export const HOUR = 36e5;
export const DAY = 864e5;

// Mindestabstand, bevor eine Aufgabe in die nächste Box aufsteigen darf (Index = aktuelle Box)
export const GAP = [0, 0, 20 * MIN, 20 * HOUR, 3 * DAY, 7 * DAY];
// Wiederholungsintervall je Box für die Fälligkeit
export const IVL = [1, 5 * MIN, HOUR, DAY, 3 * DAY, 7 * DAY];
// Grundgewicht je Box: niedrige Box = häufiger gefragt
export const BASE = [10, 7, 4.5, 2.5, 1.2, 0.6];
export const MAX_BOX = 5;
export const FAST_MS = 5000;     // schneller als das zählt für den Boxaufstieg
export const GOLD_MS = 4000;     // Gold nur bei Durchschnittszeit darunter

export const LVNAME = { '-1': 'Neu', '0': 'Übung', '1': 'Bronze', '2': 'Silber', '3': 'Gold' };

const pad2 = n => String(n).padStart(2, '0');
export const dkey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Item-Schlüssel: "m{i}x{j}" (i ≤ j, Mal-Paar) oder "d{a}x{b}" für (a·b) : b = a */
export function parse(k) {
  const [x, y] = k.slice(1).split('x').map(Number);
  return { t: k[0], x, y };
}

export const newItem = () => ({ b: 0, c: 0, w: 0, t: 0, l: 0, u: 0 });

export function allKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) for (let j = i; j <= 10; j++) keys.push(`m${i}x${j}`);
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) keys.push(`d${a}x${b}`);
  return keys;
}

export function freshState(now = Date.now()) {
  const items = {};
  for (const k of allKeys()) items[k] = newItem();
  return {
    v: 1, items, mode: 'mix', album: 'm', xp: 0, total: 0, correct: 0, rounds: 0, perfect: 0, bosses: 0,
    bestCombo: 0, bestFast: 0, bestStreak: 0, best: { blitz: 0, bossMs: 0 }, days: {}, medals: {},
    lastBackup: 0, created: now,
  };
}

/** Ergänzt fehlende Felder, damit ältere oder importierte Stände weiter funktionieren. */
export function migrate(o) {
  const f = freshState();
  if (!o || typeof o !== 'object' || !o.items) return f;
  const s = { ...f, ...o };
  const items = {};
  for (const k of allKeys()) items[k] = { ...newItem(), ...(o.items[k] || {}) };
  s.items = items;
  s.best = { blitz: 0, bossMs: 0, ...(o.best || {}) };
  s.days = o.days || {};
  s.medals = o.medals || {};
  return s;
}

/* ---------- Backup ---------- */
const PREFIX = 'EMX1:';
export function encodeBackup(S) {
  const bytes = new TextEncoder().encode(JSON.stringify(S));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin);
}
export function decodeBackup(str) {
  const t = String(str || '').trim().replace(/\s+/g, '');
  if (!t.startsWith(PREFIX)) throw new Error('format');
  const bin = atob(t.slice(PREFIX.length));
  const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  if (!o || !o.items) throw new Error('inhalt');
  return migrate(o);
}

/* ---------- Lernlogik ---------- */
/** -1 neu, 0 Übung, 1 Bronze, 2 Silber, 3 Gold */
export function level(it) {
  if (!it.c && !it.w) return -1;
  if (it.b >= 4 && it.t && it.t < GOLD_MS) return 3;
  if (it.b >= 3) return 2;
  if (it.b >= 2) return 1;
  return 0;
}

export function trivial(k) {
  const p = parse(k);
  return [p.x, p.y].some(v => v === 1 || v === 10);
}

/** Schwierigkeit ohne Fälligkeit: Box, Langsamkeit, Fehlerquote */
export function difficulty(it) {
  const seen = it.c + it.w;
  const base = seen ? BASE[it.b] : 6;
  const slow = it.t ? 1 + Math.min(1, Math.max(0, (it.t - 2500) / 4000)) : 1;
  const err = 1 + Math.min(1.5, (2 * it.w) / (seen + 1));
  return base * slow * err;
}

export const hardness = (S, k) => difficulty(S.items[k]) * (trivial(k) ? 0.35 : 1);

/** Ziehungsgewicht inkl. Fälligkeit: kürzlich Gefragtes tritt zurück */
export function weight(S, k, now) {
  const it = S.items[k];
  let w = difficulty(it);
  if (it.l) w *= 0.25 + Math.min(3, (now - it.l) / IVL[it.b]);
  if (trivial(k)) w *= 0.35;
  if (S.mode === 'mix' && k[0] === 'd') w *= 0.6; // 100 Teil- vs. 55 Mal-Items ausbalancieren
  return w;
}

export function pickWeighted(S, keys, avoid = [], now = Date.now(), rand = Math.random) {
  let cand = keys.filter(k => !avoid.includes(k));
  if (!cand.length) {
    const last = avoid[avoid.length - 1];
    cand = keys.filter(k => k !== last);
    if (!cand.length) cand = keys;
  }
  const ws = cand.map(k => weight(S, k, now));
  let r = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) {
    r -= ws[i];
    if (r <= 0) return cand[i];
  }
  return cand[cand.length - 1];
}

/** Auswahl nach Modus ('mal' | 'teilen' | 'mix') und optional Reihe */
export function poolFor(mode, row) {
  return allKeys().filter(k => {
    const p = parse(k);
    if (mode === 'mal' && p.t !== 'm') return false;
    if (mode === 'teilen' && p.t !== 'd') return false;
    if (row) return p.t === 'm' ? p.x === row || p.y === row : p.y === row;
    return true;
  });
}

export function weakest(S, n, pool, rand = Math.random) {
  const sh = pool.map(k => [k, rand()]).sort((a, b) => a[1] - b[1]).map(e => e[0]);
  return sh.sort((a, b) => hardness(S, b) - hardness(S, a)).slice(0, n);
}

/** Aufgabe als Token-Folge; null markiert das Antwortfeld */
export function makeQ(k, rand = Math.random) {
  const p = parse(k);
  if (p.t === 'm') {
    const s = rand() < 0.5;
    const i = s ? p.x : p.y, j = s ? p.y : p.x;
    return { k, tok: [i, '·', j, '=', null], ans: i * j };
  }
  const a = p.x, b = p.y, c = a * b, r = rand();
  if (r < 0.6) return { k, tok: [c, ':', b, '=', null], ans: a };
  if (r < 0.8) return { k, tok: [b, '·', null, '=', c], ans: a };
  return { k, tok: [null, '·', b, '=', c], ans: a };
}

/**
 * Plausible Falschantworten für Multiple Choice (Monster-Hüpfen):
 * Nachbaraufgaben, vertauschte Ziffern, eine Zehnerreihe daneben. Liefert n verschiedene Zahlen > 0, ≠ ans.
 */
export function distractors(q, n = 2, rand = Math.random) {
  const p = parse(q.k), ans = q.ans;
  let cand;
  if (p.t === 'm') {
    const { x: a, y: b } = p;
    cand = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), ans + 10, ans - 10];
    if (ans >= 10) cand.push(Number(String(ans).split('').reverse().join('')));
  } else {
    const { x: a, y: b } = p;
    cand = [a + 1, a - 1, a + 2, a - 2, b];
  }
  const shuffled = cand.map(v => [v, rand()]).sort((u, v) => u[1] - v[1]).map(e => e[0]);
  const out = new Set();
  for (const v of shuffled) {
    if (out.size >= n) break;
    if (v > 0 && v <= 100 && v !== ans) out.add(v);
  }
  for (let d = 1; out.size < n; d++) {
    for (const v of [ans + d, ans - d]) if (out.size < n && v > 0 && v !== ans) out.add(v);
  }
  return [...out];
}

export function canon(k) {
  const p = parse(k);
  return p.t === 'm' ? `${p.x} · ${p.y} = ${p.x * p.y}` : `${p.x * p.y} : ${p.y} = ${p.x}`;
}
export function canonShort(k) {
  const p = parse(k);
  return p.t === 'm' ? `${p.x}·${p.y}` : `${p.x * p.y}:${p.y}`;
}

export function dayRec(S, now = Date.now()) {
  const k = dkey(new Date(now));
  return S.days[k] || (S.days[k] = { n: 0, c: 0, ms: 0, r: 0, daily: 0 });
}

/** Antwort verbuchen: Box auf/ab, Zeit-Mittel, Tagesstatistik */
export function record(S, k, ok, ms, now = Date.now()) {
  const it = S.items[k];
  it.l = now;
  if (ok) {
    it.c++;
    it.t = it.t ? Math.round(it.t * 0.6 + ms * 0.4) : ms;
    if ((ms < FAST_MS || it.b < 2) && it.b < MAX_BOX && now - it.u >= GAP[it.b]) {
      it.b++;
      it.u = now;
    }
  } else {
    it.w++;
    it.b = Math.max(0, it.b - 2);
    it.u = now;
  }
  S.total++;
  if (ok) S.correct++;
  const d = dayRec(S, now);
  d.n++;
  if (ok) d.c++;
  d.ms += ms;
}

/** XP für eine richtige Antwort */
export function xpGain(ms, combo) {
  return 10 + (ms < 2000 ? 5 : ms < 3500 ? 3 : ms < 5000 ? 1 : 0) + Math.min(10, combo - 1);
}

/** Tage am Stück; heute zählt mit, ist aber noch nicht nötig */
export function streak(S, now = Date.now()) {
  const d = new Date(now);
  let n = 0;
  const played = x => S.days[dkey(x)] && S.days[dkey(x)].r > 0;
  if (!played(d)) d.setDate(d.getDate() - 1);
  while (played(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Level L+1 ab 50·L·(L+1) XP */
export function lvl(xp) {
  const L = Math.floor((-1 + Math.sqrt(1 + xp / 12.5)) / 2);
  const lo = 50 * L * (L + 1), hi = 50 * (L + 1) * (L + 2);
  return { n: L + 1, p: (xp - lo) / (hi - lo), toNext: hi - xp };
}

/* ---------- Medaillen ---------- */
const keysOf = t => allKeys().filter(k => k[0] === t);
const allAtLeast = (S, keys, l) => keys.every(k => level(S.items[k]) >= l);
export const rowGold = (S, n) => allAtLeast(S, poolFor('mix', n), 3);

export const MEDALS = [
  { id: 'start', name: 'Los geht’s', desc: 'Erste Runde gespielt', g: '1', t: 'b', test: S => S.rounds >= 1 },
  { id: 'perfekt', name: 'Fehlerfrei', desc: 'Tagesrunde ohne einen Fehler', g: '★', t: 'g', test: S => S.perfect >= 1 },
  { id: 'kette20', name: '20er-Kette', desc: '20 richtig hintereinander', g: '20', t: 's', test: S => S.bestCombo >= 20 },
  { id: 'kette50', name: '50er-Kette', desc: '50 richtig hintereinander', g: '50', t: 'g', test: S => S.bestCombo >= 50 },
  { id: 'turbo', name: 'Turbo', desc: '10 Antworten in Folge unter 2 Sekunden', g: '2s', t: 's', test: S => S.bestFast >= 10 },
  { id: 'blitz20', name: 'Blitz Bronze', desc: '20 richtig in einer Blitzrunde', g: 'B20', t: 'b', test: S => S.best.blitz >= 20 },
  { id: 'blitz30', name: 'Blitz Silber', desc: '30 richtig in einer Blitzrunde', g: 'B30', t: 's', test: S => S.best.blitz >= 30 },
  { id: 'blitz40', name: 'Blitz Gold', desc: '40 richtig in einer Blitzrunde', g: 'B40', t: 'g', test: S => S.best.blitz >= 40 },
  { id: 'boss1', name: 'Bossbezwingerin', desc: 'Den ersten Boss besiegt', g: 'B', t: 'b', test: S => S.bosses >= 1 },
  { id: 'boss10', name: 'Bossjägerin', desc: '10 Bosse besiegt', g: '10B', t: 'g', test: S => S.bosses >= 10 },
  { id: 'serie3', name: 'Dranbleiben', desc: '3 Tage am Stück gespielt', g: '3T', t: 'b', test: S => S.bestStreak >= 3 },
  { id: 'serie7', name: 'Eine Woche', desc: '7 Tage am Stück gespielt', g: '7T', t: 's', test: S => S.bestStreak >= 7 },
  { id: 'serie30', name: 'Ein Monat', desc: '30 Tage am Stück gespielt', g: '30T', t: 'g', test: S => S.bestStreak >= 30 },
  { id: 'n500', name: '500 Aufgaben', desc: '500 Aufgaben gelöst', g: '500', t: 's', test: S => S.total >= 500 },
  { id: 'n2000', name: '2000 Aufgaben', desc: '2000 Aufgaben gelöst', g: '2k', t: 'g', test: S => S.total >= 2000 },
  { id: 'angst', name: 'Angstgegner', desc: 'Eine Aufgabe mit 3 Fehlern auf Gold gebracht', g: '!', t: 'g', test: S => Object.values(S.items).some(it => it.w >= 3 && level(it) === 3) },
  { id: 'malB', name: 'Mal-Album Bronze', desc: 'Alle Malaufgaben mindestens Bronze', g: '·', t: 'b', test: S => allAtLeast(S, keysOf('m'), 1) },
  { id: 'malS', name: 'Mal-Album Silber', desc: 'Alle Malaufgaben mindestens Silber', g: '·', t: 's', test: S => allAtLeast(S, keysOf('m'), 2) },
  { id: 'malG', name: 'Mal-Album Gold', desc: 'Alle Malaufgaben auf Gold', g: '·', t: 'g', test: S => allAtLeast(S, keysOf('m'), 3) },
  { id: 'teilB', name: 'Geteilt-Album Bronze', desc: 'Alle Geteiltaufgaben mindestens Bronze', g: ':', t: 'b', test: S => allAtLeast(S, keysOf('d'), 1) },
  { id: 'teilS', name: 'Geteilt-Album Silber', desc: 'Alle Geteiltaufgaben mindestens Silber', g: ':', t: 's', test: S => allAtLeast(S, keysOf('d'), 2) },
  { id: 'teilG', name: 'Geteilt-Album Gold', desc: 'Alle Geteiltaufgaben auf Gold', g: ':', t: 'g', test: S => allAtLeast(S, keysOf('d'), 3) },
];
for (let n = 2; n <= 9; n++) {
  MEDALS.push({ id: `reihe${n}`, name: `${n}er-Reihe`, desc: `Alle Aufgaben der ${n}er-Reihe auf Gold, mal und geteilt`, g: String(n), t: 'g', row: n, test: S => rowGold(S, n) });
}

/** Vergibt neue Medaillen und liefert sie zurück */
export function checkMedals(S, now = Date.now()) {
  const got = [];
  for (const m of MEDALS) {
    if (!S.medals[m.id] && m.test(S)) {
      S.medals[m.id] = now;
      got.push(m);
    }
  }
  return got;
}
