# FairMix 1.21.0 – Gruppenpuzzle

Service-Worker-Cache: `fairmix-v30`
229 Smoketests (Pro und Lite), Validator und Stresstest grün.

## Was es tut

Neuer Bereich auf der Seite „Automatische Gruppenerstellung": ein Thema je
Zeile eintippen, Knopf drücken. Die App bildet Stammgruppen mit einem Kopf
pro Thema und Expertengruppen, die alle zum selben Thema sammeln. Ein
Umschalter wechselt zwischen beiden Ansichten.

Bei N Namen und T Themen:

    Stammgruppen  S = floor(N / T)
    Joker         R = N − S·T, besetzen ein Thema doppelt
    Expertengruppe je Thema: S oder S+1 Köpfe

Die Joker gehen reihum auf die Stammgruppen und bekommen jeweils das
bisher kleinste Thema. Beide Aufteilungen bleiben dadurch bis auf einen
Kopf gleich groß. Ein drittes Mal dasselbe Thema in einer Stammgruppe wird
vermieden, solange es geht.

Eine Vorschau nennt die Zahlen schon beim Tippen. Bei nur einer
Stammgruppe warnt die App: jede Expertengruppe hätte dann eine Person.

## Wie es sich einfügt

`teams` bleibt die eine Liste, aus der Darstellung, Ziehen, Präsentation
und Bild-Export leben. Das Puzzle hält beide Aufteilungen daneben und
spiegelt die gewählte nach `teams`. Der Rest der App weiß nichts davon.

In der Stammansicht steht das Thema an der Person – in Liste, Präsentation
und Bild. In der Expertenansicht steht es in der Überschrift.

**Regeln, fixierte Personen, Stufen, Partnerhistorie und Rollen bleiben
außen vor** und werden im Hinweistext genannt. „Anna und Ben zusammen"
hieße dieselbe Stammgruppe, aber zwangsläufig verschiedene
Expertengruppen – halb wirkende Regeln wären schlimmer als keine.

Jeder Handeingriff beendet das Puzzle: wer aus einer Stammgruppe fliegt,
stünde in seiner Expertengruppe noch drin. Die Gruppen bleiben stehen, nur
der Umschalter verschwindet.

Pro-only. In Lite steht die Funktion als gesperrte Zeile in den
Einstellungen.

## Ergebnis der Code-Prüfung

**Hoch**

1. `takeSnapshot()` sicherte das Puzzle, `performUndo()` stellte es nicht
   wieder her. Nach dem Zurückgehen hätte der Umschalter auf eine
   Aufteilung gezeigt, die `teams` gar nicht mehr enthielt. Behoben, mit
   Prüfung durch `validJigsaw()` auch beim Zurückholen.

**Mittel**

2. Die Vorschau rechnete `Math.floor(N / T)` ein zweites Mal – dieselbe
   Verdopplung wie damals in `switchToSelectedClass()`. Die Mutation traf
   zwei Stellen und war nicht eindeutig zuzuordnen. Jetzt rechnet
   `jigsawCounts()` an einer Stelle für Vorschau und Ergebnis.

3. Die Joker-Verteilung war nicht belegt: der Test hatte nur einen Joker,
   die Mutation „alle Joker in dieselbe Gruppe" blieb unentdeckt. Neuer
   Ablauf mit 19 Namen auf 5 Themen prüft, dass sich die Gruppengrößen um
   höchstens einen Kopf unterscheiden.

**Mittel (aus der Laufzeitprüfung)**

4. `parseTopics()` suchte Dubletten mit `some()` über die bisherige Liste –
   die Suche wurde mit jeder Zeile teurer. Die Funktion läuft bei **jedem
   Tastendruck**. Wer eine Namensliste ins Themenfeld einfügt, hätte die
   Eingabe eingefroren: 5000 Zeilen brauchten 405 ms je Anschlag. Jetzt
   eine Merkliste mit `Object.create(null)` und Abbruch bei 20 Themen –
   1,0 ms, also Faktor 400. Ein Ablauf mit Zeitbudget hält das fest.

   `Object.create(null)` statt `{}`, weil ein Thema namens „constructor"
   sonst als schon vorhanden gälte und verschwände. Auch das ist belegt.

**Mittel (aus der Sicherheitsprüfung)**

5. Themen aus einer fremden Sicherung waren ungeprüft: `validJigsaw()`
   verlangte nur „nicht leerer Text". Eine präparierte Datei hätte ein
   Thema mit 100 000 Zeichen, Steuerzeichen oder 500 Themen mitbringen
   können. Kein Skriptrisiko – überall `textContent` –, aber genug, um
   Liste und Präsentation unbrauchbar zu machen. Themen laufen jetzt durch
   dieselbe Prüfung wie eigene Eingaben.

6. Die Datenschutzerklärung nannte die Puzzle-Themen nicht. Ergänzt,
   bevor etwas hochgeladen wird.

**Niedrig**

7. Der Infotext unter „Über FairMix" kannte das Gruppenpuzzle nicht.
   Ergänzt in `aboutP2`, deutsch und englisch.

8. `aboutLite` zählte die Pro-Funktionen ein zweites Mal auf – neben
   `FEATURES`, aus dem der Lite-Hinweis seine Liste baut. Beim Gruppenpuzzle
   liefen die beiden prompt auseinander. Der Absatz verweist jetzt auf den
   Knopf, die Aufzählung steht nur noch an einer Stelle.

**Ohne Befund**

- Laufzeit sonst unauffällig: 35 Namen auf 6 Themen in 0,035 ms, 999 Namen
  auf 20 Themen in 0,65 ms. Die Sicherung wächst um rund 1,6 KB je Klasse,
  weil beide Ansichten gespeichert werden.
- Kein `innerHTML` mit Themennamen, keine neue Plugin-Oberfläche, keine
  Netzwerkzugriffe. Themen im Bild-Export laufen über `fillText`.
- `validJigsaw()` prüft gespeicherte Puzzle-Daten strukturell: Themenindex
  im gültigen Bereich, beide Ansichten mit gleicher Kopfzahl. Ein Index
  ins Leere hätte die Expertenansicht abstürzen lassen. Sieben
  Beschädigungsfälle sind als Ablauf hinterlegt.
- Themennamen laufen durch dieselbe Säuberung wie Namen: Steuerzeichen
  raus, auf 40 Zeichen gekürzt, Dubletten verworfen, höchstens 20 Themen.
- Kein neuer Speicherschlüssel, keine Netzwerkzugriffe, `textContent`
  statt `innerHTML`.

Vierundzwanzig Mutationen, alle erkannt. Drei davon blieben im ersten
Anlauf unentdeckt und haben jeweils eine Lücke im Test aufgedeckt – die
Joker-Verteilung, die Themen-Obergrenze und der Vergleich der Kopfzahlen.

## Was die Tests nicht sehen

Ob die Themenmarke neben langen Namen auf einem schmalen Gerät noch
lesbar ist. Vor dem Store-Build auf dem Gerät prüfen: Stammansicht mit
langen Themennamen, Präsentationsmodus mit fünf Themen, Bild-Export.

## Prüfung vor dem Push

    node validate.js      # Struktur, Offline, Rechtstexte, Versionen, Lite-Schalter
    node smoketest.js     # 229 Abläufe – ruft sich selbst als Lite erneut auf
    node stresstest.js    # 3000 Gruppenbildungen
    ./mutate.sh           # nach einer eingebauten Mutation aufrufen
    ./build-lite.sh       # erzeugt lite/ und prüft es mit FAIRMIX_LITE=1

## Was die Tests nicht sehen

Layout und Icons. Vor jedem Store-Build auf dem Gerät: alle Seiten in
beiden Ausrichtungen, hell und dunkel, größte Systemschrift,
Präsentationsmodus scrollen, **beide Icons auf dem Startbildschirm**.

## Weiter offen

- Data-Safety-Formular (Partnerhistorie, gezogene Namen)
- Zahlungsprofil für Pro – ohne das lässt sich kein Preis setzen, und
  kostenlos → kostenpflichtig geht später nicht mehr
- Reihenfolge: erst Pro veröffentlichen, dann Lite. Der Umstiegsknopf in
  Lite zeigt sonst ins Leere.
