#!/bin/bash
# Mutationsprüfung: unterscheidet Testfehler von Abstürzen.
# Ein Absturz zählt als erkannt, ein grüner Durchlauf als NICHT erkannt.
run() {
  local out rc
  out="$(node smoketest.js 2>&1)"; rc=$?
  if echo "$out" | grep -q "Abläufe fehlerfrei"; then
    echo "NICHT ERKANNT"
  elif echo "$out" | grep -q "ABLAUF-FEHLER"; then
    echo "erkannt ($(echo "$out" | grep -c '✗') Test)"
  else
    echo "erkannt (Absturz)"
  fi
}
run
