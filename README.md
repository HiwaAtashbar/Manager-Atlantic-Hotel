# Reinigungsplaner - Manager-Dashboard (Version 2)

## Wichtige Korrektur der Verteilungslogik

In der vorherigen Version wurde zuerst nach Farbe balanciert und erst danach die
Etage beruecksichtigt - das fuehrte zu ungleichen Zimmeranzahlen (z. B. 4/3/5) und
unnoetig vielen Etagenwechseln pro Mitarbeiter (siehe Screenshot-Feedback).

Die Prioritaeten wurden jetzt korrekt umgesetzt:

1. **Prioritaet 1: Minimale Etagenwechsel.** Alle Zimmer eines Tages werden nach
   Etage sortiert (unabhaengig von der Farbe). Jeder Mitarbeiter bekommt einen
   ZUSAMMENHAENGENDEN Abschnitt aus dieser sortierten Liste - dadurch besucht er
   nur die Etagen, die in seinem Abschnitt liegen, meist nur 1-2 Etagen.
2. **Prioritaet 2: Exakt gleiche Zimmeranzahl.** Da die Abschnitte gleich gross
   gebildet werden (Gesamtzahl / Anzahl Mitarbeiter, Rest wird auf die ersten
   Mitarbeiter verteilt), bekommt jeder Mitarbeiter die gleiche oder maximal 1
   Zimmer mehr/weniger als die anderen.
3. Ein taeglicher Rotations-Wert sorgt dafuer, dass nicht immer derselbe
   Mitarbeiter die "guten" (z. B. unteren) Etagen bekommt.

Getestet mit genau dem Szenario aus Ihrem Screenshot (12 Zimmer, 3 Mitarbeiter,
Etagen 3-5): Ergebnis jetzt 4/4/4 Zimmer, und die Mitarbeiter besuchen zusammen
nur noch 4 Etagen-Zuweisungen statt vorher deutlich mehr.

## Funktionen (unveraendert)

- **Mitarbeiter**: Wochenliste pflegen (Name, E-Mail, aktiv/pausiert).
- **Zimmer**: Taegliche Zimmerliste eintragen (Nummer, Etage, Farbe, WW, Suite).
- **Verteilung**: Anwesende auswaehlen, "Zimmer gerecht verteilen" klicken, Ergebnis
  ansehen (inkl. Etagen pro Mitarbeiter), "An Google Drive senden".
- **Bericht**: Live-Status (erledigt/offen), gruppierbar nach Mitarbeiter, Etage
  oder Farbe.

## Einrichtung

1. Der Manager richtet einmalig das Google Apps Script ein (Datei
   "AppsScript_v3_Manager_und_Mitarbeiter.gs.txt"; falls eine aeltere Version
   existiert, den Code darin komplett ersetzen und neu bereitstellen).
2. Alle App-Dateien in ein Repository/Verzeichnis hochladen.
3. In den Einstellungen der App die Webhook-URL eintragen (gleiche URL wie in der
   Mitarbeiter-App).

## Dateistruktur

index.html, app.js, styles.css, manifest.json, sw.js, icon-192.png, icon-512.png,
README.md, AppsScript_v3_Manager_und_Mitarbeiter.gs.txt
