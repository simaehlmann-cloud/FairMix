/* store-bilder.js – erzeugt alle Store-Screenshots automatisch.
 *
 *     npm install --no-save playwright
 *     npx playwright install chromium
 *     node store-bilder.js
 *
 * Ergebnis: store-bilder/ mit vier Saetzen zu je fuenf Bildern.
 *
 *     ios-iphone-de/  1..5.png     1290 x 2796
 *     ios-iphone-en/  1..5.png     1290 x 2796
 *     ios-ipad-de/    1..5.png     2048 x 2732
 *     ios-ipad-en/    1..5.png     2048 x 2732
 *
 * Warum ueberhaupt automatisch: Von Hand sind das zwanzig Durchgaenge
 * durch die DevTools, jeder mit derselben Fehlerquelle (DPR steht nicht
 * auf 1, Bild wird doppelt so gross, Apple weist es ab). Hier steht die
 * Groesse im Code und kann nicht verrutschen.
 *
 * Die App wird ueber ihre eigenen Funktionen gesteuert – loadDemoClass(),
 * showPage(), generateTeams(). Es wird nichts nachgebaut und nichts
 * gestellt: Was auf den Bildern steht, hat die App selbst erzeugt. Das
 * ist auch die Anforderung von Apple (Richtlinie 2.3): Screenshots
 * muessen die App im Gebrauch zeigen.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('playwright fehlt. Einmalig:');
  console.error('  npm install --no-save playwright');
  console.error('  npx playwright install chromium');
  process.exit(1);
}

const PORT = 8766;
const ZIEL = 'store-bilder';

/* Apple akzeptiert fuer die 6,9-Zoll-Klasse mehrere Masse. 1290x2796 ist
   das mittlere und wird durchgehend genommen. Beim iPad passt 2048x2732
   in den 13-Zoll-Platz. deviceScaleFactor MUSS 1 sein – bei 2 kaeme das
   Doppelte heraus und App Store Connect lehnt ab. */
/* Entscheidend ist die CSS-Breite, nicht die Pixelzahl.

   Ein iPhone 16 Pro Max hat 430 x 932 CSS-Pixel bei dreifacher Pixeldichte;
   physisch sind das 1290 x 2796 – genau das Mass, das Apple verlangt. Setzt
   man stattdessen das Fenster auf 1290 CSS-Pixel und die Dichte auf 1, kommt
   zwar dieselbe Dateigroesse heraus, die App zeichnet aber ihr
   Breitbild-Layout: winziger Text, viel leere Flaeche. Genau so sah es beim
   ersten Anlauf aus.

   iPad Pro 13": 1024 x 1366 CSS-Pixel bei doppelter Dichte = 2048 x 2732. */
const GERAETE = [
  { name: 'iphone', css: { width: 430,  height: 932  }, dichte: 3 },
  { name: 'ipad',   css: { width: 1024, height: 1366 }, dichte: 2 }
];

const SPRACHEN = ['de', 'en'];

/* Jede Aufnahme laeuft im Seitenkontext. "tun" baut die Ansicht auf,
   "pruefen" nennt ein Element, das danach sichtbar sein MUSS. Fehlt es,
   meldet das Skript den Motivnamen – statt ein leeres Bild abzuliefern,
   das erst im Review auffaellt.

   Die Reihenfolge ist die der Store-Seite: die ersten drei erscheinen in
   der Suche, danach wird es seltener angesehen. */
const MOTIVE = [
  {
    datei: '0-start',
    was: 'Startseite',
    pruefen: '#pageStart.active',
    schritte: [
      () => { showPage('pageStart'); }
    ]
  },
  {
    datei: '1-gruppen',
    was: 'Fertige Gruppen mit Rollen',
    /* Nicht "#pageTeams.active": die Seite ist auch dann offen, wenn gar
       keine Gruppen entstanden sind. Geprueft wird die Ausgabe selbst. */
    pruefen: '#teamsContainer .teamBox',
    schritte: [
      () => { showPage('pageTeams'); chooseTeamMode('auto'); },
      () => {
        /* generateTeams() steigt ohne Zahl in einem der beiden Felder sofort
           wieder aus – die Felder sind nach dem Laden leer. Genau daran sind
           die Praesentations-Motive gescheitert, und Motiv 1 zeigte leere
           Gruppen, weil die Sichtpruefung das nicht bemerkt hat. */
        const feld = document.getElementById('teamCount');
        if (feld) { feld.value = '4'; feld.dispatchEvent(new Event('input')); }
        generateTeams();
      }
    ]
  },
  {
    datei: '2-gluecksrad',
    was: 'Glücksrad bei der Ziehung',
    pruefen: '#wheelBox:not([hidden])',
    schritte: [
      () => { chooseDrawStyle('wheel'); showPage('pageDraw'); },
      () => { pickRandomNameWithAnimation(); }
    ],
    /* Die Ziehung ist animiert und laeuft laenger als alles andere. */
    warten: 3500
  },
  {
    datei: '3-puzzle-stamm',
    was: 'Gruppenpuzzle, Stammgruppen',
    pruefen: '#teamsContainer .teamBox',
    schritte: [
      () => {
        showPage('pageTeams');
        chooseTeamMode('jigsaw');   /* ohne das tut generateJigsaw() nichts */
      },
      () => {
        const ta = document.getElementById('jigsawTopics');
        if (ta) {
          ta.value = 'Photosynthese\nZellatmung\nEnzyme\nStoffwechsel';
          ta.dispatchEvent(new Event('input'));
        }
        generateJigsaw();
      },
      () => {
        switchJigsawView('home');
        const b = document.getElementById('featureJigsaw');
        if (b) b.scrollIntoView({ block: 'start' });
      }
    ]
  },
  {
    datei: '4-puzzle-experten',
    was: 'Gruppenpuzzle, Expertengruppen',
    pruefen: '#teamsContainer .teamBox',
    schritte: [
      () => { showPage('pageTeams'); chooseTeamMode('jigsaw'); },
      () => {
        const ta = document.getElementById('jigsawTopics');
        if (ta) {
          ta.value = 'Photosynthese\nZellatmung\nEnzyme\nStoffwechsel';
          ta.dispatchEvent(new Event('input'));
        }
        generateJigsaw();
      },
      () => {
        switchJigsawView('expert');
        const b = document.getElementById('featureJigsaw');
        if (b) b.scrollIntoView({ block: 'start' });
      }
    ]
  },
  {
    datei: '5-regeln',
    was: 'Regeln zusammen und getrennt',
    pruefen: '#featureRules',
    schritte: [
      () => { showPage('pageTeams'); chooseTeamMode('auto'); },
      () => {
        const b = document.getElementById('featureRules');
        if (b) b.scrollIntoView({ block: 'center' });
      }
    ]
  },
  {
    datei: '6-rollen',
    was: 'Rollenkarten verwalten',
    pruefen: '#roleModal.open',
    schritte: [
      () => { showPage('pageTeams'); },
      () => { openRoleModal(); }
    ]
  },
  {
    datei: '7-namen',
    was: 'Namensliste mit Stufen',
    pruefen: '#pageNames.active',
    schritte: [
      () => { showPage('pageNames'); }
    ]
  },
  {
    datei: '8-uhr',
    was: 'Uhr im Präsentationsmodus',
    pruefen: '#timerBox:not([hidden])',
    schritte: [
      () => { showPage('pageTeams'); chooseTeamMode('auto'); },
      () => {
        /* generateTeams() steigt ohne Zahl in einem der beiden Felder sofort
           wieder aus – die Felder sind nach dem Laden leer. Genau daran sind
           die Praesentations-Motive gescheitert, und Motiv 1 zeigte leere
           Gruppen, weil die Sichtpruefung das nicht bemerkt hat. */
        const feld = document.getElementById('teamCount');
        if (feld) { feld.value = '4'; feld.dispatchEvent(new Event('input')); }
        generateTeams();
      },
      () => { openPresentation('auto'); },
      /* Die Uhr sitzt in der Leiste des Praesentationsmodus, nicht auf
         einer eigenen Seite – deshalb fehlte sie bisher ganz. */
      () => { toggleTimerPanel(); },
      () => { startTimer(); }
    ],
    warten: 1500
  },
  {
    datei: '9-praesentation',
    was: 'Präsentationsmodus',
    pruefen: '#presentOverlay.open',
    schritte: [
      () => { showPage('pageTeams'); chooseTeamMode('auto'); },
      /* Eigener Schritt: openPresentation() bricht ab, wenn teams noch
         leer ist. Im selben Durchlauf wie generateTeams() war es das. */
      () => {
        /* generateTeams() steigt ohne Zahl in einem der beiden Felder sofort
           wieder aus – die Felder sind nach dem Laden leer. Genau daran sind
           die Praesentations-Motive gescheitert, und Motiv 1 zeigte leere
           Gruppen, weil die Sichtpruefung das nicht bemerkt hat. */
        const feld = document.getElementById('teamCount');
        if (feld) { feld.value = '4'; feld.dispatchEvent(new Event('input')); }
        generateTeams();
      },
      () => { openPresentation('auto'); }
    ]
  }
];

function server() {
  return new Promise(res => {
    const typen = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png'
    };
    const s = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const datei = path.join(process.cwd(), p);
      if (!datei.startsWith(process.cwd()) || !fs.existsSync(datei)) {
        rep.writeHead(404); return rep.end();
      }
      rep.writeHead(200, { 'Content-Type': typen[path.extname(datei)] || 'application/octet-stream' });
      rep.end(fs.readFileSync(datei));
    });
    s.listen(PORT, () => res(s));
  });
}

(async () => {
  /* Nicht nur die index.html: fehlt eine der Grafiken, laeuft das Skript
     durch und liefert Bilder mit kaputtem Logo. Genau das ist passiert,
     als es aus einem Unterordner ohne die Icons gestartet wurde. */
  const noetig = ['index.html', 'icon-192.png', 'icon.png', 'manifest.json'];
  const fehlend = noetig.filter(f => !fs.existsSync(f));
  if (fehlend.length) {
    console.error('Diese Dateien fehlen im aktuellen Ordner:');
    fehlend.forEach(f => console.error('  ' + f));
    console.error('');
    console.error('Das Skript gehoert in den Repo-Ordner, in dem die App liegt –');
    console.error('nicht in den entpackten iOS-Ordner.');
    process.exit(1);
  }

  const srv = await server();
  const browser = await chromium.launch();
  let anzahl = 0;
  const fehler = [];

  for (const g of GERAETE) {
    for (const sprache of SPRACHEN) {
      const ordner = path.join(ZIEL, `ios-${g.name}-${sprache}`);
      fs.mkdirSync(ordner, { recursive: true });

      /* Erwartete Dateigroesse in echten Pixeln. */
      const sollBreite = g.css.width  * g.dichte;
      const sollHoehe  = g.css.height * g.dichte;

      const ctx = await browser.newContext({
        viewport: g.css,
        deviceScaleFactor: g.dichte,
        isMobile: g.name === 'iphone',
        hasTouch: true,
        locale: sprache === 'de' ? 'de-DE' : 'en-GB'
      });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/index.html`);
      await page.waitForFunction(() => typeof loadDemoClass === 'function');

      /* Beispielklasse: 24 Namen, Stufen, zwei Regeln. Damit ist die App
         gefuellt, ohne dass etwas erfunden werden muesste. */
      await page.evaluate(s => { setLanguage(s); loadDemoClass(); }, sprache);
      await page.waitForTimeout(400);

      for (const m of MOTIVE) {
        try {
          /* Jedes Motiv startet aus demselben sauberen Zustand. Vorher
             bauten sie aufeinander auf: der Puzzle-Modus blieb stehen und
             verfaelschte die spaeteren Bilder. Das Neuladen kostet ein paar
             Sekunden und spart die Fehlersuche. */
          /* Speicher leeren, BEVOR neu geladen wird. loadDemoClass() fragt
             per Dialog nach, sobald schon Namen da sind – und der Dialog
             stand dann auf jedem folgenden Bild. */
          await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
          await page.reload();
          await page.waitForFunction(() => typeof loadDemoClass === 'function');
          await page.evaluate(s => {
            setLanguage(s);
            /* Rollen und Puzzle muessen eingeschaltet sein, sonst steigen
               chooseTeamMode('jigsaw') und die Rollenvergabe stumm aus. */
            if (typeof features === 'object') {
              features.jigsaw = true; features.roles = true;
              features.rules = true; features.levels = true;
            }
            loadDemoClass();
          }, sprache);
          await page.waitForTimeout(500);

          for (const schritt of m.schritte) {
            await page.evaluate(schritt);
            await page.waitForTimeout(700);
          }
          /* Zusaetzliche Ruhe fuer animierte Motive. */
          await page.waitForTimeout(m.warten || 400);

          /* Die Einblendungen der App gehoeren nicht in einen Store-Screenshot:
             "Beispielklasse geladen" stand sonst quer ueber fast jedem Bild,
             und die Backup-Erinnerung sieht auf der Startseite wie eine
             Fehlermeldung aus. Beides wird erst hier entfernt, damit die
             Ansicht davor normal aufgebaut wird. */
          await page.evaluate(() => {
            if (typeof hideUndoToast === 'function') hideUndoToast();
            ['undoToast', 'msgToast'].forEach(id => {
              const n = document.getElementById(id);
              if (n) n.classList.remove('show');
            });
            const nag = document.getElementById('backupHint');
            if (nag) nag.hidden = true;
          });
          await page.waitForTimeout(250);

          /* Hat das Motiv ueberhaupt etwas aufgebaut? Ein Bild von einer
             Ansicht, die gar nicht erschienen ist, faellt sonst erst im
             Review auf – oder gar nicht. */
          if (m.pruefen) {
            const da = await page.evaluate(sel => {
              const n = document.querySelector(sel);
              if (!n) return false;
              const r = n.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            }, m.pruefen);
            if (!da) {
              fehler.push(`${ordner}/${m.datei}: Ansicht "${m.was}" wurde nicht aufgebaut`);
              continue;
            }
          }
          const ziel = path.join(ordner, m.datei + '.png');
          await page.screenshot({ path: ziel });

          const { width, height } = massePruefen(ziel);
          if (width !== sollBreite || height !== sollHoehe) {
            fehler.push(`${ziel}: ${width}x${height}, erwartet ${sollBreite}x${sollHoehe}`);
          } else {
            anzahl++;
            console.log(`  ${ziel}  ${width}x${height}  (${m.was})`);
          }
        } catch (e) {
          fehler.push(`${ordner}/${m.datei}: ${e.message}`);
        }
      }
      await ctx.close();
    }
  }

  await browser.close();
  srv.close();

  console.log('');
  if (fehler.length) {
    console.log('FEHLER:');
    fehler.forEach(f => console.log('  ' + f));
    process.exit(1);
  }
  console.log(`${anzahl} Bilder geschrieben, alle in korrekter Groesse.`);
  console.log(`Sie liegen in ${ZIEL}/ und koennen direkt hochgeladen werden.`);
  console.log('');
  console.log('Vor dem Hochladen kurz durchsehen: Zeigt jedes Bild etwas');
  console.log('Sinnvolles? Ein leerer Bereich faellt im Review auf.');
})();

/* Liest Breite und Hoehe aus dem PNG-Kopf. Kein Fremdpaket noetig:
   Die Masse stehen im IHDR-Block ab Byte 16. Die Pruefung ist der
   eigentliche Gewinn gegenueber der Handarbeit – ein falsches Mass
   faellt hier auf und nicht erst beim Hochladen. */
function massePruefen(datei) {
  const b = fs.readFileSync(datei);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
