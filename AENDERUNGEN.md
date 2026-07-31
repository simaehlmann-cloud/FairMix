# FairMix Pro 1.17.0

Service-Worker-Cache: `fairmix-v25`

## Ziehen deutlich vereinfacht

Es gab zwei Buchhaltungen über dasselbe: eine Liste "schon gezogen" und
den Zähler. Sie konnten sich widersprechen – nach "Neue Runde" zeigte der
Topf wieder 27/27, es kamen aber weiter nur die dran, die noch nicht
gezogen waren. Die Liste ist entfernt.

- Der Topf ergibt sich aus dem Zähler: dran ist, wer am seltensten
  gezogen wurde. Anzeige und Auswahl können nicht mehr auseinanderlaufen.
- Eine Schaltfläche statt zwei: **Neue Runde** setzt die Zähler zurück.
  "Runde und Zähler zurücksetzen" ist weg.
- Nach einem vollen Durchlauf sind alle von selbst wieder im Topf.
- Der lange Erklärtext auf der Ziehen-Seite ist auf zwei Sätze gekürzt.
- Die Radgewichtung ist entfallen: Alle im Topf sind gleich oft dran
  gewesen, sie konnte also nichts mehr bewirken.

Die Zahl der Ziehungen je Name steht weiterhin in der Namensliste.

## Icons

Motiv aus der Vorlage freigestellt, Kartenrundung und Schatten entfernt.
Vordergrundebenen mit echtem Alphakanal, alle Maße passend zum Manifest.
`res/android/colors.xml` steht auf `#f4f8fc`.

## Prüfung vor dem Push

    node validate.js      # Struktur, Offline, Rechtstexte, Icon-Maße
    node smoketest.js     # 182 Abläufe
    node stresstest.js    # 3000 Gruppenbildungen
    ./mutate.sh           # nach einer eingebauten Mutation aufrufen

## Was die Tests nicht sehen

Layout. Vor jedem Store-Build auf dem Gerät: alle Seiten in beiden
Ausrichtungen, hell und dunkel, größte Systemschrift, Präsentationsmodus
scrollen, Icon auf dem Startbildschirm.

## Offen

- Lite/Pro-Umbau
- Data-Safety-Formular: Partnerhistorie nachtragen
- Zahlungsprofil für die kostenpflichtige Fassung
