#!/usr/bin/env python3
"""screenshots.py – startet FairMix lokal, damit du Store-Bilder aufnehmen kannst.

    python3 screenshots.py

Warum ueberhaupt ein Server und nicht einfach ein Doppelklick auf die
index.html: Chrome sperrt localStorage fuer Dateien, die ueber file://
geoeffnet werden. Die App startet zwar, kann sich aber nichts merken –
und du bekommst keine gefuellte Namensliste ins Bild.

Die Webfassung auf GitHub Pages hilft hier nicht: dort liegen nur
Datenschutzerklaerung und Impressum, die App selbst ist bewusst nicht
veroeffentlicht.

Aufzunehmen sind vier Saetze: iPhone und iPad, je auf Deutsch und
Englisch. Das Skript nennt die genauen Masse.
"""

import http.server
import os
import socketserver
import sys
import webbrowser

PORT = 8765

# Apple akzeptiert fuer die 6,9-Zoll-Klasse mehrere Masse. 1290x2796 ist
# das mittlere und wird durchgehend akzeptiert. Beim iPad ist 2048x2732
# das Mass des 12,9-Zoll-Pro, das ebenfalls in den 13-Zoll-Platz passt.
# Eingetragen wird die CSS-Groesse, nicht die Pixelzahl. Bei dreifacher
# Dichte ergeben 430x932 genau die 1290x2796, die Apple verlangt – und die
# App zeichnet ihr Handy-Layout. Traegt man 1290 direkt ein und stellt die
# Dichte auf 1, stimmt die Dateigroesse zwar, die App zeichnet aber ihr
# Breitbild-Layout mit winziger Schrift.
MASSE = [
    ("iPhone (6,9 Zoll)", 430, 932, 3, 1290, 2796),
    ("iPad (13 Zoll)", 1024, 1366, 2, 2048, 2732),
]

MOTIVE = [
    "Fertige Gruppeneinteilung mit Namen",
    "Automatische Erzeugung nach Gruppengroesse",
    "Regeln: immer zusammen / nie zusammen",
    "Gruppenpuzzle mit Stamm- und Expertengruppen",
    "Praesentationsmodus in grosser Schrift",
]


def main():
    if not os.path.exists("index.html"):
        sys.exit("index.html nicht gefunden. Das Skript im Repo-Ordner starten.")

    handler = http.server.SimpleHTTPRequestHandler
    # Erlaubt einen Neustart, ohne auf eine freiwerdende Portnummer zu warten.
    socketserver.TCPServer.allow_reuse_address = True

    print("=" * 62)
    print(" FairMix laeuft jetzt unter:  http://localhost:%d/" % PORT)
    print("=" * 62)
    print()
    print("SO NIMMST DU EIN BILD AUF")
    print()
    print("  1. Die Seite in Chrome oeffnen")
    print("  2. Einstellungen -> 'Beispielklasse laden'  (24 Namen, 2 Regeln)")
    print("     Damit ist die App gefuellt, ohne dass du tippen musst.")
    print("  3. F12 druecken")
    print("  4. Strg + Umschalt + M   (schaltet die Geraeteansicht ein)")
    print("  5. Oben 'Dimensions: Responsive' waehlen")
    print("  6. Breite und Hoehe eintragen (CSS-Spalte unten!)")
    print("  7. DPR auf den Wert aus der Spalte 'Dichte' stellen")
    print("     Das ist der Punkt, an dem es leicht schiefgeht: Traegt man")
    print("     1290 als Breite ein und laesst DPR auf 1, hat die Datei zwar")
    print("     die richtige Groesse, die App zeichnet aber ihr Breitbild-")
    print("     Layout mit winziger Schrift.")
    print("  8. Menue rechts oben in der Leiste (drei Punkte)")
    print("     -> 'Capture screenshot'")
    print()
    print("MASSE")
    print("  %-20s %11s  %6s   %s" % ("", "CSS", "Dichte", "ergibt"))
    for name, cb, ch, d, pb, ph in MASSE:
        print("  %-20s %5d x %4d     x%d      %4d x %4d"
              % (name, cb, ch, d, pb, ph))
    print()
    print("MOTIVE (vier bis fuenf reichen, die ersten drei zaehlen am meisten)")
    for i, m in enumerate(MOTIVE, 1):
        print("  %d. %s" % (i, m))
    print()
    print("VIER SAETZE INSGESAMT")
    print("  iPhone deutsch / iPhone englisch / iPad deutsch / iPad englisch")
    print("  Sprache in der App umstellen, dann denselben Durchgang wiederholen.")
    print()
    print("Zum Beenden: Strg + C")
    print()

    try:
        webbrowser.open("http://localhost:%d/" % PORT)
    except Exception:
        pass

    with socketserver.TCPServer(("", PORT), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer beendet.")


if __name__ == "__main__":
    main()
