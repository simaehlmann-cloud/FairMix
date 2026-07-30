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
  focus() {} select() {} scrollIntoView() {}
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

check('App startet mit reduziertem Funktionsumfang', () => {
  g('renderAll')();
  assert(g('features').fixed  === false, 'Fixierte Personen sind zu Beginn eingeschaltet');
  assert(g('features').rules  === false, 'Regeln sind zu Beginn eingeschaltet');
  assert(g('features').levels === false, 'Stufen sind zu Beginn eingeschaltet');
  assert(g('features').roles  === false, 'Rollen sind zu Beginn eingeschaltet');
  assert(g("[...document.querySelectorAll('.feature-roles')].every(b => b.hidden)"),
         'Rollen-Schaltflaechen sichtbar');
  assert(g('features').data   === true,  'Import und Backup fehlt');
  assert($('featureFixed').hidden     === true, 'Bereich fuer fixierte Personen sichtbar');
  assert($('featureRules').hidden     === true, 'Regelbereich sichtbar');
  assert($('featureLevels').hidden    === true, 'Stufenbereich sichtbar');
  assert($('featureLevelMode').hidden === true, 'Mischbereich sichtbar');
  assert($('featureData').hidden      === false, 'Import und Backup ausgeblendet');

  const reihe = g('FEATURES').map(f => f.key);
  assert(reihe[reihe.length - 1] === 'data', 'Import und Backup steht nicht am Ende');

  /* Fuer alle folgenden Ablaeufe alles einschalten */
  vm.runInContext("Object.keys(features).forEach(k => features[k] = true);", ctx);
  g('renderAll')();
});

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

check('Rollen erscheinen als Chip, Bezeichnung klappt auf', () => {
  g('resetNames')();
  $('teamCount').value = '2'; $('teamSize').value = '';
  g('generateTeams')();
  const chips = $('teamsContainer').querySelectorAll('.role-chip');
  assert(chips.length > 0, 'kein Rollen-Chip gerendert');
  const chip = chips[0];
  assert(chip.textContent.length <= 4, 'Chip zeigt Langtext: ' + chip.textContent);
  const li = chip.parentNode.parentNode;
  const detail = li.querySelector('.role-detail');
  assert(detail, 'kein Detailfeld angelegt');
  assert(detail.hidden === true, 'Detail ist von Anfang an offen');
  assert(chip.getAttribute('aria-expanded') === 'false', 'aria-expanded falsch');
  chip.click();
  assert(detail.hidden === false, 'Detail klappt nicht auf');
  assert(chip.getAttribute('aria-expanded') === 'true', 'aria-expanded nicht aktualisiert');
  assert(detail.textContent.length > 5, 'Detailfeld ohne Bezeichnung');
  chip.click();
  assert(detail.hidden === true, 'Detail klappt nicht wieder zu');
});

check('Präsentation: Gruppe ziehen markiert und wiederholt sich nicht', () => {
  g('openPresentation')('auto');
  assert(g('presentCards').length === 2, 'Karten nicht aufgebaut');
  assert(g('drawnGroups').auto.length === 0, 'Ziehung nicht leer');

  g('presentDraw')();
  assert(g('drawnGroups').auto.length === 1, 'erste Ziehung nicht vermerkt');
  const erste = g('drawnGroups').auto[0];

  g('presentDraw')();
  assert(g('drawnGroups').auto.length === 2, 'zweite Ziehung nicht vermerkt');
  assert(g('drawnGroups').auto[1] !== erste, 'dieselbe Gruppe zweimal gezogen');

  g('presentDraw')();
  assert(g('drawnGroups').auto.length === 2, 'über den Vorrat hinaus gezogen');
});

check('Präsentation: gezogene Karten werden gekennzeichnet', () => {
  const markiert = g('presentCards').filter(c => c.node.classList.contains('drawn'));
  assert(markiert.length === 2, 'Karten nicht als gezogen markiert');
  g('presentResetDraw')();
  assert(g('drawnGroups').auto.length === 0, 'Zurücksetzen wirkungslos');
  const danach = g('presentCards').filter(c => c.node.classList.contains('drawn'));
  assert(danach.length === 0, 'Markierung bleibt nach dem Zurücksetzen');
});

check('Präsentation: Ziehung teilt sich den Zustand mit der Bearbeitungsseite', () => {
  g('presentDraw')();
  const key = g('drawnGroups').auto[0];
  g('closePresentation')();
  g('renderTeams')();
  const boxen = $('teamsContainer').querySelectorAll('.teamBox');
  const box = boxen.find(b => Number(b.dataset.team) === key);
  assert(box && box.classList.contains('drawn-group'), 'Bearbeitungsseite zeigt die Ziehung nicht');
  g('resetGroupDraw')('auto');
});

check('Präsentation funktioniert auch für manuelle Gruppen', () => {
  $('groupNameInput').value = 'Team Nord'; g('addGroup')();
  $('groupNameInput').value = 'Team Süd';  g('addGroup')();
  $('groupSelect').value = 'Team Nord'; g('assignToSelectedGroup')(g('presentNames')[0]);
  $('groupSelect').value = 'Team Süd';  g('assignToSelectedGroup')(g('presentNames')[0]);

  g('openPresentation')('manual');
  assert(g('presentCards').length === 2, 'manuelle Karten fehlen');
  g('presentDraw')();
  assert(g('drawnGroups').manual.length === 1, 'manuelle Ziehung nicht vermerkt');
  assert(typeof g('drawnGroups').manual[0] === 'string', 'Schlüssel ist kein Gruppenname');
  g('presentResetDraw')();
  g('closePresentation')();
});

check('Einstellungsseite zeigt keine Navigationsleiste', () => {
  g('showPage')('pageSettings');
  assert(documentStub.querySelector('.page.active').attrs.id === 'pageSettings', 'Seite nicht aktiv');
  assert(!$('mainNav').classList.contains('visible'), 'Navigationsleiste eingeblendet');
  assert($('featureList').children.length === g('FEATURES').length,
         'Funktionsschalter fehlen: ' + $('featureList').children.length + ' von ' + g('FEATURES').length);
});

check('Farbmodus lässt sich dreistufig wählen', () => {
  g('chooseTheme')('dark');
  assert(documentStub.body.classList.contains('dark-mode'), 'Dunkelmodus nicht aktiv');
  assert($('choiceThemeDark').classList.contains('choice-active'), 'Auswahl nicht markiert');
  g('chooseTheme')('light');
  assert(!documentStub.body.classList.contains('dark-mode'), 'Hellmodus nicht aktiv');
  g('chooseTheme')('auto');
  assert($('choiceThemeAuto').classList.contains('choice-active'), 'Automatik nicht markiert');
});

check('Sprache lässt sich in den Einstellungen wählen', () => {
  g('chooseLanguage')('en');
  assert($('choiceLangEn').classList.contains('choice-active'), 'Englisch nicht markiert');
  assert(!$('choiceLangDe').classList.contains('choice-active'), 'Deutsch noch markiert');
  g('chooseLanguage')('de');
});

check('Eigene Rolle anlegen, bearbeiten und behalten', () => {
  $('newRoleIcon').value = 'MAT';
  $('newRoleName').value = 'Gerätewart';
  $('newRoleDesc').value = 'Holt und verstaut die Geräte';
  g('saveCustomRole')();
  const rollen = g('customRoles');
  assert(rollen.length === 1, 'Rolle nicht angelegt');
  const id = rollen[0].id;
  assert($('newRoleName').value === '', 'Formular nicht geleert');

  g('editRole')(id);
  assert($('newRoleIcon').value === 'MAT', 'Symbol nicht vorbelegt');
  assert($('newRoleName').value === 'Gerätewart', 'Name nicht vorbelegt');
  assert($('newRoleDesc').value === 'Holt und verstaut die Geräte', 'Beschreibung nicht vorbelegt');
  assert($('roleEditCancel').hidden === false, 'Abbrechen nicht sichtbar');

  $('newRoleName').value = 'Gerätewartin';
  $('newRoleDesc').value = 'Baut die Stationen auf';
  g('saveCustomRole')();
  const nach = g('customRoles');
  assert(nach.length === 1, 'Bearbeiten hat eine zweite Rolle erzeugt');
  assert(nach[0].id === id, 'Kennung hat sich geändert');
  assert(nach[0].name === 'Gerätewartin', 'Name nicht übernommen');
  assert(nach[0].desc === 'Baut die Stationen auf', 'Beschreibung nicht übernommen');
  assert($('roleEditCancel').hidden === true, 'Bearbeitungsmodus nicht beendet');
});

check('Funktion "Rollen" abschalten blendet aus und verteilt keine Rollen', () => {
  vm.runInContext("groups = {}; drawnGroups.manual = []; drawnGroups.auto = [];", ctx);
  g('resetNames')();
  $('teamCount').value = '2'; $('teamSize').value = '';

  g('features').roles = false;
  g('renderAll')();
  g('generateTeams')();
  assert(g('teams').every(t => t.every(m => !m.roleId)), 'Rollen trotz Abschaltung vergeben');
  assert($('teamsContainer').querySelectorAll('.role-chip').length === 0, 'Rollen-Chip noch sichtbar');
  const knopf = documentStub.querySelectorAll('.feature-roles')[0];
  assert(knopf.hidden === true, 'Knopf "Rollen verwalten" noch sichtbar');

  g('features').roles = true;
  g('renderAll')();
  g('generateTeams')();
  assert(g('teams').some(t => t.some(m => m.roleId)), 'Rollen nach Einschalten nicht vergeben');
  assert(documentStub.querySelectorAll('.feature-roles')[0].hidden === false, 'Knopf bleibt versteckt');
});

check('Funktion "Regeln" abschalten ignoriert die Regeln', () => {
  const a = g('presentNames')[0], b = g('presentNames')[1];
  g('pairRules').apart = [[a, b]];
  g('features').rules = false;
  g('renderAll')();
  assert($('featureRules').hidden === true, 'Regelbereich noch sichtbar');

  let zusammen = false;
  for (let i = 0; i < 60; i++) {
    g('generateTeams')();
    if (g('teams').some(t => { const n = t.map(m => m.name); return n.includes(a) && n.includes(b); })) zusammen = true;
  }
  assert(zusammen, 'Regel wirkt trotz Abschaltung noch');

  g('features').rules = true;
  g('renderAll')();
  for (let i = 0; i < 60; i++) {
    g('generateTeams')();
    g('teams').forEach(t => {
      const n = t.map(m => m.name);
      assert(!(n.includes(a) && n.includes(b)), 'Regel nach Einschalten nicht wirksam');
    });
  }
  g('pairRules').apart = [];
});

check('Funktion "Fixierte Personen" und "Import" lassen sich ausblenden', () => {
  g('features').fixed = false;
  g('features').data = false;
  g('renderAll')();
  assert($('featureFixed').hidden === true, 'Bereich für fixierte Personen noch sichtbar');
  assert($('featureData').hidden === true, 'Import- und Backup-Bereich noch sichtbar');
  g('features').fixed = true;
  g('features').data = true;
  g('renderAll')();
  assert($('featureFixed').hidden === false, 'Bereich bleibt versteckt');
});

check('Funktionsschalter überstehen Speichern und Laden', () => {
  g('features').rules = false;
  g('saveState')();
  g('features').rules = true;
  g('loadState')();
  assert(g('features').rules === false, 'Einstellung ging verloren');
  g('features').rules = true;
  g('saveState')();
});


/* ---------------- Stufen und Mischung ---------------- */

check('Stufe in der Namensliste durchtippen: A, B, C und wieder ohne', () => {
  vm.runInContext("fixedPersons = []; pairRules = { together: [], apart: [] }; levels = {};", ctx);
  g('resetNames')();
  g('renderAll')();
  const n = g('presentNames')[0];
  const knopf = () => $('nameList').querySelectorAll('.level-btn')[0];
  assert(knopf(), 'Stufen-Schaltflaeche nicht in der Namensliste');
  assert(knopf().textContent === '\u2013', 'Ausgangszustand ist nicht "ohne"');
  [1, 2, 3].forEach(stufe => {
    knopf().click();
    assert(g('levels')[n] === stufe, 'Stufe ' + stufe + ' nicht gesetzt');
    assert(knopf().textContent === 'ABC'[stufe - 1], 'Beschriftung stimmt nicht');
  });
  knopf().click();
  assert(g('levels')[n] === undefined, 'Stufe nicht zurueckgesetzt');
  assert(knopf().textContent === '\u2013', 'Beschriftung nicht zurueckgesetzt');
});

check('Gemischte Gruppen verteilen die Stufen', () => {
  const namen = [...g('presentNames')].slice(0, 8);
  assert(namen.length === 8, 'Testdaten unerwartet: ' + namen.length);
  const lv = g('levels');
  Object.keys(lv).forEach(k => delete lv[k]);
  namen.forEach((n, i) => { lv[n] = (i < 4) ? 1 : 3; });
  vm.runInContext("levelMode = 'hetero';", ctx);
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('generateTeams')();
  assert(g('teams').length === 4, 'Gruppenzahl falsch');
  g('teams').forEach(t => {
    const stufen = new Set(t.map(m => lv[m.name]));
    assert(stufen.size === 2, 'Gruppe nicht gemischt: ' + [...stufen].join(','));
  });
});

check('Gleichstarke Gruppen buendeln die Stufen', () => {
  vm.runInContext("levelMode = 'homo';", ctx);
  g('generateTeams')();
  const lv = g('levels');
  g('teams').forEach(t => {
    const stufen = new Set(t.map(m => lv[m.name]));
    assert(stufen.size === 1, 'Gruppe nicht gleichstark: ' + [...stufen].join(','));
  });
});

check('Regeln haben Vorrang vor den Stufen', () => {
  const namen = [...g('presentNames')].slice(0, 8);
  g('pairRules').apart = [[namen[0], namen[1]]];
  vm.runInContext("levelMode = 'homo';", ctx);
  for (let i = 0; i < 80; i++) {
    g('generateTeams')();
    g('teams').forEach(t => {
      const n = t.map(m => m.name);
      assert(!(n.includes(namen[0]) && n.includes(namen[1])), 'Regel durch Stufen ausgehebelt');
    });
  }
  g('pairRules').apart = [];
});

check('Stufen erscheinen nicht in Praesentation und Gruppenansicht', () => {
  vm.runInContext("levelMode = 'hetero';", ctx);
  g('generateTeams')();
  g('buildCards')('auto').forEach(k => k.members.forEach(m => {
    assert(!('level' in m), 'Stufe steckt im Kartendatensatz');
  }));
  g('openPresentation')('auto');
  assert(!/\u00b7\s*[ABC]\b/.test($('presentGrid').textContent), 'Stufe erscheint in der Praesentation');
  g('closePresentation')();
  g('renderTeams')();
  assert(!/\u00b7\s*[ABC]\b/.test($('teamsContainer').textContent), 'Stufe erscheint in der Gruppenansicht');
});

check('Funktion "Stufen" abschalten blendet aus und ignoriert die Mischung', () => {
  g('features').levels = false;
  g('renderAll')();
  assert($('featureLevels').hidden === true, 'Stufenbereich noch sichtbar');
  assert($('featureLevelMode').hidden === true, 'Mischbereich noch sichtbar');
  assert($('nameList').querySelectorAll('.level-btn').length === 0,
         'Stufen-Schaltflaeche steht noch in der Namensliste');
  vm.runInContext("levelMode = 'homo';", ctx);
  let gemischt = false;
  const lv = g('levels');
  for (let i = 0; i < 40; i++) {
    g('generateTeams')();
    if (g('teams').some(t => new Set(t.map(m => lv[m.name])).size > 1)) gemischt = true;
  }
  assert(gemischt, 'Stufen wirken trotz Abschaltung');
  g('features').levels = true;
  g('renderAll')();
  assert($('featureLevels').hidden === false, 'Stufenbereich bleibt versteckt');
  assert($('nameList').querySelectorAll('.level-btn').length === g('presentNames').length,
         'Stufen-Schaltflaeche fehlt nach dem Einschalten');
});

/* ---------------- Ziehung und Gluecksrad ---------------- */

check('Faire Ziehung laesst sich abschalten', () => {
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  g('resetNames')();
  const namen = [...g('presentNames')];
  namen.forEach((n, i) => { dc[n] = (i === 0) ? 0 : 9; });

  vm.runInContext("fairDraw = true;", ctx);
  for (let i = 0; i < 25; i++) {
    assert(g('chooseNextName')() === namen[0], 'faire Ziehung uebergeht den Seltensten');
  }

  vm.runInContext("fairDraw = false;", ctx);
  let andere = false;
  for (let i = 0; i < 80; i++) if (g('chooseNextName')() !== namen[0]) andere = true;
  assert(andere, 'ohne Fairness wird immer noch vorsortiert');
  vm.runInContext("fairDraw = true;", ctx);
});

check('Gluecksrad zeichnet je Name ein Segment', () => {
  g('showPage')('pageDraw');
  vm.runInContext("drawStyle = 'ticker';", ctx);
  g('renderWheel')('draw');
  assert($('wheelBox').hidden === true, 'Rad trotz Schnelldurchlauf sichtbar');

  vm.runInContext("drawStyle = 'wheel';", ctx);
  g('renderWheel')('draw');
  assert($('wheelBox').hidden === false, 'Rad bleibt versteckt');
  const pfade = $('wheelRotor').children.filter(c => c.tagName === 'PATH');
  assert(pfade.length === g('presentNames').length, 'Segmentzahl falsch: ' + pfade.length);
  const summe = g('wheelState').draw.segs.reduce((a, x) => a + (x.end - x.start), 0);
  assert(Math.abs(summe - 360) < 0.001, 'Segmente ergeben keinen Vollkreis: ' + summe);
});

check('Gewichtung vergroessert das Segment selten Gezogener', () => {
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  const namen = g('presentNames');
  dc[namen[0]] = 5;

  vm.runInContext("fairDraw = true; wheelWeighted = true; wheelState.draw.frozen = false;", ctx);
  g('renderWheel')('draw');
  const segs = g('wheelState').draw.segs;
  const oft    = segs.find(x => x.key === namen[0]);
  const selten = segs.find(x => x.key === namen[1]);
  assert((oft.end - oft.start) < (selten.end - selten.start), 'oft Gezogener hat kein kleineres Stueck');

  vm.runInContext("wheelWeighted = false;", ctx);
  g('renderWheel')('draw');
  const spanne = g('wheelState').draw.segs.map(x => x.end - x.start);
  assert(Math.max(...spanne) - Math.min(...spanne) < 0.001, 'Segmente ohne Gewichtung ungleich');
  vm.runInContext("wheelWeighted = true;", ctx);
});

check('Viele Namen: das Rad zeigt Initialen', () => {
  g('renderWheel')('draw');
  assert($('wheelNote').hidden === true, 'Initialen-Hinweis zu frueh');
  for (let i = 0; i < 12; i++) { $('nameInput').value = 'Testperson ' + i; g('addName')(); }
  assert(g('presentNames').length > 16, 'zu wenige Namen fuer den Test');
  g('renderWheel')('draw');
  assert($('wheelNote').hidden === false, 'Hinweis auf Initialen fehlt');
  const texte = $('wheelRotor').children.filter(c => c.tagName === 'TEXT');
  assert(texte.every(x => x.textContent.length <= 2), 'Rad zeigt noch volle Namen');
});

check('Gewichtung bleibt bei 3:1 gedeckelt', () => {
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  dc[g('presentNames')[0]] = 20;
  vm.runInContext("drawStyle = 'wheel'; fairDraw = true; wheelWeighted = true; wheelState.draw.frozen = false;", ctx);
  g('renderWheel')('draw');
  const spanne = g('wheelState').draw.segs.map(x => x.end - x.start);
  const verhaeltnis = Math.max(...spanne) / Math.min(...spanne);
  assert(verhaeltnis <= 3.001, 'Segmentverhaeltnis ' + verhaeltnis.toFixed(2) + ' ueberschreitet 3:1');
});

check('Beschriftung bekommt eine eigene Schriftgroesse', () => {
  const texte = $('wheelRotor').children.filter(c => c.tagName === 'TEXT');
  assert(texte.length > 0, 'keine Beschriftung gezeichnet');
  const groessen = texte.map(c => Number(c.getAttribute('font-size')));
  assert(groessen.every(v => v >= 5 && v <= 11), 'Schriftgroesse ausserhalb des Rahmens');
  assert(texte.every(c => c.getAttribute('dy') === '0.35em'), 'Grundlinie nicht per dy gesetzt');
});

check('Rad bleibt nach der Drehung stehen', () => {
  vm.runInContext("wheelState.draw.frozen = false;", ctx);
  g('renderWheel')('draw');
  const vorher = $('wheelRotor').children.length;
  assert(vorher > 0, 'Rad ist leer');

  vm.runInContext("wheelState.draw.frozen = true;", ctx);
  /* Der Ziehungstopf schrumpft ueber drawnNames, nicht mehr ueber presentNames. */
  vm.runInContext("drawnNames.push(rosterNames()[0]);", ctx);
  g('renderWheel')('draw');
  assert($('wheelRotor').children.length === vorher, 'Rad wurde trotz Sperre neu gezeichnet');

  g('unfreezeWheels')();
  assert($('wheelRotor').children.length < vorher, 'Rad baut sich nach dem Freigeben nicht neu auf');
  g('resetDraw')();
});

check('Seitenwechsel gibt das Rad wieder frei', () => {
  vm.runInContext("wheelState.draw.frozen = true;", ctx);
  g('showPage')('pageDraw');
  assert(g('wheelState').draw.frozen === false, 'Radsperre uebersteht den Seitenwechsel');
});

check('Darstellung wird nur in den Einstellungen gewaehlt', () => {
  /* Auf der Ziehen-Seite darf kein zweiter Umschalter stehen: die
     Einstellung gilt global, wirkte dort aber seitenbezogen. */
  assert(html.indexOf('switchDrawTicker') < 0, 'Umschalter auf der Ziehen-Seite noch vorhanden');
  assert(html.indexOf('switchDrawWheel') < 0, 'Umschalter auf der Ziehen-Seite noch vorhanden');

  g('chooseDrawStyle')('ticker');
  assert($('choiceDrawTicker').classList.contains('choice-active'), 'Schnelldurchlauf nicht markiert');
  assert($('wheelBox').hidden === true, 'Rad trotz Schnelldurchlauf sichtbar');
  g('chooseDrawStyle')('wheel');
  assert($('choiceDrawWheel').classList.contains('choice-active'), 'Glücksrad nicht markiert');
  assert($('wheelBox').hidden === false, 'Rad bleibt versteckt');
});

check('Bezeichnung nennt keine Namen, weil auch Gruppen gezogen werden', () => {
  ['de', 'en'].forEach(lang => {
    vm.runInContext("setLanguage('" + lang + "');", ctx);
    const text = g('t')('drawStyleTicker');
    assert(!/name/i.test(text), lang + ': Bezeichnung nennt Namen: ' + text);
    const hinweis = g('t')('settingsDrawHint');
    assert(/gruppen|groups/i.test(hinweis), lang + ': Hinweis erwaehnt Gruppen nicht: ' + hinweis);
  });
  vm.runInContext("setLanguage('de'); renderAll();", ctx);
});

check('Rad erscheint auch bei der Gruppenziehung', () => {
  vm.runInContext("drawStyle = 'wheel'; drawnGroups.auto = []; teamNames = [];", ctx);
  $('teamCount').value = '3'; $('teamSize').value = '';
  g('generateTeams')();
  g('showPage')('pageTeams');
  assert($('wheelBoxTeams').hidden === false, 'Rad auf der Gruppenseite bleibt versteckt');
  const pfade = $('wheelRotorTeams').children.filter(c => c.tagName === 'PATH');
  assert(pfade.length === 3, 'Segmentzahl entspricht nicht der Gruppenzahl: ' + pfade.length);

  /* Bewegung reduzieren, damit die Drehung ohne Wartezeit abschliesst */
  ctx.window.matchMedia = () => ({ matches: true });
  g('drawRandomGroupWithAnimation')('auto');
  ctx.window.matchMedia = () => ({ matches: false });

  assert(g('isAnimating') === false, 'Ziehung haengt');
  assert(g('drawnGroups').auto.length === 1, 'Gruppe wurde nicht als gezogen vermerkt');
  assert($('bigDisplayTeams').textContent.length > 0, 'Ergebnis wird nicht angezeigt');

  /* Gezogene Gruppe verschwindet vom Rad */
  vm.runInContext("wheelState.auto.frozen = false;", ctx);
  g('renderWheel')('auto');
  assert($('wheelRotorTeams').children.filter(c => c.tagName === 'PATH').length === 2,
         'gezogene Gruppe steht noch auf dem Rad');
  g('resetGroupDraw')('auto');
});

check('Gruppenrad gibt es auch bei manuellen Gruppen', () => {
  vm.runInContext("groups = { 'Tisch 1': [], 'Tisch 2': [] }; drawnGroups.manual = [];", ctx);
  g('showPage')('pageGroups');
  assert($('wheelBoxGroups').hidden === false, 'Rad bei manuellen Gruppen versteckt');
  assert($('wheelRotorGroups').children.filter(c => c.tagName === 'PATH').length === 2,
         'Segmentzahl stimmt nicht');
  vm.runInContext("groups = {};", ctx);
  g('showPage')('pageDraw');
  vm.runInContext("drawStyle = 'ticker';", ctx);
});

check('Stufen und Ziehungseinstellungen ueberstehen Speichern und Laden', () => {
  assert(Object.keys(g('levels')).length > 0, 'keine Stufen fuer den Test gesetzt');
  const ref = JSON.stringify(g('levels'));
  vm.runInContext("levelMode = 'homo'; drawStyle = 'wheel'; fairDraw = false; wheelWeighted = false;", ctx);
  g('saveState')();
  vm.runInContext("levels = {}; levelMode = 'off'; drawStyle = 'ticker'; fairDraw = true; wheelWeighted = true;", ctx);
  g('loadState')();
  assert(JSON.stringify(g('levels')) === ref, 'Stufen gingen verloren');
  assert(g('levelMode') === 'homo', 'Mischmodus ging verloren');
  assert(g('drawStyle') === 'wheel', 'Raddarstellung ging verloren');
  assert(g('fairDraw') === false, 'Fairness-Schalter ging verloren');
  assert(g('wheelWeighted') === false, 'Gewichtung ging verloren');
  vm.runInContext("levelMode = 'off'; drawStyle = 'ticker'; fairDraw = true; wheelWeighted = true;", ctx);
  g('saveState')();
});

check('Alle Stufen loeschen raeumt auf', () => {
  assert(Object.keys(g('levels')).length > 0, 'keine Stufen zum Loeschen');
  g('clearLevels')();
  assert(Object.keys(g('levels')).length === 0, 'Stufen nicht geloescht');
  g('performUndo')();
  assert(Object.keys(g('levels')).length > 0, 'Ruecknahme stellt die Stufen nicht wieder her');
  g('clearLevels')();
});

check('Verwaiste Stufen verschwinden beim Laden', () => {
  g('levels')['GibtEsNicht'] = 2;
  g('saveState')();
  g('loadState')();
  assert(g('levels')['GibtEsNicht'] === undefined, 'Stufe eines unbekannten Namens bleibt liegen');
});

check('Gespeicherte Listen vererben keine Stufen an gleichnamige Personen', () => {
  vm.runInContext("originalNames = ['Anna','Ben']; presentNames = ['Anna','Ben']; absentNames = []; levels = {}; drawCounts = {};", ctx);
  g('levels')['Anna'] = 3;
  g('drawCounts')['Anna'] = 4;
  $('saveNameInput').value = 'Klasse A'; g('saveNames')();

  vm.runInContext("originalNames = ['Anna','Cem']; presentNames = ['Anna','Cem']; absentNames = []; levels = {}; drawCounts = {};", ctx);
  $('saveNameInput').value = 'Klasse B'; g('saveNames')();

  $('savedNamesSelect').value = 'Klasse A'; g('loadNames')();
  assert(g('levels')['Anna'] === 3, 'Stufe der Liste ging verloren');
  assert(g('drawCounts')['Anna'] === 4, 'Ziehungshistorie der Liste ging verloren');

  $('savedNamesSelect').value = 'Klasse B'; g('loadNames')();
  assert(g('levels')['Anna'] === undefined, 'Stufe aus Klasse A wurde vererbt');
  assert(g('drawCounts')['Anna'] === undefined, 'Ziehungshistorie aus Klasse A wurde vererbt');
});

check('Unbekannte Funktionsschalter erben die Voreinstellung', () => {
  g('saveState')();
  const roh = JSON.parse(ctx.localStorage.getItem('fairmix_full_state'));
  delete roh.features.levels;            /* Zustand einer aelteren Fassung nachstellen */
  ctx.localStorage.setItem('fairmix_full_state', JSON.stringify(roh));
  vm.runInContext("features.levels = true;", ctx);
  g('loadState')();
  assert(g('features').levels === false, 'neuer Schalter uebernimmt die Voreinstellung nicht');
  vm.runInContext("Object.keys(features).forEach(k => features[k] = true);", ctx);
  g('saveState')();
  g('renderAll')();
});

check('Drehung bringt das gewaehlte Segment unter den Zeiger', () => {
  vm.runInContext(`
    originalNames = ['E1','E2','E3','E4']; presentNames = ['E1','E2','E3','E4'];
    absentNames = []; drawCounts = {}; drawStyle = 'wheel';
    wheelState.draw.frozen = false; wheelState.draw.rot = 0;
  `, ctx);
  g('showPage')('pageDraw');
  g('renderWheel')('draw');
  const segs = g('wheelState').draw.segs.slice();
  assert(segs.length === 4, 'Rad hat nicht vier Segmente');

  let vorher = 0;
  segs.forEach(seg => {
    vm.runInContext("wheelState.draw.frozen = false;", ctx);
    let fertig = false;
    g('spinWheel')('draw', seg.key, () => { fertig = true; });

    const jetzt = g('wheelState').draw.rot;
    const mitte = (seg.start + seg.end) / 2;
    const rest = ((jetzt % 360) + 360) % 360;
    const soll = ((360 - mitte) % 360 + 360) % 360;
    assert(Math.abs(rest - soll) < 0.001,
      seg.key + ': Rad steht bei ' + rest.toFixed(1) + ' statt ' + soll.toFixed(1));
    assert(jetzt - vorher >= 1440, 'weniger als vier volle Umdrehungen');
    assert(g('wheelState').draw.frozen === true, 'Rad nach der Drehung nicht gesperrt');
    assert(fertig === false, 'Abschluss wird zu frueh gemeldet');
    vorher = jetzt;
  });
  vm.runInContext("drawStyle = 'ticker';", ctx);
});

/* ---------------- Klassenprofile ---------------- */

check('Gespeicherte Liste nimmt Regeln und fixierte Personen mit', () => {
  vm.runInContext(`
    originalNames = ['Ada','Bo','Cai','Dee']; presentNames = ['Ada','Bo','Cai','Dee'];
    absentNames = []; levels = {}; drawCounts = {}; groups = {}; teams = [];
    fixedPersons = ['Ada'];
    pairRules = { together: [['Bo','Cai']], apart: [['Ada','Dee']] };
  `, ctx);
  g('levels')['Bo'] = 2;
  $('saveNameInput').value = 'Kurs 1'; g('saveNames')();

  vm.runInContext(`
    originalNames = ['Ada','Emi']; presentNames = ['Ada','Emi']; absentNames = [];
    levels = {}; drawCounts = {}; fixedPersons = []; pairRules = { together: [], apart: [] };
  `, ctx);
  $('saveNameInput').value = 'Kurs 2'; g('saveNames')();

  $('savedNamesSelect').value = 'Kurs 1'; g('loadNames')();
  assert(g('fixedPersons').join() === 'Ada', 'fixierte Person ging verloren');
  assert(g('pairRules').together.length === 1, 'Zusammen-Regel ging verloren');
  assert(g('pairRules').apart.length === 1, 'Trenn-Regel ging verloren');
  assert(g('levels')['Bo'] === 2, 'Stufe ging verloren');

  $('savedNamesSelect').value = 'Kurs 2'; g('loadNames')();
  assert(g('fixedPersons').length === 0, 'fixierte Person aus Kurs 1 vererbt');
  assert(g('pairRules').together.length === 0, 'Zusammen-Regel aus Kurs 1 vererbt');
  assert(g('pairRules').apart.length === 0, 'Trenn-Regel aus Kurs 1 vererbt');
  assert(g('levels')['Bo'] === undefined, 'Stufe aus Kurs 1 vererbt');

  $('savedNamesSelect').value = 'Kurs 1'; g('loadNames')();
  assert(g('pairRules').apart.length === 1, 'Rueckkehr zu Kurs 1 verliert die Regel');
});

check('Alte Listen ohne die neuen Felder brechen nichts', () => {
  const listen = JSON.parse(ctx.localStorage.getItem('fairmix_saved_lists'));
  listen['Alt'] = { date: '01.01.2020', original: ['Ada','Bo'], present: ['Ada','Bo'], absent: [] };
  ctx.localStorage.setItem('fairmix_saved_lists', JSON.stringify(listen));
  g('updateSavedNamesSelect')();
  $('savedNamesSelect').value = 'Alt'; g('loadNames')();
  assert(g('originalNames').join() === 'Ada,Bo', 'alte Liste nicht geladen');
  assert(Array.isArray(g('pairRules').apart), 'Regelstruktur beschaedigt');
});

/* ---------------- Rückgängig und Regelmeldung ---------------- */

check('Gruppen generieren laesst sich zuruecknehmen', () => {
  vm.runInContext(`
    originalNames = ['A1','A2','A3','A4','A5','A6']; presentNames = ['A1','A2','A3','A4','A5','A6'];
    absentNames = []; groups = {}; teams = []; teamNames = []; levels = {};
    fixedPersons = []; pairRules = { together: [], apart: [] }; levelMode = 'off';
  `, ctx);
  $('teamCount').value = '3'; $('teamSize').value = '';
  g('generateTeams')();
  const erste = JSON.stringify(g('teams'));
  g('generateTeams')();
  g('performUndo')();
  assert(JSON.stringify(g('teams')) === erste, 'Ruecknahme stellt die erste Aufteilung nicht wieder her');
});

check('Unloesbare Regeln nennen das betroffene Paar', () => {
  vm.runInContext(`
    pairRules = { together: [['A1','A2'],['A2','A3']], apart: [['A1','A3']] };
    features.rules = true;
  `, ctx);
  $('teamCount').value = '2'; $('teamSize').value = '';
  g('generateTeams')();
  const meldung = $('msgText').textContent;
  assert(meldung.indexOf('A1') >= 0 && meldung.indexOf('A3') >= 0,
         'Meldung nennt das Paar nicht: ' + meldung);
  vm.runInContext("pairRules = { together: [], apart: [] };", ctx);
});

/* ---------------- Ziehungshistorie ---------------- */

check('Namensliste zeigt, wie oft jemand dran war', () => {
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  dc['A1'] = 3; dc['A2'] = 1;
  g('renderNameList')();
  const zaehler = $('nameList').querySelectorAll('.draw-count');
  assert(zaehler.length === 2, 'falsche Anzahl Zaehler: ' + zaehler.length);
  assert(zaehler[0].textContent === '3\u00d7', 'Zaehler falsch: ' + zaehler[0].textContent);
});

check('Historie zuruecksetzen fragt nach', async () => {
  g('resetDrawHistory')();
  await flush();
  g('closeDialog')(true);
});

check('...Ergebnis von Historie zuruecksetzen', () => {
  assert(Object.keys(g('drawCounts')).length === 0, 'Historie nicht geleert');
  assert($('nameList').querySelectorAll('.draw-count').length === 0, 'Zaehler noch sichtbar');
  g('performUndo')();
  assert(g('drawCounts')['A1'] === 3, 'Ruecknahme stellt die Historie nicht wieder her');
  g('resetDrawHistory')();
});

check('...und das Leeren wird bestaetigt oder abgelehnt', async () => {
  await flush();
  g('closeDialog')(false);
  assert(g('drawCounts')['A1'] === 3, 'Historie trotz Abbruch geleert');
  const dc = g('drawCounts');
  Object.keys(dc).forEach(k => delete dc[k]);
  g('resetDrawHistory')();
  assert($('msgText').textContent === g('i18n').de.msgNoHistory, 'leere Historie wird nicht gemeldet');
});

/* ---------------- Rad im Präsentationsmodus ---------------- */

check('Praesentationsmodus zeigt das Glucksrad', () => {
  vm.runInContext("drawStyle = 'wheel'; drawnGroups.auto = []; teamNames = [];", ctx);
  $('teamCount').value = '3'; $('teamSize').value = '';
  g('generateTeams')();
  g('openPresentation')('auto');
  assert($('wheelBoxPresent').hidden === false, 'Rad in der Praesentation versteckt');
  const pfade = $('wheelRotorPresent').children.filter(c => c.tagName === 'PATH');
  assert(pfade.length === 3, 'Segmentzahl falsch: ' + pfade.length);
});

check('Praesentationsziehung dreht das Rad und markiert die Karte', () => {
  ctx.window.matchMedia = () => ({ matches: true });   /* Bewegung reduzieren */
  g('presentDraw')();
  ctx.window.matchMedia = () => ({ matches: false });

  assert(g('isAnimating') === false, 'Ziehung haengt');
  assert(g('drawnGroups').auto.length === 1, 'Gruppe nicht als gezogen vermerkt');
  const markiert = $('presentGrid').querySelectorAll('.drawn');
  assert(markiert.length === 1, 'Karte nicht markiert');

  vm.runInContext("wheelState.present.frozen = false;", ctx);
  g('renderWheel')('present');
  assert($('wheelRotorPresent').children.filter(c => c.tagName === 'PATH').length === 2,
         'gezogene Gruppe steht noch auf dem Rad');
});

check('Praesentation schliessen blendet das Rad aus', () => {
  g('presentResetDraw')();
  assert(g('drawnGroups').auto.length === 0, 'Ziehung nicht zurueckgesetzt');
  g('closePresentation')();
  assert($('wheelBoxPresent').hidden === true, 'Rad bleibt nach dem Schliessen sichtbar');
  vm.runInContext("drawStyle = 'ticker';", ctx);
});

/* ---------------- Backup-Erinnerung ---------------- */

check('Backup-Erinnerung erscheint erst ab genug Namen', () => {
  vm.runInContext(`
    originalNames = ['A1','A2','A3']; presentNames = ['A1','A2','A3']; absentNames = [];
    lastBackup = 0; backupNagOff = false; features.data = true;
  `, ctx);
  g('renderAll')();
  assert($('backupHint').hidden === true, 'Hinweis bei wenigen Namen sichtbar');

  vm.runInContext("originalNames = ['A1','A2','A3','A4','A5','A6','A7','A8']; presentNames = originalNames.slice();", ctx);
  g('renderAll')();
  assert($('backupHint').hidden === false, 'Hinweis fehlt trotz vieler Namen');
  assert($('backupHintText').textContent === g('i18n').de.backupHintNever, 'falscher Hinweistext');
});

check('Nach dem Sichern verstummt die Erinnerung, alte Backups melden sich wieder', () => {
  g('markBackupDone')();
  assert($('backupHint').hidden === true, 'Hinweis trotz frischem Backup sichtbar');

  ctx.__alt = Date.now() - 50 * 86400000;
  vm.runInContext("lastBackup = __alt;", ctx);
  g('renderBackupHint')();
  assert($('backupHint').hidden === false, 'altes Backup wird nicht angemahnt');
  assert($('backupHintText').textContent.indexOf('50') >= 0,
         'Alter fehlt im Text: ' + $('backupHintText').textContent);
});

check('Erinnerung laesst sich dauerhaft abstellen', () => {
  g('dismissBackupHint')();
  assert($('backupHint').hidden === true, 'Hinweis trotz Abschaltung sichtbar');
  assert(g('backupNagOff') === true, 'Abschaltung nicht vermerkt');
  g('saveState')(); g('loadState')();
  assert(g('backupNagOff') === true, 'Abschaltung uebersteht das Laden nicht');
  vm.runInContext("backupNagOff = false; lastBackup = Date.now();", ctx);
});

check('Ohne Backup-Bereich keine Erinnerung', () => {
  vm.runInContext("lastBackup = 0; backupNagOff = false; features.data = false;", ctx);
  g('renderAll')();
  assert($('backupHint').hidden === true, 'Hinweis trotz abgeschaltetem Bereich');
  vm.runInContext("features.data = true;", ctx);
  g('renderAll')();
  assert($('backupHint').hidden === false, 'Hinweis kommt nach dem Einschalten nicht zurueck');
  vm.runInContext("lastBackup = Date.now();", ctx);
  g('renderAll')();
});

check('Über-Text nennt Ziehen und außerschulische Einsatzfelder', () => {
  ['de', 'en'].forEach(lang => {
    const txt = [1, 2, 3, 4, 5].map(i => g('i18n')[lang]['aboutP' + i]).join(' ');
    assert(/ziehen|zieht|draw/i.test(txt), lang + ': Ziehen kommt nicht vor');
    assert(/Präsentation|presentation/i.test(txt), lang + ': Präsentationen fehlen');
    assert(/Sport|Train|coach|gym|Turnhalle/i.test(txt), lang + ': Sportbereich fehlt');
    assert(/Verein|Jugend|Unternehmen|club|youth|compan/i.test(txt), lang + ': weitere Zielgruppen fehlen');
  });
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


/* ============ Beispielklasse, Masseneingabe, Timer ============ */

check('Beispielklasse: Hinweisbox nur bei leerer Liste', async () => {
  g('deleteAllNames')(); await flush(); g('closeDialog')(true); await flush();
  g('renderAll')();
  assert($('demoBox').hidden === false, 'Hinweisbox bei leerer Liste versteckt');
});

check('Beispielklasse laden fuellt Namen, Stufen und Regeln', () => {
  g('loadDemoClass')();
  assert(g('originalNames').length === 24, 'erwartet 24 Namen, ist ' + g('originalNames').length);
  assert(g('presentNames').length === 24, 'Topf nicht vollstaendig gefuellt');
  assert(g('absentNames').length === 0, 'Abwesende nach dem Laden');
  assert(Object.keys(g('levels')).length > 0, 'keine Stufen gesetzt');
  assert(g('pairRules').together.length === 1, 'keine "immer zusammen"-Regel');
  assert(g('pairRules').apart.length === 1, 'keine "nie zusammen"-Regel');
  assert(g('features').levels === true && g('features').rules === true,
         'Stufen- und Regelbereich nicht eingeschaltet');
  assert($('demoBox').hidden === true, 'Hinweisbox trotz gefuellter Liste sichtbar');
});

check('Beispielklasse: Stufen und Regeln zeigen nur auf echte Namen', () => {
  const namen = g('originalNames');
  Object.keys(g('levels')).forEach(k => assert(namen.includes(k), 'Stufe fuer unbekannt: ' + k));
  [...g('pairRules').together, ...g('pairRules').apart].forEach(pr => {
    assert(namen.includes(pr[0]) && namen.includes(pr[1]), 'Regel mit unbekanntem Namen');
  });
});

check('Beispielklasse laesst sich zu Gruppen verarbeiten', () => {
  $('teamCount').value = '6'; $('teamSize').value = '';
  g('generateTeams')();
  const teams = g('teams');
  assert(teams.length === 6, 'erwartet 6 Gruppen, ist ' + teams.length);
  const alle = teams.flat().map(m => m.name);
  assert(alle.length === 24, 'erwartet 24 verteilte Namen, ist ' + alle.length);
  assert(new Set(alle).size === 24, 'Name doppelt verteilt');
  const [a, b] = g('pairRules').apart[0];
  teams.forEach(tm => {
    const n = tm.map(m => m.name);
    assert(!(n.includes(a) && n.includes(b)), 'Regel "nie zusammen" verletzt');
  });
});

check('Masseneingabe: Zeilen, Komma, Semikolon und Tabulator', async () => {
  g('deleteAllNames')(); await flush(); g('closeDialog')(true); await flush();
  $('bulkInput').value = "Ann Meier\nBo Kaya, Cem Roth; Dana Lux\tEli Wolf";
  g('addBulkNames')();
  assert(g('originalNames').length === 5, 'erwartet 5 Namen, ist ' + g('originalNames').length);
  assert($('bulkInput').value === '', 'Feld nicht geleert');
});

check('Masseneingabe ergaenzt und ueberspringt Bekannte', () => {
  $('bulkInput').value = "Ann Meier\nFrieda Kern";
  g('addBulkNames')();
  assert(g('originalNames').length === 6, 'erwartet 6 Namen, ist ' + g('originalNames').length);
  assert(g('originalNames').filter(n => n === 'Ann Meier').length === 1, 'Ann Meier doppelt');
});

check('Masseneingabe: Rueckgaengig nimmt nur die Neuen zurueck', () => {
  g('performUndo')();
  assert(g('originalNames').length === 5, 'erwartet 5 Namen, ist ' + g('originalNames').length);
  assert(!g('originalNames').includes('Frieda Kern'), 'Frieda Kern nicht entfernt');
  assert(g('originalNames').includes('Ann Meier'), 'Ann Meier faelschlich entfernt');
});

check('Masseneingabe: leer oder nur Bekannte legt nichts an', () => {
  const vorher = g('originalNames').length;
  $('bulkInput').value = "   \n ;; \t ";
  g('addBulkNames')();
  assert(g('originalNames').length === vorher, 'leere Eingabe hat Namen angelegt');
  $('bulkInput').value = "Ann Meier";
  g('addBulkNames')();
  assert(g('originalNames').length === vorher, 'bekannter Name wurde angelegt');
});

check('Masseneingabe kuerzt, normalisiert und entdoppelt', () => {
  const lang = 'W'.repeat(60);
  $('bulkInput').value = lang + "\nAnn    Meier\nZoe  Roth\nZoe Roth";
  g('addBulkNames')();
  const namen = g('originalNames');
  assert(namen.some(n => n.length === 40), 'zu langer Name nicht auf 40 gekuerzt');
  assert(namen.filter(n => n === 'Zoe Roth').length === 1, 'Zoe Roth doppelt angelegt');
  assert(namen.filter(n => n === 'Ann Meier').length === 1, 'Mehrfach-Leerzeichen nicht normalisiert');
});

check('CSV-Import und Masseneingabe nutzen denselben Parser', () => {
  const p = g('parseNameBlob');
  assert(p("A\nB,C;D\tE").length === 5, 'Trennzeichen unvollstaendig');
  assert(p("A\nA\nA").length === 1, 'Parser entdoppelt nicht');
  assert(p(null).length === 0, 'Parser stolpert ueber null');
  assert(p("  X  Y  ")[0] === 'X Y', 'Parser normalisiert nicht');
});

check('Timer: Anzeige formatiert Minuten und Sekunden', () => {
  const f = g('formatClock');
  assert(f(0) === '00:00', '0 -> ' + f(0));
  assert(f(59) === '00:59', '59 -> ' + f(59));
  assert(f(300) === '05:00', '300 -> ' + f(300));
  assert(f(5400) === '90:00', '5400 -> ' + f(5400));
  assert(f(-5) === '00:00', 'negative Restzeit nicht abgefangen');
});

check('Timer: Dauer setzen wird begrenzt', () => {
  g('setTimerMinutes')(10);
  assert(g('timerMinutes') === 10 && g('timerLeft') === 600, 'Dauer nicht uebernommen');
  g('setTimerMinutes')(0);
  assert(g('timerMinutes') === 1, 'Untergrenze nicht eingehalten');
  g('setTimerMinutes')(999);
  assert(g('timerMinutes') === 90, 'Obergrenze nicht eingehalten');
  g('setTimerMinutes')('keine Zahl');
  assert(g('timerMinutes') === 90, 'unsinnige Eingabe hat die Dauer veraendert');
});

check('Timer: Plus und Minus verstellen die Dauer', () => {
  g('setTimerMinutes')(5);
  g('nudgeTimer')(1);  assert(g('timerMinutes') === 6, 'plus wirkt nicht');
  g('nudgeTimer')(-2); assert(g('timerMinutes') === 4, 'minus wirkt nicht');
  g('setTimerMinutes')(1); g('nudgeTimer')(-1);
  assert(g('timerMinutes') === 1, 'minus laeuft unter die Untergrenze');
});

check('Timer: Start, Pause und Fortsetzen behalten die Restzeit', () => {
  g('setTimerMinutes')(5);
  g('startTimer')();
  assert(g('timerRunning') === true, 'Timer laeuft nicht');
  assert($('timerToggle').textContent === 'Pause', 'Schaltflaeche zeigt nicht Pause');
  /* 60 Sekunden verstreichen lassen, ohne auf echte Zeit zu warten */
  g('renderTimer'); vm.runInContext('timerDeadline = Date.now() + 240 * 1000;', ctx);
  g('tickTimer')();
  assert(g('timerLeft') === 240, 'erwartet 240 Sekunden, ist ' + g('timerLeft'));
  /* Pause muss die Restzeit selbst aus dem Ablaufzeitpunkt holen und darf
     sich nicht auf einen vorher gelaufenen Tick verlassen. */
  vm.runInContext('timerDeadline = Date.now() + 123 * 1000;', ctx);
  g('pauseTimer')();
  assert(g('timerRunning') === false, 'Pause wirkt nicht');
  assert(g('timerLeft') === 123, 'Pause rechnet die Restzeit nicht neu, ist ' + g('timerLeft'));
  vm.runInContext('timerLeft = 240;', ctx);
  assert($('timerToggle').textContent === 'Start', 'Schaltflaeche zeigt nicht Start');
  g('toggleTimer')();
  assert(g('timerRunning') === true, 'Fortsetzen wirkt nicht');
  assert(g('timerLeft') === 240, 'Restzeit beim Fortsetzen verloren');
  g('pauseTimer')();
});

check('Timer: Dauer aendern haelt eine laufende Uhr an', () => {
  g('startTimer')();
  g('setTimerMinutes')(3);
  assert(g('timerRunning') === false, 'Uhr laeuft nach Dauerwechsel weiter');
  assert(g('timerLeft') === 180, 'Restzeit nicht auf neue Dauer gesetzt');
});

check('Timer: Zuruecksetzen stellt die volle Dauer her', () => {
  g('setTimerMinutes')(4);
  g('startTimer')();
  vm.runInContext('timerDeadline = Date.now() + 30 * 1000;', ctx);
  g('tickTimer')();
  g('resetTimer')();
  assert(g('timerRunning') === false, 'Uhr laeuft nach Zuruecksetzen weiter');
  assert(g('timerLeft') === 240, 'erwartet 240 Sekunden, ist ' + g('timerLeft'));
});

check('Timer: Ablauf meldet sich und markiert die Anzeige', () => {
  g('setTimerMinutes')(1);
  g('startTimer')();
  vm.runInContext('timerDeadline = Date.now() - 1000;', ctx);
  g('tickTimer')();
  assert(g('timerLeft') === 0, 'Restzeit nicht auf 0');
  assert(g('timerRunning') === false, 'Uhr laeuft nach Ablauf weiter');
  assert($('timerBox').className.indexOf('done') >= 0, 'Anzeige nicht als abgelaufen markiert');
  assert($('timerClock').textContent === '00:00', 'Anzeige zeigt nicht 00:00');
});

check('Timer: Neustart nach Ablauf beginnt bei der vollen Dauer', () => {
  g('startTimer')();
  assert(g('timerLeft') === 60, 'erwartet 60 Sekunden, ist ' + g('timerLeft'));
  assert($('timerBox').className.indexOf('done') < 0, 'Markierung nicht zurueckgesetzt');
  g('pauseTimer')();
});

check('Timer: Signalton laesst sich abschalten und wird gespeichert', () => {
  const vorher = g('timerSound');
  g('toggleTimerSound')();
  assert(g('timerSound') === !vorher, 'Ton nicht umgeschaltet');
  assert($('timerSoundBtn').textContent === (g('timerSound') ? '🔔' : '🔇'), 'Symbol passt nicht');
  const roh = JSON.parse(store['fairmix_full_state']);
  assert(roh.timerSound === g('timerSound'), 'Ton nicht gespeichert');
  g('toggleTimerSound')();
});

check('Timer: Ausblenden haelt die Uhr an', () => {
  $('timerBox').hidden = true;
  g('toggleTimerPanel')();
  assert($('timerBox').hidden === false, 'Panel nicht eingeblendet');
  g('startTimer')();
  g('toggleTimerPanel')();
  assert($('timerBox').hidden === true, 'Panel nicht ausgeblendet');
  assert(g('timerRunning') === false, 'ausgeblendete Uhr laeuft weiter');
});

check('Timer: Praesentation schliessen haelt die Uhr an', () => {
  g('startTimer')();
  g('closePresentation')();
  assert(g('timerRunning') === false, 'Uhr laeuft nach dem Schliessen weiter');
});

check('Timer: Dauer und Ton ueberstehen Speichern und Laden', () => {
  g('setTimerMinutes')(12);
  vm.runInContext('timerSound = false; saveState();', ctx);
  vm.runInContext('timerMinutes = 5; timerSound = true; loadState();', ctx);
  assert(g('timerMinutes') === 12, 'Dauer nicht wiederhergestellt');
  assert(g('timerSound') === false, 'Ton nicht wiederhergestellt');
  assert(g('timerLeft') === 720, 'Restzeit passt nicht zur Dauer');
});

check('Timer: unsinnige gespeicherte Werte werden abgefangen', () => {
  const roh = JSON.parse(store['fairmix_full_state']);
  roh.timerMinutes = 9999;
  store['fairmix_full_state'] = JSON.stringify(roh);
  vm.runInContext('loadState();', ctx);
  assert(g('timerMinutes') === 5, 'Ausreisser nicht auf 5 zurueckgesetzt, ist ' + g('timerMinutes'));
  roh.timerMinutes = 'sieben';
  store['fairmix_full_state'] = JSON.stringify(roh);
  vm.runInContext('loadState();', ctx);
  assert(g('timerMinutes') === 5, 'Text nicht abgefangen');
});

check('Timer: Beschriftung folgt dem Sprachwechsel', () => {
  vm.runInContext("setLanguage('en'); renderAll();", ctx);
  g('startTimer')();
  assert($('timerToggle').textContent === 'Pause', 'englische Pause-Beschriftung fehlt');
  g('pauseTimer')();
  assert($('timerToggle').textContent === 'Start', 'englische Start-Beschriftung fehlt');
  vm.runInContext("setLanguage('de'); renderAll();", ctx);
});


/* ============ Partnerhistorie und Klassenwechsel ============ */

/* Beispielklasse ohne Rueckfrage laden: erst leeren, dann laden. */
const ladeDemo = () => {
  vm.runInContext("originalNames = []; presentNames = []; absentNames = []; groups = {}; teams = []; teamNames = [];", ctx);
  g('loadDemoClass')();
};

check('Partnerhistorie: Schluessel ist richtungsunabhaengig', () => {
  const k = g('pairKey');
  assert(k('Anna', 'Ben') === k('Ben', 'Anna'), 'Reihenfolge veraendert den Schluessel');
  assert(g('splitPairKey')(k('Anna', 'Ben')).length === 2, 'Schluessel nicht zweiteilig');
  /* Namen duerfen das alte Trennzeichen enthalten, ohne den Schluessel
     mehrdeutig zu machen. */
  const heikel = g('splitPairKey')(k('A||B', 'C'));
  assert(heikel[0] === 'A||B' && heikel[1] === 'C', 'Schluessel mehrdeutig: ' + heikel.join(' / '));
});

check('Partnerhistorie: ist zu Beginn aus', () => {
  vm.runInContext("features.partners = false;", ctx);
  assert(g('FEATURE_DEFAULTS').partners === false, 'Partnerhistorie standardmaessig an');
});

check('Partnerhistorie zaehlt nur bei eingeschalteter Funktion', () => {
  ladeDemo();
  vm.runInContext("features.partners = false; pairHistory = {};", ctx);
  $('teamCount').value = '6'; $('teamSize').value = '';
  g('generateTeams')();
  assert(g('pairHistoryCount')() === 0, 'Historie waechst trotz abgeschalteter Funktion');

  vm.runInContext("features.partners = true;", ctx);
  g('generateTeams')();
  assert(g('pairHistoryCount')() > 0, 'Historie waechst nicht');
});

check('Partnerhistorie: Zaehler passen zur Gruppengroesse', () => {
  vm.runInContext("features.partners = true; pairHistory = {}; levelMode = 'off';", ctx);
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('generateTeams')();
  /* 24 Kinder in 4 Gruppen zu 6 -> 4 * (6*5/2) = 60 Paare */
  assert(g('pairHistoryCount')() === 60, 'erwartet 60 Paare, ist ' + g('pairHistoryCount')());
  const werte = Object.values(g('pairHistory'));
  assert(werte.every(v => v === 1), 'Zaehler nach einem Durchlauf nicht 1');
});

check('Partnerhistorie senkt die Wiederholungen messbar', () => {
  /* Zaehlt Paare, die erneut zusammenkommen, obwohl sie schon zusammen waren.
     Im Kontrollfall wird die Historie mitgeschrieben, aber nicht genutzt.
     Gemessen wird mit 6 Gruppen zu 4 Personen: dort ist genug Spielraum,
     damit sich die Vermeidung ueberhaupt auswirken kann. */
  const messe = (optimieren, gruppen, runden) => {
    vm.runInContext("originalNames = []; presentNames = []; absentNames = []; groups = {}; teams = []; teamNames = [];", ctx);
    g('loadDemoClass')();
    vm.runInContext("features.rules = false; features.levels = false; levelMode = 'off'; pairHistory = {};", ctx);
    vm.runInContext("features.partners = " + (optimieren ? "true" : "false") + ";", ctx);
    $('teamCount').value = String(gruppen); $('teamSize').value = '';
    let wiederholt = 0;
    for (let runde = 0; runde < runden; runde++) {
      const vorher = JSON.parse(JSON.stringify(g('pairHistory')));
      g('generateTeams')();
      if (!optimieren) g('recordPairHistory')(g('teams').map(tm => tm.map(m => m.name)));
      const nach = g('pairHistory');
      Object.keys(nach).forEach(k => {
        if ((vorher[k] || 0) >= 1 && nach[k] > (vorher[k] || 0)) wiederholt++;
      });
    }
    return wiederholt;
  };

  const ohne = messe(false, 6, 5);
  const mit  = messe(true,  6, 5);
  assert(ohne >= 10, 'Kontrollmessung zu schwach: ' + ohne);
  assert(mit <= ohne * 0.3, 'Vermeidung zu schwach: mit ' + mit + ', ohne ' + ohne);

  /* Bei 6er-Gruppen ueber viele Runden sind Wiederholungen rechnerisch
     unvermeidbar. Dann darf die Optimierung nicht schlechter sein. */
  const ohneGross = messe(false, 4, 8);
  const mitGross  = messe(true,  4, 8);
  assert(mitGross <= ohneGross, 'Optimierung verschlechtert den gesaettigten Fall: '
         + mitGross + ' statt ' + ohneGross);
});

check('Partnerhistorie bricht keine "nie zusammen"-Regel', () => {
  ladeDemo();
  vm.runInContext("features.partners = true; features.rules = true; levelMode = 'off';", ctx);
  const [a, b] = g('pairRules').apart[0];
  $('teamCount').value = '4'; $('teamSize').value = '';
  for (let runde = 0; runde < 40; runde++) {
    g('generateTeams')();
    g('teams').forEach(tm => {
      const n = tm.map(m => m.name);
      assert(!(n.includes(a) && n.includes(b)), 'Regel in Runde ' + runde + ' verletzt');
    });
  }
});

check('Partnerhistorie haelt "immer zusammen" ein', () => {
  const [a, b] = g('pairRules').together[0];
  for (let runde = 0; runde < 40; runde++) {
    g('generateTeams')();
    const zusammen = g('teams').some(tm => {
      const n = tm.map(m => m.name);
      return n.includes(a) && n.includes(b);
    });
    assert(zusammen, 'Paar in Runde ' + runde + ' getrennt');
  }
});

check('Partnerhistorie laesst Gruppengroessen unveraendert', () => {
  vm.runInContext("features.partners = true; levelMode = 'off';", ctx);
  $('teamCount').value = '5'; $('teamSize').value = '';
  for (let runde = 0; runde < 20; runde++) {
    g('generateTeams')();
    const groessen = g('teams').map(tm => tm.length).sort();
    assert(groessen[groessen.length - 1] - groessen[0] <= 1,
           'Groessen entgleist: ' + groessen.join(','));
    assert(g('teams').flat().length === 24, 'Namen verloren: ' + g('teams').flat().length);
  }
});

check('Partnerhistorie zerstoert die Stufenmischung nicht', () => {
  /* Eigenstaendig aufsetzen, damit keine Reste aus vorherigen Ablaeufen
     das Ergebnis verfaelschen. Gemessen wird der Mittelwert, weil ein
     einzelner Lauf zufaellig aussetzen kann. */
  const bundelung = (partners) => {
    ladeDemo();
    vm.runInContext("features.levels = true; features.rules = false; levelMode = 'homo'; features.partners = " + partners + "; pairHistory = {};", ctx);
    $('teamCount').value = '4'; $('teamSize').value = '';
    let summe = 0;
    const laeufe = 10;
    for (let r = 0; r < laeufe; r++) {
      g('generateTeams')();
      const lv = g('levels');
      g('teams').forEach(tm => {
        if (new Set(tm.map(m => lv[m.name] || 0)).size <= 2) summe++;
      });
    }
    return summe / laeufe;
  };

  const aus = bundelung('false');
  const an  = bundelung('true');
  assert(aus >= 3.5, 'Bezugsmessung schon schlecht: ' + aus);
  assert(an >= aus - 0.5, 'Bundelung leidet unter der Historie: ' + an + ' statt ' + aus);
  vm.runInContext("levelMode = 'off'; features.levels = false;", ctx);
});

check('Partnerhistorie: Namen loeschen raeumt die Paare mit auf', () => {
  vm.runInContext("features.partners = true;", ctx);
  g('generateTeams')();
  const name = g('originalNames')[0];
  const trifft = k => (g('splitPairKey')(k) || []).indexOf(name) >= 0;
  assert(Object.keys(g('pairHistory')).some(trifft), 'Testvoraussetzung fehlt');
  g('deleteSingleName')(name);
  assert(!Object.keys(g('pairHistory')).some(trifft), 'Paare des geloeschten Namens bleiben liegen');
});

check('Partnerhistorie: Rueckgaengig stellt sie wieder her', () => {
  ladeDemo();
  vm.runInContext("features.partners = true;", ctx);
  g('generateTeams')();
  const vorher = g('pairHistoryCount')();
  assert(vorher > 0, 'Testvoraussetzung fehlt');
  g('generateTeams')();
  g('performUndo')();
  assert(g('pairHistoryCount')() === vorher, 'Historie nach Rueckgaengig falsch');
});

check('Partnerhistorie: Zuruecksetzen fragt nach und leert', async () => {
  g('resetPairHistory')();
  await flush();
  g('closeDialog')(true);
  await flush();
  assert(g('pairHistoryCount')() === 0, 'Historie nicht geleert');
  assert(g('originalNames').length === 24, 'Namen mitgeloescht');
  assert(g('pairRules').apart.length === 1, 'Regeln mitgeloescht');
});

check('Partnerhistorie: unsinnige gespeicherte Werte werden abgefangen', () => {
  const roh = JSON.parse(store['fairmix_full_state']);
  /* Gemischt: ein gueltiges altes "||"-Paar, Muell und Unbekannte. */
  roh.pairHistory = { 'Amira Yilmaz||Elif Demir': 3, 'Geist||Gespenst': 9, 'kaputt': 4, 'A||B': -2 };
  store['fairmix_full_state'] = JSON.stringify(roh);
  vm.runInContext('loadState();', ctx);
  const h = g('pairHistory');
  const erwartet = g('pairKey')('Amira Yilmaz', 'Elif Demir');
  assert(h[erwartet] === 3, 'gueltiges Altpaar nicht uebernommen');
  assert(Object.keys(h).length === 1, 'Muell nicht gefiltert: ' + Object.keys(h).length + ' Eintraege');
});

check('Klasse speichern setzt die aktive Klasse', () => {
  ladeDemo();
  vm.runInContext("features.partners = true;", ctx);
  g('generateTeams')();
  $('saveNameInput').value = '5a';
  g('saveNames')();
  assert(g('currentClass') === '5a', 'aktive Klasse nicht gesetzt');
  const saved = JSON.parse(store['fairmix_saved_lists']);
  assert(saved['5a'].original.length === 24, 'Namen nicht gesichert');
  assert(Object.keys(saved['5a'].pairHistory).length > 0, 'Partnerhistorie nicht gesichert');
});

check('Klassenleiste zeigt die aktive Klasse', () => {
  g('renderAll')();
  assert($('classBar').hidden === false, 'Klassenleiste versteckt');
  assert($('classCurrent').textContent.indexOf('5a') === 0, 'Klassenname fehlt: ' + $('classCurrent').textContent);
});

check('Zweite Klasse anlegen und wechseln sichert die erste', () => {
  vm.runInContext("originalNames = ['Tim Ott','Lea Sund','Nils Krog']; presentNames = [...originalNames]; absentNames = []; groups = {}; teams = []; pairRules = {together:[],apart:[]}; levels = {}; drawCounts = {}; pairHistory = {};", ctx);
  $('saveNameInput').value = '7b';
  g('saveNames')();
  assert(g('currentClass') === '7b', 'aktive Klasse nicht gewechselt');

  /* In 7b jemanden abwesend melden, dann zurueck zu 5a */
  g('markAbsent')('Tim Ott');
  g('switchClass')('5a');
  assert(g('currentClass') === '5a', 'Wechsel nach 5a fehlgeschlagen');
  assert(g('originalNames').length === 24, '5a nicht geladen');
  assert(g('pairHistoryCount')() > 0, 'Partnerhistorie von 5a verloren');

  const saved = JSON.parse(store['fairmix_saved_lists']);
  assert(saved['7b'].absent.indexOf('Tim Ott') >= 0, '7b wurde beim Wechsel nicht gesichert');
});

check('Klassenwechsel: Auswahlliste blendet die aktive Klasse aus', () => {
  g('renderAll')();
  const werte = [...$('classSelect').children].map(o => o.value);
  assert(werte.indexOf('5a') < 0, 'aktive Klasse steht in der Auswahl');
  assert(werte.indexOf('7b') >= 0, '7b fehlt in der Auswahl');
});

check('Klassenwechsel: Historien bleiben getrennt', () => {
  g('switchClass')('7b');
  assert(g('currentClass') === '7b', 'Wechsel nach 7b fehlgeschlagen');
  assert(g('pairHistoryCount')() === 0, '7b hat Paare aus 5a geerbt');
  assert(g('absentNames').indexOf('Tim Ott') >= 0, 'Abwesenheit in 7b verloren');
  g('switchClass')('5a');
  assert(g('pairHistoryCount')() > 0, '5a-Historie beim Zurueckwechseln verloren');
});

check('Klassenwechsel auf sich selbst tut nichts', () => {
  const vorher = g('pairHistoryCount')();
  g('switchClass')('5a');
  assert(g('pairHistoryCount')() === vorher, 'Wechsel auf sich selbst veraendert den Zustand');
  g('switchClass')('');
  assert(g('currentClass') === '5a', 'leerer Name hat die Klasse gewechselt');
});

check('Klasse loeschen macht die aktive Klasse namenlos', async () => {
  $('savedNamesSelect').value = '5a';
  g('deleteSavedNames')();
  await flush();
  g('closeDialog')(true);
  await flush();
  assert(g('currentClass') === '', 'aktive Klasse nicht abgemeldet');
  assert(g('originalNames').length === 24, 'Namen mitgeloescht');
});

check('Alte gespeicherte Klasse ohne Partnerhistorie laedt sauber', async () => {
  const saved = JSON.parse(store['fairmix_saved_lists']);
  saved['alt'] = { date: '01.01.2020', original: ['Ada L','Bob M'], present: ['Ada L','Bob M'], absent: [] };
  store['fairmix_saved_lists'] = JSON.stringify(saved);
  g('updateSavedNamesSelect')();
  $('savedNamesSelect').value = 'alt';
  g('loadNames')();
  /* Ohne aktive Klasse fragt der Wechsel nach, damit unbenannte Namen
     nicht stillschweigend verschwinden. */
  await flush();
  g('closeDialog')(true);
  await flush();
  assert(g('originalNames').length === 2, 'alte Klasse nicht geladen');
  assert(g('pairHistoryCount')() === 0, 'Historie aus dem Nichts');
  assert(g('currentClass') === 'alt', 'aktive Klasse nicht gesetzt');
});

check('Backup traegt eine Formatversion', () => {
  /* Den Blob abfangen, ohne den Auslieferweg nachzubauen. */
  let inhalt = null;
  const echt = ctx.Blob;
  ctx.Blob = class { constructor(parts) { this.parts = parts; inhalt = String(parts[0]); } };
  try { g('exportData')(); } finally { ctx.Blob = echt; }

  assert(inhalt, 'kein Backup-Inhalt erzeugt');
  const data = JSON.parse(inhalt);
  assert(data.schema === 1, 'schema-Feld fehlt oder falsch: ' + data.schema);
  assert(data.app === 'FairMix', 'app-Kennung fehlt');
  assert(data.state && typeof data.state === 'object', 'Zustand fehlt');
  assert(data.savedLists && typeof data.savedLists === 'object', 'gespeicherte Listen fehlen');
});


/* ============ Aufgeraeumte Darstellung ============ */

check('Zu Beginn sind Moderator und Zeitwaechter aktiv', () => {
  vm.runInContext("activeRoleIds = [...DEFAULT_ACTIVE_ROLE_IDS];", ctx);
  assert(g('activeRoleIds').length === 2, 'erwartet 2 Rollen, ist ' + g('activeRoleIds').length);
  const ids = g('getActiveRoles')().map(r => r.id).sort().join(',');
  assert(ids === 'r1,r2', 'falsche Rollen aktiv: ' + ids);
  assert(g('getAllRoles')().length >= 6, 'die uebrigen Rollen fehlen ganz');
});

check('Nur die aktiven Rollen werden je Gruppe vergeben', () => {
  ladeDemo();
  vm.runInContext("features.roles = true; activeRoleIds = [...DEFAULT_ACTIVE_ROLE_IDS];", ctx);
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('generateTeams')();
  g('teams').forEach((tm, i) => {
    const rollen = tm.filter(m => m.roleId).map(m => m.roleId);
    assert(rollen.length === 2, 'Gruppe ' + (i + 1) + ' hat ' + rollen.length + ' Rollen');
    assert(new Set(rollen).size === 2, 'Gruppe ' + (i + 1) + ' vergibt eine Rolle doppelt');
    rollen.forEach(r => assert(r === 'r1' || r === 'r2', 'unerwartete Rolle: ' + r));
  });
});

check('Praesentation zeigt das Rollensymbol ohne Namen', () => {
  g('openPresentation')('auto');
  const karten = $('presentGrid').children;
  assert(karten.length === 4, 'erwartet 4 Karten, sind ' + karten.length);
  const erwarteteSymbole = 4 * g('getActiveRoles')().length;

  let gefunden = 0;
  const suche = (node) => {
    (node.children || []).forEach(k => {
      const cls = (k.attrs && k.attrs.class) || k.className || '';
      if (String(cls).indexOf('role-badge') >= 0) {
        gefunden++;
        assert(String(cls).indexOf('role-icon-only') >= 0, 'Symbolklasse fehlt');
        assert(k.textContent.trim().length <= 3, 'Rollenname steht noch drin: ' + k.textContent);
        assert((k.attrs['aria-label'] || '').length > 3, 'Rollenname fehlt fuer Screenreader');
      }
      suche(k);
    });
  };
  suche($('presentGrid'));
  assert(gefunden === erwarteteSymbole,
         'erwartet ' + erwarteteSymbole + ' Rollensymbole, sind ' + gefunden);
  g('closePresentation')();
});

check('Demo-Hinweis laesst sich abschalten und wieder einschalten', () => {
  vm.runInContext("originalNames = []; presentNames = []; absentNames = [];", ctx);
  vm.runInContext("showDemoHint = true;", ctx);
  g('renderAll')();
  assert($('demoBox').hidden === false, 'Hinweis trotz eingeschaltetem Schalter versteckt');
  assert($('choiceShowDemo').checked === true, 'Kaestchen nicht gesetzt');

  g('toggleDemoHint')(false);
  assert(g('showDemoHint') === false, 'Schalter nicht umgelegt');
  assert($('demoBox').hidden === true, 'Hinweis trotz Abschaltung sichtbar');
  assert($('choiceShowDemo').checked === false, 'Kaestchen nicht zurueckgesetzt');

  g('toggleDemoHint')(true);
  assert($('demoBox').hidden === false, 'Hinweis kommt nicht zurueck');
});

check('Demo-Hinweis: Abschaltung uebersteht Speichern und Laden', () => {
  g('toggleDemoHint')(false);
  const roh = JSON.parse(store['fairmix_full_state']);
  assert(roh.showDemoHint === false, 'Schalter nicht gespeichert');
  vm.runInContext("showDemoHint = true; loadState();", ctx);
  assert(g('showDemoHint') === false, 'Schalter nach dem Laden verloren');
  vm.runInContext("showDemoHint = true; saveState();", ctx);
});

check('Demo-Hinweis bleibt bei gefuellter Liste weg', () => {
  ladeDemo();
  vm.runInContext("showDemoHint = true;", ctx);
  g('renderAll')();
  assert($('demoBox').hidden === true, 'Hinweis trotz vorhandener Namen sichtbar');
});


/* ============ Layout, Vorschau, Rechenlast ============ */

check('Vorschau nennt Gruppenzahl und Groesse', () => {
  ladeDemo();
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('updateTeamPreview')();
  const text = $('teamPreview').textContent;
  assert(text.indexOf('24') >= 0, 'Anzahl Anwesende fehlt: ' + text);
  assert(text.indexOf('4') >= 0 && text.indexOf('6') >= 0, 'Aufteilung fehlt: ' + text);
  assert($('teamPreview').className.indexOf('warn') < 0, 'Warnung bei 6er-Gruppen');
});

check('Vorschau rechnet auch aus der Gruppengroesse', () => {
  $('teamCount').value = ''; $('teamSize').value = '4';
  g('updateTeamPreview')();
  const text = $('teamPreview').textContent;
  /* 24 Anwesende bei Groesse 4 ergeben 6 Gruppen zu je 4 – nicht 4 zu je 6. */
  const erwartet = '6 ' + g('t')('groupsWord') + ' ' + g('t')('ofEach') + ' 4';
  assert(text.indexOf(erwartet) >= 0, 'erwartet "' + erwartet + '", ist "' + text + '"');
});

check('Vorschau warnt vor zu grossen Gruppen', () => {
  $('teamCount').value = '2'; $('teamSize').value = '';
  g('updateTeamPreview')();
  assert($('teamPreview').className.indexOf('warn') >= 0, 'keine Warnung bei 12er-Gruppen');
  $('teamCount').value = '4';
  g('updateTeamPreview')();
  assert($('teamPreview').className.indexOf('warn') < 0, 'Warnung bleibt haengen');
});

check('Vorschau schweigt bei leerer oder unsinniger Eingabe', () => {
  $('teamCount').value = ''; $('teamSize').value = '';
  g('updateTeamPreview')();
  assert($('teamPreview').textContent === '', 'Vorschau bei leerer Eingabe: ' + $('teamPreview').textContent);
  $('teamCount').value = '0';
  g('updateTeamPreview')();
  assert($('teamPreview').textContent === '', 'Vorschau bei Null');
  $('teamCount').value = 'abc';
  g('updateTeamPreview')();
  assert($('teamPreview').textContent === '', 'Vorschau bei Text');
  $('teamCount').value = '4';
});

check('Vorschau nennt ungleiche Gruppen mit beiden Groessen', () => {
  vm.runInContext("originalNames = []; presentNames = []; absentNames = [];", ctx);
  vm.runInContext("originalNames = ['A','B','C','D','E']; presentNames = [...originalNames];", ctx);
  $('teamCount').value = '2'; $('teamSize').value = '';
  g('updateTeamPreview')();
  const text = $('teamPreview').textContent;
  assert(text.indexOf('2') >= 0 && text.indexOf('3') >= 0, 'beide Groessen fehlen: ' + text);
});

check('Optimierung haelt ihr Zeitbudget ein', () => {
  const namen = [];
  for (let i = 0; i < 200; i++) namen.push('Kind ' + i);
  vm.runInContext("originalNames = " + JSON.stringify(namen) + "; presentNames = [...originalNames]; absentNames = []; groups = {}; teams = []; teamNames = []; levels = {}; pairRules = {together:[],apart:[]}; fixedPersons = []; pairHistory = {}; features.partners = true; features.rules = false; features.levels = false; levelMode = 'off';", ctx);
  $('teamCount').value = '34'; $('teamSize').value = '';
  for (let i = 0; i < 3; i++) g('generateTeams')();   /* Historie aufbauen */

  const start = Date.now();
  g('generateTeams')();
  const dauer = Date.now() - start;
  assert(dauer < 1000, 'Gruppenbildung dauert ' + dauer + ' ms');
  assert(g('teams').flat().length === 200, 'Namen verloren: ' + g('teams').flat().length);
  const groessen = g('teams').map(t => t.length);
  assert(Math.max(...groessen) - Math.min(...groessen) <= 1, 'Groessen entgleist');
});

check('Steuerleiste der Praesentation ueberlagert nichts', () => {
  const css = html.match(/\.present-controls\s*\{[^}]*\}/)[0];
  assert(css.indexOf('sticky') >= 0, 'Steuerleiste ist nicht klebend: ' + css);
  assert(css.indexOf('background') >= 0, 'Steuerleiste ohne Hintergrund – Text scheint durch');
  const overlay = html.match(/\.present-overlay\s*\{[^}]*\}/)[0];
  assert(overlay.indexOf('padding: 0 ') >= 0, 'Overlay hat noch festen Kopfabstand: ' + overlay);
});

check('Namen verlieren Steuerzeichen auf beiden Eingabewegen', () => {
  const p = g('parseNameBlob');
  const raus = p("An\u001Fna\nB\u0000ob");
  assert(raus[0] === 'Anna', 'Steuerzeichen nicht entfernt: ' + JSON.stringify(raus[0]));
  assert(raus[1] === 'Bob', 'Nullzeichen nicht entfernt: ' + JSON.stringify(raus[1]));

  /* Auch die Einzeleingabe – sonst kaeme das Trennzeichen ueber diesen Weg herein. */
  vm.runInContext("originalNames = []; presentNames = []; absentNames = [];", ctx);
  $('nameInput').value = "Cl\u001Fara";
  g('addName')();
  assert(g('originalNames')[0] === 'Clara',
         'Einzeleingabe laesst Steuerzeichen durch: ' + JSON.stringify(g('originalNames')[0]));
});


/* ============ Ziehen unabhaengig von Gruppen ============ */

check('Ziehen entfernt keinen Namen aus dem Gruppentopf', () => {
  ladeDemo();
  vm.runInContext("drawnNames = []; drawCounts = {}; drawStyle = 'ticker';", ctx);
  const vorher = g('presentNames').length;
  vm.runInContext("commitDraw(rosterNames()[0], getDisplay() || {classList:{add(){},remove(){}}});", ctx);
  assert(g('drawnNames').length === 1, 'Name nicht als gezogen vermerkt');
  assert(g('presentNames').length === vorher, 'Gruppentopf geschrumpft: ' + g('presentNames').length + ' statt ' + vorher);
  assert(g('drawPool')().length === vorher - 1, 'Ziehungstopf nicht geschrumpft');
});

check('Gezogene Namen landen weiterhin in Zufallsgruppen', () => {
  const gezogen = g('drawnNames')[0];
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('generateTeams')();
  const alle = g('teams').flat().map(m => m.name);
  assert(alle.length === 24, 'erwartet 24 verteilte Namen, ist ' + alle.length);
  assert(alle.indexOf(gezogen) >= 0, 'gezogener Name fehlt in den Gruppen: ' + gezogen);
});

check('Gezogene Namen bleiben fuer manuelle Gruppen waehlbar', () => {
  const gezogen = g('drawnNames')[0];
  assert(g('presentNames').indexOf(gezogen) >= 0, 'gezogener Name nicht mehr im Topf');
});

check('Wer in einer Gruppe sitzt, kann trotzdem gezogen werden', () => {
  ladeDemo();
  vm.runInContext("drawnNames = []; drawCounts = {};", ctx);
  $('groupNameInput').value = 'Tisch A';
  g('addGroup')();
  const name = g('originalNames')[0];
  $('groupSelect').value = 'Tisch A';
  g('assignToSelectedGroup')(name);
  assert(g('manualGroupOf')(name) === 'Tisch A', 'Zuordnung fehlgeschlagen');
  assert(g('presentNames').indexOf(name) < 0, 'Gruppenmitglied noch im Gruppentopf');
  assert(g('drawPool')().indexOf(name) >= 0, 'Gruppenmitglied nicht ziehbar');
});

check('Ziehungsstatus zaehlt gegen alle Anwesenden', () => {
  ladeDemo();
  vm.runInContext("drawnNames = []; drawCounts = {};", ctx);
  g('markAbsent')(g('originalNames')[0]);
  g('updateDrawStatus')();
  assert($('drawStatus').textContent.indexOf('23 / 23') === 0,
         'Status falsch: ' + $('drawStatus').textContent);
  vm.runInContext("drawnNames.push(rosterNames()[0]);", ctx);
  g('updateDrawStatus')();
  assert($('drawStatus').textContent.indexOf('22 / 23') === 0,
         'Status nach Ziehung falsch: ' + $('drawStatus').textContent);
});

check('Ziehung zuruecksetzen laesst Gruppen und Anwesenheit in Ruhe', () => {
  const abwesend = g('absentNames').length;
  $('teamCount').value = '4'; g('generateTeams')();
  const teams = g('teams').length;
  g('resetDraw')();
  assert(g('drawnNames').length === 0, 'Ziehungsrunde nicht zurueckgesetzt');
  assert(g('absentNames').length === abwesend, 'Anwesenheit veraendert');
  assert(g('teams').length === teams, 'Gruppen veraendert');
});

check('Alle zurueckholen beendet auch die Ziehungsrunde', () => {
  vm.runInContext("drawnNames.push(rosterNames()[0]);", ctx);
  g('resetNames')();
  assert(g('drawnNames').length === 0, 'Ziehungsrunde laeuft weiter');
});

check('Gezogene Namen ueberstehen Speichern und Klassenwechsel', () => {
  ladeDemo();
  vm.runInContext("drawnNames = [rosterNames()[0], rosterNames()[1]];", ctx);
  $('saveNameInput').value = 'Klasse X';
  g('saveNames')();
  vm.runInContext("drawnNames = [];", ctx);
  vm.runInContext("loadState();", ctx);
  assert(g('drawnNames').length === 2, 'nach Laden: ' + g('drawnNames').length);

  const saved = JSON.parse(store['fairmix_saved_lists']);
  assert(saved['Klasse X'].drawnNames.length === 2, 'nicht in der Klasse gesichert');
});

check('Namensliste zeigt Gruppe und Ziehung gleichzeitig', () => {
  ladeDemo();
  vm.runInContext("drawnNames = [];", ctx);
  $('groupNameInput').value = 'Tisch B';
  g('addGroup')();
  const name = g('originalNames')[0];
  $('groupSelect').value = 'Tisch B';
  g('assignToSelectedGroup')(name);
  vm.runInContext("drawnNames = ['" + name.replace(/'/g, "\\'") + "'];", ctx);
  g('renderNameList')();

  let badges = 0;
  const suche = (node) => {
    (node.children || []).forEach(k => {
      const cls = (k.attrs && k.attrs.class) || k.className || '';
      if (String(cls).indexOf('name-badge') >= 0) badges++;
      suche(k);
    });
  };
  suche($('nameList'));
  assert(badges === 2, 'erwartet 2 Markierungen (Gruppe + gezogen), sind ' + badges);
});

/* ============ Backup in den Einstellungen ============ */

check('Backup-Felder stehen in den Einstellungen', () => {
  const seite = html.indexOf('id="pageSettings"');
  const naechste = html.indexOf('id="pageNames"');
  const backup = html.indexOf('id="settingsBackup"');
  assert(backup > seite && backup < naechste, 'Backup-Kasten nicht auf der Einstellungsseite');
  assert(html.indexOf('id="jsonFile"') > seite && html.indexOf('id="jsonFile"') < naechste,
         'Dateifeld nicht mitgezogen');
});

check('Backup-Kasten folgt dem Datenbereich', () => {
  vm.runInContext("features.data = true;", ctx);
  g('applyFeatureVisibility')();
  assert($('settingsBackup').hidden === false, 'Kasten bei eingeschaltetem Bereich versteckt');
  vm.runInContext("features.data = false;", ctx);
  g('applyFeatureVisibility')();
  assert($('settingsBackup').hidden === true, 'Kasten bei abgeschaltetem Bereich sichtbar');
  vm.runInContext("features.data = true;", ctx);
  g('applyFeatureVisibility')();
});

check('Erinnerungshinweis steht auf der Startseite', () => {
  const start = html.indexOf('id="pageStart"');
  const settings = html.indexOf('id="pageSettings"');
  const hint = html.indexOf('id="backupHint"');
  assert(hint > start && hint < settings, 'Hinweis nicht auf der Startseite');
});

/* ============ Sequenzieller Praesentationsmodus ============ */

check('Praesentation startet ohne Ablaufmodus', () => {
  ladeDemo();
  vm.runInContext("features.roles = true;", ctx);
  $('teamCount').value = '4'; $('teamSize').value = '';
  g('generateTeams')();
  g('openPresentation')('auto');
  assert(g('sequenceOn') === false, 'Ablaufmodus von selbst an');
  assert($('sequenceBar').hidden === true, 'Ablaufleiste sichtbar');
  assert($('presentGrid').className.indexOf('sequence') < 0, 'Gitter schon im Ablaufmodus');
});

check('Ablaufmodus zeigt genau eine Gruppe', () => {
  g('toggleSequence')();
  assert(g('sequenceOn') === true, 'Ablaufmodus nicht an');
  assert($('sequenceBar').hidden === false, 'Ablaufleiste versteckt');
  assert($('presentGrid').className.indexOf('sequence') >= 0, 'Gitter nicht umgestellt');
  const dran = g('presentCards').filter(c => c.node.classList.contains('seq-current'));
  assert(dran.length === 1, 'erwartet genau eine sichtbare Karte, sind ' + dran.length);
  assert($('seqStatus').textContent === '1 / 4', 'Status falsch: ' + $('seqStatus').textContent);
});

check('Ablaufmodus mischt die Reihenfolge', () => {
  let verschieden = false;
  for (let i = 0; i < 30; i++) {
    g('shuffleSequence')();
    if (g('sequenceOrder').join(',') !== '0,1,2,3') verschieden = true;
  }
  assert(verschieden, 'Reihenfolge immer 0,1,2,3');
  const sortiert = [...g('sequenceOrder')].sort().join(',');
  assert(sortiert === '0,1,2,3', 'Reihenfolge unvollstaendig: ' + sortiert);
});

check('Weiter und Zurueck laufen nicht ueber die Enden hinaus', () => {
  g('shuffleSequence')();
  assert($('seqPrev').disabled === true, 'Zurueck am Anfang nicht gesperrt');
  assert($('seqNext').disabled === false, 'Weiter am Anfang gesperrt');
  g('sequenceStep')(-1);
  assert(g('sequenceIndex') === 0, 'Zurueck vom Anfang bewegt');

  for (let i = 0; i < 3; i++) g('sequenceStep')(1);
  assert(g('sequenceIndex') === 3, 'Ende nicht erreicht: ' + g('sequenceIndex'));
  assert($('seqNext').disabled === true, 'Weiter am Ende nicht gesperrt');
  g('sequenceStep')(1);
  assert(g('sequenceIndex') === 3, 'Weiter vom Ende bewegt');
  assert($('seqStatus').textContent === '4 / 4', 'Status am Ende: ' + $('seqStatus').textContent);
});

check('Jede Karte kommt im Ablauf genau einmal dran', () => {
  g('shuffleSequence')();
  const gesehen = {};
  for (let i = 0; i < 4; i++) {
    const dran = g('presentCards').filter(c => c.node.classList.contains('seq-current'));
    assert(dran.length === 1, 'Schritt ' + i + ': ' + dran.length + ' Karten sichtbar');
    gesehen[dran[0].key] = (gesehen[dran[0].key] || 0) + 1;
    if (i < 3) g('sequenceStep')(1);
  }
  assert(Object.keys(gesehen).length === 4, 'nur ' + Object.keys(gesehen).length + ' verschiedene Karten');
});

check('Ablaufmodus abschalten zeigt wieder alle Gruppen', () => {
  g('toggleSequence')();
  assert(g('sequenceOn') === false, 'Ablaufmodus noch an');
  assert($('sequenceBar').hidden === true, 'Leiste noch sichtbar');
  assert($('presentGrid').className.indexOf('sequence') < 0, 'Gitter noch umgestellt');
  const dran = g('presentCards').filter(c => c.node.classList.contains('seq-current'));
  assert(dran.length === 0, 'Karte noch als aktuell markiert');
});

check('Timer je Gruppe startet neu und ist speicherbar', () => {
  g('setTimerMinutes')(3);
  vm.runInContext("sequenceTimer = false;", ctx);
  g('toggleSequence')();
  g('toggleSequenceTimer')();
  assert(g('sequenceTimer') === true, 'Schalter nicht umgelegt');
  assert(g('timerRunning') === true, 'Timer laeuft nicht');
  assert($('timerBox').hidden === false, 'Timer-Anzeige bleibt versteckt');

  /* Zeit verstreichen lassen, dann weiterschalten: die Uhr faengt neu an. */
  vm.runInContext("timerDeadline = Date.now() + 40 * 1000;", ctx);
  g('tickTimer')();
  assert(g('timerLeft') === 40, 'Vorbereitung fehlgeschlagen: ' + g('timerLeft'));
  g('sequenceStep')(1);
  assert(g('timerLeft') === 180, 'Uhr nicht neu gestartet: ' + g('timerLeft'));
  assert(g('timerRunning') === true, 'Uhr laeuft nach dem Wechsel nicht');

  const roh = JSON.parse(store['fairmix_full_state']);
  assert(roh.sequenceTimer === true, 'Schalter nicht gespeichert');
});

check('Timer je Gruppe abschalten haelt die Uhr an', () => {
  g('toggleSequenceTimer')();
  assert(g('sequenceTimer') === false, 'Schalter nicht zurueck');
  assert(g('timerRunning') === false, 'Uhr laeuft weiter');
  assert($('seqTimerBtn').getAttribute('aria-pressed') === 'false', 'aria-pressed falsch');
});

check('Praesentation schliessen beendet den Ablaufmodus', () => {
  g('openPresentation')('auto');
  g('toggleSequence')();
  assert(g('sequenceOn') === true, 'Vorbereitung fehlgeschlagen');
  g('closePresentation')();
  assert(g('sequenceOn') === false, 'Ablaufmodus laeuft weiter');
  assert($('sequenceBar').hidden === true, 'Leiste noch sichtbar');
  assert(g('timerRunning') === false, 'Uhr laeuft weiter');
});

check('Ablaufmodus ohne Gruppen meldet sich', () => {
  vm.runInContext("presentCards = []; sequenceOn = false;", ctx);
  g('toggleSequence')();
  assert(g('sequenceOn') === false, 'Ablaufmodus ohne Karten eingeschaltet');
});


/* ============ Backup-Pruefung, Klassen, Undo-Stapel ============ */

check('Backup-Pruefung weist fremde und kaputte Dateien ab', () => {
  const pruef = g('backupProblem');
  assert(pruef(null) === 'msgBackupInvalid', 'null nicht abgewiesen');
  assert(pruef([]) === 'msgBackupInvalid', 'Array nicht abgewiesen');
  assert(pruef({ state: { originalNames: [] } }) === 'msgBackupForeign', 'Datei ohne app-Kennung angenommen');
  assert(pruef({ app: 'AndereApp', state: {} }) === 'msgBackupForeign', 'fremde App angenommen');
  assert(pruef({ app: 'FairMix', schema: 1 }) === 'msgBackupInvalid', 'Datei ohne Zustand angenommen');
  assert(pruef({ app: 'FairMix', schema: 1, state: { } }) === 'msgBackupInvalid', 'Zustand ohne Namen angenommen');
  assert(pruef({ app: 'FairMix', schema: 1, state: { originalNames: 'nein' } }) === 'msgBackupInvalid',
         'Namen als Text angenommen');
  assert(pruef({ app: 'FairMix', schema: 1, state: { originalNames: [] }, savedLists: [] }) === 'msgBackupInvalid',
         'Klassenliste als Array angenommen');
});

check('Backup-Pruefung erkennt neuere und alte Formate', () => {
  const pruef = g('backupProblem');
  const gut = { app: 'FairMix', schema: 1, state: { originalNames: ['A'] } };
  assert(pruef(gut) === null, 'gueltiges Backup abgewiesen');
  assert(pruef({ app: 'FairMix', schema: 99, state: { originalNames: ['A'] } }) === 'msgBackupNewer',
         'neueres Schema nicht erkannt');
  /* Sicherungen von vor der Einfuehrung des Feldes tragen nur "version". */
  assert(pruef({ app: 'FairMix', version: 3, state: { originalNames: ['A'] } }) === null,
         'alte Sicherung ohne schema abgewiesen');
  assert(pruef({ app: 'FairMix', version: 0, state: { originalNames: ['A'] } }) === 'msgBackupInvalid',
         'unsinnige Version angenommen');
});

check('Export schreibt dieselbe Formatversion, die der Import erwartet', () => {
  let inhalt = null;
  const echt = ctx.Blob;
  ctx.Blob = class { constructor(parts) { this.parts = parts; inhalt = String(parts[0]); } };
  try { g('exportData')(); } finally { ctx.Blob = echt; }
  const data = JSON.parse(inhalt);
  assert(data.schema === g('BACKUP_SCHEMA'), 'Export und Konstante laufen auseinander');
  assert(g('backupProblem')(data) === null, 'eigenes Backup wird nicht akzeptiert');
});

check('Klassen laden von der Namensseite sichert die bisherige Klasse', () => {
  ladeDemo();
  $('saveNameInput').value = 'Klasse A';
  g('saveNames')();
  vm.runInContext("originalNames = ['Nur Einer']; presentNames = [...originalNames]; absentNames = []; groups = {}; teams = []; pairHistory = {}; drawnNames = []; levels = {}; drawCounts = {}; pairRules = {together:[],apart:[]};", ctx);
  $('saveNameInput').value = 'Klasse B';
  g('saveNames')();

  /* In B etwas aendern, dann per Namensseite nach A laden */
  g('addName') && ($('nameInput').value = 'Zweiter', g('addName')());
  g('updateSavedNamesSelect')();
  $('savedNamesSelect').value = 'Klasse A';
  g('loadNames')();
  assert(g('currentClass') === 'Klasse A', 'nicht nach A gewechselt');

  const saved = JSON.parse(store['fairmix_saved_lists']);
  assert(saved['Klasse B'].original.length === 2,
         'Aenderung in B nicht gesichert: ' + saved['Klasse B'].original.length);
});

check('Dieselbe Klasse laden meldet sich statt zu wechseln', () => {
  const vorher = g('originalNames').length;
  $('savedNamesSelect').value = 'Klasse A';
  g('loadNames')();
  assert(g('currentClass') === 'Klasse A', 'Klasse gewechselt');
  assert(g('originalNames').length === vorher, 'Namen veraendert');
});

check('Undo-Stapel nimmt mehrere Schritte zurueck', () => {
  vm.runInContext("undoStack = [];", ctx);
  vm.runInContext("originalNames = ['A','B','C','D']; presentNames = [...originalNames]; absentNames = []; groups = {}; teams = []; drawnNames = []; pairHistory = {}; drawCounts = {}; levels = {}; pairRules = {together:[],apart:[]};", ctx);

  g('markAbsent')('A');
  g('markAbsent')('B');
  g('markAbsent')('C');
  assert(g('absentNames').length === 3, 'Vorbereitung: ' + g('absentNames').length);

  g('performUndo')();
  assert(g('absentNames').length === 2, 'erster Schritt: ' + g('absentNames').length);
  g('performUndo')();
  assert(g('absentNames').length === 1, 'zweiter Schritt: ' + g('absentNames').length);
  g('performUndo')();
  assert(g('absentNames').length === 0, 'dritter Schritt: ' + g('absentNames').length);
});

check('Undo-Stapel ist bei fuenf Schritten begrenzt', () => {
  vm.runInContext("undoStack = [];", ctx);
  for (let i = 0; i < 8; i++) g('pushUndo')();
  assert(g('undoStack').length === g('UNDO_MAX'), 'Stapel waechst unbegrenzt: ' + g('undoStack').length);
  assert(g('UNDO_MAX') === 5, 'unerwartete Stapeltiefe: ' + g('UNDO_MAX'));
});

check('Leerer Stapel meldet sich statt still zu bleiben', () => {
  vm.runInContext("undoStack = [];", ctx);
  assert(g('canUndo')() === false, 'canUndo bei leerem Stapel');
  g('performUndo')();
  assert($('msgText').textContent === g('t')('msgNothingToUndo'),
         'keine Rueckmeldung bei leerem Stapel: "' + $('msgText').textContent + '"');
});

check('Ablauf des Toasts loescht den Stapel nicht', () => {
  vm.runInContext("undoStack = [];", ctx);
  vm.runInContext("originalNames = ['A','B']; presentNames = [...originalNames]; absentNames = [];", ctx);
  g('markAbsent')('A');
  g('hideUndoToast')();      /* wie nach sechs Sekunden */
  assert(g('canUndo')() === true, 'Stapel nach Ablauf des Toasts leer');
  g('performUndo')();
  assert(g('absentNames').length === 0, 'Rueckgaengig nach Ablauf wirkungslos');
});

check('Ziehung zuruecksetzen ist rueckgaengig zu machen', () => {
  ladeDemo();
  vm.runInContext("undoStack = []; drawnNames = [rosterNames()[0], rosterNames()[1]];", ctx);
  g('resetDraw')();
  assert(g('drawnNames').length === 0, 'Runde nicht zurueckgesetzt');
  g('performUndo')();
  assert(g('drawnNames').length === 2, 'Ziehungsrunde nicht wiederhergestellt: ' + g('drawnNames').length);
});

check('Ziehung zuruecksetzen ohne Ziehung meldet sich', () => {
  vm.runInContext("undoStack = []; drawnNames = [];", ctx);
  g('resetDraw')();
  assert(g('canUndo')() === false, 'leerer Aufruf legt einen Schnappschuss an');
});

check('Gruppe umbenennen ist rueckgaengig zu machen', async () => {
  vm.runInContext("undoStack = []; groups = {}; drawnGroups = { manual: [], auto: [] };", ctx);
  $('groupNameInput').value = 'Tisch 1';
  g('addGroup')();
  g('renameGroup')('Tisch 1');
  await flush();
  $('dialogInput').value = 'Tisch 9';
  g('closeDialog')(true);
  await flush();
  assert(Object.keys(g('groups')).indexOf('Tisch 9') >= 0, 'nicht umbenannt: ' + Object.keys(g('groups')).join(','));
  g('performUndo')();
  assert(Object.keys(g('groups')).indexOf('Tisch 1') >= 0, 'Umbenennung nicht zurueckgenommen');
});

check('Verschieben zwischen Gruppen ist rueckgaengig zu machen', () => {
  vm.runInContext("undoStack = []; groups = { 'A': [{name:'Eins',roleId:null}], 'B': [] }; drawnGroups = { manual: [], auto: [] };", ctx);
  const m = g('moveMember')({ type: 'manual', key: 'A', index: 0 }, 'B');
  assert(m && m.name === 'Eins', 'Verschieben fehlgeschlagen');
  assert(g('groups')['B'].length === 1 && g('groups')['A'].length === 0, 'Mitglied nicht umgezogen');
  g('performUndo')();
  assert(g('groups')['A'].length === 1 && g('groups')['B'].length === 0, 'Verschieben nicht zurueckgenommen');
});

check('Abgebrochene Verschiebung legt keinen Schnappschuss an', () => {
  vm.runInContext("undoStack = []; groups = { 'A': [{name:'Eins',roleId:null}], 'B': [] };", ctx);
  const faelle = [
    [{ type: 'manual', key: 'A', index: 0 }, 'A'],            /* dieselbe Gruppe */
    [{ type: 'manual', key: 'A', index: 0 }, 'Gibt Es Nicht'],/* Ziel fehlt */
    [{ type: 'manual', key: 'Fehlt', index: 0 }, 'B'],        /* Quelle fehlt */
    [{ type: 'manual', key: 'A', index: 7 }, 'B'],            /* Index daneben */
    [{ type: 'manual', key: 'A', index: 0 }, undefined],      /* kein Ziel */
    [null, 'B']                                               /* keine Angaben */
  ];
  faelle.forEach((f, i) => {
    assert(g('moveMember')(f[0], f[1]) === null, 'Fall ' + i + ' wurde ausgefuehrt');
  });
  assert(g('undoStack').length === 0, 'Stapel gewachsen: ' + g('undoStack').length);
  assert(g('groups')['A'].length === 1, 'Gruppe veraendert');
});

check('Verschieben zwischen Teams laeuft ueber denselben Weg', () => {
  vm.runInContext("undoStack = []; teams = [[{name:'X',roleId:null}], []];", ctx);
  assert(g('moveMember')({ type: 'auto', key: 0, index: 0 }, 1) !== null, 'Verschieben fehlgeschlagen');
  assert(g('teams')[1].length === 1, 'Mitglied nicht umgezogen');
  assert(g('moveMember')({ type: 'auto', key: 0, index: 0 }, 'keine Zahl') === null, 'unsinniges Ziel akzeptiert');
  assert(g('undoStack').length === 1, 'zusaetzlicher Schnappschuss: ' + g('undoStack').length);
});


/* ============ Zuruecksetzen und Radanzeige ============ */

const ladeKlasse27 = () => {
  const namen = [];
  for (let i = 0; i < 27; i++) namen.push(String.fromCharCode(65 + (i % 26)) + '. Kind ' + i);
  vm.runInContext("originalNames = " + JSON.stringify(namen) + "; presentNames = [...originalNames]; absentNames = []; groups = {}; teams = []; teamNames = []; drawnNames = []; drawCounts = {}; levels = {}; pairRules = { together: [], apart: [] }; fairDraw = true; undoStack = [];", ctx);
};
const zieheOft = (n) => {
  for (let i = 0; i < n; i++) {
    vm.runInContext("commitDraw(drawPool()[0], { classList: { add() {}, remove() {} } });", ctx);
  }
};

check('Ziehungsstand passt zur Zahl der Ziehungen', () => {
  ladeKlasse27();
  zieheOft(4);
  assert(g('drawnNames').length === 4, 'drawnNames: ' + g('drawnNames').length);
  g('updateDrawStatus')();
  assert($('drawStatus').textContent.indexOf('23 / 27') === 0,
         'Status: ' + $('drawStatus').textContent);
});

check('Runde und Zaehler zuruecksetzen fuellt den Topf wieder', async () => {
  g('resetDrawHistory')();
  await flush();
  g('closeDialog')(true);
  await flush();
  assert(Object.keys(g('drawCounts')).length === 0, 'Zaehler nicht geleert');
  assert(g('drawnNames').length === 0, 'Runde nicht geleert – Topf bleibt halb voll');
  g('updateDrawStatus')();
  assert($('drawStatus').textContent.indexOf('27 / 27') === 0,
         'Status nach dem Zuruecksetzen: ' + $('drawStatus').textContent);
});

check('Runde und Zaehler zuruecksetzen ist rueckgaengig zu machen', async () => {
  ladeKlasse27();
  zieheOft(3);
  g('resetDrawHistory')();
  await flush();
  g('closeDialog')(true);
  await flush();
  g('performUndo')();
  assert(g('drawnNames').length === 3, 'Runde nicht wiederhergestellt: ' + g('drawnNames').length);
  assert(Object.keys(g('drawCounts')).length === 3, 'Zaehler nicht wiederhergestellt');
});

check('Neue Runde holt alle zurueck und behaelt den Zaehler', () => {
  ladeKlasse27();
  zieheOft(5);
  const zaehler = Object.keys(g('drawCounts')).length;
  g('resetDraw')();
  assert(g('drawnNames').length === 0, 'Runde nicht geleert');
  assert(Object.keys(g('drawCounts')).length === zaehler, 'Zaehler mitgeloescht');
  g('updateDrawStatus')();
  assert($('drawStatus').textContent.indexOf('27 / 27') === 0, 'Status: ' + $('drawStatus').textContent);
});

check('Zuruecksetzen meldet sich, wenn es nichts zu tun gibt', () => {
  ladeKlasse27();
  vm.runInContext("undoStack = [];", ctx);
  g('resetDrawHistory')();
  assert(g('canUndo')() === false, 'leerer Aufruf legt einen Schnappschuss an');
});

check('Nur eine gelaufene Runde genuegt fuers Zuruecksetzen', async () => {
  /* Vorher war die Sperre an drawCounts gebunden – eine Runde ohne
     Zaehlerstand liess sich damit nicht zuruecksetzen. */
  ladeKlasse27();
  vm.runInContext("drawnNames = [rosterNames()[0]]; drawCounts = {}; undoStack = [];", ctx);
  g('resetDrawHistory')();
  await flush();
  g('closeDialog')(true);
  await flush();
  assert(g('drawnNames').length === 0, 'Runde ohne Zaehlerstand nicht zurueckgesetzt');
});

check('Gezogenes Radfeld wird als verbraucht markiert', () => {
  ladeKlasse27();
  vm.runInContext("drawStyle = 'wheel'; wheelWeighted = true; wheelState.draw.frozen = false;", ctx);
  g('showPage')('pageDraw');
  g('renderWheel')('draw');
  const felder = [...$('wheelRotor').children].filter(k => {
    const c = (k.attrs && k.attrs.class) || '';
    return String(c).indexOf('wheel-seg') >= 0;
  });
  assert(felder.length === 27, 'erwartet 27 Felder, sind ' + felder.length);

  /* Nach der Drehung bleibt das Rad stehen – dann muss das gezogene Feld
     erkennbar sein, sonst zeigt das Rad ein Feld mehr als der Zaehler. */
  vm.runInContext("wheelState.draw.frozen = true;", ctx);
  const opfer = g('drawPool')()[0];
  const klasse = k => String(k.getAttribute ? (k.getAttribute('class') || '') : '');
  vm.runInContext("commitDraw(drawPool()[0], { classList: { add() {}, remove() {} } });", ctx);

  const markiert = [...$('wheelRotor').children].filter(k => klasse(k).indexOf('seg-used') >= 0);
  assert(markiert.length >= 1, 'gezogenes Feld nicht markiert');
  markiert.forEach(k => {
    const key = k.getAttribute ? k.getAttribute('data-seg') : null;
    assert(key === opfer, 'falsches Feld markiert: ' + key + ' statt ' + opfer);
  });

  g('updateDrawStatus')();
  const uebrig = [...$('wheelRotor').children].filter(k =>
    klasse(k).indexOf('wheel-seg') >= 0 && klasse(k).indexOf('seg-used') < 0);
  assert(uebrig.length === g('drawPool')().length,
         'Rad zeigt ' + uebrig.length + ' offene Felder, Zaehler sagt ' + g('drawPool')().length);
});

check('Neuer Radaufbau loescht die Markierungen', () => {
  vm.runInContext("wheelState.draw.frozen = false;", ctx);
  g('renderWheel')('draw');
  const markiert = [...$('wheelRotor').children].filter(k =>
    String(k.getAttribute ? (k.getAttribute('class') || '') : '').indexOf('seg-used') >= 0);
  assert(markiert.length === 0, 'alte Markierung ueberlebt den Neuaufbau');
});


/* ============ Rollen-Migration und selbsttaetige Runde ============ */

check('Frische Installation hat Moderator und Zeitwaechter', () => {
  delete store['fairmix_full_state'];
  vm.runInContext("activeRoleIds = [...DEFAULT_ACTIVE_ROLE_IDS]; loadState();", ctx);
  assert(g('activeRoleIds').join(',') === 'r1,r2', 'aktiv: ' + g('activeRoleIds').join(','));
});

check('Alte Vorgabe mit allen sechs Rollen wird migriert', () => {
  store['fairmix_full_state'] = JSON.stringify({
    originalNames: ['A', 'B'], presentNames: ['A', 'B'], absentNames: [],
    activeRoleIds: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
  });
  vm.runInContext("loadState();", ctx);
  assert(g('activeRoleIds').join(',') === 'r1,r2',
         'alte Vorgabe nicht migriert: ' + g('activeRoleIds').join(','));
});

check('Eigene Rollenauswahl bleibt unangetastet', () => {
  const faelle = [
    ['r3', 'r5'],                                /* eigene Auswahl */
    ['r1'],                                      /* bewusst nur eine */
    ['r1', 'r2', 'r3', 'r4', 'r5'],              /* fuenf, nicht sechs */
    []                                           /* alle abgewaehlt */
  ];
  faelle.forEach(auswahl => {
    store['fairmix_full_state'] = JSON.stringify({
      originalNames: ['A'], presentNames: ['A'], absentNames: [], activeRoleIds: auswahl
    });
    vm.runInContext("loadState();", ctx);
    assert(g('activeRoleIds').join(',') === auswahl.join(','),
           'Auswahl [' + auswahl.join(',') + '] wurde zu [' + g('activeRoleIds').join(',') + ']');
  });
});

check('Migration greift nur einmal', () => {
  /* Nach dem Speichern traegt der Zustand die Markierung – wer danach
     alle sechs bewusst anwaehlt, behaelt sie. */
  vm.runInContext("activeRoleIds = ['r1','r2','r3','r4','r5','r6']; saveState();", ctx);
  const roh = JSON.parse(store['fairmix_full_state']);
  assert(roh.roleChoiceMigrated === true, 'Markierung nicht gespeichert');
  vm.runInContext("loadState();", ctx);
  assert(g('activeRoleIds').length === 6,
         'bewusste Auswahl aller sechs wurde zurueckgesetzt: ' + g('activeRoleIds').join(','));
});

check('Erkennung der alten Vorgabe ist genau', () => {
  const alt = g('istAlteRollenVorgabe');
  assert(alt(['r1','r2','r3','r4','r5','r6']) === true, 'alte Vorgabe nicht erkannt');
  assert(alt(['r6','r5','r4','r3','r2','r1']) === true, 'Reihenfolge spielt eine Rolle');
  assert(alt(['r1','r2','r3','r4','r5']) === false, 'fuenf als alte Vorgabe erkannt');
  assert(alt(['r1','r2','r3','r4','r5','r6','r7']) === false, 'sieben als alte Vorgabe erkannt');
  assert(alt(['r1','r1','r1','r1','r1','r1']) === false, 'Wiederholungen als Vorgabe erkannt');
  assert(alt(null) === false, 'null als Vorgabe erkannt');
});

check('Leerer Topf beginnt die naechste Runde von selbst', () => {
  ladeKlasse27();
  vm.runInContext("drawStyle = 'ticker'; fairDraw = true;", ctx);
  zieheOft(27);
  assert(g('drawPool')().length === 0, 'Vorbereitung: Topf nicht leer');

  g('pickRandomNameWithAnimation')();
  assert(g('drawnNames').length < 27, 'Runde nicht neu begonnen: ' + g('drawnNames').length);
  assert($('msgText').textContent === g('t')('msgRoundComplete'),
         'kein Hinweis auf die neue Runde: "' + $('msgText').textContent + '"');
});

check('Nach der selbsttaetigen Runde bleibt der Zaehler erhalten', () => {
  ladeKlasse27();
  vm.runInContext("drawStyle = 'ticker';", ctx);
  zieheOft(27);
  const summe = Object.keys(g('drawCounts')).reduce((a, k) => a + g('drawCounts')[k], 0);
  assert(summe === 27, 'Vorbereitung: ' + summe);
  g('pickRandomNameWithAnimation')();
  const nachher = Object.keys(g('drawCounts')).reduce((a, k) => a + g('drawCounts')[k], 0);
  assert(nachher >= 27, 'Zaehler wurde zurueckgesetzt: ' + nachher);
});

check('Faire Ziehung laesst niemanden zweimal vor allen anderen dran', () => {
  ladeKlasse27();
  vm.runInContext("drawStyle = 'ticker'; fairDraw = true;", ctx);
  /* Zwei vollstaendige Runden ohne Zutun: danach muss jeder genau zweimal
     gezogen sein – das ist die Leistung des Zaehlers, nicht der Runde. */
  for (let i = 0; i < 54; i++) {
    if (!g('drawPool')().length) vm.runInContext("drawnNames = [];", ctx);
    vm.runInContext("commitDraw(chooseNextName(), { classList: { add() {}, remove() {} } });", ctx);
  }
  const werte = g('originalNames').map(n => g('drawCounts')[n] || 0);
  assert(Math.min(...werte) === 2 && Math.max(...werte) === 2,
         'ungleich verteilt: ' + Math.min(...werte) + ' bis ' + Math.max(...werte));
});

check('Alle abwesend meldet sich statt eine Runde zu beginnen', () => {
  ladeKlasse27();
  vm.runInContext("absentNames = [...originalNames]; presentNames = []; drawnNames = [];", ctx);
  $('msgText').textContent = '';
  g('pickRandomNameWithAnimation')();
  assert(g('drawnNames').length === 0, 'Ziehung trotz leerer Klasse');
  /* Die Meldung muss die leere Klasse nennen, nicht eine neue Runde
     ankuendigen, die es gar nicht geben kann. */
  assert($('msgText').textContent === g('t')('msgAllAbsent'),
         'falsche Meldung: "' + $('msgText').textContent + '"');
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
