// Carica il gioco in Node senza browser né GPU.
// three.js è quello vero (r128, stessa versione della CDN): la logica usa
// Vector3, Quaternion e le geometrie, quindi deve girare il codice originale.
// Solo il renderer e il DOM sono finti: accettano tutto e non disegnano nulla.

import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsFiles } from '../tools/build.mjs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

class FakeEl {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase(); this.id = id;
    this.style = {}; this.dataset = {}; this.children = [];
    this.textContent = ''; this.innerHTML = ''; this.className = '';
    this.disabled = false; this.title = '';
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c, on) => { const v = on === undefined ? !set.has(c) : !!on; v ? set.add(c) : set.delete(c); return v; },
      contains: c => set.has(c)
    };
  }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  remove() {}
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return new FakeEl(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  setPointerCapture() {}
  focus() {} blur() {} click() {}
}

class FakeRenderer {
  constructor() { this.domElement = new FakeEl('canvas'); this.info = { render: { triangles: 1 } }; }
  setPixelRatio() {} setSize() {} setClearColor() {} render() {}
}

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Crea un gioco isolato. Ogni chiamata ha il suo contesto: stato, THREE e
   Math.random non si mescolano tra una partita e l'altra.
   Restituisce { run(code) } per eseguire codice nello scope del gioco,
   e i messaggi che il gioco ha mostrato (toast) e gli errori (fail). */
export function loadGame({ seed = 1 } = {}) {
  const THREE = { ...require('three') };
  THREE.WebGLRenderer = FakeRenderer;

  const els = new Map();
  const document = {
    getElementById: id => { if (!els.has(id)) els.set(id, new FakeEl('div', id)); return els.get(id); },
    createElement: tag => new FakeEl(tag),
    querySelector: () => new FakeEl(),
    querySelectorAll: () => [],
    activeElement: null
  };
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const failures = [];
  const ctx = {
    THREE, document, localStorage, console,
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    navigator: {}, URLSearchParams,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    WebGLRenderingContext: function () {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  // Math.random deterministico: la stessa seed dà la stessa partita
  vm.runInContext('Math.random = (' + mulberry32.toString() + ')(' + (seed >>> 0) + ');', ctx);

  // tutti i moduli tranne l'ultimo (avvio e requestAnimationFrame):
  // l'avvio lo fa la simulazione, con un mondo scelto da lei
  const files = jsFiles().filter(f => !/-main\.js$/.test(f));
  const code = files.map(f => readFileSync(join(root, 'src', 'js', f), 'utf8')).join('');
  vm.runInContext(code, ctx, { filename: 'game.js' });

  const toasts = [];
  ctx.__toasts = toasts; ctx.__failures = failures;
  vm.runInContext(`
    { const t0 = toast; toast = (msg, ev) => { __toasts.push(msg); t0(msg, ev); }; }
    fail = msg => { __failures.push(String(msg)); };
  `, ctx);

  return {
    ctx, toasts, failures,
    run: src => vm.runInContext(src, ctx)
  };
}
