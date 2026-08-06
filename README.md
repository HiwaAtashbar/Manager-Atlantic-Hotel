# Reinigungsplaner - Manager-Dashboard (Version 3 - mit Bitte-nicht-stören)

## Neu in dieser Version

1. **Faire Verteilung korrigiert**: Prioritaet 1 = minimale Etagenwechsel pro Mitarbeiter (zusammenhaengender Etagenbereich), Prioritaet 2 = exakt gleiche Zimmeranzahl.
2. **"Bitte nicht stören" (rote Karte)**: Im Zimmer-Formular erscheint bei Status "Gelb" ein zusaetzliches Feld. Markierte Zimmer werden:
   - NICHT verteilt (Algorithmus schliesst sie aus),
   - NICHT in Statistiken/Berichten mitgezaehlt,
   - automatisch an den Webhook gemeldet, damit die Mitarbeiter-App sie aus ihrer eigenen Liste entfernt.

## Einrichtung

1. Datei "AppsScript_v4_Manager_und_Mitarbeiter.gs.txt" im bestehenden Apps-Script-Projekt einfuegen (alten Code ersetzen, neu bereitstellen - URL bleibt gleich).
2. In den Einstellungen der App die Webhook-URL eintragen (gleiche wie in der Mitarbeiter-App).

## Tabs

- **Mitarbeiter**: Wochenliste (Name, E-Mail, aktiv/pausiert).
- **Zimmer**: Taegliche Zimmerliste (Nummer, Etage, Farbe, WW, Suite, Bitte-nicht-stören).
- **Verteilung**: Anwesende waehlen, verteilen, an Google Drive senden.
- **Bericht**: Live-Status, gruppierbar nach Mitarbeiter/Etage/Farbe.

## Dateistruktur

index.html, app.js, styles.css, manifest.json, sw.js, icon-192.png, icon-512.png, README.md, AppsScript_v4_Manager_und_Mitarbeiter.gs.txt
