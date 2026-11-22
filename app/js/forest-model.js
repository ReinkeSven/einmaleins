// Wald-Logik: reine Funktionen ohne DOM. Der Wald wird vollständig aus dem Lernstand S berechnet,
// es gibt keinen eigenen Speicher. Pflanzen wachsen mit dem Können, Bewohner kommen durch Fleiß und Erfolge.

import { DAY, IVL, level, streak, rowGold } from './model.js';

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
];

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
