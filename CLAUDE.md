# Hinweise für Claude

- Lernlogik gehört in `app/js/model.js` (reine Funktionen, kein DOM, Zeit und Zufall injizierbar) und wird in `tests/` getestet.
- `app/` wird unverändert ausgeliefert: kein Build-Schritt, keine Laufzeit-Abhängigkeiten.
- Wald-Logik gehört in `app/js/forest-model.js` (rein, abgeleitet aus dem Lernstand). Einzige Wald-Felder im Spielstand: `forestTheme` und `themes` (freigeschaltete Motive).
- Neue Motive als Daten in `app/js/forest-themes.js`; Freischalt-Ziele in `THEMES` (forest-model) mit Tests. Ziele herausfordernd, aber erreichbar halten.
- Vor jedem Commit `npm run check` und `npm run test:e2e`.
- Bei Änderungen in `app/` die `VERSION` in `app/sw.js` erhöhen und `CHANGELOG.md` pflegen.
- Speicherformat (`einmaleins-arena-v1` im localStorage) abwärtskompatibel halten; neue Felder in `migrate()` ergänzen.
- UI-Texte auf Deutsch, Zielgruppe 12 Jahre.
