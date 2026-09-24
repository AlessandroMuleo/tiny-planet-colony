// Simulazione senza grafica: fa girare il gioco per N tick in più scenari
// e controlla a ogni tick che i conti tornino. Esce con codice 1 se qualcosa
// si rompe, così si può lanciare prima di ogni commit.
// Ogni scenario gira in un processo suo, in parallelo agli altri.
//
//   node test/sim.mjs                 tutti gli scenari, 900 tick: è quello di "npm test"
//   node test/sim.mjs --ticks 300     più corto
//   node test/sim.mjs --only rivali   solo gli scenari che contengono "rivali"
//   node test/sim.mjs --verbose       stampa anche i messaggi del gioco
//   node test/sim.mjs --trace 30      ogni 30 tick: azioni dei coloni e bisogni medi

import { loadGame } from './headless.mjs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i < 0 ? def : process.argv[i + 1];
};
const TICKS = +arg('ticks', 900);
const ONLY = arg('only', '');
const VERBOSE = process.argv.includes('--verbose');
const TRACE = +arg('trace', 0);        // ogni N tick: cosa fanno i coloni
const FPS = 5;                        // passi di simulazione per secondo di gioco (dt = 0,2 s)

const SCENARIOS = [
  // survive: col governatore la colonia deve arrivare viva alla fine
  { name: 'primo mondo, automatico',     seed: 1,  world: 1, auto: true, survive: true },
  { name: 'primo mondo, automatico #2',  seed: 7,  world: 1, auto: true, survive: true },
  { name: 'primo mondo, senza giocatore',seed: 3,  world: 1, auto: false },
  { name: 'terzo mondo con rivali',      seed: 11, world: 3, auto: true, survive: true },
  { name: 'quinto mondo con rivali',     seed: 23, world: 5, auto: true, survive: true },
  { name: 'salva e ricarica a metà',     seed: 5,  world: 3, auto: true, reload: true, survive: true }
];

/* Il ciclo di gioco di 23-main.js, senza disegno né requestAnimationFrame,
   e il controllo degli invarianti, eseguiti dentro lo scope del gioco. */
const DRIVER = `
var __acc = 0, __clock = 0, __tick = 0, __stale = new Map(), __progress = new Map();

function __setup(world, seed, autoOn){
  worldIndex = world; worldSeed = seed;
  generateWorld(worldSeed); applySeason(); refreshHUD();
  auto = autoOn;
}

function __frame(dt){
  __clock += dt;
  stepDay(dt); stepUnits(dt); stepProps(dt);
  stepOrbit(dt, __clock); stepFX(dt); stepMoon(dt, __clock);
  resolveCombat(dt); structureTick(dt);
  __acc += dt;
  const out = [];
  while(__acc >= 1 && !gameOver){
    __acc -= 1; economyTick(); __tick++;
    out.push(...__check());
  }
  return out;
}

const __fin = v => typeof v === 'number' && Number.isFinite(v);

function __check(){
  const bad = [], warn = [];
  const P = myPeople().length;
  if(pop !== P) bad.push('pop = ' + pop + ' ma i coloni sono ' + P);

  const cap = capacity();
  for(const k of ['food','mat','pow']){
    if(!__fin(res[k])) bad.push('res.' + k + ' non è un numero: ' + res[k]);
    else if(res[k] < -1e-9) bad.push('res.' + k + ' negativa: ' + res[k].toFixed(2));
    else if(res[k] > cap + 1e-6) bad.push('res.' + k + ' = ' + res[k].toFixed(1) + ' oltre la capienza ' + cap);
  }
  if(!__fin(sci)) bad.push('ricerca non è un numero');

  const onJob = new Map();
  for(const u of units){
    if(!__fin(u.hp) || !__fin(u.hpMax)) bad.push(u.kind + ': salute non numerica');
    else if(u.hp > u.hpMax + 1e-6) bad.push(u.kind + ': salute ' + u.hp.toFixed(1) + ' oltre il massimo ' + u.hpMax);
    const p = u.mesh.position;
    if(!__fin(p.x) || !__fin(p.y) || !__fin(p.z)) bad.push(u.kind + ': posizione NaN');
    if(!u.from || !u.to) bad.push(u.kind + ': senza casella');
    if(u.job){
      if(!isMine(u.job) || jobsOf(u.job) <= 0) bad.push(u.kind + ': lavora su una casella che non è un tuo edificio con posti (' + u.job.building + ')');
      onJob.set(u.job, (onJob.get(u.job) || 0) + 1);
    }
    // portatore che insegue un cantiere già chiuso: tollerato per poco,
    // il cervello si riallinea al prossimo ragionamento
    const orphan = !u.job && u.site && !u.site.site && (u.mode === 'fetch' || u.mode === 'deliver');
    if(orphan){
      const n = (__stale.get(u) || 0) + 1; __stale.set(u, n);
      if(n > 3) bad.push(u.kind + ': porta blocchi a un cantiere chiuso da ' + n + ' tick');
    } else __stale.delete(u);
  }
  for(const [t, n] of onJob)
    if(n > (t.workers || 0)) bad.push(BUILDINGS[t.building].name + ': ' + n + ' coloni al lavoro ma ' + (t.workers || 0) + ' addetti assegnati');

  for(const t of tiles){
    if(t.site){
      if(t.building !== t.site.kind) bad.push('cantiere di ' + t.site.kind + ' su una casella con ' + t.building);
      if(!t.owner) bad.push('cantiere di ' + t.site.kind + ' senza proprietario');
      if(t.site.have > t.site.need) bad.push('cantiere di ' + t.site.kind + ': ' + t.site.have + '/' + t.site.need + ' blocchi');
      if(t.owner === 'you'){
        const was = __progress.get(t);
        if(!was || was.have !== t.site.have) __progress.set(t, {have: t.site.have, since: __tick});
        else if(__tick - was.since === 240) warn.push('cantiere di ' + BUILDINGS[t.site.kind].name + ' fermo a ' + t.site.have + '/' + t.site.need + ' da 240 tick');
      }
    } else __progress.delete(t);
    if(isMine(t) && t.building){
      const j = jobsOf(t), w = t.workers || 0;
      if(w < 0 || w > j) bad.push(BUILDINGS[t.building].name + ': ' + w + ' addetti su ' + j + ' posti');
    }
    if(t.building && !BUILDINGS[t.building]) bad.push('edificio sconosciuto: ' + t.building);
  }
  // prenotazioni: il contatore di ogni cantiere e letto coincide con chi l'ha presa,
  // e nessun cantiere ha più blocchi prenotati di quanti gliene mancano
  const claims = new Map(), beds = new Map();
  for(const u of units){
    if(u.claimed) claims.set(u.claimed, (claims.get(u.claimed) || 0) + 1);
    if(u.bed) beds.set(u.bed, (beds.get(u.bed) || 0) + 1);
    if(hasNeeds(u) && (!u.name || !Array.isArray(u.traits) || !u.skills)) bad.push(u.kind + ': civile senza nome, tratti o abilità');
    for(const k in u.skills || {})
      if(!__fin(u.skills[k]) || u.skills[k] < 0 || !SKILLS[k]) bad.push(u.kind + ': abilità ' + k + ' = ' + u.skills[k]);
    for(const id of u.traits || []) if(!PERSON_TRAITS[id]) bad.push(u.kind + ': tratto sconosciuto ' + id);
    if(u.needs) for(const k of ['food','rest','mood'])
      if(!__fin(u.needs[k]) || u.needs[k] < 0 || u.needs[k] > 1) bad.push(u.kind + ': bisogno ' + k + ' = ' + u.needs[k]);
  }
  for(const t of tiles){
    if(t.site && t.owner === 'you'){
      const c = t.site.claims || 0, n = claims.get(t.site) || 0;
      if(c !== n) bad.push('cantiere di ' + t.site.kind + ': ' + c + ' prenotazioni segnate, ' + n + ' coloni le tengono');
      if(c > t.site.need - t.site.have) bad.push('cantiere di ' + t.site.kind + ': ' + c + ' blocchi prenotati ma ne mancano ' + (t.site.need - t.site.have));
    }
    const s = t.sleepers || 0, b = beds.get(t) || 0;
    if(s !== b) bad.push('letti su ' + (t.building || 'casella vuota') + ': ' + s + ' segnati, ' + b + ' coloni li tengono');
    if(t.building && isMine(t) && b > housesOf(t)) bad.push(BUILDINGS[t.building].name + ': ' + b + ' coloni a letto su ' + housesOf(t) + ' posti');
  }
  if(assignedTotal() > workforce()) bad.push('addetti assegnati ' + assignedTotal() + ' oltre le braccia disponibili ' + workforce());

  return bad.map(m => ({level: 'errore', tick: __tick, msg: m}))
    .concat(warn.map(m => ({level: 'avviso', tick: __tick, msg: m})));
}

function __trace(){
  const acts = {}, n = {food:0, rest:0, mood:0}; let k = 0;
  for(const u of units){
    if(!hasNeeds(u)) continue;
    const a = u.act || '-'; acts[a] = (acts[a] || 0) + 1;
    if(u.needs){ n.food += u.needs.food; n.rest += u.needs.rest; n.mood += u.needs.mood; k++; }
  }
  const pct = v => k ? Math.round(100 * v / k) + '%' : '-';
  return 't' + __tick + ' ' + (nightOn ? 'notte' : 'giorno') + ' · ' +
    Object.entries(acts).sort((a, b) => b[1] - a[1]).map(([a, c]) => a + ' ' + c).join(', ') +
    ' · sazi ' + pct(n.food) + ' riposati ' + pct(n.rest) + ' umore ' + pct(n.mood) +
    ' · esperienza media ' + Math.round(units.filter(u => u.skills && u.job).reduce((s, u) => s + (skillMul(u, skillKey(u.job)) - 1), 0) /
      Math.max(1, units.filter(u => u.skills && u.job).length) * 100) + '%' +
    ' · cibo ' + Math.round(res.food) + ' mat ' + Math.round(res.mat) + ' en ' + Math.round(res.pow) +
    (typeof govLast !== 'undefined' && govLast ? ' · gov ' + govLast.map(p => p.action + ' ' + p.score.toFixed(2)).join(' ') : '') +
    ' · cantieri ' +
    tiles.filter(t => t.site && t.owner === 'you').map(t => t.site.have + '/' + t.site.need).join(' ');
}

function __summary(){
  const d = demography();
  return {
    tick: __tick, gameOver, pop, demo: d,
    res: {food: Math.round(res.food), mat: Math.round(res.mat), pow: Math.round(res.pow)}, cap: capacity(),
    tech, buildings: playerBuildings().length, sites: tiles.filter(t => t.site && t.owner === 'you').length,
    raids: raidNo, units: units.length,
    clans: settlements.map(s => s.name + ' ' + s.relation).join(', '),
    // stato esatto, per l'impronta: nessun arrotondamento
    exact: JSON.stringify([res, sci, worldAge, units.map(u => u.kind + ':' + u.hp + ':' + u.from.id + ':' + u.mode),
      tiles.filter(t => t.building).map(t => t.id + t.building + t.owner + t.hp + (t.workers || 0) + (t.site ? t.site.have : ''))])
  };
}
`;

function runScenario(sc) {
  const game = loadGame({ seed: sc.seed });
  game.run(DRIVER);
  const issues = [], traces = [];
  let crashed = null;
  const t0 = Date.now();
  try {
    game.run(`__setup(${sc.world}, ${sc.seed}, ${sc.auto})`);
    const dt = 1 / FPS;
    for (let f = 0; f < TICKS * FPS; f++) {
      issues.push(...game.run(`__frame(${dt})`));
      if (TRACE && f % (TRACE * FPS) === 0) traces.push(game.run('__trace()'));
      // a metà partita: salva, ricarica dal salvataggio e continua da lì
      if (sc.reload && f === Math.floor(TICKS * FPS / 2)) {
        const state = 'JSON.stringify([myPeople().length, units.filter(u=>u.needs).length, Math.round(res.food), ' +
          'units.filter(u=>u.name).map(u=>u.name+(u.traits||[]).join("")+Math.round(Object.values(u.skills||{}).reduce((a,b)=>a+b,0))).sort().join()])';
        const before = game.run(state);
        game.run('saveGame(true); loadGame(); __stale.clear(); __progress.clear();');
        const after = game.run(state);
        if (before !== after) issues.push({ level: 'errore', tick: game.run('__tick'),
          msg: 'dopo il caricamento coloni, bisogni, cibo, nomi, tratti o abilità sono cambiati' });
      }
      if (game.failures.length) break;
      if (game.run('gameOver')) break;
    }
  } catch (e) {
    crashed = e;
  }
  const summary = game.run('__summary()');
  if (sc.survive && summary.gameOver)
    issues.push({ level: 'errore', tick: summary.tick, msg: 'la colonia si è estinta col governatore attivo' });
  return { sc, issues, crashed, failures: game.failures, summary, toasts: game.toasts, traces, ms: Date.now() - t0 };
}

function report(r) {
  const sc = r.sc, s = r.summary;
  const errors = r.issues.filter(i => i.level === 'errore');
  const warns = r.issues.filter(i => i.level === 'avviso');
  const ok = !r.crashed && !r.failures.length && !errors.length;
  // impronta della partita: con lo stesso seme, un refactor che non cambia
  // il comportamento deve lasciarla identica
  const print = s ? createHash('sha1').update(s.exact + '\n' + r.toasts.join('\n')).digest('hex').slice(0, 10) : '-';
  console.log(`${ok ? '✓' : '✗'} ${sc.name}  (seme ${sc.seed}, ${(r.ms / 1000).toFixed(1)} s, impronta ${print})`);
  if (s) console.log(`   tick ${s.tick}${s.gameOver ? ' · COLONIA PERDUTA' : ''} · coloni ${s.pop} ` +
    `(${s.demo.child}b/${s.demo.adult}a/${s.demo.elder}v) · cibo ${s.res.food} mat ${s.res.mat} en ${s.res.pow} / ${s.cap}` +
    ` · edifici ${s.buildings} · cantieri ${s.sites} · ricerca ${s.tech} · incursioni ${s.raids}` +
    (s.clans ? ` · ${s.clans}` : ''));
  if (r.crashed) console.log('   ECCEZIONE: ' + r.crashed.split('\n').slice(0, 4).join('\n     '));
  for (const f of r.failures) console.log('   fail(): ' + f.split('\n')[0]);
  // lo stesso errore ripetuto a ogni tick si stampa una volta sola, col primo tick
  const seen = new Map();
  for (const i of [...errors, ...warns]) {
    const key = i.level + i.msg.replace(/[\d.]+/g, '#');
    if (!seen.has(key)) seen.set(key, { ...i, n: 0 });
    seen.get(key).n++;
  }
  for (const i of seen.values())
    console.log(`   ${i.level === 'errore' ? '✗' : '!'} tick ${i.tick}: ${i.msg}${i.n > 1 ? `  (×${i.n})` : ''}`);
  for (const t of r.traces || []) console.log('   ' + t);
  if (VERBOSE) for (const t of r.toasts) console.log('     · ' + t);
  return ok;
}

// processo figlio: un solo scenario, risultato in JSON su stdout
const one = arg('one', null);
if (one !== null) {
  const r = runScenario(SCENARIOS[+one]);
  r.crashed = r.crashed ? String(r.crashed.stack || r.crashed) : null;
  process.stdout.write(JSON.stringify(r));
  process.exit(0);
}

const self = fileURLToPath(import.meta.url);
const picked = SCENARIOS.map((sc, i) => ({ sc, i })).filter(x => x.sc.name.includes(ONLY));
if (!picked.length) { console.log('Nessuno scenario contiene «' + ONLY + '».'); process.exit(1); }
const t0 = Date.now();
const results = await Promise.all(picked.map(({ sc, i }) => new Promise(done => {
  const child = spawn(process.execPath, [self, '--one', String(i), '--ticks', String(TICKS), '--trace', String(TRACE)]);
  let out = '', err = '';
  child.stdout.on('data', d => out += d);
  child.stderr.on('data', d => err += d);
  child.on('close', code => {
    try { done(JSON.parse(out)); }
    catch { done({ sc, issues: [], failures: [], toasts: [], ms: Date.now() - t0,
                   crashed: 'il processo è uscito con codice ' + code + '\n' + err }); }
  });
})));
const failed = results.filter(r => !report(r)).length;
console.log((failed ? `\n${failed} scenari falliti` : '\nTutti gli scenari sono passati') +
  ` · ${TICKS} tick · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
