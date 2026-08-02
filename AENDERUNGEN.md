# FairMix 1.20.0 – Lite und Pro aus einer Quelle

Service-Worker-Cache: `fairmix-v29`
213 Smoketests (Pro und Lite), Validator und Stresstest grün.

## Der Schalter

Ganz oben in `index.html`:

    const IS_LITE = false;
    const LITE_LOCKED = ['roles', 'fixed', 'rules', 'levels',
                         'partners', 'classes', 'data'];

`build-lite.sh` legt genau diese eine Zeile um und ändert sonst nur
Paketkennung, Anzeigename, Cache-Name und Icons. Der Code ist identisch –
jeder Fehler, den die Tester in Pro finden, ist damit auch in Lite behoben.

**Entscheidend ist, wie die Sperre wirkt.** Lite schreibt *nichts* in das
`features`-Objekt, sondern legt eine Prüfung darüber:

    function featureOn(key) { return !liteLocked(key) && features[key] !== false; }

Damit stehen in einer Lite-Sicherung nie lauter `false`-Schalter. Zusätzlich
trägt jeder Export `lite: true`, und Pro überspringt beim Import den
`features`-Block solcher Dateien. Sonst startete die gekaufte Fassung nach
dem Umstieg ohne die Funktionen, für die bezahlt wurde.

## Import und Export getrennt

Bisher hingen beide am Schalter `data`. Jetzt:

    function canExport() { return IS_LITE || featureOn('data'); }
    function canImport() { return featureOn('data'); }

Der Einstellungsbereich ist in zwei Kästen geteilt – „Backup als Datei"
(Export) und „Backup einlesen" (Import). Die Backup-Erinnerung folgt jetzt
dem Export statt dem Import; sonst hätte Lite nie erinnert.

## Der Umstieg

Gesperrte Zeilen in den Einstellungen tragen ein Schloss und die Marke
„nur in Pro". Die ganze Zeile führt zu einem Hinweis: Aufzählung aller
gesperrten Funktionen, die drei Schritte des Umzugs, ein Knopf zum
Exportieren und einer, der über `window.open(url, '_system')` den
Play-Store-Eintrag von Pro öffnet. Die Adresse steht als Zeichenkette im
Skript, nicht als `href` – die App lädt keine externen Ressourcen.

## Ergebnis der Code-Prüfung (Architektur & QA)

**Hoch**

1. Die Zurück-Taste hätte den neuen Hinweis nicht geschlossen, sondern die
   App beendet – ausgerechnet im Moment der Kaufentscheidung. Der Hinweis
   steht jetzt in der Kette der Overlays bei `backbutton`, `keydown` und
   Hintergrundklick. Der Validator prüft, dass die Abfrage vor `exitApp`
   steht.

2. Der Schutz gegen das Umschalten gesperrter Funktionen war unerreichbar:
   das Kästchen stand auf `disabled`, also feuerte `onchange` nie. Die
   Mutation blieb unentdeckt – derselbe Befund wie bei der Verdopplung in
   `switchToSelectedClass()`. `disabled` ist raus, stattdessen
   `aria-disabled` plus wirksame Prüfung im Handler. Nebeneffekt: TalkBack
   überspringt die Zeilen nicht mehr; wer sich die App vorlesen lässt,
   erfährt jetzt überhaupt von den Zusatzfunktionen.

**Mittel**

3. Drei Versionsnummern waren auseinandergelaufen: `APP_VERSION` 1.19.0,
   `config.xml` 1.8.1, README 1.5.1. Ein Fehlerbericht ließe sich damit
   keinem Stand zuordnen. Alles auf 1.20.0 / versionCode 12000, und der
   Validator vergleicht die drei Stellen künftig.

4. `LITE_LOCKED` konnte Namen enthalten, die es in `FEATURES` gar nicht
   gibt – ein Tippfehler hätte eine Funktion still freigeschaltet. Der
   Validator gleicht die Listen jetzt ab.

5. Paketkennung und Anzeigename werden geprüft: Pro darf keine
   `.lite`-Kennung tragen und Lite keine Pro-Kennung. Nach der
   Veröffentlichung ist daran nichts mehr zu ändern.

**Ohne Befund**

- Keine Netzwerkzugriffe, kein `eval`, kein `new Function`. `window.open`
  bekommt eine Konstante, keine Nutzereingabe.
- `innerHTML` weiterhin nur zum Leeren; die Aufzählung im Hinweis läuft
  über `textContent`.
- Kein neuer Speicherschlüssel. Das Datenmodell ist in beiden Fassungen
  identisch – Bedingung dafür, dass Pro Lite-Sicherungen liest.
- Grenzfälle geprüft: Pro-Sicherung mit allen Schaltern auf `true` in Lite
  eingelesen (wirkt nichts, Speicher überlebt), Lite-Sicherung in Pro
  (Namen kommen an, Schalter bleiben), Pro-Sicherung in Pro (Schalter
  werden wiederhergestellt).

Alle Korrekturen sind durch Mutationstests belegt; die Mutation an Punkt 2
hat die Lücke überhaupt erst aufgedeckt.

## Prüfung vor dem Push

    node validate.js      # Struktur, Offline, Rechtstexte, Versionen, Lite-Schalter
    node smoketest.js     # 213 Abläufe – ruft sich selbst als Lite erneut auf
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
