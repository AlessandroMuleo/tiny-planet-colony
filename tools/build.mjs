// Ricompone il gioco in un solo file HTML: shell + CSS + moduli JS in ordine.
// I moduli sono script classici che condividono lo scope globale, come quando
// stavano in un unico <script>: l'ordine dei file (prefisso numerico) conta.
//
//   node tools/build.mjs            → dist/tiny-planet-colony.html
//   node tools/build.mjs --stdout   → stampa l'HTML invece di scriverlo

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

export function jsFiles() {
  return readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
}

export function bundleJs() {
  return jsFiles().map(f => readFileSync(join(src, 'js', f), 'utf8')).join('');
}

/* Due `function` globali con lo stesso nome in moduli diversi non danno
   errore: vince l'ultima, in silenzio. È successo con makePeace (pace tra
   clan e pace tra coloni): la build ora si ferma.                       */
export function checkGlobals() {
  const seen = new Map(), dup = [];
  for (const f of jsFiles()) {
    const text = readFileSync(join(src, 'js', f), 'utf8');
    for (const m of text.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm)) {
      const name = m[1] || m[2];
      if (seen.has(name)) dup.push(name + ' (' + seen.get(name) + ' e ' + f + ')');
      else seen.set(name, f);
    }
  }
  if (dup.length) throw new Error('nomi globali doppi: ' + dup.join(', '));
}

export function build() {
  checkGlobals();
  const shell = readFileSync(join(src, 'shell.html'), 'utf8');
  const css = readFileSync(join(src, 'style.css'), 'utf8');
  const fill = (text, mark, body) => {
    const line = mark + '\n';
    if (text.split(line).length !== 2) throw new Error('segnaposto ' + mark + ' mancante o doppio');
    return text.replace(line, () => body);
  };
  return fill(fill(shell, '@@CSS@@', css), '@@JS@@', bundleJs());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = build();
  if (process.argv.includes('--stdout')) process.stdout.write(html);
  else {
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'tiny-planet-colony.html'), html);
    console.log('dist/tiny-planet-colony.html · ' + jsFiles().length + ' moduli · ' +
      (html.length / 1024).toFixed(0) + ' KB');
  }
}
