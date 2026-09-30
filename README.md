# Reinigungsplaner – Manager-App (Version 3)

Passt zur Mitarbeiter-App Version 12 und zum Apps-Script Version 5. Beide Apps verwenden dieselbe Webhook-URL.

## Ablauf eines Tages
1. **Mitarbeiter** (einmal pro Woche): Namen eintragen – exakt wie in der Mitarbeiter-App. „Pausiert“ = diese Woche nicht im Dienst.
2. **Zimmer**: Tagesliste des Hotels eintragen. Schnell: „📋 Mehrere Zimmer auf einmal“, eine Zeile pro Zimmer, z. B. `301 blau`, `302 rot ww`, `303 gelb dnd`, `304 gelb suite`. Die Etage wird aus der Nummer abgeleitet (301 → Etage 3, 1205 → Etage 12) und kann im Einzelformular überschrieben werden.
3. **Verteilung**: Anwesende wählen → „Zimmer gerecht verteilen“ → „An Mitarbeiter senden“. Jeder Mitarbeiter bekommt seine Liste automatisch in die App (Nicht eingeteilte erhalten eine leere Liste, alte Zuteilungen werden so überschrieben).
4. **Bericht**: Live-Stand: erledigt / in Arbeit / offen, wer eingestempelt ist (anwesend / gegangen / nicht eingestempelt), je Mitarbeiter Erledigt x/y nach Farben, Gruppierung nach Mitarbeiter, Etage oder Farbe. Aktualisiert sich alle 60 Sekunden.

## Verteilungslogik
1. Priorität: möglichst wenige Etagenwechsel – jeder Mitarbeiter bekommt einen zusammenhängenden Etagenbereich.
2. Priorität: gleiche Arbeitslast – ohne Suiten exakt gleiche Zimmeranzahl (max. 1 Unterschied); Suiten zählen doppelt.
3. „Bitte nicht stören“-Zimmer werden nie verteilt und nicht mitgezählt; sie werden automatisch aus den Listen der Mitarbeiter entfernt.
4. Ein Tageswert rotiert, wer welchen Etagenbereich bekommt.

## Einrichtung
1. Google Apps Script: Datei `AppsScript_v5_…gs.txt` einfügen (alten Code komplett ersetzen), speichern, **Bereitstellen → Bereitstellungen verwalten → Stift → Neue Version**. Die URL bleibt gleich. Beim ersten Mal Berechtigungen bestätigen (Drive und E-Mail).
2. App-Dateien in das GitHub-Repository der Manager-App hochladen (getrennt von der Mitarbeiter-App!). Icons als `icon-192.png`/`icon-512.png`.
3. ⚙️ → Webhook-URL eintragen → „Verbindung testen“ (zeigt an, wenn das Skript noch veraltet ist).
