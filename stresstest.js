/* Belastungstest: Halten die Paar-Regeln, wenn die Stufenmischung mitarbeitet?
   Aufruf: node stresstest.js                                                   */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

/* Minimale Attrappe – wir brauchen nur die Rechenkerne. */
function makeNode(tag) {
  const n = {
    tagName: String(tag || 'div').toUpperCase(),
    value: '', textContent: '', hidden: false, checked: false,
    files: [], children: [], dataset: {}, parentNode: null,
    style: { cssText: '', setProperty(){} },
    className: '', title: '', placeholder: '', type: '',
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){ return false; } },
    setAttribute(){}, getAttribute(){ return null; },
    appendChild(c){ n.children.push(c); return c; },
    removeChild(c){ const i = n.children.indexOf(c); if (i >= 0) n.children.splice(i, 1); return c; },
    remove(){},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, matches(){ return false; },
    focus(){}, select(){}, click(){}, scrollIntoView(){}, setPointerCapture(){}
  };
  Object.defineProperty(n, 'innerHTML', { get: () => '', set: () => { n.children.length = 0; } });
  Object.defineProperty(n, 'firstChild', { get: () => n.children[0] || null });
  return n;
}
const stub = makeNode('div');

const ctx = {
  console,
  document: { body: stub, documentElement: {}, createElement: t => makeNode(t),
    createElementNS: (ns, t) => makeNode(t), getElementById: () => stub,
    querySelector: () => stub, querySelectorAll: () => [], addEventListener(){} },
  navigator: {}, location: { protocol: 'file:', hostname: '', reload(){} },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
  Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL(){} },
  Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map,
  Promise, Error, parseInt, parseFloat, isNaN, RegExp, Symbol, FileReader: class {}
};
ctx.window = ctx;
ctx.window.matchMedia = () => ({ matches: false });
ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1], ctx, { filename: 'app.js' });

const run = src => vm.runInContext(src, ctx);
const set = (name, val) => { ctx.__tmp = val; run(name + ' = __tmp;'); };

const NAMEN = Array.from({ length: 24 }, (_, i) => 'P' + (i + 1));
const RUNDEN = 1000;

let verstoesse = 0, getrennt = 0, groessenfehler = 0;
let historieWiederholt = 0, historiePaare = 0;
const qual = { hetero: { gruppen: 0, vielfalt: 0 }, homo: { gruppen: 0, vielfalt: 0 } };

for (const modus of ['off', 'hetero', 'homo']) {
  for (let lauf = 0; lauf < RUNDEN; lauf++) {
    set('originalNames', [...NAMEN]);
    set('presentNames',  [...NAMEN]);
    set('absentNames',   []);
    set('groups', {});
    set('teams', []);
    set('fixedPersons', [NAMEN[0], NAMEN[5], NAMEN[11]]);
    set('pairRules', { together: [[NAMEN[2], NAMEN[3]], [NAMEN[17], NAMEN[18]]],
                       apart:    [[NAMEN[1], NAMEN[4]], [NAMEN[6], NAMEN[7]], [NAMEN[20], NAMEN[21]]] });
    /* Stufen zufaellig verteilen, ein Teil bleibt bewusst ohne */
    const lv = {};
    NAMEN.forEach((n, i) => { if (i % 5 !== 0) lv[n] = 1 + (i % 3); });
    set('levels', lv);
    set('levelMode', modus);
    set('features', { roles: true, fixed: true, rules: true, data: true, levels: true, partners: true });
    /* Historie NICHT leeren: sie soll ueber die Laeufe wachsen, damit der
       Tauschmechanismus unter Last gegen die Regeln arbeiten muss. */

    ctx.document.getElementById = id =>
      id === 'teamCount' ? { value: '6' } : id === 'teamSize' ? { value: '' } : stub;

    run('generateTeams()');
    const teams = run('teams').map(t => t.map(m => m.name));

    /* 0. Partnerhistorie: waechst sie, und bleibt sie konsistent? */
    const hist = run('pairHistory');
    const zerlege = run('splitPairKey');
    Object.keys(hist).forEach(k => {
      const teile = zerlege(k);
      if (!teile || !NAMEN.includes(teile[0]) || !NAMEN.includes(teile[1])
          || !(hist[k] > 0) || teile[0] >= teile[1]) historieWiederholt++;
    });
    historiePaare = Object.keys(hist).length;

    /* 1. "nie zusammen" darf nie verletzt sein */
    for (const [a, b] of [[NAMEN[1], NAMEN[4]], [NAMEN[6], NAMEN[7]], [NAMEN[20], NAMEN[21]]]) {
      if (teams.some(t => t.includes(a) && t.includes(b))) verstoesse++;
    }
    /* 2. "immer zusammen" muss halten */
    for (const [a, b] of [[NAMEN[2], NAMEN[3]], [NAMEN[17], NAMEN[18]]]) {
      if (!teams.some(t => t.includes(a) && t.includes(b))) getrennt++;
    }
    /* 3. Qualitaet der Mischung messen */
    if (modus !== 'off') {
      teams.forEach(t => {
        const stufen = t.map(n => lv[n]).filter(Boolean);
        if (stufen.length > 1) {
          const eindeutig = new Set(stufen).size;
          qual[modus].gruppen++;
          qual[modus].vielfalt += eindeutig;
        }
      });
    }
    /* 4. Gruppengroessen duerfen nicht entgleisen */
    const groessen = teams.map(t => t.length);
    if (Math.max(...groessen) - Math.min(...groessen) > 2) groessenfehler++;
  }
}

const gesamt = RUNDEN * 3;
console.log('─'.repeat(61));
console.log('  Durchläufe gesamt:            ' + gesamt + ' (je ' + RUNDEN + ' für ohne / gemischt / gleichstark)');
console.log('  Verstöße "nie zusammen":      ' + verstoesse);
console.log('  Gebrochene "immer zusammen":  ' + getrennt);
console.log('  Entgleiste Gruppengrößen:     ' + groessenfehler);
console.log('  Kaputte Historie-Einträge:    ' + historieWiederholt);
console.log('  Vermerkte Paare am Ende:      ' + historiePaare);
console.log('  Ø Stufen je Gruppe, gemischt: ' + (qual.hetero.vielfalt / qual.hetero.gruppen).toFixed(2) + ' von 3');
console.log('  Ø Stufen je Gruppe, gleich:   ' + (qual.homo.vielfalt / qual.homo.gruppen).toFixed(2) + ' von 3');
console.log('─'.repeat(61));
/* Schutz gegen stille Verschlechterung: die Partnerhistorie darf die
   Stufenmischung nicht aufweichen. 2,72 war der Wert ohne Historie. */
const mischung = qual.hetero.vielfalt / qual.hetero.gruppen;
const mischungsFehler = mischung < 2.6 ? 1 : 0;
if (mischungsFehler) console.log('  ✗ Durchmischung eingebrochen: ' + mischung.toFixed(2) + ' statt >= 2.60');

const fehler = verstoesse + getrennt + groessenfehler + historieWiederholt + mischungsFehler;
console.log(fehler ? fehler + ' FEHLER' : 'Regeln halten auch mit Stufenmischung');
process.exit(fehler ? 1 : 0);
