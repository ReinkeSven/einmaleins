import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, MIN, allKeys, freshState, migrate, encodeBackup, decodeBackup, level, record, weight,
  pickWeighted, poolFor, weakest, makeQ, canon, distractors, streak, lvl, xpGain, checkMedals, dkey,
} from '../app/js/model.js';

const T0 = new Date('2026-11-02T10:00:00').getTime();

test('155 Aufgaben: 55 Mal-Paare und 100 Teilaufgaben', () => {
  const keys = allKeys();
  assert.equal(keys.length, 155);
  assert.equal(keys.filter(k => k[0] === 'm').length, 55);
  assert.equal(keys.filter(k => k[0] === 'd').length, 100);
});

test('makeQ liefert immer eine korrekt lösbare Aufgabe', () => {
  for (const k of allKeys()) {
    for (const r of [0.1, 0.5, 0.7, 0.9]) {
      const q = makeQ(k, () => r);
      const nums = q.tok.map(t => (t === null ? q.ans : t));
      const [a, op, b, , c] = nums;
      if (op === '·') assert.equal(a * b, c, `${k}: ${nums.join(' ')}`);
      else assert.equal(a / b, c, `${k}: ${nums.join(' ')}`);
    }
  }
});

test('canon zeigt die Aufgabe mit Ergebnis', () => {
  assert.equal(canon('m7x8'), '7 · 8 = 56');
  assert.equal(canon('d7x8'), '56 : 8 = 7');
});

test('Box steigt nur mit Mindestabstand, Fehler werfen zwei Stufen zurück', () => {
  const S = freshState(T0);
  const k = 'm7x8';
  record(S, k, true, 2000, T0);
  record(S, k, true, 2000, T0 + 1000);
  assert.equal(S.items[k].b, 2);
  record(S, k, true, 2000, T0 + 2000); // zu früh für Box 3
  assert.equal(S.items[k].b, 2);
  record(S, k, true, 2000, T0 + 21 * MIN);
  assert.equal(S.items[k].b, 3);
  record(S, k, false, 2000, T0 + 22 * MIN);
  assert.equal(S.items[k].b, 1);
  assert.equal(S.items[k].w, 1);
});

test('Langsame richtige Antworten steigen ab Box 2 nicht auf', () => {
  const S = freshState(T0);
  const k = 'm6x7';
  record(S, k, true, 8000, T0);
  record(S, k, true, 8000, T0 + 1);
  assert.equal(S.items[k].b, 2);
  record(S, k, true, 8000, T0 + DAY);
  assert.equal(S.items[k].b, 2);
});

test('Gold erst ab Box 4 und unter 4 Sekunden', () => {
  assert.equal(level({ b: 0, c: 0, w: 0, t: 0 }), -1);
  assert.equal(level({ b: 4, c: 5, w: 0, t: 3000 }), 3);
  assert.equal(level({ b: 4, c: 5, w: 0, t: 6000 }), 2);
  assert.equal(level({ b: 2, c: 2, w: 0, t: 2000 }), 1);
});

test('Fehlerhafte Aufgaben werden höher gewichtet als gemeisterte', () => {
  const S = freshState(T0);
  Object.assign(S.items.m7x8, { b: 0, c: 1, w: 4, t: 6000, l: T0 - DAY });
  Object.assign(S.items.m3x4, { b: 5, c: 9, w: 0, t: 1500, l: T0 - DAY });
  assert.ok(weight(S, 'm7x8', T0) > 10 * weight(S, 'm3x4', T0));
});

test('pickWeighted vermeidet ausgeschlossene Aufgaben', () => {
  const S = freshState(T0);
  const pool = ['m2x3', 'm4x5', 'm6x7'];
  for (let i = 0; i < 50; i++) assert.notEqual(pickWeighted(S, pool, ['m2x3'], T0), 'm2x3');
});

test('poolFor filtert nach Modus und Reihe', () => {
  assert.equal(poolFor('mal').length, 55);
  assert.equal(poolFor('teilen').length, 100);
  assert.equal(poolFor('mal', 7).length, 10);
  assert.ok(poolFor('teilen', 7).every(k => k.endsWith('x7')));
});

test('weakest liefert die schwierigsten Aufgaben zuerst', () => {
  const S = freshState(T0);
  Object.assign(S.items.m7x8, { b: 0, c: 1, w: 5, t: 7000 });
  for (const k of poolFor('mal')) if (k !== 'm7x8') Object.assign(S.items[k], { b: 5, c: 5, t: 1500 });
  assert.equal(weakest(S, 3, poolFor('mal'))[0], 'm7x8');
});

test('Backup überlebt einen Hin- und Rückweg inklusive Umlauten', () => {
  const S = freshState(T0);
  record(S, 'm7x8', true, 1800, T0);
  S.note = 'Größe ✓';
  const back = decodeBackup(encodeBackup(S));
  assert.equal(back.items.m7x8.c, 1);
  assert.equal(back.note, 'Größe ✓');
  assert.throws(() => decodeBackup('kaputt'));
});

test('migrate ergänzt fehlende Felder', () => {
  const s = migrate({ items: { m7x8: { c: 3 } }, xp: 120 });
  assert.equal(s.xp, 120);
  assert.equal(s.items.m7x8.c, 3);
  assert.equal(s.items.m7x8.b, 0);
  assert.equal(Object.keys(s.items).length, 155);
  assert.deepEqual(s.best, { blitz: 0, bossMs: 0 });
});

test('Streak zählt aufeinanderfolgende Spieltage', () => {
  const S = freshState(T0);
  for (const off of [0, 1, 2, 4]) S.days[dkey(new Date(T0 - off * DAY))] = { n: 1, c: 1, ms: 1, r: 1, daily: 0 };
  assert.equal(streak(S, T0), 3);
  assert.equal(streak(S, T0 + DAY), 3); // heute noch nicht gespielt: Serie bleibt
});

test('Level-Schwellen bei 100 und 300 XP', () => {
  assert.equal(lvl(0).n, 1);
  assert.equal(lvl(99).n, 1);
  assert.equal(lvl(100).n, 2);
  assert.equal(lvl(300).n, 3);
});

test('XP: Basis, Tempo- und Kettenbonus', () => {
  assert.equal(xpGain(6000, 1), 10);
  assert.equal(xpGain(1500, 1), 15);
  assert.equal(xpGain(1500, 20), 25);
});

test('Medaillen werden genau einmal vergeben', () => {
  const S = freshState(T0);
  S.rounds = 1;
  assert.deepEqual(checkMedals(S, T0).map(m => m.id), ['start']);
  assert.equal(checkMedals(S, T0).length, 0);
});

test('Falschantworten sind verschieden, positiv und nie die Lösung', () => {
  for (const k of allKeys()) {
    for (const r of [0.05, 0.5, 0.95]) {
      const q = makeQ(k, () => r);
      const d = distractors(q, 2, Math.random);
      assert.equal(d.length, 2, k);
      assert.equal(new Set(d).size, 2, k);
      for (const v of d) {
        assert.ok(v > 0, `${k}: ${v}`);
        assert.notEqual(v, q.ans, k);
      }
    }
  }
});

test('Falschantworten sind plausibel nah an der Aufgabe', () => {
  const q = { k: 'm7x8', tok: [7, '·', 8, '=', null], ans: 56 };
  const plausible = new Set([64, 48, 63, 49, 66, 46, 65]);
  for (let i = 0; i < 20; i++) assert.ok(distractors(q).every(v => plausible.has(v)));
});
