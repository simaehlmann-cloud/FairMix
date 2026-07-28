# FairMix Pro

Faire Gruppenbildung und Zufallsauswahl für den Unterricht.
Läuft als Android-App (Cordova) und als installierbare Web-App (PWA) – vollständig offline,
ohne Konto, ohne Tracking, ohne externe Bibliotheken.

## Dateistruktur

```
index.html                     komplette App (HTML, CSS, Logik)
manifest.json                  PWA-Manifest
sw.js                          Service Worker v6 (Offline-Cache + Update-Hinweis)
datenschutz.html               Datenschutzerklärung
impressum.html                 Impressum (§ 5 DDG)
icon.png                       512×512
icon-192.png                   192×192
icon-maskable-512.png          512×512, maskable (PWA)
config.xml                     Cordova-Konfiguration
res/android/                   adaptive Icons je Bildschirmdichte + colors.xml
.github/workflows/android.yml  Build (Debug-APK immer, signiertes AAB mit Keystore)
validate.js                    statische Prüfung
smoketest.js                   Ablauftest gegen eine DOM-Nachbildung
```

## Prüfen

```bash
node validate.js     # Syntax, i18n-Vollständigkeit, IDs, Handler, Manifest, config.xml
node smoketest.js    # 38 Bedienabläufe inkl. Regel- und Funktionsschalter-Tests
```

## Bauen

Der Workflow läuft bei jedem Push auf `main`. Er erzeugt immer ein Debug-APK.
Sobald die vier Secrets hinterlegt sind, kommt zusätzlich ein signiertes AAB dazu:

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 fairmix.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Passwort des Keystores |
| `ANDROID_KEY_ALIAS` | Alias des Schlüssels |
| `ANDROID_KEY_PASSWORD` | Passwort des Schlüssels |

Keystore anlegen (einmalig, gut sichern – ohne ihn sind keine Updates mehr möglich):

```bash
keytool -genkey -v -keystore fairmix.keystore -alias fairmix \
        -keyalg RSA -keysize 2048 -validity 10000
```

## Vor der geschlossenen Testphase

- [ ] Impressum-URL und Datenschutz-URL im Play-Store-Eintrag hinterlegen
- [ ] GitHub Pages aktivieren, damit die Datenschutz-URL öffentlich erreichbar ist
- [ ] Diese URL im Play-Store-Eintrag hinterlegen
- [ ] Data-Safety-Formular: keine Datenerhebung, keine Weitergabe
- [ ] Inhaltseinstufung ausfüllen
- [ ] Screenshots (Handy und Tablet), Feature-Grafik 1024×500, Store-Icon 512×512
- [ ] Bei jedem Upload `version` **und** `android-versionCode` in `config.xml` erhöhen

## Version

1.5.0 (versionCode 10500)
