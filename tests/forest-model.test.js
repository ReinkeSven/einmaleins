import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, HOUR, freshState, record, poolFor, dkey } from '../app/js/model.js';
import {
  stageOf, isThirsty, thirstiest, groves, creatures, summary, snapshot, diff, featuredGrove, computeForest,
} from '../app/js/forest-model.js';

const T0 = new Date('2026-11-02T10:00:00').getTime();
const gold = { b: 4, c: 6, w: 0, t: 2000, l: T0, u: T0 };

test('Stufen folgen dem Lernstand: Neu → Samen … Gold → blühend', () => {
  assert.equal(stageOf({ b: 0, c: 0, w: 0, t: 0 }), 0);
  assert.equal(stageOf({ b: 0, c: 1, w: 1, t: 3000 }), 1);
  assert.equal(stageOf({ b: 2, c: 2, w: 0, t: 3000 }), 2);
  assert.equal(stageOf({ b: 3, c: 3, w: 0, t: 3000 }), 3);
  assert.equal(stageOf(gold), 4);
});

test('Durst: nie bei neuen Aufgaben, frühestens nach einem Tag, bei hoher Box später', () => {
  assert.equal(isThirsty({ b: 0, c: 0, w: 0, t: 0, l: 0 }, T0), false);
  const it = { b: 1, c: 2, w: 0, t: 2000, l: T0 };
  assert.equal(isThirsty(it, T0 + 23 * HOUR), false);
  assert.equal(isThirsty(it, T0 + 25 * HOUR), true);
  const high = { b: 5, c: 9, w: 0, t: 1500, l: T0 };
  assert.equal(isThirsty(high, T0 + 10 * DAY), false);
  assert.equal(isThirsty(high, T0 + 15 * DAY), true);
});

test('Üben gießt: eine Antwort beendet den Durst', () => {
  const S = freshState(T0);
  record(S, 'm7x8', true, 2000, T0);
  const later = T0 + 3 * DAY;
  assert.equal(isThirsty(S.items.m7x8, later), true);
  record(S, 'm7x8', true, 2000, later);
  assert.equal(isThirsty(S.items.m7x8, later), false);
});

test('thirstiest liefert nur durstige Aufgaben, am stärksten überfällige zuerst', () => {
  const S = freshState(T0);
  Object.assign(S.items.m7x8, { b: 1, c: 1, l: T0 - 5 * DAY });
  Object.assign(S.items.m3x4, { b: 1, c: 1, l: T0 - 2 * DAY });
  Object.assign(S.items.m6x6, { b: 5, c: 9, t: 1500, l: T0 - 2 * DAY }); // hohe Box: noch nicht durstig
  assert.deepEqual(thirstiest(S, 10, T0), ['m7x8', 'm3x4']);
  assert.deepEqual(thirstiest(S, 1, T0), ['m7x8']);
  assert.deepEqual(thirstiest(freshState(T0), 5, T0), []);
});

test('Zehn Haine mit je 10 Bäumen und 10 Blumen; Tauschaufgaben teilen sich den Baum', () => {
  const S = freshState(T0);
  Object.assign(S.items.m3x7, gold);
  const g = groves(S, T0);
  assert.equal(g.length, 10);
  for (const grove of g) {
    assert.equal(grove.trees.length, 10);
    assert.equal(grove.flowers.length, 10);
    assert.ok(grove.flowers.every(f => f.k.endsWith(`x${grove.n}`)));
  }
  assert.equal(g[2].trees[6].k, 'm3x7');
  assert.equal(g[6].trees[2].k, 'm3x7');
  assert.equal(g[2].trees[6].stage, 4);
  assert.equal(g[6].trees[2].stage, 4);
});

test('Hain ist golden, wenn alle Aufgaben der Reihe Gold sind', () => {
  const S = freshState(T0);
  for (const k of poolFor('mix', 7)) Object.assign(S.items[k], gold);
  const g = groves(S, T0);
  assert.equal(g[6].gold, true);
  assert.equal(g[5].gold, false);
  assert.equal(creatures(S, T0).hirsch, 1);
});

test('Bewohner erscheinen durch Fleiß und Erfolge', () => {
  const S = freshState(T0);
  assert.ok(Object.values(creatures(S, T0)).every(v => v === 0));
  for (let i = 0; i < 7; i++) S.days[dkey(new Date(T0 - i * DAY))] = { n: 1, c: 1, ms: 1, r: 1, daily: 1 };
  S.bosses = 1; S.perfect = 9; S.total = 650;
  const c = creatures(S, T0);
  assert.equal(c.eichhoernchen, 1);
  assert.equal(c.fuchs, 1);
  assert.equal(c.hase, 1);
  assert.equal(c.voegel, 5);
  assert.equal(c.pilze, 3);
  assert.equal(c.bach, 1);
});

test('Zusammenfassung zählt die 155 Aufgaben', () => {
  const S = freshState(T0);
  Object.assign(S.items.m7x8, gold);
  Object.assign(S.items.d7x8, { b: 1, c: 1, l: T0 - 3 * DAY });
  const s = summary(S, T0);
  assert.equal(s.total, 155);
  assert.equal(s.blooming, 1);
  assert.equal(s.growing, 2);
  assert.equal(s.thirsty, 1);
  assert.equal(s.stages.reduce((a, b) => a + b, 0), 155);
});

test('diff erkennt Wachstum, Gießen und neue Bewohner nach einer Runde', () => {
  const S = freshState(T0);
  Object.assign(S.items.m7x8, { b: 1, c: 1, t: 2000, l: T0 - 3 * DAY, u: T0 - 3 * DAY });
  const before = snapshot(S, T0);
  record(S, 'm7x8', true, 2000, T0);  // gegossen und Box 2 → wächst
  S.bosses = 1;                        // Hase zieht ein
  const d = diff(before, snapshot(S, T0));
  assert.deepEqual(d.grown, ['m7x8']);
  assert.deepEqual(d.watered, ['m7x8']);
  assert.deepEqual(d.newCreatures, ['hase']);
});

test('Vorschau zeigt den durstigsten Hain, sonst den am weitesten gewachsenen', () => {
  const S = freshState(T0);
  Object.assign(S.items.m4x9, gold);
  assert.equal(featuredGrove(computeForest(S, T0)), 4);
  Object.assign(S.items.d2x6, { b: 1, c: 1, l: T0 - 3 * DAY });
  assert.equal(featuredGrove(computeForest(S, T0)), 6);
});
