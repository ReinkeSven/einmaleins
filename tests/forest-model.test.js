import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, HOUR, freshState, record, poolFor, dkey } from '../app/js/model.js';
import {
  stageOf, isThirsty, thirstiest, groves, creatures, summary, snapshot, diff, featuredGrove, computeForest,
  THEMES, checkThemes, activeTheme, selectableThemes, isChristmasSeason, isChristmasEve,
} from '../app/js/forest-model.js';
import { migrate } from '../app/js/model.js';

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

test('Weihnachtszeit vom 1. Dezember bis 6. Januar, Stern ab Heiligabend', () => {
  assert.equal(isChristmasSeason(new Date(2026, 10, 30)), false);
  assert.equal(isChristmasSeason(new Date(2026, 11, 1)), true);
  assert.equal(isChristmasSeason(new Date(2027, 0, 6)), true);
  assert.equal(isChristmasSeason(new Date(2027, 0, 7)), false);
  assert.equal(isChristmasEve(new Date(2026, 11, 23)), false);
  assert.equal(isChristmasEve(new Date(2026, 11, 24)), true);
});

test('Aktives Motiv: automatisch Weihnachten im Dezember, sonst Standard', () => {
  const S = freshState(T0);
  assert.equal(activeTheme(S, new Date(2026, 10, 25)), 'standard');
  assert.equal(activeTheme(S, new Date(2026, 11, 10)), 'christmas');
  S.forestTheme = 'standard';
  assert.equal(activeTheme(S, new Date(2026, 11, 10)), 'standard');
  S.forestTheme = 'christmas';                                    // außerhalb der Saison nicht möglich
  assert.equal(activeTheme(S, new Date(2026, 6, 1)), 'standard');
});

test('Gesperrte Motive lassen sich nicht wählen, freigeschaltete schon', () => {
  const S = freshState(T0);
  S.forestTheme = 'riff';
  assert.equal(activeTheme(S, new Date(2026, 6, 1)), 'standard');
  assert.deepEqual(selectableThemes(S, new Date(2026, 6, 1)), ['standard']);
  S.themes.riff = T0;
  assert.equal(activeTheme(S, new Date(2026, 6, 1)), 'riff');
  assert.equal(activeTheme(S, new Date(2026, 11, 10)), 'riff'); // eigene Wahl gilt auch im Dezember
  assert.deepEqual(selectableThemes(S, new Date(2026, 11, 10)), ['standard', 'christmas', 'riff']);
});

test('Motive werden bei Erreichen des Ziels dauerhaft freigeschaltet', () => {
  const S = freshState(T0);
  assert.deepEqual(checkThemes(S, T0), []);
  S.perfect = 10;
  S.best.blitz = 35;
  assert.deepEqual(checkThemes(S, T0).map(t => t.id), ['suess', 'riff']);
  S.best.blitz = 0;                                               // bleibt trotzdem frei
  assert.deepEqual(checkThemes(S, T0), []);
  assert.ok(S.themes.riff);
});

test('Zauberwald: 60 wachsende Pflanzen ohne Durst', () => {
  const S = freshState(T0);
  const keys = Object.keys(S.items).slice(0, 60);
  for (const k of keys) Object.assign(S.items[k], { b: 2, c: 2, t: 3000, l: T0 - 2 * DAY });
  const zauber = THEMES.find(t => t.id === 'zauber');
  assert.equal(zauber.progress(S, T0)[0], 0);                    // alle durstig
  assert.match(zauber.hint(S, T0), /60 Pflanzen haben noch Durst/);
  for (const k of keys) S.items[k].l = T0;                        // gegossen
  assert.deepEqual(zauber.progress(S, T0), [60, 60]);
  assert.deepEqual(checkThemes(S, T0).map(t => t.id), ['zauber']);
});

test('Kirschblüten und Weltraum: Reihen auf Gold, alle Aufgaben auf Silber', () => {
  const S = freshState(T0);
  for (const n of [2, 3, 4, 5]) for (const k of poolFor('mix', n)) Object.assign(S.items[k], gold);
  assert.ok(checkThemes(S, T0).some(t => t.id === 'kirsch'));
  const welt = THEMES.find(t => t.id === 'weltraum');
  assert.ok(welt.progress(S, T0)[0] < 155);
  for (const it of Object.values(S.items)) Object.assign(it, { b: 3, c: 3, t: 3000, l: T0 });
  assert.deepEqual(welt.progress(S, T0), [155, 155]);
});

test('Alte Spielstände ohne Motiv-Felder bleiben gültig', () => {
  const old = freshState(T0);
  delete old.themes; delete old.forestTheme;
  const s = migrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(s.themes, {});
  assert.equal(s.forestTheme, 'auto');
});

test('Neue Bewohner: Igel, Frosch, Specht, Marienkäfer, Eule, Biber, Bär, Einhorn', () => {
  const S = freshState(T0);
  const c0 = creatures(S, T0);
  for (const id of ['igel', 'frosch', 'specht', 'marienkaefer', 'eule', 'biber', 'baer', 'einhorn']) assert.equal(c0[id], 0, id);
  Object.assign(S, { bosses: 5, total: 1000, bestStreak: 14 });
  S.best.blitz = 25;
  for (const k of Object.keys(S.items).filter(k => k[0] === 'd')) Object.assign(S.items[k], { b: 2, c: 2, t: 3000, l: T0 });
  Object.keys(S.items).slice(0, 50).forEach(k => Object.assign(S.items[k], gold));
  const c = creatures(S, T0);
  for (const id of ['igel', 'frosch', 'specht', 'eule', 'biber']) assert.equal(c[id], 1, id);
  assert.equal(c.marienkaefer, 3);
  assert.equal(c.einhorn, 0);
  for (const it of Object.values(S.items)) Object.assign(it, gold);
  const all = creatures(S, T0);
  assert.equal(all.einhorn, 1);
  assert.equal(all.baer, 1);
});

test('Bär ab 3 goldenen Reihen, Eule bleibt nach abgerissener Serie', () => {
  const S = freshState(T0);
  for (const n of [2, 5]) for (const k of poolFor('mix', n)) Object.assign(S.items[k], gold);
  assert.equal(creatures(S, T0).baer, 0);
  for (const k of poolFor('mix', 9)) Object.assign(S.items[k], gold);
  assert.equal(creatures(S, T0).baer, 1);
  S.bestStreak = 14;                                             // aktuelle Serie 0
  assert.equal(creatures(S, T0).eule, 1);
});

test('Weihnachtsmann nur in der Weihnachtszeit und nur nach der heutigen Tagesrunde', () => {
  const S = freshState(T0);
  const dec = new Date(2026, 11, 10, 18).getTime();
  const nov = new Date(2026, 10, 10, 18).getTime();
  assert.equal(creatures(S, dec).weihnachtsmann, 0);
  S.days[dkey(new Date(dec))] = { n: 15, c: 15, ms: 1, r: 1, daily: 1 };
  S.days[dkey(new Date(nov))] = { n: 15, c: 15, ms: 1, r: 1, daily: 1 };
  assert.equal(creatures(S, dec).weihnachtsmann, 1);
  assert.equal(creatures(S, nov).weihnachtsmann, 0);
  assert.equal(creatures(S, dec + DAY).weihnachtsmann, 0);        // am nächsten Tag erst nach der Runde
  const before = snapshot(S, dec + DAY);
  S.days[dkey(new Date(dec + DAY))] = { n: 15, c: 15, ms: 1, r: 1, daily: 1 };
  assert.deepEqual(diff(before, snapshot(S, dec + DAY)).newCreatures, ['weihnachtsmann']);
});
