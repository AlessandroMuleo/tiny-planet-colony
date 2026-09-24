/* ── campo di distanze: una BFS per obiettivo, riusata da tutti ──
   Il vecchio metodo goloso sceglieva il vicino più vicino "in linea d'aria":
   davanti a un golfo o a una catena montuosa entrava in stallo e il colono
   rimbalzava avanti e indietro all'infinito. Questo invece è esatto.        */
let fieldCache=new Map(), foeCache=new Map();
function bumpWalk(){ fieldCache.clear(); foeCache.clear(); }
/* Per i tuoi coloni è una BFS semplice. Per i nemici è invece una Dijkstra
   con le mura percorribili ma carissime (WALL_COST passi): così aggirano
   la cinta se il giro vale meno di sfondarla, e sfondano solo quando il
   muro è davvero la via più breve — cioè quando la cinta è chiusa.     */
function distField(goal,foe){
  const cache = foe?foeCache:fieldCache;
  let f=cache.get(goal.id);
  if(f) return f;
  if(cache.size>40) cache.clear();
  f=new Int32Array(tiles.length).fill(-1);
  if(!foe){
    f[goal.id]=0;
    const q=[goal.id];
    for(let h=0;h<q.length;h++){
      const cur=q[h], d=f[cur];
      for(const n of tiles[cur].neighbors){
        if(f[n]!==-1||!walkable(tiles[n])) continue;
        f[n]=d+1; q.push(n);
      }
    }
  } else {
    // coda a bucket: i costi sono interi piccoli, niente heap
    const INF=0x3fffffff, dist=new Int32Array(tiles.length).fill(INF);
    const maxD=tiles.length*(WALL_COST+1)+2;
    const buckets=new Map();
    const put=(id,d)=>{ let b=buckets.get(d); if(!b){b=[];buckets.set(d,b);} b.push(id); };
    dist[goal.id]=0; put(goal.id,0);
    for(let d=0; d<=maxD; d++){
      const b=buckets.get(d);
      if(!b) continue;
      buckets.delete(d);
      for(const cur of b){
        if(dist[cur]!==d) continue;
        for(const n of tiles[cur].neighbors){
          const t=tiles[n];
          if(!walkable(t)) continue;
          const nd=d+(blocksFoe(t)?WALL_COST:1);
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

function stepToward(from,goal,fly,foe){
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
  let best=from, bd=here;
  for(const n of from.neighbors){
    const d=f[n];
    if(d>=0&&d<bd){ bd=d; best=tiles[n]; }
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
    if(t.building==='rtower'&&t.settlement) FC.rtowers.push(t);
    if(t.owner==='rival') FC.rivalB.push(t);
    if(t.owner!=='you') continue;
    FC.mine.push(t);
    if(BUILDINGS[t.building].wall) FC.walls.push(t);
    if(storeOf(t)>0) FC.storage.push(t);
    if(housesOf(t)>0) FC.beds.push(t);
    if(t.building==='turret') FC.turrets.push(t);
    if(t.building==='armory'||t.building==='shrine'||t.building==='fort'||
       t.building==='hut'||t.building==='block') FC.defense.push(t);
  }
  FC.raiders.length=0;
  FC.bucket.clear();
  for(const u of units){
    if(u.faction==='raider') FC.raiders.push(u);
    let a=FC.bucket.get(u.from.id);
    if(!a){ a=[]; FC.bucket.set(u.from.id,a); }
    a.push(u);
  }
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
