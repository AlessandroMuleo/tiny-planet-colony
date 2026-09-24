/* ═══════════════════════════════════════════════════════════════
   COLONIA — pianeta minuscolo
   Geosfera, logistica a blocchi, stagioni, ricerca, popoli rivali.
   ═══════════════════════════════════════════════════════════════ */

function fail(msg){
  const box=document.getElementById('err');
  box.innerHTML='<b>Qualcosa si è rotto.</b>'+msg;
  box.classList.add('on');
}

const R = 14, SUBDIV = 11, SKIRT = 1.8;   // 10·11²+2 = 1212 caselle
const USE = 0.15, DRIP = 0.5;
const FOOD_DRIP = 1.0;   // il cibo ha un rifornimento doppio: 1 al tick
const WALL_COST = 14;    // quanti passi di deviazione vale sfondare un muro

/* ── ciclo di vita, in tick (1 tick = 1 s a velocità 1×) ─────── */
const AGES = {
  child: {until:45,  eat:0.25, work:0,   scale:0.62, label:'bambino'},
  adult: {until:260, eat:0.45, work:1,   scale:1.00, label:'adulto'},
  elder: {until:340, eat:0.35, work:0.7, scale:0.86, label:'anziano'}
};
const stageAt = age => age<AGES.child.until ? 'child' : age<AGES.adult.until ? 'adult' : 'elder';
const WOUND_AT = 0.4;          // sotto il 40% di salute un colono è ferito
const SELF_HEAL = 0.06;        // guarigione senza ospedale, per tick
const BASE_STORE = 140;

/* ── stagioni ─────────────────────────────────────────────────── */
const SEASONS = [
  {name:'primavera', food:1.15, tint:0x7fbf5e},
  {name:'estate',    food:1.00, tint:0x74b45c},
  {name:'autunno',   food:1.10, tint:0xa3a04a},
  {name:'inverno',   food:0.55, tint:0xbcc6cf}
];
const SEASON_LEN = 55;   // tick per stagione

