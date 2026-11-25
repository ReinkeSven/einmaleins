// End-to-End-Tests der Hauptabläufe im Handy-Format
import { test, expect, seed, seededState, maxedState, readState, playRound } from './helpers.js';

test.describe('Lernen', () => {
  test('Startseite zeigt Album, Modi und Wald-Vorschau', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-1')).toHaveText('1×1');
    await expect(page.locator('.cell')).toHaveCount(100);
    await expect(page.locator('#forest-preview')).toBeVisible();
    await expect(page.locator('#tabs button')).toHaveCount(5);
  });

  test('Tagesrunde: richtig gelöst, Statistik, Medaille und Wald wachsen', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-act=daily]');
    await playRound(page);
    await expect(page.locator('.hero h1')).toHaveText('Tagesrunde geschafft');
    await expect(page.locator('.stat b').first()).toHaveText('15/15');
    await expect(page.locator('.new-medals')).toContainText('Los geht’s');
    await expect(page.locator('.forest-card')).toContainText('gewachsen');
    const S = await readState(page);
    expect(S.total).toBe(15);
    expect(S.rounds).toBe(1);
    expect(S.perfect).toBe(1);
    expect(Object.values(S.days)[0].daily).toBe(1);
  });

  test('Falsche Antwort zeigt die Lösung und kommt in der Runde erneut', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-act=daily]');
    const asked = await playRound(page, { wrongAt: [0] });
    expect(asked).toBe(16);                       // 15 + 1 Wiederholung
    await expect(page.locator('.stat b').first()).toHaveText('15/16');
    await expect(page.locator('.list')).toBeVisible(); // „Kommen öfter dran“
  });

  test('Fortschritt bleibt nach dem Neuladen erhalten', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-act=daily]');
    await playRound(page);
    await page.reload();
    const S = await readState(page);
    expect(S.total).toBe(15);
    await expect(page.locator('.cta.done')).toBeVisible();
  });

  test('Backup: Code exportieren und wieder einspielen', async ({ page }) => {
    await seed(page, seededState());
    await page.goto('/');
    await page.click('#tabs [data-tab=more]');
    const code = await page.inputValue('#exp');
    expect(code.startsWith('EMX1:')).toBe(true);
    await page.click('[data-act=reset]');
    await page.click('[data-act=reset]');
    expect((await readState(page)).total).toBe(0);
    await page.click('#tabs [data-tab=more]');
    await page.fill('#imp', code);
    await page.click('[data-act=import]');
    await page.click('[data-act=importConfirm]');
    await expect(page.locator('.ok-msg')).toHaveText('Fortschritt wiederhergestellt.');
    expect((await readState(page)).total).toBe(820);
  });
});

test.describe('Wald', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, seededState());
  });

  test('zeigt Haine, Durst, Stufen und Bewohner passend zum Spielstand', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    await expect(page.locator('#forest-cv')).toBeVisible();
    await expect(page.locator('.grove-nav button')).toHaveCount(10);
    await expect(page.locator('.grove-nav [data-grove="7"]')).toHaveClass(/\bg\b/);   // 7er-Hain golden
    await expect(page.locator('.grove-nav [data-grove="6"]')).not.toHaveClass(/\bg\b/);
    await expect(page.getByRole('heading', { name: /Pflanzen haben Durst/ })).toBeVisible();
    const on = name => page.locator('.medal-card.on', { hasText: name });
    const off = name => page.locator('.medal-card.off', { hasText: name });
    for (const n of ['Eichhörnchen', 'Fuchs', 'Hase', 'Vögel ×3', 'Pilze ×4', 'Bach', 'Hirsch']) await expect(on(n)).toBeVisible();
    await expect(page.locator('.medal-card.on', { hasText: 'Schmetterlinge' })).toHaveCount(1);
    await expect(off('Hirsch')).toHaveCount(0);
  });

  test('Pflanze antippen öffnet die Aufgabe mit ihren Werten', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    await page.click('[data-grove="3"]');
    await page.waitForTimeout(700);              // Kamerafahrt
    const pt = await page.locator('#forest-cv').evaluate(cv => cv.forestApi.plantPoint('m3x7'));
    expect(pt).not.toBeNull();
    await page.locator('#forest-cv').click({ position: pt });
    await expect(page.locator('#sheet .big')).toHaveText('3 · 7 = 21');
    await expect(page.locator('#sheet .pill')).toHaveText('Gold');
  });

  test('Wischen bewegt den Ausschnitt', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    const cv = page.locator('#forest-cv');
    await page.click('[data-grove="1"]');
    await page.waitForTimeout(700);
    const before = await cv.evaluate(c => c.forestApi.camX);
    const box = await cv.boundingBox();
    await page.mouse.move(box.x + box.width - 20, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 100, { steps: 10 });
    await page.mouse.up();
    const after = await cv.evaluate(c => c.forestApi.camX);
    expect(after).toBeGreaterThan(before + 50);
    await expect(page.locator('#sheet')).toBeHidden(); // Wischen ist kein Antippen
  });

  test('Gießrunde übt durstige Aufgaben und gießt sie', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    const thirstyBefore = Number((await page.getByRole('heading', { name: /Durst/ }).textContent()).match(/\d+/)[0]);
    await page.click('[data-act=water]');
    await playRound(page);
    await expect(page.locator('.hero h1')).toHaveText('Gießrunde geschafft');
    await expect(page.locator('.forest-card')).toContainText('12 Pflanzen gegossen');
    await page.click('.forest-card [data-tab=forest]');
    const thirstyAfter = Number((await page.getByRole('heading', { name: /Durst/ }).textContent()).match(/\d+/)[0]);
    expect(thirstyAfter).toBe(thirstyBefore - 12);
  });

  for (const [label, hour, dark] of [['Tag', 12, false], ['Nacht', 23, true]]) {
    test(`Himmel passt zur Tageszeit: ${label}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(2026, 10, 22, hour, 0));
      await page.goto('/');
      await page.click('#tabs [data-tab=forest]');
      await page.waitForTimeout(300);
      const [r, g, b] = await page.locator('#forest-cv').evaluate(cv => [...cv.getContext('2d').getImageData(cv.width / 2, 4, 1, 1).data]);
      const brightness = (r + g + b) / 3;
      if (dark) expect(brightness).toBeLessThan(80); else expect(brightness).toBeGreaterThan(120);
    });
  }
});

test.describe('Motive', () => {
  const themeOf = page => page.locator('#forest-cv').evaluate(cv => cv.forestApi.theme);

  test('Im November: Standard, Motive gesperrt mit Fortschritt, kein Weihnachtswald', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 25, 12));
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    expect(await themeOf(page)).toBe('standard');
    await expect(page.locator('[data-theme="auto"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-theme="christmas"]')).toHaveCount(0);
    for (const id of ['zauber', 'suess', 'kirsch', 'riff', 'weltraum']) await expect(page.locator(`[data-theme="${id}"]`)).toBeDisabled();
    await expect(page.locator('[data-theme="suess"]')).toContainText('0 von 10 fehlerfreien Tagesrunden');
    await expect(page.locator('.themes').locator('..')).toContainText('0 von 5 freigespielt');
  });

  test('Im Dezember automatisch Weihnachtswald, abwählbar und gespeichert', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 11, 10, 12));
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    expect(await themeOf(page)).toBe('christmas');
    await page.click('[data-theme="standard"]');
    expect(await themeOf(page)).toBe('standard');
    expect((await readState(page)).forestTheme).toBe('standard');
    await page.reload();
    await page.click('#tabs [data-tab=forest]');
    expect(await themeOf(page)).toBe('standard');
    await page.click('[data-theme="christmas"]');
    expect(await themeOf(page)).toBe('christmas');
  });

  test('Fehlerfreie Runde schaltet den Süßigkeitenwald frei, danach wählbar', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 25, 12));
    const S = seededState(new Date(2026, 10, 25, 12).getTime());
    S.perfect = 9;
    await seed(page, S);
    await page.goto('/');
    await page.click('[data-act=daily]');
    await playRound(page);
    await expect(page.locator('.forest-card')).toContainText('Neues Motiv freigeschaltet: Süßigkeitenwald');
    await page.click('.forest-card [data-tab=forest]');
    await expect(page.locator('[data-theme="suess"]')).toBeEnabled();
    await page.click('[data-theme="suess"]');
    expect(await themeOf(page)).toBe('suess');
    expect((await readState(page)).themes.suess).toBeTruthy();
  });

  test('Bereits erreichte Ziele werden beim Start freigeschaltet', async ({ page }) => {
    const S = seededState();
    S.best.blitz = 36;
    await seed(page, S);
    await page.goto('/');
    expect((await readState(page)).themes.riff).toBeTruthy();
    await page.click('#tabs [data-tab=forest]');
    await page.click('[data-theme="riff"]');
    expect(await themeOf(page)).toBe('riff');
  });

  for (const id of ['christmas', 'zauber', 'suess', 'kirsch', 'riff', 'weltraum']) {
    test(`Motiv ${id} zeichnet fehlerfrei bei Tag und Nacht`, async ({ page }) => {
      const S = seededState(new Date(2026, 11, 24, 12).getTime());
      S.themes = { zauber: 1, suess: 1, kirsch: 1, riff: 1, weltraum: 1 };
      S.forestTheme = id;
      await seed(page, S);
      for (const hour of [12, 23]) {
        await page.clock.setFixedTime(new Date(2026, 11, 24, hour));
        await page.goto('/');
        await page.click('#tabs [data-tab=forest]');
        expect(await themeOf(page)).toBe(id);
        await page.waitForTimeout(400);
        await page.click('[data-grove="10"]');
        await page.waitForTimeout(400);
      }
    });
  }
});

test.describe('Bewohner', () => {
  test('Mit allem freigespielt sind alle Tiere da und zeichnen fehlerfrei', async ({ page }) => {
    const now = new Date(2026, 10, 25, 12);
    await page.clock.setFixedTime(now);
    await seed(page, maxedState(now.getTime()));
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    for (const name of ['Igel', 'Frosch', 'Specht', 'Marienkäfer ×3', 'Eule', 'Biber', 'Bär', 'Einhorn']) {
      await expect(page.locator('.medal-card.on', { hasText: name })).toBeVisible();
    }
    await expect(page.locator('.medal-card.off')).toHaveCount(0);
    await expect(page.locator('.medal-card', { hasText: 'Weihnachtsmann' })).toHaveCount(0); // nicht in der Saison
    for (const n of [3, 4, 6, 7, 9, 10]) { await page.click(`[data-grove="${n}"]`); await page.waitForTimeout(250); }
  });

  test('Weihnachtsmann kommt im Dezember nach der Tagesrunde', async ({ page }) => {
    const now = new Date(2026, 11, 10, 17);
    await page.clock.setFixedTime(now);
    await seed(page, seededState(now.getTime()));
    await page.goto('/');
    await page.click('#tabs [data-tab=forest]');
    await expect(page.locator('.medal-card.off', { hasText: 'Weihnachtsmann' })).toBeVisible();
    await page.click('#tabs [data-tab=home]');
    await page.click('[data-act=daily]');
    await playRound(page);
    await expect(page.locator('.forest-card')).toContainText('Weihnachtsmann');
    await page.click('.forest-card [data-tab=forest]');
    await expect(page.locator('.medal-card.on', { hasText: 'Weihnachtsmann' })).toBeVisible();
  });
});

test.describe('Spaß und Technik', () => {
  test('Monster-Hüpfen läuft und verändert die Lernstatistik nicht', async ({ page }) => {
    await seed(page, seededState());
    await page.goto('/');
    const before = await readState(page);
    await page.click('[data-act=runner]');
    const cv = page.locator('.r-canvas');
    await cv.click();                              // Start
    for (let i = 0; i < 6; i++) { await cv.click(); await page.waitForTimeout(400); }
    await page.click('.r-exit');
    await expect(page.locator('.brand-1')).toBeVisible();
    const after = await readState(page);
    expect(after.total).toBe(before.total);
    expect(after.items).toEqual(before.items);
    expect(after.xp).toBe(before.xp);
  });

  test('App startet nach dem ersten Besuch auch offline', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();                           // jetzt kontrolliert der Service Worker die Seite
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.brand-1')).toHaveText('1×1');
    await page.click('#tabs [data-tab=forest]');
    await expect(page.locator('#forest-cv')).toBeVisible();
    await context.setOffline(false);
  });
});
