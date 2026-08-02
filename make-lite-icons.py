#!/usr/bin/env python3
"""
Erzeugt aus den Pro-Icons den vollstaendigen Satz fuer FairMix Lite.

Aufruf im Wurzelverzeichnis des Repos:

    python3 make-lite-icons.py            # schreibt nach lite-icons/
    python3 make-lite-icons.py --ziel X   # anderes Zielverzeichnis

Erwartet werden die Dateien, die auch im Repo liegen:

    icon.png, icon-192.png, icon-maskable-512.png
    res/android/icon_{ldpi..xxxhdpi}.png
    res/android/icon_fg_{ldpi..xxxhdpi}.png

Das Motiv wird verkleinert und nach oben gerueckt, darunter kommt ein
Band mit der Aufschrift LITE. Zwei Profile:

  quadrat  fuer die quadratisch bzw. rund maskierten Dateien
  sicher   fuer die Vordergrundebene des adaptiven Icons und fuer das
           maskable-Icon. Android zeigt davon nur den mittleren Kreis mit
           66 Prozent Durchmesser - Motiv und Band bleiben darin.

Vorhandene Transparenz bleibt erhalten. Fehlt sie (etwa weil die Datei
durch eine Zwischenstation gelaufen ist), wird sie aus der Randfarbe
rekonstruiert, damit die Vordergrundebene nicht als weisser Klotz auf
dem Startbildschirm landet.
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow fehlt:  pip install Pillow")

BAND_FARBE = (0, 51, 102, 255)      # #003366, dieselbe Farbe wie die Kopfzeile
TEXT_FARBE = (255, 255, 255, 255)
BESCHRIFTUNG = "LITE"

SCHRIFT_KANDIDATEN = [
    "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]

# Profil: (Verkleinerung, Verschiebung nach unten, Bandoberkante,
#          Bandunterkante, Bandbreite) - alles als Anteil der Kantenlaenge
PROFILE = {
    "quadrat": (0.80, 0.010, 0.745, 0.885, 0.600),
    "sicher":  (0.72, 0.055, 0.628, 0.748, 0.460),
}

DICHTEN = ["ldpi", "mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]


def schrift(groesse):
    for pfad in SCHRIFT_KANDIDATEN:
        if os.path.exists(pfad):
            return ImageFont.truetype(pfad, groesse)
    return ImageFont.load_default()


def mit_alpha(bild):
    """Sorgt fuer eine brauchbare Alphaebene.

    Bilder mit Alpha bleiben unveraendert. Fehlt der Kanal, wird von den
    vier Raendern her alles freigestellt, was der Randfarbe entspricht.
    Der Fuellalgorithmus laeuft bewusst vom Rand aus: helle Flaechen
    mitten im Motiv - etwa die Nabe des Gluecksrads - bleiben so erhalten.
    """
    if bild.mode == "RGBA" and bild.getextrema()[3][0] < 255:
        return bild

    bild = bild.convert("RGB")
    b, h = bild.size
    px = bild.load()
    rand = px[0, 0]

    def nah(p):
        return max(abs(p[0] - rand[0]), abs(p[1] - rand[1]), abs(p[2] - rand[2])) <= 12

    frei = bytearray(b * h)
    stapel = []
    for x in range(b):
        stapel.append((x, 0))
        stapel.append((x, h - 1))
    for y in range(h):
        stapel.append((0, y))
        stapel.append((b - 1, y))

    while stapel:
        x, y = stapel.pop()
        if x < 0 or y < 0 or x >= b or y >= h:
            continue
        i = y * b + x
        if frei[i] or not nah(px[x, y]):
            continue
        frei[i] = 1
        stapel.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    aus = bild.convert("RGBA")
    alpha = Image.frombytes("L", (b, h), bytes(255 if not f else 0 for f in frei))
    aus.putalpha(alpha)
    return aus


def hintergrundfarbe(bild):
    """Die Farbe, mit der freie Flaechen aufgefuellt werden."""
    ecke = bild.getpixel((0, 0))
    return ecke if len(ecke) == 4 else ecke + (255,)


def lite_fassung(quelle, profil):
    bild = Image.open(quelle)
    bild = mit_alpha(bild) if bild.mode in ("RGBA", "LA", "P") else bild.convert("RGB")
    if bild.mode != "RGBA":
        bild = bild.convert("RGBA")

    n = bild.size[0]
    if bild.size[1] != n:
        raise SystemExit("%s ist nicht quadratisch (%dx%d)" % (quelle, *bild.size))

    faktor, versatz, band_oben, band_unten, band_breite = PROFILE[profil]

    ziel = Image.new("RGBA", (n, n), hintergrundfarbe(bild))
    klein = max(1, int(round(n * faktor)))
    ziel.paste(bild.resize((klein, klein), Image.LANCZOS),
               ((n - klein) // 2, int(round(n * versatz))))

    # Das Band wird vierfach vergroessert gezeichnet und dann verkleinert.
    # Bei 36 Pixel Kantenlaenge waeren Rundungen und Schrift sonst kantig.
    s = 4
    schicht = Image.new("RGBA", (n * s, n * s), (0, 0, 0, 0))
    zeichner = ImageDraw.Draw(schicht)

    breite = n * band_breite * s
    oben = n * band_oben * s
    unten = n * band_unten * s
    links = (n * s - breite) / 2
    radius = (unten - oben) / 2

    zeichner.rounded_rectangle([links, oben, links + breite, unten],
                               radius=radius, fill=BAND_FARBE)

    # Die Schrift wird Buchstabe fuer Buchstabe gesetzt. Etwas Sperrung
    # macht vier Grossbuchstaben auf kleinen Flaechen deutlich lesbarer
    # als der enge Standardabstand.
    hoehe = unten - oben
    groesse = max(8, int(hoehe * 0.66))
    fnt = schrift(groesse)
    sperrung = groesse * 0.14

    breiten = [zeichner.textlength(z, font=fnt) for z in BESCHRIFTUNG]
    gesamt = sum(breiten) + sperrung * (len(BESCHRIFTUNG) - 1)

    # Optische Mitte ueber die Versalhoehe, nicht ueber die Zeilenhoehe:
    # sonst sitzt der Text sichtbar zu tief im Band.
    k = zeichner.textbbox((0, 0), BESCHRIFTUNG, font=fnt, anchor="ls")
    mitte_y = (oben + unten) / 2 + (k[3] - k[1]) / 2

    x = n * s / 2 - gesamt / 2
    for z, w in zip(BESCHRIFTUNG, breiten):
        zeichner.text((x, mitte_y), z, font=fnt, fill=TEXT_FARBE, anchor="ls")
        x += w + sperrung

    schicht = schicht.resize((n, n), Image.LANCZOS)
    return Image.alpha_composite(ziel, schicht)


def schreibe(quelle, zielpfad, profil):
    if not os.path.exists(quelle):
        print("  uebersprungen (fehlt): %s" % quelle)
        return False
    bild = lite_fassung(quelle, profil)
    os.makedirs(os.path.dirname(zielpfad) or ".", exist_ok=True)
    bild.save(zielpfad, "PNG", optimize=True)
    print("  %-34s -> %s (%dx%d)" % (quelle, zielpfad, *bild.size))
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--quelle", default=".", help="Wurzelverzeichnis des Repos")
    p.add_argument("--ziel", default="lite-icons", help="Zielverzeichnis")
    a = p.parse_args()

    q = lambda *t: os.path.join(a.quelle, *t)
    z = lambda *t: os.path.join(a.ziel, *t)

    auftraege = [
        (q("icon.png"),              z("icon.png"),              "quadrat"),
        (q("icon-192.png"),          z("icon-192.png"),          "quadrat"),
        (q("icon-maskable-512.png"), z("icon-maskable-512.png"), "sicher"),
    ]
    for d in DICHTEN:
        auftraege.append((q("res", "android", "icon_%s.png" % d),
                          z("res", "android", "icon_%s.png" % d), "quadrat"))
        auftraege.append((q("res", "android", "icon_fg_%s.png" % d),
                          z("res", "android", "icon_fg_%s.png" % d), "sicher"))

    print("FairMix Lite - Icons")
    gemacht = sum(1 for s, t, pr in auftraege if schreibe(s, t, pr))
    print("%d von %d Dateien geschrieben." % (gemacht, len(auftraege)))
    if gemacht < len(auftraege):
        print("Fehlende Dateien bitte pruefen - Cordova bricht sonst beim Bauen ab.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
