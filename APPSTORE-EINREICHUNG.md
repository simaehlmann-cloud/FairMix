# FairMix Pro in den App Store – Schritt für Schritt

Für jemanden, der Apps bauen kann, aber bei Apple zum ersten Mal einreicht.
Alles ohne Mac, mit Windows-PC und iPad.

---

## Die vier Tage im Überblick

| | Was | Wo | Dauer |
|---|---|---|---|
| **Tag 1** | App-ID anlegen, Store-Eintrag schreiben | Browser | 2 Std. |
| **Tag 2** | Screenshots erzeugen | Windows + Node | 20 Min. |
| **Tag 3** | Zertifikat, Profil, Secrets, erster Build | Browser + Git Bash | 2–3 Std. |
| **Tag 4** | Auf dem iPad testen, einreichen | iPad + Browser | 1 Std. |

Tag 1 und 2 hängen nicht von Tag 3 ab. Du kannst den Store-Eintrag fertig
schreiben, lange bevor es einen Build gibt.

**Wenn etwas nicht klappt, ist nichts kaputt.** Alles hier ist
wiederholbar. Nur eine Sache nicht: den privaten Schlüssel aus Tag 3
verlieren. Dazu steht dort ein eigener Hinweis.

---

# Tag 1 – App-ID und Store-Eintrag

## 1.1 App-ID anlegen

**Das muss vor allem anderen passieren.** Ohne diesen Schritt taucht
FairMix in App Store Connect gar nicht erst auf.

1. developer.apple.com/account öffnen, anmelden
2. Links **Identifiers** anklicken
3. Blaues **+**
4. **App IDs** wählen → Continue
5. **App** wählen → Continue
6. Ausfüllen:
   - Description: `FairMix Pro`
   - Bundle ID: **Explicit** ankreuzen, dann `de.fairmix.app` eintippen
7. Bei den Capabilities **nichts** ankreuzen
8. Continue → Register

Fertig. Zwei Minuten.

> `de.fairmix.app` ist dieselbe Kennung wie bei Android. Sie muss überall
> zeichengenau gleich sein: hier, im Profil, in der `config.xml` und im
> Store-Eintrag.

## 1.2 App in App Store Connect anlegen

1. appstoreconnect.apple.com öffnen
2. **Meine Apps** → blaues **+** → **Neue App**
3. Ausfüllen:

       Plattform        iOS ankreuzen
       Name             FairMix Pro
       Primäre Sprache  Deutsch
       Bundle-ID        de.fairmix.app aus der Liste wählen
       SKU              fairmix-pro
       Benutzerzugriff  Vollzugriff

4. **Erstellen**

> **Die Bundle-ID steht nicht in der Liste?** Dann fehlt Schritt 1.1.
>
> **„Der App-Name ist bereits vergeben"?** Namen sind Apple-weit einmalig.
> Nimm etwas wie `FairMix Pro – Gruppen bilden`. Der Name in der App
> selbst ändert sich dadurch nicht.

## 1.3 Englisch dazunehmen

Im Eintrag oben links steht die Sprachauswahl (zunächst „Deutsch").
Aufklappen → **Englisch (USA)** hinzufügen.

Jede Sprache braucht **eigene Texte und eigene Screenshots**. Das ist der
Grund, warum es am Ende vier Screenshot-Sätze sind.

## 1.4 Texte eintragen

Fertig zum Kopieren in **Anhang A** am Ende dieser Datei. Zeichenzahlen
sind geprüft.

Reihenfolge im Formular: Untertitel, Beschreibung, Schlüsselwörter,
Support-URL.

Bei Support-URL und Datenschutz-URL trägst du deine GitHub-Pages-Adresse
ein – dieselbe wie im Play Store.

## 1.5 Kategorie und Altersfreigabe

    Kategorie, primär     Bildung
    Kategorie, sekundär   Produktivität

Altersfreigabe: Fragebogen ausfüllen, überall **„Keine"** bzw. **„Nie"**.
Ergebnis ist 4+.

## 1.6 Datenschutz

Der Abschnitt, an dem Einreichungen am häufigsten hängen bleiben.

**App-Datenschutz** → **Datenerfassung** → **„Nein, wir erfassen keine
Daten aus dieser App"**.

Damit entfallen alle Folgefragen. Das stimmt bei FairMix tatsächlich – die
App sendet nichts.

Diese Angabe muss zu drei anderen Stellen passen: deiner
Datenschutzerklärung, der Datei `PrivacyInfo.xcprivacy` im Build und
deinem Play-Store-Formular. Bei FairMix sagen alle vier dasselbe.

## 1.7 Preis

Unter **Preise und Verfügbarkeit**.

**Anders als bei Google ist das nicht endgültig.** Du kannst später
zwischen kostenlos und kostenpflichtig wechseln.

Falls kostenpflichtig, vorher zwei Dinge erledigen:

- **Verträge, Steuern und Bankverbindung** → Vertrag „Paid Applications"
  abschließen, Bankverbindung und Steuerangaben hinterlegen. Ohne das
  bleibt der Eintrag blockiert.
- **App Store Small Business Program** anmelden. Apples Anteil sinkt von
  30 % auf 15 %. Ein Formular, lohnt sich ab dem ersten Euro.

## 1.8 Prüfnotizen

Ganz unten im Eintrag, Feld **Notizen für die Überprüfung**. Das liest ein
Mensch. Text steht in **Anhang B**.

---

# Tag 2 – Screenshots

## 2.1 Warum das aufwendiger ist als gedacht

Apple verlangt Bilder in exakten Pixelmaßen. Stimmen sie nicht auf den
Punkt, weist App Store Connect sie beim Hochladen ab.

Pflicht sind zwei Geräteklassen:

    iPhone, 6,9 Zoll      1290 × 2796
    iPad, 13 Zoll         2048 × 2732

Mal zwei Sprachen sind das vier Sätze zu je vier bis fünf Bildern.

## 2.2 Der schnelle Weg: automatisch

Einmalig:

```bash
npm install --no-save playwright
npx playwright install chromium
```

Dann:

```bash
node store-bilder.js
```

Das Skript startet FairMix, laedt die Beispielklasse, geht die fuenf
Ansichten durch und nimmt alles auf – iPhone und iPad, Deutsch und
Englisch, zwanzig Bilder. Danach prueft es jedes einzelne gegen sein
Sollmass und meldet Abweichungen, statt sie dich beim Hochladen finden
zu lassen.

Ergebnis liegt in `store-bilder/`, aufgeteilt in vier Ordner, die den
vier Plaetzen in App Store Connect entsprechen.

**Trotzdem durchsehen.** Das Skript garantiert die Masse, nicht den
Inhalt. Zeigt jedes Bild etwas Sinnvolles? Ist irgendwo ein Bereich leer
geblieben? Das faellt im Review auf.

Damit ist Tag 2 in zwanzig Minuten erledigt statt in zwei Stunden.

## 2.3 Der Weg von Hand (falls das Skript klemmt)

FairMix ist eine Web-App – die Oberfläche im Browser ist dieselbe wie in
der App. Damit brauchst du kein Gerät.

**Nicht die GitHub-Pages-Adresse nehmen.** Dort liegen nur
Datenschutzerklärung und Impressum; die App selbst ist bewusst nicht
veröffentlicht.

Stattdessen im Repo-Ordner:

```bash
python3 screenshots.py
```

Das Skript startet FairMix lokal und schreibt dir die Schritte noch einmal
in die Konsole. Ein Doppelklick auf die `index.html` reicht übrigens
nicht: Chrome sperrt bei `file://` den lokalen Speicher, und die App kann
sich dann keine Namen merken.

Dann in Chrome:

1. **Einstellungen → „Beispielklasse laden"**
   Lädt 24 Namen, Stufen und zwei Regeln. Damit sieht die App gefüllt aus,
   ohne dass du tippen musst.
2. **F12**
3. **Strg + Umschalt + M**
4. Oben **„Responsive"** wählen, Breite und Höhe eintragen
5. **DPR auf 1 stellen** ← der häufigste Fehler. Steht dort 2 oder 3,
   kommt das Bild doppelt so groß heraus und Apple weist es ab.
6. Rechts in der Leiste die drei Punkte → **Capture screenshot**

## 2.4 Was aufs Bild gehört

Apple verlangt, dass Screenshots die App im Gebrauch zeigen. Also keine
leeren Startbildschirme.

1. Fertige Gruppeneinteilung mit Namen
2. Automatische Erzeugung nach Gruppengröße
3. Regeln: immer zusammen / nie zusammen
4. Gruppenpuzzle mit Stamm- und Expertengruppen
5. Präsentationsmodus in großer Schrift

Die ersten drei sind die, die in der Suche erscheinen.

Danach Sprache in der App umstellen und denselben Durchgang für Englisch
wiederholen.

---

# Tag 3 – Zertifikat, Profil, Build

Der technische Teil. Alles unter Windows in **Git Bash** (kommt mit Git
for Windows mit – rechte Maustaste im Repo-Ordner → „Git Bash here").

## 3.1 Was hier passiert, in einfachen Worten

Apple nimmt nur Apps an, die mit einem Zertifikat signiert sind. Das
funktioniert wie bei Android, nur mit mehr Schritten:

- **Privater Schlüssel** – erzeugst du selbst, bleibt bei dir
- **Signieranfrage (CSR)** – daraus abgeleitet, schickst du an Apple
- **Zertifikat** – bekommst du von Apple zurück
- **Profil** – verbindet Zertifikat und App-ID

Das Skript `ios-secrets.sh` nimmt dir alles ab außer den zwei Besuchen auf
Apples Webseite.

## 3.2 Schlüssel erzeugen

```bash
chmod +x ios-secrets.sh
./ios-secrets.sh anfang
```

Es entsteht ein Ordner `ios-signierung/` mit zwei Dateien.

> **Der wichtigste Satz dieser Anleitung:**
> Sichere `ios-signierung/ios_distribution.key` an einem zweiten Ort.
>
> Ohne diese Datei ist das Zertifikat wertlos, und du kannst nie wieder
> ein Update einreichen – dieselbe Bedeutung wie dein Android-Keystore.
> Nicht ins Repo hochladen.

## 3.3 Zertifikat bei Apple holen

1. developer.apple.com/account → **Certificates** → **+**
2. **Apple Distribution** wählen → Continue
3. **Choose File** → `ios-signierung/ios_distribution.csr` hochladen
4. Continue → **Download**
5. Die Datei `distribution.cer` nach `ios-signierung/` legen

## 3.4 Profil bei Apple holen

1. Links **Profiles** → **+**
2. Unter „Distribution" **App Store Connect** wählen → Continue
3. App-ID `de.fairmix.app` wählen → Continue
4. Das eben erstellte Zertifikat ankreuzen → Continue
5. Name: `FairMix Pro App Store` → Generate → **Download**
6. Die `.mobileprovision` nach `ios-signierung/` legen

## 3.5 Secrets erzeugen

```bash
./ios-secrets.sh ende
```

Das Skript fragt nach einem Passwort (frei wählbar, merken), prüft das
Ergebnis und zeigt dir dann alle fünf Werte an.

Zwei davon – `IOS_SIGNING_IDENTITY` und `IOS_TEAM_ID` – liest es direkt
aus dem Zertifikat aus. Ohne Mac käme man sonst schwer an sie heran.

## 3.6 Secrets in GitHub eintragen

Repository → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**

| Name | Inhalt |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | Inhalt von `secret-p12.txt` |
| `IOS_CERTIFICATE_PASSWORD` | das eben vergebene Passwort |
| `IOS_PROVISIONING_PROFILE` | Inhalt von `secret-profil.txt` |
| `IOS_TEAM_ID` | zeigt das Skript an |
| `IOS_SIGNING_IDENTITY` | zeigt das Skript an |

Die `.txt`-Dateien enthalten je eine sehr lange Zeile. Komplett markieren
(Strg+A im Editor), kopieren, einfügen. Keine Umbrüche einfügen.

## 3.7 Schlüssel für den Upload

App Store Connect → **Benutzer und Zugriff** → **Integrationen** →
**App Store Connect API** → **+**

    Name     GitHub Actions
    Zugriff  App Manager

> **Die `.p8`-Datei lässt sich genau einmal herunterladen.** Verlierst du
> sie, musst du einen neuen Schlüssel anlegen. Der alte lässt sich dann
> widerrufen – kein Drama, aber unnötig.

Drei weitere Secrets:

| Name | Inhalt |
|---|---|
| `ASC_KEY_ID` | steht in der Liste, zehn Zeichen |
| `ASC_ISSUER_ID` | steht über der Liste |
| `ASC_KEY_P8` | Inhalt der `.p8`, vollständig mit BEGIN/END |

## 3.8 Dateien ins Repo

    ios.yml                  ->  .github/workflows/ios.yml
    make-ios-icons.py        ->  Wurzelverzeichnis
    screenshots.py           ->  Wurzelverzeichnis
    ios-secrets.sh           ->  Wurzelverzeichnis
    store-bilder.js          ->  Wurzelverzeichnis
    PrivacyInfo.xcprivacy    ->  res/ios/PrivacyInfo.xcprivacy
    config.xml               ->  ersetzt die vorhandene
    validate.js              ->  ersetzt die vorhandene
    index.html               ->  ersetzt die vorhandene

In die `.gitignore` gehört noch:

    ios-signierung/
    res/ios/icon-*.png
    res/ios/Default*.png

Dann die Prüfkette wie gewohnt, und push.

## 3.9 Bauen

GitHub → **Actions** → **Build FairMix (iOS)** → **Run workflow**

Der Upload läuft **nur** beim manuellen Start, nicht bei jedem Push. Das
ist Absicht: Jede hochgeladene Build-Nummer ist bei Apple dauerhaft
belegt, auch wenn der Build nie eingereicht wird.

Nach 5 bis 30 Minuten erscheint der Build in App Store Connect unter
**TestFlight**. Solange dort „Wird verarbeitet" steht, kannst du ihn nicht
auswählen.

---

# Tag 4 – Testen und einreichen

## 4.1 TestFlight

App Store Connect → **TestFlight** → **Interne Tests** → Gruppe anlegen →
dich selbst hinzufügen.

Anders als bei Google gibt es keine Mindestzahl an Testern und keine
Wartefrist. Du bekommst eine Mail, installierst die TestFlight-App auf dem
iPad und darüber FairMix.

## 4.2 Was du auf dem Gerät prüfen musst

Fünf Dinge, die nur auf echter Hardware auffallen. Zwei davon sind Fehler,
die beim Code-Review gefunden und korrigiert wurden – dass die Korrekturen
greifen, sollte bestätigt sein, bevor du einreichst:

- [ ] **Weckton der Uhr** – Timer stellen, ablaufen lassen. Es muss piepen.
      (Das Gerät darf nicht stummgeschaltet sein.)
- [ ] **Teilen auf dem iPad** – Einteilung als Bild teilen. Die App darf
      nicht abstürzen.
- [ ] **Präsentationsmodus** – die unterste Karte muss sichtbar sein, nicht
      hinter dem Balken am unteren Rand verschwinden.
- [ ] **Statusleiste** – Uhrzeit oben muss weiß sein, nicht schwarz.
- [ ] **Google-Link** in der Datenschutzerklärung – muss Safari öffnen,
      nicht in der App laden.

Findest du etwas, melde es mit der Beobachtung. Neuer Build heißt nur:
`ios-CFBundleVersion` in der `config.xml` erhöhen und neu laufen lassen.

## 4.3 Einreichen

Im Eintrag → Build auswählen → **Zur Überprüfung hinzufügen** →
**Einreichen**.

Bei „Version freigeben" beim ersten Mal **manuell** wählen. Dann
entscheidest du selbst, wann die App erscheint.

Die Prüfung dauert meist ein bis drei Tage.

> **Eine Ablehnung beim ersten Anlauf ist normal.** Das ist kein
> Rückschlag – bei Apple geht fast jede erste Einreichung einmal zurück.
> Im **Resolution Center** steht die Begründung, du antwortest dort und
> reichst erneut ein. Meist ohne neuen Build.

---

# Wenn etwas schiefgeht

| Meldung | Was zu tun ist |
|---|---|
| Bundle-ID fehlt in der Liste | Schritt 1.1 nachholen |
| „App-Name bereits vergeben" | anderen Namen wählen, Schritt 1.2 |
| „The dimensions of one or more screenshots are wrong" | CSS-Größe und Dichte passen nicht zusammen, Schritt 2.3 |
| Text auf den Bildern winzig, viel leere Fläche | CSS-Breite zu groß gesetzt – 430 statt 1290, Schritt 2.3 |
| „Invalid Bundle. Missing Info.plist value" | `node validate.js` laufen lassen, das prüft die kritischen Schlüssel |
| „Missing Privacy Manifest" | `res/ios/PrivacyInfo.xcprivacy` nicht im Repo |
| „icon with alpha channel" | Icons nicht über `make-ios-icons.py` erzeugt |
| „Redundant binary upload" | `ios-CFBundleVersion` erhöhen |
| Build erscheint nicht in TestFlight | 30 Minuten warten, danach im Actions-Protokoll nachsehen |
| „Invalid Bundle Structure“ nach einem cordova-ios-Update | Apache hat die Projektstruktur geändert; der Workflow sucht die Info.plist, statt den Pfad zu raten – die Meldung nennt die Ursache |
| `openssl: command not found` | Git Bash benutzen, nicht die Eingabeaufforderung |
| Build bricht mit „No signing certificate" ab | ein Secret fehlt oder hat Umbrüche, Schritt 3.6 |

---

# Anhang A – Store-Texte

Zeichenzahlen geprüft. Lies gegen, ob der Funktionsumfang noch stimmt.

## Deutsch

**Untertitel** (27 von 30 Zeichen)

    Gruppen bilden und auslosen

**Schlüsselwörter** (84 von 100 Zeichen, keine Leerzeichen)

    gruppen,einteilen,klasse,unterricht,lehrer,auslosen,gruppenpuzzle,zufall,team,schule

**Beschreibung**

    FairMix macht aus einer Namensliste faire Gruppen – schnell,
    nachvollziehbar und ohne Diskussionen.

    Für alle, die regelmäßig Gruppen einteilen: Lehrkräfte und
    Kursleitende ebenso wie Trainerinnen und Trainer im Sport, Leitungen
    von Jugend- und Ferienfreizeiten, Chorleitungen, Ehrenamtliche in der
    Vereinsarbeit oder Teamverantwortliche in Unternehmen.

    GRUPPEN BILDEN
    Von Hand zusammenstellen oder automatisch erzeugen – nach Anzahl der
    Gruppen oder nach gewünschter Gruppengröße. Wer doch noch wechseln
    muss, wird per Fingerdruck in eine andere Gruppe gezogen.

    FAIR HEISST: MIT GEDÄCHTNIS
    FairMix merkt sich, wer zuletzt mit wem zusammen war, und meidet
    Wiederholungen. Beim Ziehen einzelner Namen merkt es sich außerdem,
    wer schon dran war – so wird niemand dauerhaft übergangen.

    REGELN UND STUFEN
    Legen Sie fest, wer immer zusammen und wer nie zusammen landen soll.
    Über Stufen entstehen wahlweise gemischte oder gleichstarke Gruppen.
    Einzelne Personen lassen sich gezielt auf die Gruppen verteilen.

    NAMEN UND GRUPPEN ZIEHEN
    Wer kommt als Nächstes dran, wer übernimmt die Aufgabe? FairMix zieht
    einzelne Namen oder ganze Gruppen – für die Reihenfolge von
    Präsentationen, für Spielrunden oder für die Verteilung von Stationen.

    GRUPPENPUZZLE
    Themen eingeben genügt: FairMix bildet Stammgruppen mit einem Kopf pro
    Thema und die passenden Expertengruppen. Ein Umschalter wechselt
    zwischen beiden Ansichten.

    ROLLEN
    Moderator, Zeitwächter, Sprecher – Rollenkarten geben jedem Mitglied
    eine klare Aufgabe. Eigene Rollen lassen sich jederzeit ergänzen.

    FÜR DEN UNTERRICHT GEMACHT
    Ein Präsentationsmodus mit großer Schrift zeigt die Einteilung an
    Beamer oder Whiteboard. Eine Uhr hilft bei der Zeitplanung. Mehrere
    Klassen lassen sich getrennt verwalten, Namenslisten per CSV
    einlesen, und jede Einteilung lässt sich als Bild speichern und
    teilen.

    OHNE INTERNET, OHNE KONTO
    FairMix arbeitet vollständig offline. Es gibt keine Anmeldung, keine
    Werbung, kein Tracking und keine Datenübertragung. Alle Namen bleiben
    auf Ihrem Gerät.

## Englisch

**Untertitel** (29 von 30 Zeichen)

    Group builder and name picker

**Schlüsselwörter** (80 von 100 Zeichen)

    groups,grouping,classroom,teacher,random,picker,jigsaw,team,students,school,draw

**Beschreibung**

    FairMix turns a list of names into fair groups – quickly,
    transparently and without arguments.

    Made for everyone who regularly divides people into groups: teachers
    and course instructors, sports coaches, leaders of youth and holiday
    camps, choir directors, volunteers in clubs and associations, or team
    leads in companies.

    BUILDING GROUPS
    Put groups together by hand or generate them automatically – by number
    of groups or by desired group size. Anyone who still needs to move is
    simply dragged into another group.

    FAIR MEANS: WITH A MEMORY
    FairMix remembers who was last paired with whom and avoids repeats.
    When drawing individual names it also keeps track of who has already
    had a turn, so nobody is passed over again and again.

    RULES AND LEVELS
    Define who should always end up together and who never should. Levels
    let you build either mixed or evenly matched groups. Individuals can
    be spread deliberately across the groups.

    DRAWING NAMES AND GROUPS
    Who goes next, who takes the task? FairMix draws single names or whole
    groups – for presentation order, for game rounds, or for handing out
    stations.

    JIGSAW METHOD
    Just enter the topics: FairMix builds home groups with one person per
    topic plus the matching expert groups. A switch moves between the two
    views.

    ROLES
    Moderator, timekeeper, presenter – role cards give every member a
    clear task. Add your own roles at any time.

    BUILT FOR THE CLASSROOM
    A presentation mode with large type displays the arrangement on a
    projector or whiteboard. A timer helps with pacing. Several classes
    can be kept separately, name lists imported from CSV, and every
    arrangement saved and shared as an image.

    NO INTERNET, NO ACCOUNT
    FairMix works entirely offline. There is no sign-in, no advertising,
    no tracking and no data transfer. All names stay on your device.

---

# Anhang B – Prüfnotizen

Ins Feld „Notizen für die Überprüfung" kopieren:

    Die App funktioniert vollständig offline. Es gibt kein Benutzerkonto,
    keine Anmeldung und keine Datenübertragung; alle Daten bleiben auf dem
    Gerät.

    Testweg in unter einer Minute:
    Einstellungen -> "Beispielklasse laden" (24 Namen, 2 Regeln)
    -> "Gruppen bilden" -> die Einteilung erscheint.
    Der Präsentationsmodus zeigt sie in großer Schrift.

    The app works entirely offline. No account, no sign-in, no data
    transfer; everything stays on the device.

    Quick test: Settings -> "Load example class" -> "Build groups".

---

# Checkliste vor dem Absenden

- [ ] App-ID registriert (1.1)
- [ ] Bundle-ID `de.fairmix.app` in App-ID, Profil, config.xml und Eintrag identisch
- [ ] Texte auf Deutsch und Englisch
- [ ] Vier Screenshot-Sätze, alle in exakten Maßen
- [ ] Datenerfassung: „keine Daten"
- [ ] Datenschutz-URL erreichbar
- [ ] Kategorie Bildung, Altersfreigabe 4+
- [ ] Prüfnotizen ausgefüllt
- [ ] Bei Bezahlung: Paid-Applications-Vertrag und Small Business Program
- [ ] `ios_distribution.key` an zweitem Ort gesichert
- [ ] Auf echtem iPad geprüft, alle fünf Punkte aus 4.2
