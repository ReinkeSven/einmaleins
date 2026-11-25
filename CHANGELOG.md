# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [1.4.0] - 2026-11-25

### Hinzugefügt
- Weihnachtswald, automatisch vom 1. Dezember bis 6. Januar: Schnee, Schneekappen, Lichterketten an den Tannen, Geschenke unter blühenden Bäumen, Schneemänner, Rentiere, zugefrorener Bach, ab Heiligabend ein Stern am Nachthimmel
- Fünf freispielbare Motive mit eigenen Farben, Wetter und Deko: Zauberwald (Wald ohne Durst), Süßigkeitenwald (10 fehlerfreie Tagesrunden), Kirschblüten-Garten (4 Reihen Gold), Korallenriff (35 im Blitz), Weltraumgarten (alle Aufgaben mindestens Silber)
- Motivauswahl im Wald-Tab mit Fortschritt für gesperrte Motive; Meldung im Rundenergebnis beim Freischalten
- Neue Felder im Spielstand: `forestTheme`, `themes` (abwärtskompatibel über `migrate()`)

## [1.3.0] - 2026-11-22

### Hinzugefügt
- Wald: Jede Aufgabe ist eine Pflanze, die mit dem Lernstand wächst (Samen, Spross, Jungbaum, Baum, blühend). Bäume für Malaufgaben, Blumen für Teilaufgaben, ein Hain pro Reihe.
- Durstige Pflanzen für Aufgaben, die länger nicht geübt wurden; Gießrunde übt genau diese. Pflanzen sterben nie.
- Bewohner durch Fleiß und Erfolge: Eichhörnchen, Fuchs, Hase, Vögel, Pilze, Schmetterlinge, Bach, Hirsch
- Pixel-Panorama zum Wischen mit Tag, Dämmerung und Nacht nach Uhrzeit; Pflanze antippen zeigt die Aufgabe
- Wald-Vorschau auf der Startseite und Wald-Karte im Rundenergebnis
- E2E-Tests mit Playwright (Handy-Format) für alle Hauptabläufe, in der CI vor dem Deployment

### Geändert
- Gemeinsame Pixel-Helfer in `pixel.js` für Monster-Hüpfen und Wald

## [1.2.2] - 2026-11-21

### Geändert
- Monster-Hüpfen: höher und länger springen (60 statt 46 px, weniger Schwerkraft); auch kurzes Tippen springt mindestens 40 px und damit sicher über ein Monster; etwas gnädigere seitliche Trefferzone

## [1.2.1] - 2026-11-21

### Geändert
- Monster-Hüpfen ruhiger: Starttempo 34 statt 46 px/s, Höchsttempo 50 statt 70 px/s, langsamere Steigerung, Monster laufen gemächlicher

## [1.2.0] - 2026-11-21

### Geändert
- Monster-Hüpfen im Retro-Pixel-Look: Welt in niedriger Auflösung, ganzzahlig und ohne Glättung hochskaliert; Pixel-Sprites für Axolotl, Monster, Münzen, Herzen, Wolken, Hügel, Büsche und Ziegelboden; Pixelschrift „Press Start 2P“ für Texte

## [1.1.0] - 2026-11-21

### Hinzugefügt
- Monster-Hüpfen: Jump and Run nur zum Spaß. Auf das Monster mit der richtigen Zahl springen, über die anderen hinweg. Zählt nicht für Album, Statistik, XP oder Medaillen; gespeichert wird nur der Bestwert.
- Plausible Falschantworten (`distractors()`) im Lernmodell, mit Tests

## [1.0.0] - 2026-11-21

### Hinzugefügt
- Spielmodi Tagesrunde, Blitz, Boss und Reihen-Training für Mal- und Teilaufgaben
- Spaced Repetition pro Aufgabe mit Leitner-Boxen und Gewichtung nach Fehlern und Antwortzeit
- Album, Medaillen, XP, Level, Streak und Statistik
- Installierbare PWA mit Offline-Cache und dauerhaftem Speicher
- Backup als Datei oder Code, Wiederherstellung per Datei oder Code
- Unit-Tests für das Lernmodell, ESLint, CI und automatisches Deployment auf GitHub Pages
