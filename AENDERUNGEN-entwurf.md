# FairMix 1.22.2 – iOS-Fassung vorbereitet

Version auf 1.22.2 anheben, `ios-CFBundleVersion` auf 12202, Cache-Name
auf `fairmix-1.22.2`. Am Verhalten unter Android ändert sich nichts; alle
249 Abläufe bleiben grün.

Entwurf. Vor dem Übernehmen gegenlesen und die Versionsnummer anpassen,
falls zwischendurch etwas anderes dazugekommen ist.

---

**Der Weckton der Uhr wäre auf iOS stumm geblieben.** Der `AudioContext`
entstand erst in `timerFinished()` – also in einem `setInterval`-Rückruf.
WKWebView legt einen Kontext, der ausserhalb einer Nutzergeste entsteht,
als `suspended` an und lässt ihn dabei. Kein Fehler, kein Log, kein Ton.
Jetzt gibt es einen einzigen Kontext, freigeschaltet in `unlockAudio()`
beim Tippen auf Start und beim Einschalten des Tons. `validate.js` prüft
beide Aufrufwege.

Auf Android war das nie ein Problem, deshalb ist es nie aufgefallen.

**Teilen hätte die App auf dem iPad beendet.** `UIActivityViewController`
ist dort ein Popover und verlangt einen Ankerpunkt; ohne Angabe wirft
UIKit zur Laufzeit. `deliverFile()` übergibt jetzt `iPadPopupCoordinates`,
berechnet aus der Fenstergrösse.

**Der Präsentationsmodus lag unter dem Home-Indikator.** 24 px Polsterung
gegen 34 px Balken – die letzte Karte verschwand darunter. Jetzt mit
`env(safe-area-inset-bottom)`. Dialoge halten zusätzlich oben und unten
Abstand und ziehen beim Wischen nicht mehr die Seite dahinter mit.

**`validate.js` prüft 14 iOS-Punkte mehr.** Jeder davon ist ein
Rückweisungsgrund bei App Store Connect, und jeder fällt dort erst nach
der Verarbeitung auf – die Build-Nummer ist dann verbraucht. Geprüft
werden unter anderem das Privacy-Manifest, die Export-Erklärung, der
Foto-Hinweis in der Info.plist, das Store-Icon und die beiden
Code-Korrekturen oben. Alle 14 wurden per Mutation dagegengehalten.

Im Lite-Build werden sie übersprungen. Lite bleibt Android-only, und
`build-lite.sh` kopiert die iOS-Dateien gar nicht mit – ohne die Ausnahme
wäre der Lite-Build rot geworden. Dieselbe Behandlung wie bei der
Webfassung der Rechtstexte.

**Neu im Repo:**

    .github/workflows/ios.yml   Build auf macOS-Läufer, Upload nach
                                App Store Connect nur bei manuellem Start
    make-ios-icons.py           Icon-Satz ohne Alphakanal plus Startbild
    ios-secrets.sh              Zertifikatskette ohne Mac
    store-bilder.js             Store-Screenshots automatisch
    screenshots.py             Screenshots von Hand, als Rückfallweg
    res/ios/PrivacyInfo.xcprivacy

`config.xml` hat einen iOS-Block bekommen: Statusleiste hell,
Rückwärts-Wischgeste an, Ziel iOS 14, Icons, Startbild und die drei
Info.plist-Einträge, die Apple sonst beim Upload einfordert.

---

**Offen und bewusst nicht angefasst:** WKWebView darf `localStorage` unter
Speicherdruck verwerfen, wenn die App länger nicht benutzt wurde. Für eine
App, die jede Klassenliste dort hält, ist das der ernsteste Punkt der
Portierung. Die Lösung – eine Zweitkopie über ein Dateisystem-Plugin –
gehört hinter die erste Einreichung, weil sie eigene Abläufe und eigene
Mutationsläufe braucht. Steht in `IOS-PORTIERUNG.md` mit drei Wegen.
