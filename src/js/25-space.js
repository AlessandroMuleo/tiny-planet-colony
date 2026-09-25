/* ═══════════════ spazio ═══════════════
   Le strutture orbitali si costruiscono, si migliorano fino al livello 3
   e a volte si spengono (tempesta solare). Quelle avanzate richiedono un
   Controllo missioni con addetti; l'Ascensore spaziale le rende più
   economiche e fa viaggiare le navette più in fretta.                  */

const orbitOf = k => orbit.find(o=>o.kind===k);
/* sotto una tempesta solare l'orbita resta buia: niente effetti, niente consumi */
let spaceOffline=0;
/* un orbitale funziona se è costruito, l'orbita non è spenta e (se consuma) c'è energia */
function orbitalOn(k){
  const o=orbitOf(k);
  if(!o||!o.built||spaceOffline>0) return false;
  return !ORBITALS[k].drain||res.pow>0;
}
/* quanto rende: 0 se spento, altrimenti il moltiplicatore del livello */
const orbMul = k => orbitalOn(k) ? ORBIT_LEVELS[(orbitOf(k).level||1)].mul : 0;
const hasElevator = () => activeFlag('elevator');

/* il costo di una struttura orbitale: ricerca e ascensore fanno sconto */
function orbitCost(k){
  const disc=(1-techSum('orbitCost'))*(hasElevator()?0.6:1), c={};
  for(const r in ORBITALS[k].cost) c[r]=Math.round(ORBITALS[k].cost[r]*disc);
  return c;
}
/* perché non si può (ancora) costruire: null se si può */
function orbitBlock(k){
  const O=ORBITALS[k];
  if(orbitOf(k)) return 'già in orbita';
  if(!O.hub&&!hasOrbital('station')) return 'serve prima la Stazione orbitale';
  if(O.advanced&&!activeFlag('control')) return 'serve un Controllo missioni con addetti';
  if(!canPay(orbitCost(k))) return 'servono '+costText(orbitCost(k));
  return null;
}
function buildOrbital(k){
  if(orbitBlock(k)) return;
  pay(orbitCost(k));
  addOrbital(k);
  toast(ORBITALS[k].name+': lancio in corso.');
  refreshHUD();
}
function upgradeCost(k){
  const o=orbitOf(k); if(!o||!o.built) return null;
  const next=ORBIT_LEVELS[(o.level||1)+1];
  return next?next.cost:null;
}
function upgradeOrbital(k){
  const c=upgradeCost(k);
  if(!c||!canPay(c)) return;
  pay(c);
  const o=orbitOf(k); o.level=(o.level||1)+1;
  o.mesh.scale.setScalar(1+0.15*(o.level-1));
  logEvent('🛰 '+ORBITALS[k].name+' migliorata al livello '+o.level+'.');
  refreshHUD();
}
/* un clic sulla carta del catalogo: costruisce, oppure migliora */
function orbitalAction(k){ if(orbitOf(k)) upgradeOrbital(k); else buildOrbital(k); }

/* ── scudo: abbatte parte di ogni navetta prima che atterri ── */
function shieldCut(n){
  const m=orbMul('shield');
  if(!m||n<=1) return n;
  const cut=Math.min(n-1,Math.round(n*Math.min(0.8,ORBITALS.shield.cut*m)));
  if(cut>0){
    achFlags.shielded=true;
    logEvent('🛡 Lo scudo orbitale colpisce la navetta: '+cut+(cut===1?' predone in meno.':' predoni in meno.'));
  }
  return n-cut;
}

/* ── telescopio: prevede dove atterrerà la prossima navetta ── */
let raidSite=null;
function telescopeTick(){
  if(raidActive||!orbMul('telescope')||raidSite||raidIn>30) return;
  const spots=tiles.filter(t=>!t.building&&BIOMES[t.biome].build);
  if(!spots.length) return;
  raidSite=spots[Math.floor(Math.random()*spots.length)];
  markLaunch(raidSite);
  logEvent('🔭 Il telescopio ha calcolato la rotta: la navetta atterrerà tra '+raidIn+' secondi, vicino a '+
    (raidSite.center.dot((colonyCenter()||raidSite.center))>0.9?'la colonia!':'un punto lontano.'));
}

/* ── raccoglitore di asteroidi: ogni tanto una capsula cade vicino a un magazzino ── */
let minerT=0;
function minerTick(){
  const m=orbMul('miner');
  if(!m) return;
  minerT+=hasElevator()?2:1;
  if(minerT<ORBITALS.miner.every) return;
  minerT=0;
  const st=FC.storage.find(isMine)||FC.mine.find(isMine);
  if(!st) return;
  const bars=Math.round(ORBITALS.miner.bars*m), mat=Math.round(ORBITALS.miner.mat*m);
  capsuleFX(st,()=>{
    const cap=capacity();
    res.bar=Math.min(cap,(res.bar||0)+bars); res.mat=Math.min(cap,res.mat+mat);
    achFlags.asteroid=true;
    toast('☄ Capsula dagli asteroidi: +'+bars+' lingotti, +'+mat+' materiali.'); refreshHUD();
  });
}
/* una capsula che scende dall'orbita col paracadute */
function capsuleFX(tile,onLand){
  const sky=tile.center.clone().multiplyScalar(R+20), ground=surfacePos(tile,0.3);
  const g=new THREE.Group();
  const pod=new THREE.Mesh(new THREE.ConeGeometry(.22,.4,8),mat(0xd9a441)); g.add(pod);
  const chute=new THREE.Mesh(new THREE.SphereGeometry(.4,8,5,0,Math.PI*2,0,Math.PI/2),mat(0xff7a3c));
  chute.position.y=.7; g.add(chute);
  g.quaternion.setFromUnitVectors(UP,tile.center);
  g.position.copy(sky);
  addFX(g,3,k=>{ const p=1-k; g.position.lerpVectors(sky,ground,Math.min(1,p*1.1)); chute.visible=p>0.4; },onLand);
}

/* ── tempesta solare: l'orbita si spegne per un po', lo scudo la protegge ── */
function solarFlare(){
  if(!orbit.some(o=>o.built)) return false;
  if(orbitalOn('shield')){ logEvent('☀ Tempesta solare: lo scudo orbitale ha protetto le strutture in orbita.'); return; }
  spaceOffline=35;
  logEvent('☀ Tempesta solare: le strutture orbitali sono fuori uso per 35 secondi.');
}
function spaceTick(){
  if(spaceOffline>0&&--spaceOffline===0) logEvent('Le strutture orbitali tornano operative.');
  telescopeTick(); minerTick();
}

/* ── il governatore in orbita: una decisione per volta, e solo con scorte abbondanti ── */
function govOrbit(c){
  if(!hasOrbital('station')&&res.mat<200&&!orbitOf('station')) return;
  const bad=weather.kind==='temporale'||weather.kind==='siccita';
  const want={
    station:1, cannon:c.threat*0.9, shield:c.threat*1.1, eye:c.threat*0.5,
    mirror:c.winter?0.7:0.3, telescope:researchLeft()?0.7:0.2, miner:c.wantBars?0.9:0.35,
    weathersat:bad?0.6:0.25, habitat:c.freeBeds<3?0.75:0.15, moonbase:0.45
  };
  let best=null, bs=0;
  for(const k in want){
    if(orbitBlock(k)) continue;
    // si lancia solo se dopo restano scorte: l'orbita è un lusso, non un bisogno
    const cost=orbitCost(k);
    if(!canPay(cost,1.6)) continue;
    if(want[k]>bs){ bs=want[k]; best=k; }
  }
  if(best&&bs>=0.3){ buildOrbital(best); return; }
  // altrimenti migliora quella che serve di più
  for(const k of Object.keys(want).sort((a,b)=>want[b]-want[a])){
    const u=upgradeCost(k);
    if(u&&canPay(u,2)&&want[k]>=0.4){ upgradeOrbital(k); return; }
  }
}
