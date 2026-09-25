/* ── campo di distanze: una BFS per obiettivo, riusata da tutti ──
   Il vecchio metodo goloso sceglieva il vicino più vicino "in linea d'aria":
   davanti a un golfo o a una catena montuosa entrava in stallo e il colono
   rimbalzava avanti e indietro all'infinito. Questo invece è esatto.        */
let fieldCache=new Map(), foeCache=new Map();
function bumpWalk(){ fieldCache.clear(); foeCache.clear(); }
/* Entrambi sono una Dijkstra a costi interi. Per i tuoi coloni un passo
   costa STEP_COST, e ROAD_COST su una strada finita: conoscono le strade
   e le preferiscono quando il giro in più si ripaga (ci si cammina 1,6
   volte più in fretta). Per i nemici un passo costa 1 e le mura sono
   percorribili ma carissime (WALL_COST passi): così aggirano la cinta
   se il giro vale meno di sfondarla, e sfondano solo quando il muro è
   davvero la via più breve — cioè quando la cinta è chiusa.           */
const STEP_COST=3, ROAD_COST=2;
const onRoad = t => hasFlag(t,'road')&&!t.site;
function distField(goal,foe){
  const cache = foe?foeCache:fieldCache;
  let f=cache.get(goal.id);
  if(f) return f;
  // ogni posto di lavoro e cantiere ha il suo campo: 160 × 1.212 caselle ≈ 0,8 MB
  if(cache.size>160) cache.clear();
  f=new Int32Array(tiles.length).fill(-1);
  {
    const cost = foe ? t=>blocksFoe(t)?WALL_COST:1 : t=>onRoad(t)?ROAD_COST:STEP_COST;
    // coda a bucket: i costi sono interi piccoli, niente heap
    const INF=0x3fffffff, dist=new Int32Array(tiles.length).fill(INF);
    const maxD=tiles.length*(Math.max(WALL_COST,STEP_COST)+1)+2;
    const buckets=[];
    const put=(id,d)=>{ (buckets[d]||(buckets[d]=[])).push(id); };
    dist[goal.id]=0; put(goal.id,0);
    for(let d=0; d<=maxD&&d<buckets.length; d++){
      const b=buckets[d];
      if(!b) continue;
      buckets[d]=null;
      for(const cur of b){
        if(dist[cur]!==d) continue;
        for(const n of tiles[cur].neighbors){
          const t=tiles[n];
          if(!walkable(t)) continue;
          const nd=d+cost(t);
          if(nd<dist[n]){ dist[n]=nd; put(n,nd); }
        }
      }
    }
    for(let i=0;i<tiles.length;i++) f[i]=dist[i]===INF?-1:dist[i];
  }
  cache.set(goal.id,f);
  return f;
}
const reachable=(from,goal)=>!!goal&&distField(goal)[from.id]>=0;

/* avoid(t): quanto il colono vuole evitare la casella (i luoghi che teme).
   Tra i vicini che accorciano la strada si prende quello che teme meno:
   non allunga mai il percorso, ma dove ci sono due vie aggira il ricordo */
function stepToward(from,goal,fly,foe,avoid){
  if(fly){
    let best=from, bd=from.center.dot(goal.center);
    for(const n of from.neighbors){
      const d=tiles[n].center.dot(goal.center);
      if(d>bd){ bd=d; best=tiles[n]; }
    }
    return best;
  }
  const f=distField(goal,foe), here=f[from.id];
  if(here<0){   // obiettivo irraggiungibile via terra: resta dov'è
    return from;
  }
  let best=from, bd=here, bf=Infinity;
  for(const n of from.neighbors){
    const d=f[n];
    if(d<0||d>=here) continue;
    if(avoid){
      // vale anche un passo un po' più lungo, se si allontana dal ricordo
      const fear=avoid(tiles[n]), key=d+fear*STEP_COST;
      if(key<bf||(key===bf&&d<bd)){ bf=key; bd=d; best=tiles[n]; }
    } else if(d<bd){ bd=d; best=tiles[n]; }
  }
  return best;
}
function nearestTile(from,test){
  let best=null,bd=-2;
  for(const t of tiles){
    if(!test(t)) continue;
    const d=from.center.dot(t.center);
    if(d>bd){ bd=d; best=t; }
  }
  return best;
}
function hostile(a,b){
  if(a.faction===b.faction) return false;
  if(a.faction==='raider'||b.faction==='raider') return true;
  // due clan in guerra tra loro si combattono (gli emissari non combattono)
  if(a.faction==='rival'&&b.faction==='rival') return !!(a.settlement&&b.settlement&&atWar(a.settlement,b.settlement));
  const set=a.faction==='rival'?a.settlement:b.settlement;
  return !!set&&set.relation==='ostile';
}
function nearestFoeUnit(u,wide){
  let best=null,bd=1e9;
  for(const o of nearbyUnits(u.from,wide!==false)){
    if(!hostile(u,o)||o.state==='landing') continue;
    const d=u.mesh.position.distanceToSquared(o.mesh.position);
    if(d<bd){ bd=d; best=o; }
  }
  return best;
}
/* ── cache di frame ────────────────────────────────────────────
   Prima ogni unità scandiva tutte le 1212 caselle a ogni fotogramma per
   trovare magazzino, cantiere o nemico: con 90 coloni erano ~27 milioni di
   operazioni al secondo. Ora le liste si costruiscono UNA volta per frame
   e i nemici si cercano solo nelle caselle adiacenti.               */
const FC={mine:[],storage:[],sites:[],turrets:[],rtowers:[],defense:[],walls:[],rivalB:[],
          raiders:[],beds:[],bucket:new Map()};
function rebuildFrameCache(){
  FC.mine.length=0; FC.storage.length=0; FC.sites.length=0; FC.turrets.length=0;
  FC.rtowers.length=0; FC.defense.length=0; FC.beds.length=0; FC.walls.length=0; FC.rivalB.length=0;
  for(const t of tiles){
    if(t.site&&t.owner==='you'){ FC.sites.push(t); continue; }
    if(!t.building) continue;
    if(t.settlement&&BUILDINGS[t.building].dps) FC.rtowers.push(t);
    if(t.owner==='rival') FC.rivalB.push(t);
    if(t.owner!=='you') continue;
    FC.mine.push(t);
    if(BUILDINGS[t.building].wall) FC.walls.push(t);
    if(storeOf(t)>0) FC.storage.push(t);
    if(housesOf(t)>0) FC.beds.push(t);
    if(BUILDINGS[t.building].dps) FC.turrets.push(t);
    if(BUILDINGS[t.building].guard) FC.defense.push(t);
  }
  FC.raiders.length=0;
  FC.bucket.clear();
  for(const u of units){
    if(u.faction==='raider') FC.raiders.push(u);
    let a=FC.bucket.get(u.from.id);
    if(!a){ a=[]; FC.bucket.set(u.from.id,a); }
    a.push(u);
  }
  // C'è qualcuno con cui combattere? Solo predoni, clan ostili o clan in guerra
  // tra loro. Senza, la ricerca di nemici intorno a ogni colono (centinaia di
  // ricerche a fotogramma) è lavoro sprecato: era un quinto del tempo di gioco.
  FC.danger = FC.raiders.length>0 || settlements.some(s=>!settled(s)&&
    (s.relation==='ostile'||settlements.some(o=>atWar(s,o))));
}
function nearestOf(from,list,filter){
  let best=null,bd=-2;
  for(const t of list){
    if(filter&&!filter(t)) continue;
    const d=from.center.dot(t.center);
    if(d>bd){ bd=d; best=t; }
  }
  return best;
}
/* unità nelle vicinanze: casella propria + anello di vicini (due per gli arcieri) */
let _stamp=0;
function nearbyUnits(tile,wide){
  const out=[]; _stamp++;
  const add=id=>{
    const a=FC.bucket.get(id); if(!a) return;
    for(const u of a) if(u._s!==_stamp){ u._s=_stamp; out.push(u); }
  };
  add(tile.id);
  for(const n of tile.neighbors){
    add(n);
    if(wide) for(const m of tiles[n].neighbors) add(m);
  }
  return out;
}

const nearestStorage = from =>
     nearestOf(from,FC.storage,t=>reachable(from,t))
  || nearestOf(from,FC.mine,t=>reachable(from,t))
  || nearestOf(from,FC.mine);
/* FC.sites è la fotografia di inizio fotogramma: un cantiere può essersi
   completato (o essere stato demolito) subito dopo. Chi la usa deve sempre
   riverificare t.site, altrimenti si legge da null — è lo stesso errore che
   aveva già colpito structureTick.                                       */
const openSites = () => FC.sites.filter(t=>t.site);
const reachableSites = from => FC.sites.filter(t=>t.site&&reachable(from,t));

/* ═══════════════ logistica: chi porta cosa, e dove ═══════════ */
