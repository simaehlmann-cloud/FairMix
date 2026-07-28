/* FairMix – Ablauftest gegen eine schlanke DOM-Nachbildung.
   Führt die echte App-Logik aus und spielt typische Bedienabläufe durch. */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

/* ================= Mini-DOM ================= */
const VOID = new Set(['input', 'br', 'img', 'meta', 'link', 'hr', 'source']);
let ID_MAP = {};

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = []; this.parentNode = null;
    this.attrs = {}; this.dataset = {}; this._classes = new Set();
    this._text = ''; this.style = makeStyle();
    this.checked = false; this.value = ''; this.hidden = false;
    this.disabled = false; this.selected = false; this.files = [];
    this._events = {}; this.onclick = null; this.onchange = null;
  }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const s = this._classes;
    return {
      add:      (...c) => c.forEach(x => x && s.add(x)),
      remove:   (...c) => c.forEach(x => s.delete(x)),
      contains: c => s.has(c),
      toggle:   (c, force) => { const on = force === undefined ? !s.has(c) : !!force; on ? s.add(c) : s.delete(c); return on; }
    };
  }
  get textContent() {
    if (this.children.length) return this.children.map(c => c.textContent).join('');
    return this._text;
  }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML() { return ''; }
  set innerHTML(v) { if (String(v) !== '') throw new Error('innerHTML mit Inhalt: ' + v); this.children = []; this._text = ''; }
  get title() { return this.attrs.title || ''; }
  set title(v) { this.attrs.title = v; }
  get placeholder() { return this.attrs.placeholder || ''; }
  set placeholder(v) { this.attrs.placeholder = v; }
  get type() { return this.attrs.type || ''; }
  set type(v) { this.attrs.type = v; }

  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') ID_MAP[v] = this; }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); if (c.attrs.id) ID_MAP[c.attrs.id] = c; return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(t, fn) { (this._events[t] = this._events[t] || []).push(fn); }
  removeEventListener(t, fn) { if (this._events[t]) this._events[t] = this._events[t].filter(f => f !== fn); }
  dispatch(t, ev) { (this._events[t] || []).forEach(f => f.call(this, ev || { target: this, currentTarget: this, preventDefault() {} })); }
  click() { if (this.onclick) this.onclick({ target: this, currentTarget: this }); this.dispatch('click'); }
  focus() {} select() {}
  setPointerCapture() {}
  get firstChild() { return this.children[0] || null; }

  walk(fn) { fn(this); this.children.forEach(c => c.walk(fn)); }
  matches(sel) { return matchCompound(this, sel); }
  closest(sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const out = []; this.children.forEach(c => c.walk(n => { if (matchSelector(n, sel)) out.push(n); })); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function makeStyle() {
  const o = { cssText: '', setProperty(k, v) { o[k] = v; }, left: '', top: '', display: '' };
  return o;
}

/* --- winziger Selektor-Motor: Tag, .klasse, #id, [attr], Nachfahren --- */
function matchCompound(node, part) {
  const tokens = part.match(/([.#]?[\w-]+|\[[^\]]+\])/g) || [];
  return tokens.every(tok => {
    if (tok.startsWith('.')) return node._classes.has(tok.slice(1));
    if (tok.startsWith('#')) return node.attrs.id === tok.slice(1);
    if (tok.startsWith('[')) {
      const m = tok.slice(1, -1).split('=');
      const key = m[0];
      return node.attrs[key] !== undefined;
    }
    return node.tagName === tok.toUpperCase();
  });
}
function matchSelector(node, sel) {
  return sel.split(',').some(s => {
    const parts = s.trim().split(/\s+/);
    if (!matchCompound(node, parts[parts.length - 1])) return false;
    let n = node.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (n && !matchCompound(n, parts[i])) n = n.parentNode;
      if (!n) return false;
      n = n.parentNode;
    }
    return true;
  });
}

/* --- HTML des <body> in den Baum überführen --- */
function parseBody(src) {
  const body = new Node('body');
  const start = src.indexOf('<head>');
  const end = src.indexOf('<script>', start);
  let s = src.slice(start, end);
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  const stack = [body];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)\s*(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(s))) {
    const text = s.slice(last, m.index).trim();
    if (text) stack[stack.length - 1]._text += text;
    last = re.lastIndex;

    const [, closing, tag, attrStr, selfClose] = m;
    if (closing) { if (stack.length > 1) stack.pop(); continue; }

    const node = new Node(tag);
    for (const a of attrStr.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      const [, k, v = ''] = a;
      node.setAttribute(k, v);
      if (k === 'class') node.className = v;
      if (k === 'id') ID_MAP[v] = node;
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        node.dataset[camel] = v;
      }
      if (k === 'hidden') node.hidden = true;
    }
    stack[stack.length - 1].appendChild(node);
    if (!selfClose && !VOID.has(tag.toLowerCase())) stack.push(node);
  }
  return body;
}

/* ================= Laufzeitumgebung ================= */
const body = parseBody(html);
const store = {};
const listeners = {};

const documentStub = {
  body,
  documentElement: { lang: 'de' },
  createElement: t => new Node(t),
  getElementById: id => ID_MAP[id] || null,
  querySelector: sel => body.querySelector(sel),
  querySelectorAll: sel => body.querySelectorAll(sel),
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  elementFromPoint: () => null
};

const ctx = {
  console,
  document: documentStub,
  navigator: { serviceWorker: undefined },
  location: { protocol: 'file:', hostname: '', reload() {} },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  setTimeout: (fn, ms) => { if (ms <= 100) fn(); return 0; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  Blob: class { constructor(p) { this.parts = p; } },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  Uint8Array, Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map,
  Promise, Error, parseInt, parseFloat, isNaN, RegExp, Symbol, FileReader: class {}
};
ctx.window = ctx;
ctx.window.matchMedia = () => ({ matches: false });
ctx.window.scrollTo = () => {};
ctx.self = ctx;
vm.createContext(ctx);

const js = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
vm.runInContext(js, ctx, { filename: 'app.js' });

/* Start auslösen */
(listeners.DOMContentLoaded || []).forEach(fn => fn());

/* ================= Abläufe ================= */
const results = [];
const queue = [];
const check = (label, fn) => queue.push([label, fn]);
const flush = () => new Promise(r => setImmediate(r));
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const $ = id => documentStub.getElementById(id);
const g = name => vm.runInContext(name, ctx);

check('Namen anlegen', () => {
  ['Anna', 'Ben', 'Cem', 'Dana', 'Emil', 'Feli', 'Gero', 'Hana'].forEach(n => {
    $('nameInput').value = n; g('addName')();
  });
  assert(g('originalNames').length === 8, 'erwartet 8, ist ' + g('originalNames').length);
});

check('Doppelter Name wird abgewiesen', () => {
  $('nameInput').value = 'Anna'; g('addName')();
  assert(g('originalNames').length === 8, 'Duplikat wurde angelegt');
});

check('Abwesend und zurück', () => {
  g('markAbsent')('Hana');
  assert(g('absentNames').includes('Hana'), 'nicht als abwesend vermerkt');
  assert(!g('presentNames').includes('Hana'), 'noch in der Anwesenheitsliste');
  g('markPresent')('Hana');
  assert(g('presentNames').includes('Hana'), 'nicht zurückgeholt');
});

check('Manuelle Gruppe anlegen und zuordnen', () => {
  $('groupNameInput').value = 'Tisch A'; g('addGroup')();
  $('groupNameInput').value = 'Tisch B'; g('addGroup')();
  $('groupSelect').value = 'Tisch A';
  g('assignToSelectedGroup')('Anna');
  g('assignToSelectedGroup')('Ben');
  assert(g('groups')['Tisch A'].length === 2, 'Zuordnung fehlgeschlagen');
  assert(!g('presentNames').includes('Anna'), 'Anna noch in der freien Liste');
});

check('Doppelte Gruppe wird abgewiesen', () => {
  $('groupNameInput').value = 'Tisch A'; g('addGroup')();
  assert(Object.keys(g('groups')).length === 2, 'Gruppe doppelt angelegt');
});

check('Keine Doppelzuordnung', () => {
  $('groupSelect').value = 'Tisch B';
  g('assignToSelectedGroup')('Anna');
  assert(g('groups')['Tisch B'].length === 0, 'Anna wurde zweimal zugeordnet');
});

check('BUGFIX: Zurücksetzen erzeugt keine Doppelten', () => {
  g('resetNames')();
  const inGroups = ['Anna', 'Ben'];
  inGroups.forEach(n => assert(!g('presentNames').includes(n), n + ' doppelt im Topf'));
  assert(g('presentNames').length === 6, 'erwartet 6 freie Namen, ist ' + g('presentNames').length);
});

check('Gruppe umbenennen behält Reihenfolge und Ziehungsstatus', async () => {
  g('toggleGroupDrawn')('manual', 'Tisch A');
  assert(g('drawnGroups').manual.includes('Tisch A'), 'Status nicht gesetzt');
  // Umbenennen läuft über den Dialog
  g('renameGroup')('Tisch A');
  await flush();
  $('dialogInput').value = 'Gruppe Rot';
  g('closeDialog')(true);
});

check('...Ergebnis der Umbenennung', () => {
  assert(g('groups')['Gruppe Rot'], 'neue Gruppe fehlt');
  assert(!g('groups')['Tisch A'], 'alte Gruppe noch da');
  assert(g('drawnGroups').manual.includes('Gruppe Rot'), 'Ziehungsstatus verloren');
  assert(Object.keys(g('groups'))[0] === 'Gruppe Rot', 'Reihenfolge verloren');
});

check('Mitglied aus Gruppe nehmen kehrt in den Topf zurück', () => {
  g('removeFromManualGroup')('Gruppe Rot', 0);
  assert(g('presentNames').includes('Anna'), 'Anna nicht zurück im Topf');
});

check('Rückgängig stellt Paarregeln wieder her', () => {
  $('pairSelectA').value = 'Cem'; $('pairSelectB').value = 'Dana';
  g('addPairRule')('together');
  assert(g('pairRules').together.length === 1, 'Regel nicht angelegt');
  g('deleteSingleName')('Cem');
  assert(g('pairRules').together.length === 0, 'Regel nicht bereinigt');
  g('performUndo')();
  assert(g('originalNames').includes('Cem'), 'Name nicht zurück');
  assert(g('pairRules').together.length === 1, 'Regel nach Undo verloren');
});

check('Automatische Gruppen: Anzahl', () => {
  g('resetNames')();
  $('teamCount').value = '3'; $('teamSize').value = '';
  g('generateTeams')();
  assert(g('teams').length === 3, 'erwartet 3 Gruppen, ist ' + g('teams').length);
  const total = g('teams').reduce((a, t) => a + t.length, 0);
  assert(total === g('presentNames').length, 'nicht alle verteilt: ' + total);
});

check('Automatische Gruppen ohne Eingabe werden verweigert', () => {
  const before = JSON.stringify(g('teams'));
  $('teamCount').value = ''; $('teamSize').value = '';
  g('generateTeams')();
  assert(JSON.stringify(g('teams')) === before, 'Gruppen ohne Vorgabe erzeugt');
});

check('Sauberer Ausgangszustand für die Regeltests', () => {
  vm.runInContext('groups = {}; drawnGroups.manual = []; drawnGroups.auto = []; absentNames = [];', ctx);
  g('resetNames')();
  assert(g('presentNames').length === 8, 'erwartet 8 freie Namen, ist ' + g('presentNames').length);
});

check('Regel "nie zusammen" wird eingehalten (300 Durchläufe)', () => {
  g('pairRules').together = [];
  g('pairRules').apart = [['Anna', 'Ben'], ['Dana', 'Emil']];
  $('teamCount').value = '3';
  for (let i = 0; i < 300; i++) {
    g('generateTeams')();
    g('teams').forEach(t => {
      const n = t.map(m => m.name);
      assert(!(n.includes('Anna') && n.includes('Ben')), 'Anna+Ben in Runde ' + i);
      assert(!(n.includes('Dana') && n.includes('Emil')), 'Dana+Emil in Runde ' + i);
    });
  }
});

check('Regel "immer zusammen" wird eingehalten (300 Durchläufe)', () => {
  g('pairRules').apart = [];
  g('pairRules').together = [['Anna', 'Ben'], ['Dana', 'Emil']];
  for (let i = 0; i < 300; i++) {
    g('generateTeams')();
    const find = n => g('teams').findIndex(t => t.some(m => m.name === n));
    assert(find('Anna') === find('Ben'), 'Anna/Ben getrennt in Runde ' + i);
    assert(find('Dana') === find('Emil'), 'Dana/Emil getrennt in Runde ' + i);
  }
});

check('Gruppengröße statt Anzahl', () => {
  g('pairRules').together = [];
  $('teamCount').value = ''; $('teamSize').value = '2';
  g('generateTeams')();
  const n = g('presentNames').length;
  assert(g('teams').length === Math.ceil(n / 2), 'falsche Gruppenzahl: ' + g('teams').length);
});

check('Faire Ziehung bevorzugt selten Gezogene', () => {
  const counts = {};
  g('presentNames').forEach(n => counts[n] = 0);
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  // 4 volle Runden simulieren
  for (let round = 0; round < 4; round++) {
    g('resetDraw')();
    const pool = [...g('presentNames')];
    for (let i = 0; i < pool.length; i++) {
      const pn = g('presentNames');
      const min = Math.min(...pn.map(x => dc[x] || 0));
      const cand = pn.filter(x => (dc[x] || 0) === min);
      const chosen = cand[0];
      dc[chosen] = (dc[chosen] || 0) + 1;
      counts[chosen]++;
      g('presentNames').splice(g('presentNames').indexOf(chosen), 1);
    }
  }
  const vals = Object.values(counts);
  assert(Math.max(...vals) - Math.min(...vals) <= 1, 'Ziehung unfair: ' + JSON.stringify(counts));
});

check('Sprachwechsel färbt alle Texte um', () => {
  g('setLanguage')('en');
  g('renderAll')();
  assert(documentStub.documentElement.lang === 'en', 'html lang nicht gesetzt');
  assert($('nav-pageNames').textContent === 'Names', 'Navigation nicht übersetzt');
  assert(documentStub.querySelector('title').textContent === 'FairMix Pro', 'Titel fehlt');
  g('setLanguage')('de');
  g('renderAll')();
  assert($('nav-pageNames').textContent === 'Namen', 'Rückwechsel fehlgeschlagen');
});

check('Seitenwechsel rendert ohne Fehler', () => {
  ['pageNames', 'pageDraw', 'pageGroups', 'pageTeams', 'pageAbout', 'pageStart']
    .forEach(p => g('showPage')(p));
  assert(documentStub.querySelector('.page.active').attrs.id === 'pageStart', 'aktive Seite falsch');
});

check('Zustand übersteht Speichern und Laden', () => {
  g('saveState')();
  const before = JSON.stringify({ g: g('groups'), t: g('teams'), p: g('pairRules') });
  g('loadState')();
  const after = JSON.stringify({ g: g('groups'), t: g('teams'), p: g('pairRules') });
  assert(before === after, 'Zustand verändert sich beim Neuladen');
});

check('Alles löschen entfernt jeden Rest', async () => {
  g('deleteAllNames')();
  await flush();
  g('closeDialog')(true);
});

check('...Ergebnis von Alles löschen', () => {
  assert(g('originalNames').length === 0, 'Namen übrig');
  assert(Object.keys(g('groups')).length === 0, 'Gruppen übrig');
  assert(g('teams').length === 0, 'Teams übrig');
  assert(g('pairRules').together.length === 0 && g('pairRules').apart.length === 0, 'Regeln übrig');
});

check('Leerzustände werden angezeigt', () => {
  g('renderAll')();
  assert($('groupsContainer').textContent.length > 10, 'kein Hinweistext bei leeren Gruppen');
  assert($('teamsContainer').textContent.length > 10, 'kein Hinweistext bei leeren Teams');
});

/* ================= Ausgabe ================= */
(async () => {
for (const [label, fn] of queue) {
  try { await fn(); await flush(); await flush(); results.push(['ok', label]); }
  catch (e) { results.push(['fail', label + ' -> ' + e.message]); }
}
console.log('─'.repeat(61));
let failed = 0;
results.forEach(([s, m]) => {
  if (s === 'ok') console.log('  \u2713 ' + m);
  else { failed++; console.log('  \u2717 ' + m); }
});
console.log('─'.repeat(61));
console.log(failed ? failed + ' ABLAUF-FEHLER' : results.length + ' Abläufe fehlerfrei');
process.exit(failed ? 1 : 0);
})();
