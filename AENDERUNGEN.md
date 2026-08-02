# FairMix Pro 1.19.0 – finale Fassung vor dem Lite/Pro-Umbau

Service-Worker-Cache: `fairmix-v28`
200 Smoketests, Validator und Stresstest grün.

## Ergebnis der Code-Prüfung (Architektur & QA)

**Hoch**
1. Backup-Import konnte halb durchlaufen. Scheiterte der zweite
   Schreibvorgang, lag fremder Zustand neben alten Klassen. Jetzt wird
   vorher gesichert und bei Fehlern zurückgerollt. Die Schreiblogik ist
   nach `importDataFromObject()` ausgelagert und damit prüfbar.
2. Partnerhistorie wuchs unbegrenzt: 267 KB nach 20 Läufen bei 300
   Namen, rechnerisches Maximum 44850 Paare. Deckel `PAIR_HISTORY_MAX`
   (6000), gekappt wird nach Häufigkeit – oft gepaarte bleiben erhalten.
   Greift auch beim Laden alter Sicherungen.

**Mittel**
3. `parseInt(1e308)` ergab 1: Sicherungen mit unsinniger Formatversion
   wurden angenommen. Prüfung jetzt über `Number` mit Ober- und
   Untergrenze.
4. `savedLists` wurde nur oberflächlich geprüft. Einträge ohne
   Namensliste führten erst später zu "Klasse beschädigt".
5. `parseInt("-5abc")` ergab -5, `"2.7"` wurde stillschweigend zu 2.
   Beides erzeugte Gruppen ohne Rückmeldung. Jetzt `Number` mit
   Ganzzahlprüfung.

**Ohne Befund**
- Keine Netzwerkzugriffe, kein `eval`, kein `new Function`.
- `innerHTML` wird ausschließlich zum Leeren verwendet; alle Nutzertexte
  laufen über `textContent`. Namen mit `<img src=x onerror=...>` sind
  dadurch ungefährlich.
- Vier Speicherschlüssel, alle im Datenschutztext abgedeckt.
- Gruppenbildung bei 400 Namen: 362 ms, durch `PARTNER_BUDGET_MS`
  gedeckelt.
- Grenzfälle geprüft: leere Liste, ein Name, alle abwesend, Regel mit
  sich selbst, widersprüchliche Regeln, 200-Zeichen-Namen, Namen als
  Zahlen, kaputte Strukturen aus Backups – kein Absturz.

Alle sieben Korrekturen sind durch Mutationstests belegt.

## Prüfung vor dem Push

    node validate.js      # Struktur, Offline, Rechtstexte, Icon-Maße
    node smoketest.js     # 200 Abläufe
    node stresstest.js    # 3000 Gruppenbildungen
    ./mutate.sh           # nach einer eingebauten Mutation aufrufen

## Was die Tests nicht sehen

Layout. Vor jedem Store-Build auf dem Gerät: alle Seiten in beiden
Ausrichtungen, hell und dunkel, größte Systemschrift, Präsentationsmodus
scrollen, Icon auf dem Startbildschirm.

## Nächster Schritt: Lite

Funktionsschalter, die Lite ausschaltet:
`roles`, `fixed`, `rules`, `levels`, `partners`, `classes`

Noch zu trennen: Import und Export hängen beide am Schalter `data`.
Lite braucht den Export für den Umstieg, aber keinen Import.

Weiter offen: Data-Safety-Formular (Partnerhistorie), Zahlungsprofil.
