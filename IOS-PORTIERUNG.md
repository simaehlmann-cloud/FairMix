# FairMix Pro im App Store

Stand 1.22.1. Ergänzt das vorhandene Projektwissen; alles zu Android bleibt
unverändert gültig.

Es gibt **keine Lite-Fassung für iOS**. Apples Richtlinie 4.3 wertet ein
Paar aus kostenloser und kostenpflichtiger App als doppelte Einreichung.
Der von Apple erwartete Weg wäre eine App mit In-App-Kauf – das ist eine
eigene Entwicklung (StoreKit, Kaufwiederherstellung, `IS_LITE` durch einen
Laufzeitschalter ersetzen) und bewusst nicht Teil dieser Portierung.

---

## Was neu dazukommt

    res/ios/PrivacyInfo.xcprivacy     Privacy-Manifest (Pflicht)
    res/ios/icon-*.png                aus make-ios-icons.py, nicht im Repo
    res/ios/Default@2x~universal~anyany.png   ebenso

    make-ios-icons.py     Wurzelverzeichnis
    ios.yml            -> .github/workflows/ios.yml

Geändert: `config.xml` (iOS-Block), `index.html` (drei Korrekturen),
`validate.js` (14 neue Prüfungen).

Die Icons entstehen im CI-Lauf und gehören **nicht** ins Repo – wie bei
Lite. Quelle ist `icon.png`.

---

## Einmalige Einrichtung

### 1. Apple Developer Program

99 € im Jahr, Verlängerung automatisch. Als Einzelunternehmer meldest du
dich mit deiner D-U-N-S-Nummer als Organisation an oder als
Einzelperson – dann steht dein bürgerlicher Name im Store, nicht
„Wisdompeak Apps". Für einen einheitlichen Auftritt mit Google Play ist die
Organisationsvariante die richtige; sie dauert länger, weil die D-U-N-S
erst beantragt werden muss (kostenlos, ein bis zwei Wochen).

Das ist der Punkt, den du **vor** allem anderen anstoßen solltest.

### 2. Zertifikate und Profil

Einmal lokal auf einem Mac, danach nie wieder:

1. Xcode → Settings → Accounts → Apple-ID hinzufügen
2. Manage Certificates → **Apple Distribution** anlegen
3. Schlüsselbundverwaltung → Zertifikat samt privatem Schlüssel als `.p12`
   exportieren, Passwort vergeben
4. developer.apple.com → Identifiers → App-ID `de.fairmix.app` anlegen
5. Profiles → **App Store**-Profil für diese App-ID, `.mobileprovision` laden

Ohne Mac geht das auch über einen macOS-Runner, ist aber deutlich
mühsamer. Ein gebrauchter Mac mini ist für dieses eine Mal die ruhigere
Lösung.

### 3. Repository-Secrets

    IOS_CERTIFICATE_P12_BASE64    base64 -i dist.p12 | pbcopy
    IOS_CERTIFICATE_PASSWORD      Passwort des .p12
    IOS_PROVISIONING_PROFILE      base64 -i profil.mobileprovision | pbcopy
    IOS_TEAM_ID                   zehnstellig, steht im Developer-Portal
    IOS_SIGNING_IDENTITY          "Apple Distribution: Name (TEAMID)"

Solange sie fehlen, läuft `ios.yml` trotzdem durch und baut unsigniert –
das beweist, dass der Quelltext übersetzt.

---

## Was Apple anders prüft als Google

| | Play | App Store |
|---|---|---|
| Prüfung | überwiegend automatisch | Mensch, 1–3 Tage |
| Rückweisung | selten | beim ersten Mal die Regel |
| Icon mit Alphakanal | erlaubt | **abgelehnt** |
| Privacy-Manifest | – | **Pflicht** |
| Testfassung | Closed Testing | TestFlight, keine Mindestzahl |
| Preis später ändern | frei → kostenpflichtig unmöglich | jederzeit möglich |

Der letzte Punkt nimmt Druck heraus: Anders als bei Google ist die
Preisentscheidung im App Store **nicht** endgültig. Du kannst mit 1,99 €
starten und später anpassen.

### Die drei häufigsten Rückweisungsgründe für diese Art App

**4.2 – Mindestfunktionalität.** Apple weist Apps zurück, die nur eine
Webseite in einen Rahmen packen. FairMix ist davon nicht betroffen: Die
App funktioniert vollständig offline, hat keine Netzaufrufe und bietet
Funktionen, die eine Webseite so nicht liefert. Erwähne im Feld „Notizen
für die Prüfung" ausdrücklich, dass die App ohne Internetverbindung
arbeitet.

**5.1.1 – Datenschutz.** Das Privacy-Manifest, das Data-Collection-Formular
in App Store Connect und die Datenschutzerklärung müssen dasselbe sagen.
Bei FairMix ist das leicht, weil überall dasselbe steht: nichts wird
erhoben. Widersprüche fallen im Review auf.

**2.1 – Unvollständige Angaben.** Der Prüfer muss die App benutzen können,
ohne zu raten. Lege in den Prüfnotizen einen Satz dazu, wie man in zwanzig
Sekunden zu einem Ergebnis kommt: Beispielklasse laden → Gruppen bilden.

---

## Vor der ersten Einreichung

- [ ] Developer Program aktiv, D-U-N-S geklärt
- [ ] Secrets hinterlegt, `ios.yml` liefert eine IPA
- [ ] Auf echtem iPhone **und** echtem iPad getestet (das iPad-Teilen-Menü
      ist ein eigener Codepfad, siehe unten)
- [ ] Screenshots: 6,9" iPhone und 13" iPad, je mindestens einer.
      Beide Größen sind Pflicht, wenn die App auf beiden läuft.
- [ ] Store-Texte DE und EN – die Play-Texte lassen sich übernehmen,
      der Verweis auf Google Play muss aber raus
- [ ] Altersfreigabe: 4+ (keine Rückfragen zu erwarten)
- [ ] Kategorie: Bildung
- [ ] Datenschutz-URL: dieselbe GitHub-Pages-Adresse wie bei Play
- [ ] Data Collection in App Store Connect: „Es werden keine Daten erfasst"
- [ ] Prüfnotizen: offline nutzbar, kein Konto, Testweg beschreiben

---

## Was auf iOS anders läuft und in der App korrigiert wurde

### AudioContext (behoben)

Auf iOS startet ein AudioContext, der außerhalb einer Nutzergeste entsteht,
im Zustand `suspended` und bleibt es. Der Weckton der Uhr entstand bisher
erst in `timerFinished()` – also in einem `setInterval`-Rückruf. Auf dem
iPhone wäre er tonlos gewesen, ohne jede Fehlermeldung.

Jetzt gibt es einen einzigen Kontext, der in `unlockAudio()` beim Tippen auf
Start freigeschaltet wird. `validate.js` prüft beides.

**Bleibt offen:** Der Seitenschalter am iPhone stummschaltet Web-Audio.
Eine Lehrkraft mit stummgeschaltetem Gerät hört den Weckton nicht. Das
ließe sich nur mit einem Plugin ändern, das die Audio-Sitzungskategorie
umstellt – für einen Weckton wäre das übergriffig. Die sichtbare Markierung
der Anzeige bleibt in jedem Fall.

### Teilen auf dem iPad (behoben)

`UIActivityViewController` ist auf dem iPad ein Popover und verlangt einen
Ankerpunkt. Ohne Angabe löst UIKit zur Laufzeit eine Ausnahme aus – die App
bricht beim Export ab. `deliverFile()` übergibt jetzt
`iPadPopupCoordinates`.

**Das ist der Pfad, der auf dem Simulator anders aussehen kann als auf
echter Hardware.** Auf dem iPad testen, nicht nur auf dem iPhone.

### Rechtstexte (abgesichert)

Die Datenschutzerklärung verlinkt auf `policies.google.com`. Innerhalb der
App gibt es auf dem iPhone keine Zurück-Taste. Führte der Link zu einer
Navigation im WebView, säße der Nutzer fest und müsste die App abwürgen.

Zwei Sicherungen greifen: `allow-navigation` bleibt auf der eigenen
Herkunft beschränkt, sodass cordova-ios die Adresse an Safari übergibt;
zusätzlich ist `AllowBackForwardNavigationGestures` gesetzt, womit das
Wischen von der linken Kante zurückführt.

**Auf dem Gerät nachsehen.** Öffnet der Google-Link Safari, ist alles gut.
Lädt er in der App, muss die Zeile
`<allow-navigation href="https://policies.google.com/*" />` ergänzt werden –
dann greift wenigstens die Wischgeste.

### Sichere Bereiche (behoben)

Der Präsentationsmodus liegt als `position: fixed; inset: 0` über dem
Bildschirm. Die untere Polsterung von 24 px ist kleiner als der
Home-Indikator (34 px) – die letzte Karte verschwand darunter. Jetzt mit
`env(safe-area-inset-bottom)`.

Dialoge halten zusätzlich Abstand nach oben und unten und ziehen beim
Wischen nicht mehr die Seite dahinter mit (`overscroll-behavior: contain`).

### localStorage – die eine Sache, die noch offen ist

WKWebView darf `localStorage` unter Speicherdruck löschen, wenn eine App
länger nicht benutzt wurde. Für FairMix, das jede Klassenliste dort ablegt,
ist das ein echtes Risiko: eine Lehrkraft, die die App über die Ferien
liegen lässt, findet sie unter Umständen leer vor.

Auf Android tritt das nicht auf, deshalb ist es nie aufgefallen.

Drei Wege, in der Reihenfolge, wie ich sie einschätze:

1. **Sicherungserinnerung verschärfen.** Der Mechanismus ist schon da
   (`lastBackup`, `backupNagOff`). Auf iOS früher und deutlicher erinnern.
   Kein Codeumbau, aber der Datenverlust bleibt möglich.
2. **Zweitkopie über ein Dateisystem-Plugin.** Bei jedem `saveState()`
   zusätzlich in `Library/NoCloud` schreiben, beim Start von dort holen,
   wenn `localStorage` leer ist. Das löst es sauber, kostet aber ein
   weiteres Plugin und einen neuen Codepfad – mit allem, was das für die
   Prüfkette bedeutet.
3. **Vollständig auf das Dateisystem umstellen.** Am saubersten,
   der größte Eingriff, und Android müsste mitziehen.

Mein Rat: Weg 2, aber **nach** der ersten Einreichung. Die App ist
funktionsfähig und einreichbar, wie sie ist; diese Änderung will eigene
Tests und eigene Mutationsläufe.

---

## Prüfkette

Unverändert, mit einem Zusatz vorweg:

    python3 make-ios-icons.py     (neu – legt res/ios/ an)
    node make-legal-pages.js
    node validate.js
    node smoketest.js
    node stresstest.js
    ./mutate.sh nach eingebauter Mutation
    ./build-lite.sh

`validate.js` prüft jetzt zusätzlich 14 iOS-Punkte. Im Lite-Build werden
sie übersprungen: Lite ist bewusst Android-only, die iOS-Dateien werden
dort gar nicht mitkopiert. Jeder davon ist ein
Rückweisungsgrund bei App Store Connect, und jeder fällt dort erst **nach**
der Verarbeitung auf – die Build-Nummer ist dann verbraucht.

Nachgewiesen: Alle 249 Smoketests laufen mit den Korrekturen durch, und
jede der 14 neuen Prüfungen wurde per Mutation dagegen gehalten.

---

## Reihenfolge

1. FairMix Pro erreicht Produktion bei Google Play
2. FairMix Lite erscheint bei Google Play
3. Apple Developer Program beantragen (läuft nebenher, dauert)
4. iOS-Portierung, TestFlight, Einreichung

Schritt 3 kannst du jederzeit anstoßen – die Wartezeit läuft dann parallel
zu allem anderen.
