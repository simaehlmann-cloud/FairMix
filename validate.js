/* FairMix – Prüfskript. Läuft mit: node validate.js */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
let errors = [], warns = [], ok = [];
const E = m => errors.push(m);
const W = m => warns.push(m);
const O = m => ok.push(m);

/* ---------- Skriptblock isolieren ---------- */
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) E(`Erwartet 1 Inline-Skript, gefunden: ${scripts.length}`);
const js = scripts.join('\n');

/* ---------- 1. Syntax ---------- */
try { new vm.Script(js, { filename: 'inline.js' }); O('JavaScript-Syntax gültig'); }
catch (e) { E(`Syntaxfehler: ${e.message}`); }

/* ---------- 2. i18n-Pakete extrahieren ---------- */
let packs = null;
try {
  const ctx = { console };
  vm.createContext(ctx);
  const start = js.indexOf('const i18n = {');
  const end = js.indexOf('\n};', start) + 3;
  vm.runInContext(js.slice(start, end) + '\nthis.__i18n = i18n;', ctx);
  packs = ctx.__i18n;
  O('i18n-Objekt lesbar');
} catch (e) { E(`i18n nicht lesbar: ${e.message}`); }

if (packs) {
  const de = Object.keys(packs.de), en = Object.keys(packs.en);
  const missingEn = de.filter(k => !en.includes(k));
  const missingDe = en.filter(k => !de.includes(k));
  if (missingEn.length) E(`Schlüssel fehlen in EN: ${missingEn.join(', ')}`);
  if (missingDe.length) E(`Schlüssel fehlen in DE: ${missingDe.join(', ')}`);
  if (!missingEn.length && !missingDe.length) O(`i18n vollständig (${de.length} Schlüssel in DE und EN)`);

  const emptyDe = de.filter(k => !String(packs.de[k]).trim());
  const emptyEn = en.filter(k => !String(packs.en[k]).trim());
  if (emptyDe.length) E(`Leere DE-Texte: ${emptyDe.join(', ')}`);
  if (emptyEn.length) E(`Leere EN-Texte: ${emptyEn.join(', ')}`);

  /* Schlüssel aus dem Markup */
  const attrKeys = new Set();
  for (const a of ['data-i18n', 'data-i18n-placeholder', 'data-i18n-title', 'data-i18n-aria']) {
    const re = new RegExp(`${a}="([^"]+)"`, 'g');
    for (const m of html.matchAll(re)) attrKeys.add(m[1]);
  }
  const missAttr = [...attrKeys].filter(k => !de.includes(k));
  if (missAttr.length) E(`Im HTML benutzte, aber nicht definierte Schlüssel: ${missAttr.join(', ')}`);
  else O(`Alle ${attrKeys.size} HTML-Schlüssel definiert`);

  /* Schlüssel aus t('...') */
  const tKeys = new Set([...js.matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]));
  const missT = [...tKeys].filter(k => !de.includes(k));
  if (missT.length) E(`In t() benutzte, aber nicht definierte Schlüssel: ${missT.join(', ')}`);
  else O(`Alle ${tKeys.size} t()-Schlüssel definiert`);

  /* Ungenutzte Schlüssel */
  /* Schlüssel, die über Variablen adressiert werden (z. B. t(f.label)),
     erkennt man nur daran, dass sie irgendwo als Zeichenkette auftauchen. */
  const literals = new Set([...js.matchAll(/'([A-Za-z0-9_]+)'/g)].map(m => m[1]));
  const used = new Set([...attrKeys, ...tKeys, ...[...literals].filter(k => de.includes(k))]);
  const unused = de.filter(k => !used.has(k));
  if (unused.length) W(`Nicht verwendete Schlüssel: ${unused.join(', ')}`);
}

/* ---------- 3. Inline-Handler zeigen auf existierende Funktionen ---------- */
const declared = new Set([...js.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map(m => m[1]));
const handlerCalls = new Set();
for (const m of html.matchAll(/\bon(?:click|change|input|submit)="([^"]+)"/g)) {
  for (const c of m[1].matchAll(/([A-Za-z0-9_$]+)\s*\(/g)) handlerCalls.add(c[1]);
}
const missingFns = [...handlerCalls].filter(f => !declared.has(f));
if (missingFns.length) E(`Handler ohne Funktion: ${missingFns.join(', ')}`);
else O(`Alle ${handlerCalls.size} Inline-Handler aufgelöst`);

/* ---------- 4. Doppelte Funktionsnamen ---------- */
const fnList = [...js.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map(m => m[1]);
const dupFns = fnList.filter((f, i) => fnList.indexOf(f) !== i);
if (dupFns.length) E(`Doppelte Funktionsnamen: ${[...new Set(dupFns)].join(', ')}`);
else O('Keine doppelten Funktionsnamen');

/* ---------- 5. Doppelte IDs ---------- */
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
if (dupIds.length) E(`Doppelte IDs: ${[...new Set(dupIds)].join(', ')}`);
else O(`Keine doppelten IDs (${ids.length} insgesamt)`);

/* ---------- 6. getElementById auf vorhandene Elemente ---------- */
const idSet = new Set(ids);
const looked = new Set([...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]));
[...js.matchAll(/getElementById\('([^']+)'\)/g)].forEach(m => looked.add(m[1]));
const ghostIds = [...looked].filter(i => !idSet.has(i));
if (ghostIds.length) E(`getElementById auf fehlende IDs: ${ghostIds.join(', ')}`);
else O(`Alle ${looked.size} getElementById-Ziele vorhanden`);

/* ---------- 7. innerHTML nur zum Leeren ---------- */
const bad = [...js.matchAll(/\.innerHTML\s*=\s*([^;\n]+)/g)]
  .map(m => m[1].trim()).filter(v => v !== '""' && v !== "''");
if (bad.length) E(`innerHTML mit Inhalt (Injektionsrisiko): ${bad.join(' | ')}`);
else O('innerHTML wird nur zum Leeren verwendet');
if (/insertAdjacentHTML|document\.write|eval\(/.test(js)) E('Unsichere DOM-/Eval-Aufrufe gefunden');

/* ---------- 8. Keine externen Ressourcen (Offline-Fähigkeit) ---------- */
const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
if (ext.length) E(`Externe Ressourcen gefunden: ${ext.join(', ')}`);
else O('Keine externen Ressourcen – vollständig offline');
if (/html2canvas/.test(html)) E('Verweis auf html2canvas noch vorhanden');

/* ---------- 9. Keine Browser-Dialoge mehr ---------- */
const natives = [...js.matchAll(/(?:^|[^.\w])(alert|confirm|prompt)\s*\(/g)].map(m => m[1]);
if (natives.length) E(`Native Dialoge gefunden: ${[...new Set(natives)].join(', ')}`);
else O('Keine nativen alert/confirm/prompt');

/* ---------- 10. Alle Seiten erreichbar ---------- */
const pages = [...html.matchAll(/<div id="(page[A-Za-z]+)" class="page/g)].map(m => m[1]);
const targets = new Set([...html.matchAll(/showPage\('([^']+)'\)/g)].map(m => m[1]));
const unreachable = pages.filter(p => !targets.has(p));
if (unreachable.length) E(`Seiten ohne Navigationsziel: ${unreachable.join(', ')}`);
else O(`Alle ${pages.length} Seiten erreichbar`);
const ghostPages = [...targets].filter(p => !pages.includes(p));
if (ghostPages.length) E(`showPage auf fehlende Seiten: ${ghostPages.join(', ')}`);

/* ---------- 11. Manifest, Service Worker, Icons ---------- */
const mf = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const need = ['name', 'short_name', 'start_url', 'display', 'icons', 'id', 'scope'];
const miss = need.filter(k => !(k in mf));
if (miss.length) E(`manifest.json fehlt: ${miss.join(', ')}`);
else O('manifest.json vollständig');
const sizes = mf.icons.map(i => i.sizes);
if (!sizes.includes('192x192') || !sizes.includes('512x512')) E('manifest.json braucht 192x192 und 512x512');
if (!mf.icons.some(i => (i.purpose || '').includes('maskable'))) E('manifest.json braucht ein maskable-Icon');

const sw = fs.readFileSync('sw.js', 'utf8');
if (!/activate/.test(sw))       E('sw.js ohne activate-Handler (alte Caches bleiben liegen)');
if (!/caches\.delete/.test(sw)) E('sw.js löscht alte Caches nicht');
if (!/SKIP_WAITING/.test(sw))   E('sw.js reagiert nicht auf SKIP_WAITING');

/* Alle im SW gelisteten Dateien müssen existieren */
const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(Boolean);
const missingAssets = assets.filter(a => !fs.existsSync(a));
if (missingAssets.length) E(`sw.js cached nicht vorhandene Dateien: ${missingAssets.join(', ')}`);
else O(`Alle ${assets.length} gecachten Dateien vorhanden`);

/* Im HTML referenzierte lokale Dateien */
const locals = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"]+)"/g)].map(m => m[1])
  .filter(f => f !== 'cordova.js');
const missingLocal = locals.filter(f => !fs.existsSync(f));
if (missingLocal.length) E(`Im HTML verlinkte, aber fehlende Dateien: ${missingLocal.join(', ')}`);
else O(`Alle ${locals.length} verlinkten Dateien vorhanden`);

/* ---------- 12. config.xml ---------- */
const cfg = fs.readFileSync('config.xml', 'utf8');
for (const [re, msg] of [
  [/android-versionCode="\d+"/, 'config.xml ohne android-versionCode'],
  [/android-targetSdkVersion"\s+value="3[6-9]"/, 'config.xml zielt nicht auf API 36+'],
  [/icon[^>]+foreground/, 'config.xml ohne adaptives Icon'],
  [/socialsharing/, 'config.xml ohne Share-Plugin (Export bricht)']
]) if (!re.test(cfg)) E(msg);
if (!errors.some(e => e.startsWith('config.xml'))) O('config.xml vollständig');

/* ---------- 13. Rechtstexte: vollständig und widerspruchsfrei ---------- */
const legal = {
  'impressum.html':   fs.readFileSync('impressum.html', 'utf8'),
  'datenschutz.html': fs.readFileSync('datenschutz.html', 'utf8'),
  'config.xml':       cfg
};
const MAIL = 'smaehlmann.appdev@gmail.com';
const MUST = ['Wisdompeak Apps', 'Simon Mählmann', 'Oderstraße 13', '28844 Weyhe'];

for (const [file, text] of Object.entries(legal)) {
  if (!text.includes(MAIL)) E(`${file} nennt nicht die Kontaktadresse ${MAIL}`);
  if (/info@fairmix\.de|fairmix\.de|Simon Mähl[^m]/.test(text)) E(`${file} enthält veraltete Anbieterangaben`);
}
for (const f of ['impressum.html', 'datenschutz.html']) {
  const fehlt = MUST.filter(m => !legal[f].includes(m));
  if (fehlt.length) E(`${f} fehlt: ${fehlt.join(', ')}`);
}
if (/class="todo"|Bitte hier|PLATZHALTER|TODO/i.test(legal['impressum.html'] + legal['datenschutz.html']))
  E('In den Rechtstexten steht noch ein Platzhalter');
if (/ec\.europa\.eu\/consumers\/odr|OS-Plattform|Online-Streitbeilegung/.test(legal['impressum.html']))
  E('Impressum verweist auf die abgeschaltete OS-Plattform (abmahnfähig)');
if (!/§ 5 DDG/.test(legal['impressum.html'])) E('Impressum ohne Bezug auf § 5 DDG');
if (!errors.some(e => /impressum|datenschutz|config\.xml nennt/.test(e))) O('Rechtstexte vollständig und widerspruchsfrei');

/* ---------- 14. Android-Ressourcen kollisionsfrei ---------- */
const colors = fs.readFileSync('res/android/colors.xml', 'utf8');
const colorNames = [...colors.matchAll(/<color name="([^"]+)"/g)].map(m => m[1]);
const reserved = colorNames.filter(n => /^(cdv_|android_)/.test(n));
if (reserved.length) E(`colors.xml belegt von Cordova erzeugte Namen: ${reserved.join(', ')}`);
const referenced = [...cfg.matchAll(/@color\/([\w]+)/g)].map(m => m[1]);
const undefinedColors = [...new Set(referenced)].filter(n => !colorNames.includes(n));
if (undefinedColors.length) E(`config.xml verweist auf fehlende Farben: ${undefinedColors.join(', ')}`);
if (!reserved.length && !undefinedColors.length) O('Android-Farbressourcen kollisionsfrei');

/* ---------- 15. Export: nur Daten-URIs teilen ---------- */
if (/fileEntry\.toURL|resolveLocalFileSystemURL|createWriter/.test(js))
  E('Export nutzt noch Dateisystem-Pfade – ab Android 7 nicht teilbar');
if (!/blobToDataUrl/.test(js)) E('Export baut keine Daten-URI');
if (!/subject:\s*filename/.test(js)) E('Dateiname wird dem Share-Plugin nicht als subject übergeben');
if (/cordova-plugin-file"/.test(cfg)) E('config.xml enthält ein nicht mehr genutztes Dateisystem-Plugin');
if (!errors.some(e => /Export|Dateiname|Dateisystem/.test(e))) O('Export teilt ausschließlich Daten-URIs');

/* ---------- Ausgabe ---------- */
console.log('\n\u2500'.repeat(1) + '─'.repeat(60));
ok.forEach(m => console.log('  \u2713 ' + m));
warns.forEach(m => console.log('  ! ' + m));
errors.forEach(m => console.log('  \u2717 ' + m));
console.log('─'.repeat(61));
console.log(errors.length ? `${errors.length} FEHLER` : 'Alle Prüfungen bestanden');
process.exit(errors.length ? 1 : 0);
