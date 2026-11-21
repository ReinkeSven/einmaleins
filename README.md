# Einmaleins-Arena

[![CI & Deploy](https://github.com/ReinkeSven/einmaleins/actions/workflows/ci.yml/badge.svg)](https://github.com/ReinkeSven/einmaleins/actions/workflows/ci.yml)

Lernspiel fürs kleine Einmaleins, vorwärts (`7 · 8`) und rückwärts (`56 : 8`, `8 · ? = 56`), als installierbare Web-App für das Handy.

**App:** https://reinkesven.github.io/einmaleins/

## Funktionen

- **Spaced Repetition pro Aufgabe:** Leitner-Boxen 0 bis 5 mit Mindestabständen zwischen Aufstiegen; Ziehungsgewicht nach Box, Fehlerquote, Antwortzeit und Fälligkeit
- **Modi:** Tagesrunde (15 Aufgaben), Blitz (60 s), Boss (10 schwierigste Aufgaben), Reihen-Training
- **Gamification:** Album als 10×10-Matrix (Übung, Bronze, Silber, Gold), 30 Medaillen, XP und Level, Streak
- **Statistik:** Trefferquote, Antwortzeiten, Verlauf über 14 Tage, schwierigste Aufgaben
- **Offline-fähig** und auf dem Home-Bildschirm installierbar

## Installation auf dem Handy

1. https://reinkesven.github.io/einmaleins/ im Browser öffnen (iPhone: Safari, Android: Chrome)
2. iPhone: Teilen → „Zum Home-Bildschirm“. Android: Menü → „App installieren“
3. Ab dann über das Icon starten

## Daten und Datenschutz

Der Spielstand liegt ausschließlich im Browser des Geräts (`localStorage`). Es gibt keinen Server, kein Tracking und keine Accounts. Die App fordert dauerhaften Speicher an (`navigator.storage.persist()`).

Daten gehen verloren, wenn die Website-Daten gelöscht werden oder das Gerät zurückgesetzt wird. Deshalb gibt es unter **Backup** einen Export als Datei oder Code und den Import auf einem anderen Gerät.

## Lernmodell

| Größe | Regel |
|---|---|
| Aufgaben | 55 Mal-Paare (Tauschaufgaben gekoppelt), 100 Teilaufgaben |
| Box hoch | richtige Antwort unter 5 s (bis Box 2 auch langsamer), frühestens nach 0 / 0 / 20 min / 20 h / 3 d / 7 d |
| Box runter | Fehler: −2 |
| Gold | Box ≥ 4 und mittlere Antwortzeit < 4 s |
| Gewicht | Grundgewicht je Box × Langsamkeit × Fehlerquote × Fälligkeit; Aufgaben mit 1 und 10 × 0,35 |

Details in [`app/js/model.js`](app/js/model.js).

## Entwicklung

Voraussetzung: Node.js ab Version 20.

```bash
npm install
npm run check   # ESLint und Tests
npm start       # lokaler Server auf http://localhost:8080
```

### Aufbau

```
app/               ausgelieferte Web-App (wird so auf GitHub Pages veröffentlicht)
  index.html
  css/styles.css
  js/model.js      Lernmodell, reine Funktionen ohne DOM
  js/app.js        Oberfläche und Spielablauf
  sw.js            Service Worker (Offline-Cache)
  manifest.webmanifest
  icons/
tests/             Unit-Tests für das Lernmodell (node:test)
.github/workflows  CI (Lint, Tests) und Deployment auf GitHub Pages
```

### Release

1. Änderungen auf `main` mergen. Die CI prüft und veröffentlicht automatisch.
2. Bei Änderungen an Dateien in `app/` die `VERSION` in `app/sw.js` erhöhen, damit installierte Apps den neuen Stand laden.
3. Eintrag in [`CHANGELOG.md`](CHANGELOG.md) ergänzen.

## Lizenz

[MIT](LICENSE)
