# FairMix Pro – Stand 1.16.1

Service-Worker-Cache: `fairmix-v24`

## Neu in diesem Paket

**Icons vollständig ersetzt.** Motiv aus der eigenen Vorlage freigestellt,
Kartenrundung und Schlagschatten entfernt.

- `icon.png` (512×512), `icon-192.png`, `icon-maskable-512.png` – volle
  Quadrate ohne transparente Ränder, Maße stimmen mit `manifest.json` überein
- `res/android/icon_fg_*.png` – sechs Dichten, echter Alphakanal (rund 90 %
  transparent). Vorher waren diese Dateien deckend weiß und haben die
  Hintergrundfarbe des adaptiven Icons vollständig überdeckt.
- `res/android/icon_*.png` – sechs Dichten in den korrekten Android-Maßen
  (36/48/72/96/144/192)
- `res/android/colors.xml` – Hintergrundfarbe auf `#f4f8fc` geändert,
  passend zur hellen Karte des Motivs

## Prüfung vor dem Push

    node validate.js      # Struktur, Offline-Fähigkeit, Rechtstexte, Icons
    node smoketest.js     # 189 Abläufe
    node stresstest.js    # 3000 Gruppenbildungen gegen die Paar-Regeln
    ./mutate.sh           # Mutationsprüfung, unterscheidet Testfehler und Absturz

Alle drei müssen grün sein. `mutate.sh` wird nach einer Codeänderung
zusammen mit einer absichtlich eingebauten Mutation benutzt.

## Was von Hand zu prüfen bleibt

Die Tests laufen auf einer DOM-Attrappe ohne Darstellung und können kein
Layout sehen. Vor jedem Store-Build auf dem Gerät durchgehen:

- alle sieben Seiten in Hoch- und Querformat
- heller und dunkler Modus
- größte Schriftgröße des Systems
- Präsentationsmodus scrollen: nichts darf unter die Steuerleiste rutschen
- Startbildschirm: sieht das Icon in echter Größe brauchbar aus

## Offen

- Lite/Pro-Umbau (`IS_LITE`-Schalter, Sperren, Umstiegshinweis)
- Data-Safety-Formular: Partnerhistorie und gezogene Namen nachtragen
- Zahlungsprofil für die kostenpflichtige Fassung
