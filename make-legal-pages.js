/* Erzeugt aus den Rechtstexten der App die Fassungen fuer GitHub Pages.
 *
 *   node make-legal-pages.js
 *
 * Die Dateien im Wurzelverzeichnis sind die einzige Quelle. In der App
 * zeigt "Zurueck zur App" auf die index.html – im Web gibt es die dort
 * nicht, weil Pages aus docs/ liefert und der Quelltext der App bewusst
 * nicht mit veroeffentlicht wird. Der Verweis geht deshalb in den Store.
 *
 * validate.js fuehrt dieselbe Umformung im Speicher aus und vergleicht.
 * Wer einen Rechtstext aendert und dieses Skript vergisst, faellt durch –
 * genau das soll es verhindern: eine Datenschutzerklaerung, die im Store
 * anders lautet als in der App.
 */
const fs = require('fs');
const path = require('path');

const ZIEL = 'docs';

/* Muss zu PRO_STORE_URL in der index.html passen. validate.js prueft das. */
const STORE_URL = 'https://play.google.com/store/apps/details?id=de.fairmix.app';

/* Einzige Umformung: der Rueckverweis auf die App. Alles andere – Text,
   Gestaltung, Kopfzeile – bleibt Zeichen fuer Zeichen gleich.

   Der Knopf fuehrt bewusst auf die Uebersichtsseite und nicht mehr in den
   Play Store: Diese Seite ist auch die Datenschutz-Adresse im App Store,
   und Apples Richtlinie 2.3.10 untersagt Verweise auf andere mobile
   Plattformen in den Metadaten. Fuer Android-Nutzer aendert sich nichts
   Wesentliches – sie kommen ueber den Store, aus dem sie geladen haben.
   STORE_URL bleibt stehen, weil validate.js sie gegen PRO_STORE_URL in der
   index.html prueft. */
function fuerWeb(html) {
  return html
    .replace(/href="index\.html">Zurück zur App</g,
             'href="../">Zur Übersicht<')
    .replace(/href="index\.html">Back to the app</g,
             'href="../">Overview<')
    .replace(/<title>([^<]*)<\/title>/,
             '<title>$1</title>\n<meta name="robots" content="index, follow">');
}

const START = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wisdompeak Apps – Rechtliches</title>
<meta name="theme-color" content="#003366">
<style>
  :root { --bg:#bcdcff; --card:#fff; --text:#003366; --border:#0055aa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#121220; --card:#1e1e30; --text:#e6e6ee; --border:#5b9ce6; }
  }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--text);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
         line-height:1.5; }
  main { max-width:640px; margin:0 auto; background:var(--card);
         border:2px solid var(--border); border-radius:14px; padding:24px; }
  h1 { font-size:24px; margin:0 0 8px; }
  h2 { font-size:18px; margin:24px 0 8px; }
  ul { margin:0; padding-left:20px; }
  li { margin:6px 0; }
  a { color:var(--border); }
</style>
</head>
<body>
<main>
  <h1>Wisdompeak Apps</h1>
  <p>Rechtliche Angaben zu den Apps von Simon Mählmann.</p>

  <h2>FairMix</h2>
  <ul>
    <li><a href="fairmix/datenschutz.html">Datenschutzerklärung</a></li>
    <li><a href="fairmix/impressum.html">Impressum</a></li>
    <li><a href="fairmix/datenschutz-en.html">Privacy Policy (English)</a></li>
    <li><a href="fairmix/impressum-en.html">Legal Notice (English)</a></li>
  </ul>

  <p>Kontakt: <a href="mailto:smaehlmann.appdev@gmail.com">smaehlmann.appdev@gmail.com</a></p>
</main>
</body>
</html>
`;

/* Wird auch von validate.js benutzt: dieselbe Umformung, dieselben Ziele. */
function erwarteteDateien() {
  return {
    [path.join(ZIEL, 'index.html')]: START,
    [path.join(ZIEL, '.nojekyll')]: '',
    [path.join(ZIEL, 'fairmix', 'datenschutz.html')]:
      fuerWeb(fs.readFileSync('datenschutz.html', 'utf8')),
    [path.join(ZIEL, 'fairmix', 'impressum.html')]:
      fuerWeb(fs.readFileSync('impressum.html', 'utf8')),
    [path.join(ZIEL, 'fairmix', 'datenschutz-en.html')]:
      fuerWeb(fs.readFileSync('datenschutz-en.html', 'utf8')),
    [path.join(ZIEL, 'fairmix', 'impressum-en.html')]:
      fuerWeb(fs.readFileSync('impressum-en.html', 'utf8'))
  };
}

module.exports = { erwarteteDateien, STORE_URL, ZIEL };

if (require.main === module) {
  const dateien = erwarteteDateien();
  for (const [ziel, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, inhalt);
    console.log('  ' + ziel);
  }
  console.log(Object.keys(dateien).length + ' Dateien geschrieben.');
  console.log('GitHub Pages: Settings -> Pages -> Branch main, Ordner /docs');
}
