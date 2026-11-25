// Hilfsfunktionen für die E2E-Tests
import { test as base, expect } from '@playwright/test';
import { freshState, poolFor, dkey, DAY, HOUR } from '../../app/js/model.js';

export const KEY = 'einmaleins-arena-v1';

/** Fixture: blockiert externe Schriften, sammelt Seitenfehler und prüft am Ende, dass keine auftraten */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    const isFont = url => /fonts\.(googleapis|gstatic)\.com/.test(url);
    page.on('pageerror', e => errors.push(String(e)));
    // Ladefehler werden über die Antworten geprüft (Schriften ausgenommen), nicht über die Konsole
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400 && !isFont(r.url())) errors.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!isFont(r.url())) errors.push(`fehlgeschlagen: ${r.url()}`); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await use(page);
    expect(errors, 'Fehler in der Seite').toEqual([]);
  },
});
export { expect };

/**
 * Realistischer Spielstand: Pflanzen in allen Stufen, ein Teil durstig,
 * 7er-Reihe komplett Gold, 7 Tage Serie, ein Boss besiegt, 3 fehlerfreie Runden.
 */
export function seededState(now = Date.now()) {
  const S = freshState(now - 30 * DAY);
  Object.keys(S.items).forEach((k, i) => {
    const it = S.items[k];
    const recent = now - HOUR;
    switch (i % 6) {
      case 1: Object.assign(it, { b: 1, c: 2, w: 1, t: 4000, l: recent }); break;
      case 2: Object.assign(it, { b: 2, c: 3, w: 0, t: 3500, l: recent }); break;
      case 3: Object.assign(it, { b: 3, c: 4, w: 0, t: 3000, l: recent }); break;
      case 4: Object.assign(it, { b: 4, c: 6, w: 0, t: 2000, l: recent }); break;
      case 5: Object.assign(it, { b: 2, c: 3, w: 1, t: 3000, l: now - 4 * DAY }); break; // durstig
      default: break;                                                                 // neu
    }
  });
  for (const k of poolFor('mix', 7)) Object.assign(S.items[k], { b: 4, c: 6, w: 0, t: 2000, l: now - HOUR });
  for (let i = 1; i <= 7; i++) S.days[dkey(new Date(now - i * DAY))] = { n: 20, c: 18, ms: 50000, r: 1, daily: 1 };
  Object.assign(S, { total: 820, correct: 700, rounds: 12, perfect: 3, bosses: 1, bestStreak: 7, lastBackup: now });
  return S;
}

/** Setzt einen Spielstand vor dem ersten Laden (nur einmal pro Tab, damit Reloads ihn nicht überschreiben) */
export async function seed(page, state) {
  await page.addInitScript(([key, json]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, json);
      sessionStorage.setItem('seeded', '1');
    }
  }, [KEY, JSON.stringify(state)]);
}

export const readState = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);

/** Liest die aktuelle Aufgabe aus dem DOM und berechnet die Lösung */
export async function currentAnswer(page) {
  const tokens = await page.$$eval('#q > span', spans => spans.map(s => (s.classList.contains('slot') ? null : s.textContent.trim())));
  const [a, op, b, , c] = tokens;
  if (c === null) return op === '·' ? Number(a) * Number(b) : Number(a) / Number(b);
  const known = a === null ? Number(b) : Number(a);
  return Number(c) / known;
}

const waitForQuestionOrEnd = page => page.waitForFunction(() => document.querySelector('#q .slot.empty') || document.querySelector('.hero h1'));

/** Spielt eine Runde bis zum Ende; wrongAt: Indizes, an denen absichtlich falsch geantwortet wird */
export async function playRound(page, { wrongAt = [] } = {}) {
  let i = 0;
  for (; i < 60; i++) {
    await waitForQuestionOrEnd(page);
    if (await page.locator('.hero h1').count()) break;
    const ans = await currentAnswer(page);
    if (wrongAt.includes(i)) {
      const str = String(ans);
      await page.keyboard.type((str[0] === '1' ? '2' : '1').repeat(str.length)); // andere erste Ziffer: sicher falsch
      await expect(page.locator('#fb b')).toBeVisible();
      await page.keyboard.press('1');            // Tippen beendet die Korrektur-Anzeige
    } else {
      await page.keyboard.type(String(ans));
    }
    await page.waitForFunction(() => !document.querySelector('#q.good, #q.bad'));
  }
  await expect(page.locator('.hero h1')).toBeVisible();
  return i;
}

/** Spielstand mit allem: alle Aufgaben Gold, alle Bewohner, heutige Tagesrunde erledigt */
export function maxedState(now = Date.now()) {
  const S = seededState(now);
  for (const it of Object.values(S.items)) Object.assign(it, { b: 5, c: 9, w: 3, t: 1800, l: now - HOUR });
  for (let i = 0; i <= 30; i++) S.days[dkey(new Date(now - i * DAY))] = { n: 20, c: 20, ms: 40000, r: 1, daily: 1 };
  Object.assign(S, { total: 2400, perfect: 12, bosses: 6, bestStreak: 31 });
  S.best.blitz = 41;
  return S;
}
