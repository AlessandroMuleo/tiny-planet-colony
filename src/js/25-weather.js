/* ═══════════════ meteo e difficoltà ═══════════════ */

/* ── meteo ───────────────────────────────────────────────────────────
   Sopra le stagioni c'è il tempo che fa, e cambia ogni 80–180 secondi.
   Ogni tipo di tempo ha una conseguenza che chiede una risposta:
   · temporale: i campi rendono di più, ma cadono fulmini sugli edifici
     (un parafulmine è una torre di segnalazione: li attira lei);
   · siccità: i campi rendono il 30% in meno, tranne vicino a un pozzo;
   · nebbia: le torrette vedono meno lontano e la torre non avvista le navette. */
const WEATHER = {
  sereno:   {label:'sereno'},
  temporale:{label:'temporale', food:1.15, bolts:0.05, light:0.55, mood:-0.04},
  siccita:  {label:'siccità',   food:0.7,  light:1.12},
  nebbia:   {label:'nebbia',    fog:true,  turret:0.7, light:0.75}
};
/* pesi per stagione: d'estate la siccità, d'autunno i temporali, d'inverno la nebbia */
const WEATHER_ODDS = [
  {sereno:5, temporale:3, nebbia:1},
  {sereno:5, siccita:3, temporale:2},
  {sereno:3, temporale:3, nebbia:3},
  {sereno:4, nebbia:4, temporale:1}
];
let weather={kind:'sereno', t:120};
const weatherNow = () => WEATHER[weather.kind]||WEATHER.sereno;
/* quanto rende un campo col tempo di oggi: il pozzo salva dalla siccità */
/* il satellite meteo dimezza la perdita della siccità */
const weatherFood = t => weather.kind==='siccita' ? (wellNear(t)?1:orbitalOn('weathersat')?0.85:WEATHER.siccita.food) : (weatherNow().food||1);
const turretReach = () => weatherNow().turret||1;
function weatherTick(){
  if(--weather.t>0){ lightningTick(); return; }
  const odds=WEATHER_ODDS[season]||WEATHER_ODDS[0];
  const total=Object.values(odds).reduce((a,b)=>a+b,0);
  let r=Math.random()*total, kind='sereno';
  for(const k in odds){ r-=odds[k]; if(r<0){ kind=k; break; } }
  const was=weather.kind;
  weather={kind, t:80+Math.floor(Math.random()*100)};
  if(kind!==was) logEvent(kind==='sereno'?'☀ Torna il sereno.':
    kind==='temporale'?'⛈ Temporale: i campi ringraziano, ma attenti ai fulmini.':
    kind==='siccita'?'🌵 Siccità: i campi lontani dai pozzi rendono il 30% in meno.':
    '🌫 Nebbia: le torrette vedono meno lontano, la torre non avvista le navette.');
  applyWeather();
}
function lightningTick(){
  const W=weatherNow();
  if(!W.bolts||orbitalOn('weathersat')||Math.random()>W.bolts) return;   // il satellite scarica i fulmini in quota
  const mine=FC.mine.filter(isMine);
  if(!mine.length) return;
  // una torre di segnalazione fa da parafulmine: il colpo va a lei e non fa danni
  const rod=mine.find(t=>hasFlag(t,'watch'));
  const hit=rod||mine[Math.floor(Math.random()*mine.length)];
  boltFX(hit);
  if(rod){ toast('⚡ Un fulmine si scarica sulla torre di segnalazione.'); return; }
  const name=BUILDINGS[hit.building].name;
  damageBuilding(hit,12);
  toast('⚡ Un fulmine colpisce '+name+'.');
}
function boltFX(tile){
  const top=tile.center.clone().multiplyScalar(R+18), pts=[top];
  const end=surfacePos(tile,0.3);
  for(let i=1;i<7;i++){ const p=top.clone().lerp(end,i/7); p.x+=Math.random()*0.8-0.4; p.z+=Math.random()*0.8-0.4; pts.push(p); }
  pts.push(end);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:0xe6f0ff,transparent:true}));
  addFX(line,0.35,k=>{ line.material.opacity=k; });
}
/* nebbia e luce: la scena cambia col tempo (le luci del giorno le ricalcola stepDay) */
function applyWeather(){
  const want=!!weatherNow().fog;
  if(want===!!scene.fog) return;
  // la camera sta a ~36 dal centro: la faccia visibile del pianeta è tra 22 e 36
  scene.fog = want ? new THREE.Fog(0x8a97ad,16,42) : null;
  // i materiali già compilati non vedono la nebbia aggiunta dopo: vanno ricompilati
  scene.traverse(o=>{ if(o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); });
}

/* ── difficoltà ──────────────────────────────────────────────────────
   ?difficolta=facile | normale | difficile nell'indirizzo. Cambia la forza
   delle incursioni, quanto in fretta vengono fame e sonno, e le scorte
   iniziali.                                                            */
const DIFFICULTY = {
  facile:   {label:'facile',    raid:0.7,  needs:0.8, start:1.5},
  normale:  {label:'normale',   raid:1,    needs:1,   start:1},
  difficile:{label:'difficile', raid:1.35, needs:1.2, start:0.7}
};
let difficulty = DIFFICULTY[URLP.get('difficolta')] ? URLP.get('difficolta') : 'normale';
const diff = () => DIFFICULTY[difficulty]||DIFFICULTY.normale;
function startingRes(){
  const k=diff().start;
  return {food:Math.round(22*k), mat:Math.round(60*k), pow:12, bar:0};
}
