#!/bin/bash
# Mutationsprüfung: unterscheidet Testfehler von Abstürzen.
# Ein Absturz zählt als erkannt, ein grüner Durchlauf als NICHT erkannt.
# Zeitlimit: eine Mutation, die eine Endlosschleife erzeugt, darf die
# Prüfung nicht aufhängen. Abbruch nach 120 s zählt als erkannt.
run() {
  local out rc
  out="$(timeout 120 node smoketest.js 2>&1)"; rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "erkannt (Zeitlimit überschritten)"
  elif echo "$out" | grep -q "Abläufe fehlerfrei"; then
    echo "NICHT ERKANNT"
  elif echo "$out" | grep -q "ABLAUF-FEHLER"; then
    echo "erkannt ($(echo "$out" | grep -c '✗') Test)"
  else
    echo "erkannt (Absturz)"
  fi
}
run
