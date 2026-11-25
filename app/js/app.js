// UI der Einmaleins-Arena: Ansichten, Spielablauf, Eingaben, Speichern.
import {
  DAY, LVNAME, MEDALS, dkey, parse, freshState, migrate, encodeBackup, decodeBackup,
  level, hardness, pickWeighted, poolFor, weakest, makeQ, canon, canonShort, dayRec,
  record, xpGain, streak, lvl, rowGold, checkMedals, distractors,
} from './model.js';
import { createRunner } from './runner.js';
import {
  STAGES, CREATURES, THEMES, computeForest, snapshot, diff, thirstiest, featuredGrove,
  checkThemes, activeTheme, selectableThemes, isChristmasSeason,
} from './forest-model.js';
import { THEME_STYLES, themeSwatch } from './forest-themes.js';
import { createForestView, creatureIcon } from './forest.js';

const KEY = 'einmaleins-arena-v1';
const FUN_KEY = 'einmaleins-arena-fun'; // Monster-Hüpfen: nur Bestwert, getrennt von der Lernstatistik
const LVCOL = { '-1': 'var(--new)', '0': 'var(--learn)', '1': 'var(--bronze)', '2': 'var(--silver)', '3': 'var(--gold)' };
const TIER = { b: 'var(--bronze)', s: 'var(--silver)', g: 'var(--gold)' };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const todayKey = () => dkey(new Date());
const sec = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);

/* ---------- Zustand ---------- */
let S = null;
let view = 'home';
let R = null;          // laufende Runde
let lastRun = null;
let rowOpen = false;
let tick = null;
let storageOK = false;
let persisted = null;
let ui = blankUi();
let runner = null;
let forestView = null;   // Wald-Tab oder Startseiten-Vorschau
const queued = t => t === 'daily' || t === 'row' || t === 'water';
function blankUi() { return { copyMsg: '', importMsg: '', importOk: false, pending: null, resetArm: false }; }

/* ---------- Speichern ---------- */
function probeStorage() {
  try { localStorage.setItem(KEY + '-t', '1'); localStorage.removeItem(KEY + '-t'); storageOK = true; } catch { storageOK = false; }
}
function loadLocal() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; } catch { storageOK = false; }
}
function loadFun() {
  try { return JSON.parse(localStorage.getItem(FUN_KEY)) || { best: 0 }; } catch { return { best: 0 }; }
}
function saveFun(fun) {
  try { localStorage.setItem(FUN_KEY, JSON.stringify(fun)); } catch { /* ohne Speicher kein Bestwert */ }
}

/* ---------- Monster-Hüpfen (zählt nicht für die Statistik) ---------- */
let funRecent = [];
function funQuestion() {
  // Liest die Lerngewichte, schreibt aber nichts zurück
  const k = pickWeighted(S, poolFor(S.mode), funRecent);
  funRecent = [...funRecent, k].slice(-6);
  const q = makeQ(k);
  const opts = [q.ans, ...distractors(q, 2)].map(v => [v, Math.random()]).sort((a, b) => a[1] - b[1]).map(e => e[0]);
  return { ...q, opts };
}
function mountRunner() {
  runner = createRunner($('#runroot'), {
    nextQuestion: funQuestion,
    best: loadFun().best,
    onBest: n => saveFun({ ...loadFun(), best: n }),
    onExit: () => show('home'),
  });
}

async function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      persisted = await navigator.storage.persisted();
      if (!persisted) persisted = await navigator.storage.persist();
    }
  } catch { persisted = null; }
}

/* ---------- Runden ---------- */
function startRun(type, row) {
  const pool = poolFor(S.mode, row);
  R = { type, row, mode: S.mode, pool, answered: 0, correct: 0, combo: 0, maxCombo: 0, fast: 0, xp: 0, ms: 0,
    wrong: [], recent: [], requeued: {}, start: Date.now(), idx: 0, input: '', lock: false, showWrong: false, wait: null };
  lastRun = { type, row };
  R.forestBefore = snapshot(S, Date.now());
  if (type === 'water') R.queue = thirstiest(S, 12, Date.now());
  if (type === 'daily' || type === 'row') {
    const n = type === 'daily' ? 15 : 12;
    R.queue = [];
    for (let i = 0; i < n; i++) {
      const avoid = type === 'row' ? R.queue.slice(-Math.min(8, pool.length - 1)) : R.queue;
      R.queue.push(pickWeighted(S, pool, avoid));
    }
  }
  if (type === 'blitz') R.deadline = Date.now() + 60000;
  if (type === 'boss') {
    R.hp = 10; R.maxHp = 10; R.deadline = Date.now() + 120000;
    R.bossKeys = weakest(S, 10, pool);
    R.bossName = `Das ${canonShort(R.bossKeys[0])}-Monster`;
  }
  show('play');
  clearInterval(tick);
  tick = setInterval(hud, 100);
  nextQ();
}

function nextQ() {
  if (!R) return;
  let k;
  if (queued(R.type)) {
    if (R.idx >= R.queue.length) return endRun();
    k = R.queue[R.idx++];
  } else {
    if (Date.now() >= R.deadline) return endRun(false);
    k = pickWeighted(S, R.type === 'boss' ? R.bossKeys : R.pool, R.recent.slice(R.type === 'boss' ? -3 : -5));
  }
  R.recent.push(k);
  R.q = makeQ(k);
  R.input = ''; R.lock = false; R.showWrong = false; R.qStart = Date.now();
  const q = $('#q');
  if (q) q.className = 'q pop';
  $('#fb').innerHTML = '';
  renderQ();
  hud();
}

function renderQ(state) {
  const q = $('#q');
  if (!q || !R || !R.q) return;
  q.innerHTML = R.q.tok.map(t => {
    if (t === null) {
      const val = state === 'bad' ? String(R.q.ans) : R.input;
      return `<span class="slot${val === '' ? ' empty' : ''}">${val === '' ? '0' : esc(val)}</span>`;
    }
    return (t === '·' || t === ':' || t === '=') ? `<span class="op">${t}</span>` : `<span class="n">${t}</span>`;
  }).join('');
  if (state) q.classList.add(state);
}

function submit() {
  if (!R || R.lock || !R.input) return;
  const ms = Math.min(20000, Date.now() - R.qStart);
  const ok = Number(R.input) === R.q.ans;
  R.lock = true; R.answered++; R.ms += ms;
  record(S, R.q.k, ok, ms);
  const fb = $('#fb');
  if (ok) {
    R.correct++; R.combo++; R.maxCombo = Math.max(R.maxCombo, R.combo);
    if (ms < 2000) { R.fast++; S.bestFast = Math.max(S.bestFast, R.fast); } else R.fast = 0;
    S.bestCombo = Math.max(S.bestCombo, R.combo);
    const gain = xpGain(ms, R.combo);
    R.xp += gain; S.xp += gain;
    if (R.type === 'boss') { R.hp--; bossAnim('hit'); }
    renderQ('good');
    fb.innerHTML = `<span class="gain">+${gain} XP</span>`;
    buzz(8);
    R.wait = setTimeout(after, R.type === 'blitz' ? 200 : 300);
  } else {
    R.combo = 0; R.fast = 0; R.wrong.push(R.q.k);
    if (queued(R.type) && !R.requeued[R.q.k]) {
      R.requeued[R.q.k] = 1;
      R.queue.splice(Math.min(R.queue.length, R.idx + 3), 0, R.q.k);
    }
    if (R.type === 'boss') { R.hp = Math.min(R.maxHp, R.hp + 1); bossAnim('heal'); }
    R.showWrong = true;
    renderQ('bad');
    fb.innerHTML = `Du hattest ${esc(R.input)}. Richtig ist:<b>${R.q.tok.map(t => t === null ? R.q.ans : t).join(' ')}</b>`;
    buzz([30, 40, 30]);
    R.wait = setTimeout(after, R.type === 'blitz' ? 1200 : 2200);
  }
  save();
  hud();
}

function after() {
  if (!R || !R.lock) return;
  clearTimeout(R.wait);
  if (R.type === 'boss' && R.hp <= 0) return endRun(true);
  nextQ();
}

function bossAnim(c) {
  const b = $('#boss');
  if (!b) return;
  b.classList.remove('hit', 'heal');
  void b.offsetWidth;
  b.classList.add(c);
}
function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch { /* nicht unterstützt */ } }

function hud() {
  if (!R || view !== 'play') return;
  const info = $('#pinfo'), bar = $('#pbar'), combo = $('#combo');
  if (!info) return;
  if (queued(R.type)) {
    const done = Math.max(0, R.idx - (R.lock ? 0 : 1));
    const name = { row: `${R.row}er-Reihe`, daily: 'Tagesrunde', water: 'Gießrunde' }[R.type];
    info.innerHTML = `${done} / ${R.queue.length} <small>${name}</small>`;
    bar.style.width = (done / R.queue.length * 100) + '%';
  } else {
    const left = Math.max(0, R.deadline - Date.now());
    if (R.type === 'blitz') {
      info.innerHTML = `${Math.ceil(left / 1000)} s <small>${R.correct} richtig</small>`;
      bar.style.width = (left / 60000 * 100) + '%';
    } else {
      info.innerHTML = `${Math.ceil(left / 1000)} s <small>Treffer: ${R.maxHp - R.hp} von ${R.maxHp}</small>`;
      bar.style.width = (R.hp / R.maxHp * 100) + '%';
    }
    if (left <= 0 && !R.lock) return endRun(false);
  }
  combo.textContent = R.combo >= 3 ? R.combo + 'er-Kette' : '';
}

function endRun(win) {
  if (!R || R.ended) return;
  R.ended = true;
  clearTimeout(R.wait);
  clearInterval(tick);
  const d = dayRec(S);
  if (R.answered > 0) { S.rounds++; d.r++; }
  if (R.type === 'daily' && R.idx >= R.queue.length && !R.quit) {
    d.daily = 1;
    if (!R.wrong.length) S.perfect++;
  }
  if (R.type === 'blitz' && !R.quit) {
    R.isRecord = R.correct > S.best.blitz;
    S.best.blitz = Math.max(S.best.blitz, R.correct);
  }
  if (R.type === 'boss') {
    R.win = !!win;
    if (win) {
      S.bosses++;
      const t = Date.now() - R.start;
      R.bossTime = t;
      R.isRecord = !S.best.bossMs || t < S.best.bossMs;
      if (R.isRecord) S.best.bossMs = t;
    }
  }
  S.bestStreak = Math.max(S.bestStreak, streak(S));
  R.newMedals = checkMedals(S);
  R.forestDiff = diff(R.forestBefore, snapshot(S, Date.now()));
  R.newThemes = checkThemes(S, Date.now());
  save();
  show('result');
}

/* ---------- Bausteine ---------- */
const flame = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1c1 3 4.2 4.6 4.2 8.4A4.2 4.2 0 0 1 3.8 9.4C3.8 7 5.3 5.9 5.9 4c.8 1.1 1.2 2 1.2 3C8.4 5.6 8.6 3.4 8 1z" fill="currentColor"/></svg>';

function medalSvg(m, on) {
  const fs = m.g.length > 2 ? 14 : m.g.length > 1 ? 17 : 21;
  return `<svg viewBox="0 0 64 72" class="medal" aria-hidden="true">
  <path d="M16 0h13l9 24H25z" fill="${on ? 'var(--pink)' : '#d9d2c3'}"/><path d="M35 0h13l-9 24H26z" fill="${on ? 'var(--ink)' : '#cbc4b4'}"/>
  <circle cx="32" cy="45" r="24" fill="${on ? TIER[m.t] : '#d9d2c3'}" stroke="${on ? 'var(--ink)' : '#c4bdad'}" stroke-width="2"/>
  <circle cx="32" cy="45" r="18" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
  <text x="32" y="${45 + fs * 0.36}" text-anchor="middle" font-family="Dela Gothic One, Arial Black, sans-serif" font-size="${fs}" fill="${on ? '#1e2a66' : '#a49d8a'}">${esc(m.g)}</text></svg>`;
}

function week() {
  let h = '<div class="week" aria-label="Letzte 7 Tage">';
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const r = S.days[dkey(d)];
    const cls = (r && r.daily) ? 'done' : (r && r.r) ? 'played' : '';
    h += `<div class="wd ${cls} ${i === 0 ? 'today' : ''}"><span class="dot">${(r && r.daily) ? '✓' : ''}</span>${WD[d.getDay()]}</div>`;
  }
  return h + '</div>';
}

function albumHtml() {
  const v = S.album;
  let h = `<div class="mx" role="grid" aria-label="Album ${v === 'm' ? 'Mal' : 'Geteilt'}"><span class="mh corner">${v === 'm' ? '·' : ':'}</span>`;
  for (let c = 1; c <= 10; c++) h += `<span class="mh">${c}</span>`;
  const cnt = { '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0 };
  for (let r = 1; r <= 10; r++) {
    h += `<span class="mh">${r}</span>`;
    for (let c = 1; c <= 10; c++) {
      const k = v === 'm' ? `m${Math.min(r, c)}x${Math.max(r, c)}` : `d${c}x${r}`;
      const l = level(S.items[k]);
      if (v === 'd' || r <= c) cnt[l]++;
      h += `<button class="cell ${l < 0 ? 'ln' : 'l' + l}" data-cell="${k}" aria-label="${canon(k)}, ${LVNAME[l]}">${r * c}</button>`;
    }
  }
  h += '</div><div class="legend">';
  for (const l of ['-1', '0', '1', '2', '3']) h += `<span><i style="background:${LVCOL[l]}"></i>${LVNAME[l]} ${cnt[l]}</span>`;
  return h + '</div>';
}

function chartBars(days, val, fmt, color) {
  const W = 320, H = 110, pl = 4, pb = 18, pt = 14, bw = (W - pl * 2) / days.length;
  const vals = days.map(val), max = Math.max(1, ...vals.filter(v => v != null));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  s += `<line x1="${pl}" x2="${W - pl}" y1="${H - pb}" y2="${H - pb}" stroke="var(--ink)" stroke-width="1.5"/>`;
  s += `<line x1="${pl}" x2="${W - pl}" y1="${pt}" y2="${pt}" stroke="rgba(30,42,102,.15)" stroke-dasharray="3 3"/><text x="${W - pl}" y="${pt - 3}" text-anchor="end">${fmt(max)}</text>`;
  days.forEach((d, i) => {
    const v = vals[i], x = pl + i * bw;
    if (v != null && v > 0) {
      const h = (H - pb - pt) * v / max;
      s += `<rect x="${x + bw * 0.18}" y="${H - pb - h}" width="${bw * 0.64}" height="${h}" rx="2" fill="${i === days.length - 1 ? 'var(--pink)' : color}"/>`;
    }
    if (i % 2 === days.length % 2 || i === days.length - 1) s += `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${d.date.getDate()}.</text>`;
  });
  return s + '</svg>';
}

/* ---------- Ansichten ---------- */
function vHome() {
  const L = lvl(S.xp), st = streak(S), d = S.days[todayKey()], done = d && d.daily;
  const modes = [['mal', 'Mal', 'vorwärts'], ['teilen', 'Geteilt', 'rückwärts'], ['mix', 'Gemischt', 'beides']];
  const needBackup = S.total >= 60 && Date.now() - (S.lastBackup || 0) > 10 * DAY;
  let rows = '';
  for (let n = 2; n <= 10; n++) rows += `<button data-row="${n}" class="${rowGold(S, n) ? 'g' : ''}" aria-label="${n}er-Reihe üben">${n}</button>`;
  rows += '<button data-row="1" aria-label="1er-Reihe üben">1</button>';
  return `
  <header class="top">
    <div class="brand"><span class="brand-1">1×1</span><span class="brand-2">Arena</span></div>
    <div class="chips"><span class="chip ${st ? 'hot' : ''}" title="Tage am Stück">${flame} ${st}</span><span class="chip lvl">Level ${L.n}</span></div>
  </header>
  <div class="xp"><div class="xp-bar" role="progressbar" aria-valuenow="${Math.round(L.p * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(L.p * 100).toFixed(1)}%"></i></div><span>Noch ${L.toNext} XP bis Level ${L.n + 1}</span></div>
  ${week()}
  <div class="stack">
    <span class="label">Aufgaben</span>
    <div class="seg" role="radiogroup" aria-label="Aufgabenart">
      ${modes.map(m => `<button role="radio" aria-checked="${S.mode === m[0]}" data-mode="${m[0]}">${m[1]}<small>${m[2]}</small></button>`).join('')}
    </div>
  </div>
  <button class="cta ${done ? 'done' : ''}" data-act="daily">
    <div><h2>Tagesrunde</h2><p>${done ? 'Heute geschafft. Noch eine Runde geht immer.' : '15 Aufgaben, die schwierigen kommen öfter dran'}</p></div>
    <span class="badge">${done ? '✓' : '15'}</span>
  </button>
  <div class="grid3">
    <button class="tile" data-act="blitz"><b>Blitz</b><small>60 Sekunden<br>Rekord ${S.best.blitz}</small></button>
    <button class="tile" data-act="boss"><b>Boss</b><small>Deine 10 schwersten Aufgaben</small></button>
    <button class="tile" data-act="rowpick" aria-expanded="${rowOpen}"><b>Reihe</b><small>Eine Reihe gezielt üben</small></button>
  </div>
  <div class="rows" ${rowOpen ? '' : 'hidden'}>${rows}</div>
  <button class="fun" data-act="runner">
    <svg viewBox="0 0 120 90" class="fun-mon" aria-hidden="true"><path d="M22 82Q14 14 60 10Q106 14 98 82Z" fill="var(--sun)" stroke="var(--ink)" stroke-width="5"/><circle cx="45" cy="38" r="10" fill="#fff"/><circle cx="76" cy="38" r="10" fill="#fff"/><circle cx="43" cy="40" r="5" fill="var(--ink)"/><circle cx="74" cy="40" r="5" fill="var(--ink)"/><path d="M33 22L54 30M88 22L67 30" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/><text x="60" y="72" text-anchor="middle" font-family="Dela Gothic One, Arial Black, sans-serif" font-size="26" fill="var(--ink)">56</text></svg>
    <span><b>Monster-Hüpfen</b><small>Nur zum Spaß · Bestwert ${loadFun().best} Münzen</small></span>
  </button>
  ${needBackup ? '<div class="note"><b>Backup fällig.</b> Dein Fortschritt liegt nur auf diesem Handy. <button data-tab="more">Jetzt sichern</button></div>' : ''}
  ${!storageOK ? '<div class="note"><b>Speichern geht hier nicht.</b> Dieser Browser erlaubt keinen Speicher. Sichere deinen Fortschritt nach dem Spielen unter Backup.</div>' : ''}
  ${forestPreview()}
  <section class="card">
    <div class="card-head"><h3>Album</h3>
      <div class="mini-seg"><button data-album="m" aria-pressed="${S.album === 'm'}">Mal</button><button data-album="d" aria-pressed="${S.album === 'd'}">Geteilt</button></div>
    </div>
    ${albumHtml()}
  </section>`;
}

function vPlay() {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('');
  const boss = R.type === 'boss' ? `<div class="boss" id="boss"><svg viewBox="0 0 120 90" class="monster" aria-hidden="true"><path d="M20 82Q8 42 34 22Q60 4 86 22Q112 42 100 82Q90 73 80 82Q70 73 60 82Q50 73 40 82Q30 73 20 82Z" fill="var(--pink)" stroke="var(--ink)" stroke-width="3"/><circle cx="45" cy="46" r="10" fill="#fff"/><circle cx="75" cy="46" r="10" fill="#fff"/><circle cx="47" cy="48" r="4.5" fill="var(--ink)"/><circle cx="73" cy="48" r="4.5" fill="var(--ink)"/><path d="M47 65Q60 58 73 65" stroke="var(--ink)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M34 33L54 39M86 33L66 39" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/></svg><div class="bossname">${esc(R.bossName)}<small>10 Treffer, bevor die Zeit abläuft. Fehler heilen ihn.</small></div></div>` : '';
  return `<div class="play">
    <div class="ptop"><button class="x" data-act="quit" aria-label="Runde beenden"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="pinfo" id="pinfo"></div><div class="combo" id="combo"></div></div>
    <div class="pbar ${R.type === 'boss' ? 'boss' : R.type === 'blitz' ? 'blitz' : ''}"><i id="pbar"></i></div>
    ${boss}
    <div class="stage"><div class="q" id="q" aria-live="polite"></div><div class="fb" id="fb" aria-live="polite"></div></div>
    <div class="pad" id="pad">${keys}<button data-k="del" class="del" aria-label="Löschen">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button></div>
  </div>`;
}

function vResult() {
  const r = R, acc = r.answered ? Math.round(r.correct / r.answered * 100) : 0;
  let title, sub;
  if (r.type === 'daily') {
    title = r.quit ? 'Runde abgebrochen' : 'Tagesrunde geschafft';
    sub = r.wrong.length ? 'Die Fehler von heute kommen in den nächsten Tagen öfter dran.' : 'Ohne einen einzigen Fehler!';
  } else if (r.type === 'row') {
    title = `${r.row}er-Reihe geübt`; sub = `${acc} % richtig`;
  } else if (r.type === 'water') {
    title = r.quit ? 'Gießrunde abgebrochen' : 'Gießrunde geschafft'; sub = `${acc} % richtig`;
  } else if (r.type === 'blitz') {
    title = `${r.correct} richtig in 60 Sekunden`; sub = `Dein Rekord: ${S.best.blitz}`;
  } else {
    title = r.win ? 'Boss besiegt!' : 'Der Boss war schneller';
    sub = r.win ? 'Zeit: ' + sec(r.bossTime) : `Noch ${r.hp} Treffer hätten gefehlt. Versuch es nochmal.`;
  }
  const wrongU = [...new Set(r.wrong)];
  const label = { daily: 'Tagesrunde', row: 'Reihe', blitz: 'Blitz', boss: 'Boss', water: 'Gießrunde' }[r.type];
  return `<div class="hero"><span class="label">${label}</span><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
  ${r.isRecord ? '<span class="record">Neuer Rekord</span>' : ''}
  <div class="tiles">
    <div class="stat"><b>${r.correct}/${r.answered}</b><span>richtig</span></div>
    <div class="stat"><b>${acc} %</b><span>Trefferquote</span></div>
    <div class="stat"><b>${r.answered ? sec(r.ms / r.answered) : '–'}</b><span>Zeit pro Aufgabe</span></div>
    <div class="stat"><b>+${r.xp}</b><span>XP, beste Kette ${r.maxCombo}</span></div>
  </div>
  ${r.newMedals.length ? `<section class="card"><div class="card-head"><h3>Neue Medaille${r.newMedals.length > 1 ? 'n' : ''}</h3></div><div class="new-medals">${r.newMedals.map((m, i) => `<div class="medal-card on" style="animation-delay:${i * 0.12}s">${medalSvg(m, true)}<b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>`).join('')}</div></section>` : ''}
  ${forestCard(r.forestDiff, r.newThemes)}
  ${wrongU.length ? `<section class="card"><div class="card-head"><h3>Kommen öfter dran</h3></div><ul class="list">${wrongU.map(k => `<li><span class="eq">${canon(k)}</span><span class="pill l${level(S.items[k])}">${LVNAME[level(S.items[k])]}</span></li>`).join('')}</ul></section>` : ''}
  <div class="btns"><button class="btn" data-act="home">Fertig</button><button class="btn primary" data-act="again">Nochmal</button></div>`;
}

function vStats() {
  const acc = S.total ? Math.round(S.correct / S.total * 100) : 0;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d, r: S.days[dkey(d)] });
  }
  let n7 = 0, ms7 = 0;
  days.slice(-7).forEach(d => { if (d.r) { n7 += d.r.n; ms7 += d.r.ms; } });
  const keys = Object.keys(S.items);
  const hard = keys.filter(k => level(S.items[k]) >= 0 && (S.items[k].w > 0 || S.items[k].t > 3500))
    .sort((a, b) => hardness(S, b) - hardness(S, a)).slice(0, 8);
  const dist = { '-1': 0, '0': 0, '1': 0, '2': 0, '3': 0 };
  Object.values(S.items).forEach(it => dist[level(it)]++);
  const tot = keys.length;
  const order = ['3', '2', '1', '0', '-1'];
  return `<div class="hero"><h1>Statistik</h1><p>${S.total} Aufgaben seit ${new Date(S.created).toLocaleDateString('de-DE')}</p></div>
  <div class="tiles">
    <div class="stat"><b>${acc} %</b><span>Trefferquote gesamt</span></div>
    <div class="stat"><b>${n7 ? sec(ms7 / n7) : '–'}</b><span>pro Aufgabe, 7 Tage</span></div>
    <div class="stat"><b>${S.best.blitz}</b><span>Blitz-Rekord</span></div>
    <div class="stat"><b>${S.bestStreak}</b><span>längste Serie (Tage)</span></div>
  </div>
  <section class="card"><div class="card-head"><h3>Album-Fortschritt</h3><span class="small">${dist['3']} von ${tot} Gold</span></div>
    <div class="dist">${order.map(l => dist[l] ? `<i style="width:${dist[l] / tot * 100}%;background:${LVCOL[l]}"></i>` : '').join('')}</div>
    <div class="legend">${order.map(l => `<span><i style="background:${LVCOL[l]}"></i>${LVNAME[l]} ${dist[l]}</span>`).join('')}</div>
  </section>
  <section class="card"><div class="card-head"><h3>Aufgaben pro Tag</h3><span class="small">14 Tage</span></div>${chartBars(days, d => d.r ? d.r.n : 0, v => String(v), 'var(--ink)')}</section>
  <section class="card"><div class="card-head"><h3>Zeit pro Aufgabe</h3><span class="small">Sekunden, kürzer ist besser</span></div>${chartBars(days, d => d.r && d.r.n ? d.r.ms / d.r.n / 1000 : null, v => v.toFixed(1).replace('.', ',') + ' s', 'var(--silver)')}</section>
  <section class="card"><div class="card-head"><h3>Schwierigste Aufgaben</h3></div>
    ${hard.length ? `<ul class="list">${hard.map(k => { const it = S.items[k]; return `<li><span class="eq">${canon(k)}</span><span class="meta">${it.w} Fehler · ${it.t ? sec(it.t) : '–'}<br><span class="pill l${level(it)}">${LVNAME[level(it)]}</span></span></li>`; }).join('')}</ul>` : '<p class="small">Noch keine. Spiel ein paar Runden, dann siehst du hier, was dir schwerfällt.</p>'}
  </section>`;
}

function vMedals() {
  const got = MEDALS.filter(m => S.medals[m.id]).length;
  const card = m => {
    const on = !!S.medals[m.id];
    return `<div class="medal-card ${on ? 'on' : 'off'}">${medalSvg(m, on)}<b>${esc(m.name)}</b><small>${on ? 'am ' + new Date(S.medals[m.id]).toLocaleDateString('de-DE') : esc(m.desc)}</small></div>`;
  };
  return `<div class="hero"><h1>Medaillen</h1><p>${got} von ${MEDALS.length} gesammelt</p></div>
  <section class="stack"><span class="label">Erfolge</span><div class="medals">${MEDALS.filter(m => !m.row).map(card).join('')}</div></section>
  <section class="stack"><span class="label">Reihen-Meisterin</span><div class="medals">${MEDALS.filter(m => m.row).map(card).join('')}</div></section>`;
}

function vMore() {
  const persistText = persisted === true ? 'zugesichert'
    : persisted === false ? 'vom Browser nicht zugesichert. Tipp: App zum Home-Bildschirm hinzufügen.' : 'unbekannt';
  return `<div class="hero"><h1>Backup</h1><p>Dein Fortschritt wird nur auf diesem Handy gespeichert. Mit einem Backup kannst du ihn sichern oder auf ein anderes Gerät mitnehmen.</p></div>
  <section class="card stack"><h3>Sichern</h3>
    <p class="small">Speichere die Datei oder kopiere den Code, zum Beispiel in eine Notiz.${S.lastBackup ? ' Letzte Sicherung: ' + new Date(S.lastBackup).toLocaleDateString('de-DE') + '.' : ''}</p>
    <textarea id="exp" readonly aria-label="Backup-Code">${encodeBackup(S)}</textarea>
    <div class="btns"><button class="btn primary" data-act="download">Als Datei speichern</button><button class="btn" data-act="copy">Code kopieren</button></div>
    ${ui.copyMsg ? `<p class="ok-msg">${esc(ui.copyMsg)}</p>` : ''}
  </section>
  <section class="card stack"><h3>Wiederherstellen</h3>
    <p class="small">Wähle eine Backup-Datei oder füge einen Code ein. Der aktuelle Fortschritt wird dabei ersetzt.</p>
    <label class="btn" for="impfile">Backup-Datei wählen</label><input type="file" id="impfile" accept=".txt,text/plain" hidden>
    <textarea id="imp" aria-label="Backup-Code einfügen" placeholder="EMX1:…"></textarea>
    ${ui.pending ? `<button class="btn danger" data-act="importConfirm">Ja, Fortschritt ersetzen (${ui.pending.total} Aufgaben)</button>` : '<button class="btn" data-act="import">Code prüfen</button>'}
    ${ui.importMsg ? `<p class="${ui.importOk ? 'ok-msg' : 'err-msg'}">${esc(ui.importMsg)}</p>` : ''}
  </section>
  <section class="card stack"><h3>Neu anfangen</h3>
    <p class="small">Löscht alle Statistiken, Medaillen und das Album auf diesem Gerät.</p>
    <button class="btn danger" data-act="reset">${ui.resetArm ? 'Wirklich alles löschen? Nochmal tippen' : 'Alles zurücksetzen'}</button>
  </section>
  <p class="small">Speicher: ${storageOK ? 'verfügbar' : 'nicht verfügbar'}. Dauerhafter Speicher: ${persistText}</p>`;
}

/* ---------- Wald ---------- */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function forestCard(d, newThemes = []) {
  if (!d || (!d.grown.length && !d.watered.length && !d.newCreatures.length && !newThemes.length)) return '';
  const parts = [];
  if (d.grown.length) parts.push(`${plural(d.grown.length, 'Pflanze ist', 'Pflanzen sind')} gewachsen`);
  if (d.watered.length) parts.push(`${plural(d.watered.length, 'Pflanze', 'Pflanzen')} gegossen`);
  const names = d.newCreatures.map(id => CREATURES.find(c => c.id === id).name);
  return `<section class="card forest-card"><div class="card-head"><h3>Im Wald</h3></div>
    <p class="forest-news">${parts.join(', ')}${parts.length ? '.' : ''}</p>
    ${names.length ? `<p class="forest-news"><b>Neu eingezogen:</b> ${names.map(esc).join(', ')}</p>` : ''}
    ${newThemes.map(t => `<p class="forest-news theme-new"><b>Neues Motiv freigeschaltet:</b> ${esc(t.name)}</p>`).join('')}
    <button class="btn" data-tab="forest">Zum Wald</button></section>`;
}

function forestPreview() {
  const f = computeForest(S, Date.now()), sm = f.summary;
  const line = sm.growing ? `${sm.growing} von ${sm.total} Pflanzen wachsen · ${sm.blooming} blühen` : 'Noch alles Samen. Jede geübte Aufgabe lässt etwas wachsen.';
  return `<button class="card forest-preview" data-tab="forest" aria-label="Zum Wald">
    <div class="card-head"><h3>Dein Wald</h3>${sm.thirsty ? `<span class="pill thirst">${sm.thirsty} durstig</span>` : ''}</div>
    <canvas class="forest-cv preview" id="forest-preview" aria-hidden="true"></canvas>
    <span class="small">${line}</span></button>`;
}

function vForest() {
  const f = computeForest(S, Date.now()), sm = f.summary, c = f.creatures;
  const chips = f.groves.map(g => {
    const thirsty = [...g.trees, ...g.flowers].some(p => p.thirsty);
    return `<button data-grove="${g.n}" class="${g.gold ? 'g' : ''}${thirsty ? ' t' : ''}" aria-label="${g.n}er-Hain">${g.n}</button>`;
  }).join('');
  const stageRow = STAGES.map((name, i) => `<span><span class="pill l${i - 1}">${LVNAME[i - 1]}</span> ${name}</span>`).join('');
  const creatureCards = CREATURES.filter(cr => !cr.seasonal || isChristmasSeason(new Date())).map(cr => {
    const n = c[cr.id];
    return `<div class="medal-card ${n ? 'on' : 'off'}"><img class="creature" src="${creatureIcon(cr.id)}" alt=""><b>${esc(cr.name)}${n > 1 ? ` ×${n}` : ''}</b><small>${esc(cr.desc)}</small></div>`;
  }).join('');
  return `<div class="hero"><h1>Dein Wald</h1><p>${sm.growing} von ${sm.total} Pflanzen wachsen, ${sm.blooming} blühen. Bäume sind Malaufgaben, Blumen Teilaufgaben.</p></div>
  <section class="card forest-main">
    <canvas class="forest-cv" id="forest-cv" aria-label="Wald: wischen zum Bewegen, Pflanze antippen für Details"></canvas>
    <div class="grove-nav" aria-label="Zu Hain springen">${chips}</div>
  </section>
  ${sm.thirsty
    ? `<section class="card stack"><h3>${plural(sm.thirsty, 'Pflanze hat', 'Pflanzen haben')} Durst</h3><p class="small">Aufgaben, die länger nicht geübt wurden, lassen die Blätter hängen. Eine Gießrunde übt genau diese.</p><button class="btn primary" data-act="water">Gießrunde starten</button></section>`
    : '<section class="card stack"><h3>Alles gegossen</h3><p class="small">Keine Pflanze hat gerade Durst. Weiterüben lässt den Wald wachsen.</p></section>'}
  ${themeSection()}
  <section class="card stack"><h3>So wächst der Wald</h3><div class="legend stages">${stageRow}</div></section>
  <section class="stack"><span class="label">Bewohner</span><div class="medals">${creatureCards}</div></section>`;
}

/* ---------- Motive ---------- */
function themeCard({ id, name, desc, locked, sel, progress }) {
  const sw = themeSwatch(id === 'auto' ? (isChristmasSeason(new Date()) ? 'christmas' : 'standard') : id)
    .map(c => `<i style="background:${c}"></i>`).join('');
  const bar = locked && progress ? `<span class="tbar" aria-hidden="true"><i style="width:${Math.round(progress[0] / progress[1] * 100)}%"></i></span>` : '';
  return `<button class="theme-card${locked ? ' locked' : ''}${sel ? ' sel' : ''}" data-theme="${id}" ${locked ? 'disabled' : ''} aria-pressed="${sel}">
    <span class="swatch">${sw}</span><b>${esc(name)}</b><small>${esc(desc)}</small>${bar}</button>`;
}

function themeSection() {
  const nowD = new Date(), now = Date.now();
  const sel = S.forestTheme || 'auto';
  const selectable = selectableThemes(S, nowD);
  const cards = [
    themeCard({ id: 'auto', name: 'Automatisch', desc: 'Standard, vom 1. Dezember bis 6. Januar Weihnachtswald', sel: sel === 'auto' }),
    themeCard({ id: 'standard', name: THEME_STYLES.standard.name, desc: 'Der Sommerwald', sel: sel === 'standard' }),
  ];
  if (isChristmasSeason(nowD)) cards.push(themeCard({ id: 'christmas', name: THEME_STYLES.christmas.name, desc: 'Schnee, Lichter und Geschenke, nur in der Weihnachtszeit', sel: sel === 'christmas' }));
  for (const t of THEMES) {
    const open = selectable.includes(t.id);
    cards.push(themeCard({ id: t.id, name: t.name, desc: open ? t.desc : t.hint(S, now), locked: !open, sel: sel === t.id, progress: open ? null : t.progress(S, now) }));
  }
  const unlocked = THEMES.filter(t => S.themes[t.id]).length;
  return `<section class="stack"><span class="label">Motive · ${unlocked} von ${THEMES.length} freigespielt</span><div class="themes">${cards.join('')}</div></section>`;
}

function mountForest(v) {
  const f = computeForest(S, Date.now());
  if (v === 'forest') {
    forestView = createForestView($('#forest-cv'), { forest: f, focus: featuredGrove(f), onPlant: openSheet, theme: activeTheme(S, new Date()) });
  } else if (v === 'home') {
    forestView = createForestView($('#forest-preview'), { forest: f, focus: featuredGrove(f), interactive: false, theme: activeTheme(S, new Date()) });
  }
}

const VIEWS = { home: vHome, forest: vForest, stats: vStats, medals: vMedals, more: vMore, play: vPlay, result: vResult, runner: () => '<div id="runroot" class="runroot"></div>' };

function show(v) {
  view = v;
  if (v !== 'play' && v !== 'result') { R = null; clearInterval(tick); }
  if (runner) { runner.destroy(); runner = null; }
  if (forestView) { forestView.destroy(); forestView = null; }
  document.body.classList.toggle('playing', v === 'play' || v === 'runner');
  $('#view').innerHTML = VIEWS[v]();
  if (v === 'runner') mountRunner();
  if (v === 'forest' || v === 'home') mountForest(v);
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === v ? 'page' : 'false'));
  if (v !== 'play') window.scrollTo(0, 0);
}

function openSheet(k) {
  const it = S.items[k], l = level(it), p = parse(k);
  const row = p.t === 'm' ? (Math.max(...[p.x, p.y].filter(v => v !== 1 && v !== 10), 0) || Math.max(p.x, p.y)) : p.y;
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-in" role="dialog" aria-label="Aufgabe ${canon(k)}">
    <div class="big">${canon(k)}</div>
    <div><span class="pill l${l}">${LVNAME[l]}</span></div>
    <div class="tiles"><div class="stat"><b>${it.c}</b><span>richtig</span></div><div class="stat"><b>${it.w}</b><span>falsch</span></div>
    <div class="stat"><b>${it.t ? sec(it.t) : '–'}</b><span>Zeit (Schnitt)</span></div><div class="stat"><b>${it.b} / 5</b><span>Lernstufe</span></div></div>
    <p class="small">Gold gibt es ab Stufe 4 bei unter 4 Sekunden. Aufsteigen kann eine Aufgabe nur mit Pausen dazwischen, damit sie wirklich sitzt.</p>
    <div class="btns"><button class="btn" data-act="sheetclose">Schließen</button><button class="btn primary" data-row="${row}">${row}er-Reihe üben</button></div>
  </div>`;
  sh.hidden = false;
}
const closeSheet = () => { $('#sheet').hidden = true; };

/* ---------- Eingaben ---------- */
function handleKey(k) {
  if (!R || view !== 'play' || R.ended) return;
  if (R.lock) { if (R.showWrong) after(); return; }
  if (k === 'del') { R.input = R.input.slice(0, -1); renderQ(); return; }
  if (k === 'ok') { submit(); return; }
  if (R.input.length >= 3) return;
  R.input += k;
  renderQ();
  if (R.input.length >= String(R.q.ans).length) submit();
}

document.addEventListener('pointerdown', e => {
  const b = e.target.closest('#pad button');
  if (!b) return;
  e.preventDefault();
  b.classList.add('down');
  setTimeout(() => b.classList.remove('down'), 90);
  handleKey(b.dataset.k);
});

document.addEventListener('keydown', e => {
  if (view !== 'play') return;
  if (/^[0-9]$/.test(e.key)) handleKey(e.key);
  else if (e.key === 'Backspace') handleKey('del');
  else if (e.key === 'Enter') handleKey('ok');
  else if (e.key === 'Escape' && R) { R.quit = true; endRun(false); }
});

function doDownload() {
  try {
    const blob = new Blob([encodeBackup(S)], { type: 'text/plain' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `einmaleins-backup-${todayKey()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
    S.lastBackup = Date.now();
    save();
    ui.copyMsg = 'Datei gespeichert. Sie liegt in deinen Downloads.';
  } catch {
    ui.copyMsg = 'Download nicht möglich. Bitte den Code kopieren.';
  }
  show('more');
}

function doCopy() {
  const ta = $('#exp');
  const done = m => { ui.copyMsg = m; S.lastBackup = Date.now(); save(); show('more'); };
  const fallback = () => { ta.select(); done('Code ist markiert. Bitte selbst kopieren.'); };
  try { navigator.clipboard.writeText(ta.value).then(() => done('Kopiert. Jetzt irgendwo einfügen und speichern.'), fallback); } catch { fallback(); }
}

function tryImport(text, okMsg, errMsg) {
  try { ui.pending = decodeBackup(text); ui.importMsg = okMsg; ui.importOk = true; } catch { ui.pending = null; ui.importMsg = errMsg; ui.importOk = false; }
  show('more');
}

const ACTIONS = {
  daily: () => startRun('daily'),
  blitz: () => startRun('blitz'),
  boss: () => startRun('boss'),
  runner: () => show('runner'),
  water: () => { if (thirstiest(S, 1, Date.now()).length) startRun('water'); },
  rowpick: () => { rowOpen = !rowOpen; show('home'); },
  quit: () => { if (R) { R.quit = true; endRun(false); } },
  again: () => startRun(lastRun.type, lastRun.row),
  home: () => { rowOpen = false; show('home'); },
  sheetclose: closeSheet,
  download: doDownload,
  copy: doCopy,
  import: () => tryImport($('#imp').value, 'Code ist gültig.', 'Das ist kein gültiger Backup-Code. Er beginnt mit EMX1: und muss vollständig sein.'),
  importConfirm: () => { S = ui.pending; ui.pending = null; save(); ui.importMsg = 'Fortschritt wiederhergestellt.'; ui.importOk = true; show('more'); },
  reset: () => {
    if (!ui.resetArm) { ui.resetArm = true; show('more'); return; }
    S = freshState(); save(); ui.resetArm = false; show('home');
  },
};

document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'sheet') { closeSheet(); return; }
  const el = t.closest('[data-act],[data-tab],[data-mode],[data-album],[data-cell],[data-row],[data-grove],[data-theme]');
  if (!el || el.closest('#pad')) return;
  const ds = el.dataset;
  if (ds.tab) { closeSheet(); ui = blankUi(); show(ds.tab); return; }
  if (ds.mode) { S.mode = ds.mode; save(); show('home'); return; }
  if (ds.album) { S.album = ds.album; save(); show('home'); return; }
  if (ds.cell) { openSheet(ds.cell); return; }
  if (ds.grove) { if (forestView) forestView.focus(Number(ds.grove)); return; }
  if (ds.theme) { S.forestTheme = ds.theme; save(); show('forest'); return; }
  if (ds.row) { closeSheet(); startRun('row', Number(ds.row)); return; }
  if (ds.act && ACTIONS[ds.act]) ACTIONS[ds.act]();
});

document.addEventListener('change', e => {
  if (e.target.id !== 'impfile' || !e.target.files[0]) return;
  e.target.files[0].text().then(txt => tryImport(txt, 'Datei ist gültig.', 'Die Datei enthält keinen gültigen Backup-Code.'));
});

/* ---------- Start ---------- */
probeStorage();
const local = loadLocal();
S = local ? migrate(local) : freshState();
checkThemes(S, Date.now());   // bereits erreichte Ziele (z. B. aus früheren Runden) freischalten
save();
show('home');
askPersist().then(() => { if (view === 'more') show('more'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
