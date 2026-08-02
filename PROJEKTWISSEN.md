# FairMix – Projektwissen, Stand 1.21.0

Das ist der **Pro-Stand**. Die Lite-Fassung wird daraus erzeugt und nie
getrennt gepflegt (`build-lite.sh`).

## Wo die Dateien im Repo liegen

Das Projektwissen kennt keine Ordner. Im Repo `simaehlmann-cloud/FairMix`
sieht es so aus:

    index.html            Wurzelverzeichnis – die gesamte App
    manifest.json         Wurzelverzeichnis
    sw.js                 Wurzelverzeichnis
    datenschutz.html      Wurzelverzeichnis
    impressum.html        Wurzelverzeichnis
    config.xml            Wurzelverzeichnis
    README.md             Wurzelverzeichnis
    AENDERUNGEN.md        Wurzelverzeichnis
    validate.js           Wurzelverzeichnis
    smoketest.js          Wurzelverzeichnis
    stresstest.js         Wurzelverzeichnis
    mutate.sh             Wurzelverzeichnis
    build-lite.sh         Wurzelverzeichnis
    make-lite-icons.py    Wurzelverzeichnis

    android.yml       -> .github/workflows/android.yml
    colors.xml        -> res/android/colors.xml

## Was hier bewusst fehlt

**Alle PNG-Dateien.** Beim Hochladen ins Projektwissen werden Bilder neu
kodiert: Maße ändern sich, der Alphakanal geht verloren, es kommen weiße
Ränder dazu. Als Vorlage sind sie damit unbrauchbar, und sie sähen
trotzdem echt aus – das ist die gefährlichere Variante.

Im Repo liegen:

    icon.png                       512x512, PWA und Play-Store-Eintrag
    icon-192.png                   192x192
    icon-maskable-512.png          512x512, purpose "maskable"
    res/android/icon_{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}.png
    res/android/icon_fg_{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}.png

Die Lite-Icons entstehen aus genau diesen Dateien über
`python3 make-lite-icons.py`. Der Hintergrund des adaptiven Icons kommt
aus `colors.xml` (`fairmix_icon_background`, #f4f8fc).

## Stand

- Version 1.21.0, versionCode 12100, Service-Worker-Cache `fairmix-v30`
- Paketkennung Pro: `de.fairmix.app`   Lite: `de.fairmix.lite`
- 229 Smoketests (Pro und Lite aus einer Quelle), Validator, Stresstest
- Prüfkette: `node validate.js`, `node smoketest.js`, `node stresstest.js`,
  `./mutate.sh` nach einer eingebauten Mutation, `./build-lite.sh`

## Offen

- Data-Safety-Formular: Partnerhistorie und gezogene Namen fehlen noch
- Zahlungsprofil für Pro – ohne das kein Preis, und kostenlos →
  kostenpflichtig geht später nicht mehr
- Reihenfolge: erst Pro veröffentlichen, dann Lite
