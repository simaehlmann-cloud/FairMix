# Textbausteine zum Einfügen

Drei Dateien, die du sonst selbst nachziehen müsstest. Jeweils der Block
zum Kopieren, mit Angabe, wo er hingehört.

---

## 1. `.gitignore`

Ans Ende anhängen. Der erste Eintrag ist der wichtigste: Im Ordner
`ios-signierung/` liegt der private Schlüssel, mit dem jeder in deinem
Namen einreichen könnte.

```gitignore
# iOS-Signierung – enthält den privaten Schlüssel. Niemals einchecken.
ios-signierung/

# iOS-Icons und Startbild entstehen im Build aus icon.png
res/ios/icon-*.png
res/ios/Default*.png

# Store-Screenshots entstehen aus store-bilder.js
store-bilder/

# Playwright für store-bilder.js
node_modules/
```

---

## 2. `README.md`

Nach dem Abschnitt „Bauen" einfügen.

````markdown
## iOS

Dieselbe Quelle, andere Hülle. Es gibt **nur die Pro-Fassung** – eine
Lite-Variante wäre im App Store nach Richtlinie 4.3 (doppelte Apps)
angreifbar; Apple erwartet dort eine App mit In-App-Kauf.

Kein Mac nötig. Gebaut wird auf einem macOS-Läufer bei GitHub Actions,
Zertifikat und Profil entstehen mit OpenSSL unter Windows.

```bash
./ios-secrets.sh anfang     # Schlüssel und Signieranfrage
# Zertifikat und Profil bei developer.apple.com holen
./ios-secrets.sh ende       # dist.p12 bauen, alle Secrets ausgeben
```

| Secret | Inhalt |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | Distribution-Zertifikat samt Schlüssel |
| `IOS_CERTIFICATE_PASSWORD` | Passwort des .p12 |
| `IOS_PROVISIONING_PROFILE` | App-Store-Profil, base64 |
| `IOS_TEAM_ID` | zehnstellig |
| `IOS_SIGNING_IDENTITY` | `Apple Distribution: Name (TEAMID)` |
| `ASC_KEY_ID` | App-Store-Connect-API |
| `ASC_ISSUER_ID` | App-Store-Connect-API |
| `ASC_KEY_P8` | Inhalt der .p8 |

**`ios-signierung/ios_distribution.key` gut sichern.** Ohne diese Datei
sind keine Updates mehr möglich – dieselbe Bedeutung wie der
Android-Keystore.

Der Workflow baut bei jedem Push unsigniert (beweist, dass der Quelltext
übersetzt). Signieren und Hochladen passiert nur beim manuellen Start über
**Run workflow**, weil jede hochgeladene Build-Nummer bei Apple dauerhaft
belegt ist.

### Store-Screenshots

```bash
npm install --no-save playwright
npx playwright install chromium
node store-bilder.js
```

Erzeugt vier Sätze zu je fünf Bildern (iPhone und iPad, Deutsch und
Englisch) in exakt den Massen, die Apple verlangt, und prüft jedes Bild
gegen sein Sollmass. Steuert dabei die App über ihre eigenen Funktionen
und die Beispielklasse – es wird nichts nachgebaut.

Von Hand geht es mit `python3 screenshots.py`.

### Ablauf

`APPSTORE-EINREICHUNG.md` beschreibt die Einreichung Schritt für Schritt,
`IOS-PORTIERUNG.md` die technischen Unterschiede zu Android.

**Bei jedem Upload `version` und `ios-CFBundleVersion` erhöhen.**
````

---

## 3. `PROJEKTWISSEN.md`

Im Abschnitt „Wo die Dateien im Repo liegen" ergänzen:

```
    ios-secrets.sh        Wurzelverzeichnis
    store-bilder.js       Wurzelverzeichnis
    screenshots.py        Wurzelverzeichnis
    make-ios-icons.py     Wurzelverzeichnis

    ios.yml               -> .github/workflows/ios.yml
    PrivacyInfo.xcprivacy -> res/ios/PrivacyInfo.xcprivacy
```

Im Abschnitt „Was hier bewusst fehlt" ergänzen:

```
Die iOS-Icons ebenso. Sie entstehen im CI-Lauf aus icon.png über
make-ios-icons.py, mit auf #f4f8fc geflachtem Alphakanal – iOS lehnt
Icons mit Transparenz ab.
```

Neuer Abschnitt, vor „Offen":

```markdown
## iOS

Nur Pro. Eine Lite-Fassung wäre nach Apples Richtlinie 4.3 angreifbar.

Paketkennung `de.fairmix.app`, dieselbe wie bei Android. Gebaut auf einem
macOS-Läufer; Zertifikat und Profil entstehen ohne Mac mit OpenSSL.

Drei Dinge verhalten sich anders als unter Android, alle drei sind in
1.22.2 behoben und werden von validate.js bewacht:

- AudioContext muss aus einer Nutzergeste heraus freigeschaltet werden,
  sonst bleibt der Weckton stumm (unlockAudio)
- Das Teilen-Menü braucht auf dem iPad einen Ankerpunkt, sonst bricht
  UIKit die App ab (iPadPopupCoordinates)
- env(safe-area-inset-bottom) im Präsentationsmodus

**Offen:** WKWebView darf localStorage verwerfen, wenn die App länger
ungenutzt liegt. Betrifft alle Klassenlisten. Drei Lösungswege stehen in
IOS-PORTIERUNG.md; angehen nach der ersten Einreichung.
```

Im Abschnitt „Offen" ergänzen:

```
- iOS: localStorage-Verwurf absichern (Zweitkopie über Dateisystem-Plugin)
- iOS: Store-Texte und Screenshots vor der Einreichung gegenlesen
```
