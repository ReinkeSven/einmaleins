// Wald-Logik: reine Funktionen ohne DOM. Der Wald wird vollständig aus dem Lernstand S berechnet,
// gespeichert werden nur Motiv-Auswahl und freigeschaltete Motive. Pflanzen wachsen mit dem Können, Bewohner kommen durch Fleiß und Erfolge.

import { DAY, IVL, level, streak, rowGold, dkey } from './model.js';

/** Wachstumsstufen: 0 Samen, 1 Spross, 2 junger Baum, 3 großer Baum, 4 blühend */
export const STAGES = ['Samen', 'Spross', 'Jungbaum', 'Baum', 'blühend'];

/** Stufe einer Aufgabe aus ihrem Lernstand (Neu → Samen … Gold → blühend) */
export const stageOf = it => level(it) + 1;

/** Durstig: schon geübt, aber länger nicht wiederholt als für ihre Lernstufe passend (mindestens 1 Tag) */
export function thirstLimit(it) {
  return Math.max(DAY, 2 * IVL[it.b]);
}
export function isThirsty(it, now) {
  return it.c + it.w > 0 && now - it.l > thirstLimit(it);
}

/** Bis zu n durstige Aufgaben, die durstigsten (relativ am längsten überfällig) zuerst */
export function thirstiest(S, n, now) {
  return Object.keys(S.items)
    .filter(k => isThirsty(S.items[k], now))
    .map(k => [k, (now - S.items[k].l) / thirstLimit(S.items[k])])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(e => e[0]);
}

const plant = (S, k, now) => ({ k, stage: stageOf(S.items[k]), thirsty: isThirsty(S.items[k], now) });

/**
 * Zehn Haine, einer pro Reihe n: 10 Bäume für n·1 … n·10 (Tauschaufgaben teilen sich den Zustand)
 * und 10 Blumen für die Teilaufgaben (n·j) : n.
 */
export function groves(S, now) {
  const out = [];
  for (let n = 1; n <= 10; n++) {
    const trees = [], flowers = [];
    for (let j = 1; j <= 10; j++) {
      trees.push(plant(S, `m${Math.min(n, j)}x${Math.max(n, j)}`, now));
      flowers.push(plant(S, `d${j}x${n}`, now));
    }
    out.push({ n, trees, flowers, gold: rowGold(S, n) });
  }
  return out;
}

/** Bewohner: Bedingung und Anzahl (0 = noch nicht da). Alles abgeleitet, nichts gespeichert. */
export const CREATURES = [
  { id: 'eichhoernchen', name: 'Eichhörnchen', desc: '3 Tage am Stück üben', count: (S, now) => (streak(S, now) >= 3 ? 1 : 0) },
  { id: 'fuchs', name: 'Fuchs', desc: '7 Tage am Stück üben', count: (S, now) => (streak(S, now) >= 7 ? 1 : 0) },
  { id: 'hase', name: 'Hase', desc: 'Einen Boss besiegen', count: S => (S.bosses >= 1 ? 1 : 0) },
  { id: 'voegel', name: 'Vögel', desc: 'Eine Tagesrunde ohne Fehler (je Runde ein Vogel, bis 5)', count: S => Math.min(5, S.perfect) },
  { id: 'pilze', name: 'Pilze', desc: 'Je 200 gelöste Aufgaben ein Pilz (bis 10)', count: S => Math.min(10, Math.floor(S.total / 200)) },
  { id: 'schmetterlinge', name: 'Schmetterlinge', desc: 'Je 10 goldene Aufgaben ein Schmetterling (bis 8)', count: S => Math.min(8, Math.floor(Object.values(S.items).filter(it => level(it) === 3).length / 10)) },
  { id: 'bach', name: 'Bach', desc: '500 Aufgaben gelöst', count: S => (S.total >= 500 ? 1 : 0) },
  { id: 'hirsch', name: 'Hirsch', desc: 'Eine Reihe komplett auf Gold (je Hain ein Hirsch)', count: S => [...Array(10)].filter((_, i) => rowGold(S, i + 1)).length },
  { id: 'igel', name: 'Igel', desc: '5 Bosse besiegen', count: S => (S.bosses >= 5 ? 1 : 0) },
  { id: 'frosch', name: 'Frosch', desc: '25 richtige in einer Blitzrunde', count: S => (S.best.blitz >= 25 ? 1 : 0) },
  { id: 'specht', name: 'Specht', desc: '50 Aufgaben auf Gold', count: S => (countLevel(S, 3) >= 50 ? 1 : 0) },
  { id: 'marienkaefer', name: 'Marienkäfer', desc: 'Alle Teilaufgaben mindestens auf Bronze', count: S => (Object.keys(S.items).filter(k => k[0] === 'd').every(k => level(S.items[k]) >= 1) ? 3 : 0) },
  { id: 'eule', name: 'Eule', desc: 'Einmal 14 Tage am Stück üben', count: S => (S.bestStreak >= 14 ? 1 : 0) },
  { id: 'biber', name: 'Biber', desc: '1000 Aufgaben gelöst', count: S => (S.total >= 1000 ? 1 : 0) },
  { id: 'baer', name: 'Bär', desc: '3 Reihen komplett auf Gold', count: S => (goldRowCount(S) >= 3 ? 1 : 0) },
  { id: 'einhorn', name: 'Einhorn', desc: 'Alle 155 Aufgaben auf Gold (legendär)', count: S => (countLevel(S, 3) === 155 ? 1 : 0) },
  {
    id: 'weihnachtsmann', name: 'Weihnachtsmann', seasonal: true,
    desc: 'In der Weihnachtszeit: fliegt vorbei, sobald heute die Tagesrunde geschafft ist',
    count: (S, now) => {
      const d = new Date(now);
      return isChristmasSeason(d) && S.days[dkey(d)] && S.days[dkey(d)].daily ? 1 : 0;
    },
  },
];

function countLevel(S, l) { return Object.values(S.items).filter(it => level(it) === l).length; }
function goldRowCount(S) { return [...Array(10)].filter((_, i) => rowGold(S, i + 1)).length; }

export function creatures(S, now) {
  const out = {};
  for (const c of CREATURES) out[c.id] = c.count(S, now);
  return out;
}

/** Zusammenfassung über die 155 einzelnen Aufgaben */
export function summary(S, now) {
  const its = Object.values(S.items);
  const stages = [0, 0, 0, 0, 0];
  for (const it of its) stages[stageOf(it)]++;
  return {
    total: its.length,
    stages,
    growing: its.length - stages[0],
    blooming: stages[4],
    thirsty: its.filter(it => isThirsty(it, now)).length,
  };
}

/** Kompletter Wald für die Anzeige */
export function computeForest(S, now) {
  return { groves: groves(S, now), creatures: creatures(S, now), summary: summary(S, now) };
}

/** Schnappschuss vor einer Runde, für den Vergleich danach */
export function snapshot(S, now) {
  const plants = {};
  for (const k of Object.keys(S.items)) plants[k] = { stage: stageOf(S.items[k]), thirsty: isThirsty(S.items[k], now) };
  return { plants, creatures: creatures(S, now) };
}

/** Was hat sich im Wald getan? Gewachsene und gegossene Pflanzen, neue Bewohner */
export function diff(before, after) {
  const grown = [], watered = [], newCreatures = [];
  for (const k of Object.keys(after.plants)) {
    const a = after.plants[k], b = before.plants[k];
    if (!b) continue;
    if (a.stage > b.stage) grown.push(k);
    if (b.thirsty && !a.thirsty) watered.push(k);
  }
  for (const c of CREATURES) if ((after.creatures[c.id] || 0) > (before.creatures[c.id] || 0)) newCreatures.push(c.id);
  return { grown, watered, newCreatures };
}

/** Hain, der in der Vorschau gezeigt wird: der durstigste, sonst der mit den meisten Blüten */
export function featuredGrove(forest) {
  const score = g => [...g.trees, ...g.flowers];
  const thirst = forest.groves.map(g => score(g).filter(p => p.thirsty).length);
  const maxT = Math.max(...thirst);
  if (maxT > 0) return forest.groves[thirst.indexOf(maxT)].n;
  const growth = forest.groves.map(g => score(g).reduce((a, p) => a + p.stage, 0));
  return forest.groves[growth.indexOf(Math.max(...growth))].n;
}

/* ---------- Motive ---------- */

/** Weihnachtszeit: 1. Dezember bis 6. Januar */
export function isChristmasSeason(date) {
  const m = date.getMonth(), d = date.getDate();
  return m === 11 || (m === 0 && d <= 6);
}
/** Weihnachtsstern am Nachthimmel ab Heiligabend */
export function isChristmasEve(date) {
  const m = date.getMonth(), d = date.getDate();
  return (m === 11 && d >= 24) || (m === 0 && d <= 6);
}

const goldRows = goldRowCount;

/**
 * Freispielbare Motive, aufsteigend schwerer. progress liefert [aktuell, Ziel];
 * freigeschaltet wird, sobald aktuell ≥ Ziel – danach bleibt das Motiv dauerhaft frei.
 */
export const THEMES = [
  {
    id: 'zauber', name: 'Zauberwald', desc: 'Wald ohne Durst: mindestens 60 Pflanzen wachsen und keine ist durstig',
    progress: (S, now) => { const sm = summary(S, now); return [sm.thirsty ? 0 : Math.min(60, sm.growing), 60]; },
    hint: (S, now) => { const sm = summary(S, now); return sm.thirsty ? `${sm.thirsty} Pflanzen haben noch Durst` : `${Math.min(60, sm.growing)} von 60 Pflanzen wachsen`; },
  },
  {
    id: 'suess', name: 'Süßigkeitenwald', desc: '10 fehlerfreie Tagesrunden',
    progress: S => [Math.min(10, S.perfect), 10],
    hint: S => `${Math.min(10, S.perfect)} von 10 fehlerfreien Tagesrunden`,
  },
  {
    id: 'kirsch', name: 'Kirschblüten-Garten', desc: '4 Reihen komplett auf Gold',
    progress: S => [Math.min(4, goldRows(S)), 4],
    hint: S => `${Math.min(4, goldRows(S))} von 4 Reihen auf Gold`,
  },
  {
    id: 'riff', name: 'Korallenriff', desc: '35 richtige Antworten in einer Blitzrunde',
    progress: S => [Math.min(35, S.best.blitz), 35],
    hint: S => `Blitz-Rekord ${S.best.blitz} von 35`,
  },
  {
    id: 'weltraum', name: 'Weltraumgarten', desc: 'Alle 155 Aufgaben mindestens auf Silber',
    progress: S => { const n = Object.values(S.items).filter(it => level(it) >= 2).length; return [n, 155]; },
    hint: S => `${Object.values(S.items).filter(it => level(it) >= 2).length} von 155 auf Silber oder Gold`,
  },
];

/** Schaltet erreichte Motive frei (dauerhaft) und liefert die neu freigeschalteten */
export function checkThemes(S, now) {
  const got = [];
  for (const t of THEMES) {
    if (S.themes[t.id]) continue;
    const [cur, goal] = t.progress(S, now);
    if (cur >= goal) { S.themes[t.id] = now; got.push(t); }
  }
  return got;
}

/** Wählbare Motive: Standard, in der Weihnachtszeit Weihnachten, dazu alle freigeschalteten */
export function selectableThemes(S, date) {
  const ids = ['standard'];
  if (isChristmasSeason(date)) ids.push('christmas');
  for (const t of THEMES) if (S.themes[t.id]) ids.push(t.id);
  return ids;
}

/** Angezeigtes Motiv: 'auto' heißt Weihnachten in der Weihnachtszeit, sonst Standard */
export function activeTheme(S, date) {
  const sel = S.forestTheme || 'auto';
  const xmas = isChristmasSeason(date);
  if (sel === 'auto') return xmas ? 'christmas' : 'standard';
  if (selectableThemes(S, date).includes(sel)) return sel;
  return xmas ? 'christmas' : 'standard';
}
