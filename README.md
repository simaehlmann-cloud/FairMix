# FairMix Pro

Faire Gruppenbildung und Zufallsauswahl für den Unterricht.
Läuft als Android-App (Cordova) und als installierbare Web-App (PWA) – vollständig offline,
ohne Konto, ohne Tracking, ohne externe Bibliotheken.

## Dateistruktur

```
index.html                     komplette App (HTML, CSS, Logik)
manifest.json                  PWA-Manifest
sw.js                          Service Worker v7 (Offline-Cache + Update-Hinweis)
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

## Aufs eigene Gerät spielen

Es entstehen zwei installierbare Dateien:

| Artefakt | Zweck |
|---|---|
| `FairMix-release-apk` | Testen auf dem eigenen Gerät |
| `FairMix-release-aab` | Upload in die Play Console |
| `FairMix-debug-apk` | Notlösung, solange kein Keystore hinterlegt ist |

**Zum Testen immer das Release-APK nehmen.** Debug-APKs werden bei jedem Lauf
mit einem frisch erzeugten Schlüssel signiert. Android lässt ein Update nur zu,
wenn die Signatur zur installierten Fassung passt – deshalb verlangt jedes neue
Debug-APK vorher eine Deinstallation, und dabei geht der lokale Speicher verloren.
Das signierte Release-APK nutzt immer denselben Keystore und lässt sich schlicht
darüberlegen.

Falls doch einmal deinstalliert werden muss: vorher in der App unter
*Namen verwalten → Backup als Datei* eine Sicherung erstellen und teilen.

## Vor der geschlossenen Testphase

- [ ] Impressum-URL und Datenschutz-URL im Play-Store-Eintrag hinterlegen
- [ ] GitHub Pages aktivieren, damit die Datenschutz-URL öffentlich erreichbar ist
- [ ] Diese URL im Play-Store-Eintrag hinterlegen
- [ ] Data-Safety-Formular: keine Datenerhebung, keine Weitergabe
- [ ] Inhaltseinstufung ausfüllen
- [ ] Screenshots (Handy und Tablet), Feature-Grafik 1024×500, Store-Icon 512×512
- [ ] Bei jedem Upload `version` **und** `android-versionCode` in `config.xml` erhöhen

## Version

1.5.1 (versionCode 10501)
