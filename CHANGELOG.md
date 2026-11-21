# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

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
