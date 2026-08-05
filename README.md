# Reinigungsplaner - Manager-Dashboard (Version 1)

Diese eigenstaendige App ist fuer den MANAGER gedacht und ergaenzt die Mitarbeiter-App.
Sie verbindet sich mit dem GLEICHEN Google Apps Script Webhook wie die Mitarbeiter-App.

## Funktionen

### Tab "Mitarbeiter"
Wochenliste aller Reinigungskraefte pflegen (Name, E-Mail, aktiv/pausiert).

### Tab "Zimmer"
Taegliche Zimmerliste eintragen, die das Hotel liefert: Zimmernummer, Etage, Farbe
(Blau/Rot/Gelb), WW, Suite - genau wie in der Mitarbeiter-App.

### Tab "Verteilung"
1. Waehlen Sie aus, welche Mitarbeiter heute im Dienst sind.
2. Klicken Sie auf "Zimmer gerecht verteilen". Der Algorithmus sorgt dafuer, dass:
   - JEDER Mitarbeiter die GLEICHE Anzahl Zimmer JEDER Farbe bekommt (Hauptziel),
   - die Etagen pro Mitarbeiter so weit wie moeglich zusammenhaengend sind, um
     Laufwege/Etagenwechsel zu minimieren (Nebenziel).
   - Eine taegliche Rotation sorgt dafuer, dass ueber die Zeit hinweg jeder Mitarbeiter
     mal die "leichten" und mal die "schwierigen" Etagen bekommt.
3. Klicken Sie auf "An Google Drive senden" - jede Zuteilung wird als eigene Datei im
   Google Drive gespeichert, damit die Mitarbeiter-App sie spaeter laden kann.

### Tab "Bericht"
Live-Uebersicht, welche Zimmer schon erledigt und welche noch offen sind. Gruppierung
waehlbar nach Mitarbeiter, Etage oder Farbe. Der Button "Status aktualisieren" ruft die
tatsaechlich abgeschlossenen Reinigungen direkt aus dem gemeinsamen Google-Speicher ab.

## Einrichtung

1. Der Manager richtet EINMALIG das Google Apps Script ein (siehe Datei
   "AppsScript_v3_Manager_und_Mitarbeiter.gs.txt" - falls bereits eine aeltere Version
   des Skripts existiert, den kompletten Code darin ersetzen und neu bereitstellen).
2. Alle App-Dateien (index.html, app.js, styles.css, manifest.json, sw.js, Icons) in ein
   NEUES GitHub-Repository oder einen NEUEN Unterordner hochladen (getrennt von der
   Mitarbeiter-App, da es eine eigene Anwendung ist).
3. In der Manager-App unter Einstellungen die gleiche Webhook-URL eintragen wie in der
   Mitarbeiter-App.

## Wichtiger Hinweis zur Mitarbeiter-App

Damit Mitarbeiter ihre Zuteilung tatsaechlich sehen koennen, muss die Mitarbeiter-App
noch um eine "Zuteilung laden"-Funktion erweitert werden, die per GET
(action=getAssignment) die fuer sie gespeicherte Liste abruft und automatisch in ihre
taegliche Zimmerliste uebernimmt. Bitte im naechsten Schritt anfragen, damit ich auch
die Mitarbeiter-App entsprechend aktualisiere und Ihnen die neue Version zusende.

## Dateistruktur

index.html, app.js, styles.css, manifest.json, sw.js, icon-192.png, icon-512.png,
README.md, AppsScript_v3_Manager_und_Mitarbeiter.gs.txt
