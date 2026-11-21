# Hinweise für Claude

- Lernlogik gehört in `app/js/model.js` (reine Funktionen, kein DOM, Zeit und Zufall injizierbar) und wird in `tests/` getestet.
- `app/` wird unverändert ausgeliefert: kein Build-Schritt, keine Laufzeit-Abhängigkeiten.
- Vor jedem Commit `npm run check`.
- Bei Änderungen in `app/` die `VERSION` in `app/sw.js` erhöhen und `CHANGELOG.md` pflegen.
- Speicherformat (`einmaleins-arena-v1` im localStorage) abwärtskompatibel halten; neue Felder in `migrate()` ergänzen.
- UI-Texte auf Deutsch, Zielgruppe 12 Jahre.
