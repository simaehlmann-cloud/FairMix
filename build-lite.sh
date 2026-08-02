#!/bin/bash
# Erzeugt aus dem Pro-Stand im Wurzelverzeichnis einen vollstaendigen
# Lite-Build im Verzeichnis lite/.
#
#   ./build-lite.sh            erzeugt lite/ und prueft es
#   ./build-lite.sh --ohne-icons   ueberspringt make-lite-icons.py
#
# Der Lite-Build ist derselbe Code. Geaendert werden genau vier Dinge:
# der Schalter IS_LITE, die Paketkennung, der angezeigte Name und der
# Name des Service-Worker-Caches. Alles andere wird kopiert.
set -e

ZIEL="lite"
ICONS=1
[ "$1" = "--ohne-icons" ] && ICONS=0

# Muss zur Paketkennung in PRO_STORE_URL passen: Lite verweist auf Pro,
# nicht auf sich selbst.
PRO_ID="de.fairmix.app"
LITE_ID="de.fairmix.lite"

echo "== FairMix Lite bauen =="

for f in index.html config.xml manifest.json sw.js datenschutz.html impressum.html \
         validate.js smoketest.js stresstest.js README.md make-lite-icons.py; do
  [ -f "$f" ] || { echo "FEHLT: $f"; exit 1; }
done

rm -rf "$ZIEL"
mkdir -p "$ZIEL/res/android"

# ---- Quelldateien uebernehmen ----
# Die App-Dateien plus die vollstaendige Pruefkette. Der Smoketest setzt
# den Schalter fuer jeden seiner beiden Laeufe selbst und funktioniert
# deshalb auch hier, wo index.html bereits auf Lite steht.
cp datenschutz.html impressum.html validate.js smoketest.js stresstest.js \
   mutate.sh README.md "$ZIEL/"
cp res/android/colors.xml "$ZIEL/res/android/"

# ---- Schalter umlegen ----
sed 's/^const IS_LITE = false;$/const IS_LITE = true;/' index.html > "$ZIEL/index.html"
if ! grep -q '^const IS_LITE = true;$' "$ZIEL/index.html"; then
  echo "::error:: Schalter IS_LITE nicht gefunden – wurde die Zeile umformatiert?"
  exit 1
fi

# ---- Paketkennung und Name ----
# Die Kennung ist nach der Veroeffentlichung unveraenderlich. Sie darf
# sich deshalb nie versehentlich mit der von Pro decken.
sed -e "s|id=\"$PRO_ID\"|id=\"$LITE_ID\"|" \
    -e 's|<name>FairMix</name>|<name>FairMix Lite</name>|' \
    config.xml > "$ZIEL/config.xml"
if grep -q "id=\"$PRO_ID\"" "$ZIEL/config.xml"; then
  echo "::error:: config.xml traegt noch die Pro-Kennung"
  exit 1
fi

sed -e 's|"FairMix Pro – Gruppenplaner"|"FairMix Lite – Gruppenplaner"|' \
    -e 's|"short_name": "FairMix"|"short_name": "FairMix Lite"|' \
    manifest.json > "$ZIEL/manifest.json"

# ---- Service-Worker: eigener Cache ----
# Gleicher Name hiesse: liegen beide Fassungen je auf derselben Adresse,
# uebernaehme eine den Cache der anderen.
sed "s/'fairmix-v/'fairmixlite-v/" sw.js > "$ZIEL/sw.js"

# ---- Icons ----
if [ "$ICONS" = "1" ]; then
  python3 make-lite-icons.py --ziel "$ZIEL"
else
  echo "  Icons uebersprungen – aus lite-icons/ kopieren"
  cp lite-icons/*.png "$ZIEL/" 2>/dev/null || true
  cp lite-icons/res/android/*.png "$ZIEL/res/android/" 2>/dev/null || true
fi

# ---- Pruefen ----
# Erst der Quellbaum: dort laufen beide Fassungen durch den Smoketest.
echo "== Pruefungen im Quellbaum =="
node validate.js > /dev/null && echo "  Validator (Pro) bestanden"
node smoketest.js | tail -1
node stresstest.js > /dev/null && echo "  Stresstest bestanden"

echo "== Pruefungen im Lite-Build =="
cd "$ZIEL"
FAIRMIX_LITE=1 node validate.js | tail -1
node smoketest.js | tail -1
cd ..

echo
echo "Fertig: $ZIEL/"
echo "Kennung: $LITE_ID   Version: $(grep -o 'version=\"[0-9.]*\"' "$ZIEL/config.xml" | head -1)"
