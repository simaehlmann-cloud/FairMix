#!/usr/bin/env bash
#
# ios-secrets.sh – erzeugt Schluessel und Zertifikat fuer den iOS-Build
# und gibt am Ende genau die Werte aus, die als GitHub-Secrets gebraucht
# werden. Laeuft unter Windows in Git Bash, unter Linux und auf dem Mac.
#
# Es gibt zwei Durchgaenge, weil zwischendurch Apples Webseite dran ist:
#
#   ./ios-secrets.sh anfang     -> erzeugt Schluessel und Signieranfrage
#   [Zertifikat bei Apple holen]
#   ./ios-secrets.sh ende       -> baut dist.p12 und zeigt alle Secrets
#
# Gedacht fuer Leute ohne Mac. Die Angaben IOS_SIGNING_IDENTITY und
# IOS_TEAM_ID liest man sonst mit Apple-Bordmitteln aus dem Schluesselbund;
# hier holt das Skript sie direkt aus dem Zertifikat.

set -e

MAIL="smaehlmann.appdev@gmail.com"
ORDNER="ios-signierung"

rot()  { printf '\033[31m%s\033[0m\n' "$*"; }
gruen(){ printf '\033[32m%s\033[0m\n' "$*"; }
fett() { printf '\033[1m%s\033[0m\n' "$*"; }

command -v openssl >/dev/null || {
  rot "openssl nicht gefunden."
  echo "Unter Windows: Git Bash benutzen (kommt mit Git for Windows mit)."
  exit 1
}

# ---------------------------------------------------------------------------

anfang() {
  mkdir -p "$ORDNER"
  cd "$ORDNER"

  if [ -f ios_distribution.key ]; then
    rot "ios_distribution.key existiert bereits."
    echo "Ein zweiter Schluessel macht das vorhandene Zertifikat unbrauchbar."
    echo "Wenn du wirklich neu anfangen willst, benenne den Ordner um."
    exit 1
  fi

  echo "Erzeuge privaten Schluessel ..."
  openssl genrsa -out ios_distribution.key 2048 2>/dev/null

  echo "Erzeuge Signieranfrage ..."
  openssl req -new -key ios_distribution.key -out ios_distribution.csr \
    -subj "/emailAddress=$MAIL/CN=FairMix/C=DE" 2>/dev/null

  gruen "Fertig. Zwei Dateien liegen in $ORDNER/"
  echo
  fett "SICHERE ios_distribution.key JETZT."
  echo "Ohne diese Datei ist das Zertifikat wertlos und du kannst keine"
  echo "Updates mehr einreichen. Gleiche Bedeutung wie der Android-Keystore."
  echo "Kopie an einen zweiten Ort legen, nicht ins Repo."
  echo
  fett "Naechster Schritt bei Apple:"
  echo "  1. developer.apple.com/account -> Certificates -> +"
  echo "  2. 'Apple Distribution' waehlen"
  echo "  3. Datei hochladen:  $ORDNER/ios_distribution.csr"
  echo "  4. distribution.cer herunterladen und nach $ORDNER/ legen"
  echo "  5. dann:  ./ios-secrets.sh ende"
}

# ---------------------------------------------------------------------------

ende() {
  cd "$ORDNER" 2>/dev/null || { rot "Ordner $ORDNER fehlt. Erst 'anfang' laufen lassen."; exit 1; }

  [ -f ios_distribution.key ] || { rot "ios_distribution.key fehlt."; exit 1; }
  [ -f distribution.cer ] || {
    rot "distribution.cer fehlt."
    echo "Die Datei von Apple herunterladen und nach $ORDNER/ legen."
    exit 1
  }

  echo "Wandle Zertifikat um ..."
  openssl x509 -inform DER -in distribution.cer -out distribution.pem 2>/dev/null

  # Neuere OpenSSL-Fassungen schreiben ein Format, das macOS nicht liest.
  # -legacy behebt das, existiert aber erst ab Version 3. Deshalb pruefen
  # statt raten.
  if openssl pkcs12 -help 2>&1 | grep -q -- '-legacy'; then
    LEGACY="-legacy"
  else
    LEGACY=""
  fi

  echo
  fett "Passwort fuer die .p12 vergeben."
  echo "Es kommt gleich als Secret IOS_CERTIFICATE_PASSWORD nach GitHub."
  echo "Frei waehlbar, aber nicht leer – merken oder in den Passwortspeicher."
  printf 'Passwort: '; read -rs PW1; echo
  printf 'Wiederholen: '; read -rs PW2; echo
  [ -n "$PW1" ] || { rot "Leeres Passwort wird nicht akzeptiert."; exit 1; }
  [ "$PW1" = "$PW2" ] || { rot "Die beiden Eingaben stimmen nicht ueberein."; exit 1; }

  openssl pkcs12 -export $LEGACY \
    -inkey ios_distribution.key \
    -in distribution.pem \
    -out dist.p12 \
    -passout pass:"$PW1" 2>/dev/null

  [ -s dist.p12 ] || { rot "dist.p12 wurde nicht erzeugt."; exit 1; }

  # Zurueckgelesen wird mit denselben Schaltern. Eine .p12, die sich hier
  # nicht oeffnen laesst, scheitert spaeter auch im Build – nur dann erst
  # nach fuenfzehn Minuten Wartezeit auf dem macOS-Laeufer.
  if openssl pkcs12 -in dist.p12 -nokeys -noout $LEGACY -passin pass:"$PW1" 2>/dev/null; then
    gruen "dist.p12 geprueft: lesbar, Passwort stimmt."
  else
    rot "dist.p12 laesst sich nicht zurueckoeffnen."
    echo "Bitte melden, bevor du weitermachst – der Build wuerde daran scheitern."
    exit 1
  fi
  PW1=; PW2=

  # Die beiden Angaben, an die man ohne Mac sonst schwer kommt.
  BETREFF=$(openssl x509 -in distribution.pem -noout -subject)
  IDENT=$(printf '%s' "$BETREFF" | sed -n 's/.*CN *= *\([^,/]*\).*/\1/p')
  TEAM=$(printf '%s' "$BETREFF" | sed -n 's/.*OU *= *\([^,/]*\).*/\1/p')

  PROFIL=$(ls *.mobileprovision 2>/dev/null | head -1)

  echo
  gruen "============================================================"
  gruen " Diese Werte in GitHub eintragen:"
  gruen " Repository -> Settings -> Secrets and variables -> Actions"
  gruen "============================================================"
  echo
  fett "IOS_SIGNING_IDENTITY"
  echo "$IDENT"
  echo
  fett "IOS_TEAM_ID"
  echo "$TEAM"
  echo
  fett "IOS_CERTIFICATE_PASSWORD"
  echo "(das Passwort, das du gerade vergeben hast)"
  echo
  fett "IOS_CERTIFICATE_P12_BASE64"
  echo "steht in:  $ORDNER/secret-p12.txt"
  base64 dist.p12 | tr -d '\n' > secret-p12.txt

  if [ -n "$PROFIL" ]; then
    echo
    fett "IOS_PROVISIONING_PROFILE"
    echo "steht in:  $ORDNER/secret-profil.txt"
    base64 "$PROFIL" | tr -d '\n' > secret-profil.txt
  else
    echo
    rot "Kein .mobileprovision im Ordner gefunden."
    echo "Fehlt noch: developer.apple.com -> Profiles -> + -> App Store Connect"
    echo "Danach die Datei hierher legen und nochmal './ios-secrets.sh ende'."
  fi

  echo
  echo "Die .txt-Dateien enthalten je eine lange Zeile. Komplett markieren,"
  echo "kopieren, in GitHub einfuegen. Keine Zeilenumbrueche einfuegen."
  echo
  rot "secret-*.txt, dist.p12 und ios_distribution.key NICHT ins Repo."
  echo "Falls der Ordner im Repo liegt, gehoert er in die .gitignore."
}

# ---------------------------------------------------------------------------

case "${1:-}" in
  anfang) anfang ;;
  ende)   ende ;;
  *)
    echo "Benutzung:"
    echo "  ./ios-secrets.sh anfang    vor dem Gang zu Apple"
    echo "  ./ios-secrets.sh ende      nachdem distribution.cer da ist"
    exit 1
    ;;
esac
