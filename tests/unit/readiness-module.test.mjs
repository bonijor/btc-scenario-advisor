import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../assets/readiness-module.js', import.meta.url), 'utf8');

// Minimal DOM for the actual module; browser/geometry checks live in E2E.
function fixture(hash = '') {
  const nodes = [], listeners = {}, windowListeners = {}, timers = new Map();
  let timerId = 0;
  const location = { hash }, navigation = [], history = [];
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.dataset = {}; this.attrs = {}; this.className = ''; this.id = ''; this.removed = false; this.textContent = ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    removeAttribute(k) { delete this.attrs[k]; }
    get classList() {
      return {
        contains: (c) => this.className.split(' ').includes(c),
        toggle: (c, on) => { const set = new Set(this.className.split(' ').filter(Boolean)); if (on) set.add(c); else set.delete(c); this.className = [...set].join(' '); },
      };
    }
    append(n) { if (!nodes.includes(n)) nodes.push(n); n.removed = false; }
    insertAdjacentElement(_position, n) { this.append(n); }
    remove() { this.removed = true; }
    focus() { document.activeElement = this; }
    closest(selector) { return selector === '[data-view]' && this.dataset.view ? this : null; }
  }
  const make = (id, className = '') => { const n = new Element(); n.id = id; n.className = className; nodes.push(n); return n; };
  const trial = make('trial', 'view'), overview = make('overview', 'view active'), system = make('system', 'view'), systemContent = make('system-content');
  const trialButton = make('trial-nav'); trialButton.dataset.view = 'trial';
  const overviewButton = make('overview-nav'); overviewButton.dataset.view = 'overview';
  const select = (s) => nodes.filter((n) => {
    if (n.removed) return false;
    if (s === '.nav [data-view="trial"]') return n === trialButton;
    if (s === '#system .content') return n === systemContent;
    if (s === '[data-readiness-control]') return n.dataset.readinessControl;
    if (s === '[data-view="readiness"]') return n.dataset.view === 'readiness';
    if (s === '[data-view]') return n.dataset.view;
    if (s === '.view') return n.classList.contains('view');
    if (s.startsWith('#')) return n.id === s.slice(1);
    return false;
  });
  const document = {
    readyState: 'complete', head: new Element('head'), activeElement: null,
    createElement: (tag) => new Element(tag), querySelector: (s) => select(s)[0] || null, querySelectorAll: select,
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const window = {
    addEventListener: (name, fn) => { windowListeners[name] = fn; },
    BTCDashboardNavigation: { open: (name) => { navigation.push(name); } },
  };
  runInNewContext(source, {
    document, window, location,
    history: { pushState: (_state, _title, url) => { history.push(url); location.hash = url; } },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const controls = () => select('[data-view="readiness"]');
  const sheets = () => nodes.filter((n) => n.tagName === 'link' && !n.removed);
  const click = (target = controls()[0]) => {
    const event = { target, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    listeners.click(event); return event;
  };
  const settle = async () => {
    for (let i = 0; i < 16; i += 1) {
      await Promise.resolve();
      for (const [id, timer] of timers) if (timer.delay === 0) { timers.delete(id); timer.fn(); }
    }
  };
  return { nodes, select, controls, sheets, click, settle, timers, trial, overview, system, overviewButton, document, windowListeners, navigation, location, history };
}

test('startup creates desktop and system controls, not panel or CSS', () => {
  const f = fixture();
  assert.equal(f.controls().length, 2);
  assert.equal(f.select('#readiness').length, 0);
  assert.equal(f.sheets().length, 0);
  assert.equal(f.navigation.length, 0);
});

test('first click opens once, preserves evidence and accessibility state', async () => {
  const f = fixture();
  const event = f.click();
  assert.equal(event.prevented && event.stopped, true);
  assert.equal(f.controls()[0].attrs['aria-busy'], 'true');
  f.sheets()[0].onload(); await f.settle();
  const panel = f.select('#readiness')[0];
  assert.equal(panel.attrs['aria-hidden'], 'false');
  assert.equal(f.document.activeElement, panel);
  assert.equal(f.overview.attrs['aria-hidden'], 'true');
  assert.deepEqual(f.history, ['#readiness']);
  for (const text of ['LIVE_READY = FALSE', 'VERIFIED 16/90', '12 outcomes', '0 activados', 'REAL_ORDER_CREATED=false', 'Snapshot fechado', 'SPOT_ONLY']) assert.ok(panel.innerHTML.includes(text), text);
  assert.equal(f.controls()[0].attrs['aria-busy'], 'false');
});

test('rapid activation reuses one pending stylesheet and one render', async () => {
  const f = fixture(); f.click(); f.click(); f.click(f.controls()[1]);
  assert.equal(f.sheets().length, 1);
  f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness').length, 1);
  assert.equal(f.navigation.length, 1);
  f.click(); await f.settle();
  assert.equal(f.select('#readiness').length, 1);
  assert.equal(f.sheets().length, 1);
});

test('CSS error releases failed promise and permits a successful retry', async () => {
  const f = fixture(); f.click(); f.sheets()[0].onerror(); await f.settle();
  assert.equal(f.select('#readiness').length, 0);
  assert.equal(f.sheets().length, 0);
  assert.match(f.select('#readinessLoadStatus')[0].textContent, /reintentar/);
  f.click(); f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness')[0].attrs['aria-hidden'], 'false');
});

test('stylesheet timeout also permits retry without duplicate content', async () => {
  const f = fixture(); f.click();
  const timeout = [...f.timers.values()].find((t) => t.delay === 10000); timeout.fn(); await f.settle();
  assert.equal(f.sheets().length, 0);
  f.click(); f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness').length, 1);
});

test('leaving during load does not steal focus or navigate on late completion', async () => {
  const f = fixture(); f.click(); f.click(f.overviewButton);
  f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness')[0].attrs['aria-hidden'], 'true');
  assert.equal(f.navigation.length, 0);
  assert.equal(f.document.activeElement, null);
  f.click(); await f.settle();
  assert.equal(f.navigation.length, 1);
});

test('direct hash loads and opens without adding a duplicate history entry', async () => {
  const f = fixture('#readiness');
  assert.equal(f.sheets().length, 1);
  f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness')[0].attrs['aria-hidden'], 'false');
  assert.equal(f.history.length, 0);
});

test('hash navigation away cancels pending reveal', async () => {
  const f = fixture('#readiness');
  f.location.hash = '#overview'; f.windowListeners.hashchange();
  f.sheets()[0].onload(); await f.settle();
  assert.equal(f.navigation.length, 0);
  assert.equal(f.select('#readiness')[0].attrs['aria-hidden'], 'true');
});

test('missing mount point is recoverable and does not retain its stylesheet', async () => {
  const f = fixture(); f.trial.remove(); f.click();
  f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness').length, 0);
  assert.equal(f.sheets().length, 0);
  assert.match(f.select('#readinessLoadStatus')[0].textContent, /reintentar/);
  f.trial.removed = false; f.click(); f.sheets()[0].onload(); await f.settle();
  assert.equal(f.select('#readiness').length, 1);
});
