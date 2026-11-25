# Einmaleins-Arena

[![CI & Deploy](https://github.com/ReinkeSven/einmaleins/actions/workflows/ci.yml/badge.svg)](https://github.com/ReinkeSven/einmaleins/actions/workflows/ci.yml)

Lernspiel fürs kleine Einmaleins, vorwärts (`7 · 8`) und rückwärts (`56 : 8`, `8 · ? = 56`), als installierbare Web-App für das Handy.

**App:** https://reinkesven.github.io/einmaleins/

## Funktionen

- **Spaced Repetition pro Aufgabe:** Leitner-Boxen 0 bis 5 mit Mindestabständen zwischen Aufstiegen; Ziehungsgewicht nach Box, Fehlerquote, Antwortzeit und Fälligkeit
- **Modi:** Tagesrunde (15 Aufgaben), Blitz (60 s), Boss (10 schwierigste Aufgaben), Reihen-Training
- **Monster-Hüpfen:** Jump and Run nur zum Spaß, auf das Monster mit der richtigen Zahl springen. Zählt nicht für die Statistik.
- **Gamification:** Album als 10×10-Matrix (Übung, Bronze, Silber, Gold), 30 Medaillen, XP und Level, Streak
- **Wald:** jede Aufgabe eine Pflanze, die mit dem Lernstand wächst; durstige Pflanzen und Gießrunde; Bewohner für Serien und Erfolge; Tag und Nacht; Weihnachtswald im Dezember und fünf freispielbare Motive
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

## Wald

| Größe | Regel |
|---|---|
| Pflanzenstufe | Neu → Samen, Übung → Spross, Bronze → Jungbaum, Silber → Baum, Gold → blühend |
| Haine | einer pro Reihe: 10 Bäume (n·1 … n·10, Tauschaufgaben teilen sich den Zustand) und 10 Blumen ((n·j) : n) |
| Durst | geübt, aber länger als max(1 Tag, 2 × Wiederholungsintervall der Box) nicht wiederholt |
| Gießrunde | bis zu 12 durstige Aufgaben, die am stärksten überfälligen zuerst |
| Bewohner | aus Serie, Bossen, fehlerfreien Runden, Aufgabenzahl, Blitz-Rekord, Gold-Aufgaben und Gold-Reihen abgeleitet (16 Tiere bis zum Einhorn bei 155 × Gold) |
| Weihnachtsmann | in der Weihnachtszeit, sobald die heutige Tagesrunde geschafft ist |
| Weihnachtswald | automatisch vom 1. Dezember bis 6. Januar (Auswahl „Automatisch“) |
| Motive | Zauberwald: 60 wachsende Pflanzen ohne Durst · Süßigkeitenwald: 10 fehlerfreie Tagesrunden · Kirschblüten-Garten: 4 Reihen Gold · Korallenriff: 35 im Blitz · Weltraumgarten: alle 155 mindestens Silber |

Der Wald wird aus dem Lernstand berechnet. Gespeichert werden nur die gewählte Ansicht (`forestTheme`) und freigeschaltete Motive (`themes`), damit ein erreichtes Motiv frei bleibt. Motive als Daten: [`app/js/forest-themes.js`](app/js/forest-themes.js). Details in [`app/js/forest-model.js`](app/js/forest-model.js).

## Entwicklung

Voraussetzung: Node.js ab Version 20.

```bash
npm install
npm run check      # ESLint und Unit-Tests
npm run test:e2e   # Browser-Tests (einmalig vorher: npx playwright install chromium)
npm start          # lokaler Server auf http://localhost:8080
```

### Aufbau

```
app/               ausgelieferte Web-App (wird so auf GitHub Pages veröffentlicht)
  index.html
  css/styles.css
  js/model.js      Lernmodell, reine Funktionen ohne DOM
  js/app.js        Oberfläche und Spielablauf
  js/runner.js     Monster-Hüpfen (Canvas)
  js/forest-model.js  Wald-Logik, reine Funktionen
  js/forest.js     Wald-Panorama (Canvas)
  js/forest-themes.js  Wald-Motive als Daten (Farben, Wetter, Deko)
  js/pixel.js      gemeinsame Pixel-Art-Helfer
  sw.js            Service Worker (Offline-Cache)
  manifest.webmanifest
  icons/
tests/             Unit-Tests für Lernmodell und Wald (node:test)
tests/e2e/         Browser-Tests im Handy-Format (Playwright)
.github/workflows  CI (Lint, Unit- und Browser-Tests) und Deployment auf GitHub Pages
```

### Release

1. Änderungen auf `main` mergen. Die CI prüft und veröffentlicht automatisch.
2. Bei Änderungen an Dateien in `app/` die `VERSION` in `app/sw.js` erhöhen, damit installierte Apps den neuen Stand laden.
3. Eintrag in [`CHANGELOG.md`](CHANGELOG.md) ergänzen.

## Lizenz

[MIT](LICENSE)
