/* Quanto è lontano un punto dal magazzino più vicino, in passi reali.
   Serve a non aprire cantieri dall'altra parte del continente. */
function haulSteps(t){
  const st=nearestOf(t,FC.storage);
  if(!st) return 99;
  const d=distField(st)[t.id];
  return d<0?99:d;
}
function autoThink(){
  const r=rates();
  if(idleCount()>0){
    const open=workedTiles().filter(t=>(t.workers||0)<jobsOf(t));
    const pref=r.food<0.6?['farm','fishery','mine','lab','plant','armory']
             : raidActive?['armory','farm','fishery','mine','plant','lab']
                         :['farm','fishery','mine','plant','lab','armory','fort'];
    open.sort((a,b)=>pref.indexOf(a.building)-pref.indexOf(b.building));
    for(const t of open)
      while((t.workers||0)<jobsOf(t)&&idleCount()>0) t.workers++;
    syncJobs();
  }

  const have=k=>tiles.filter(t=>(isMine(t)||t.site)&&(t.building===k)).length;
  let want=null;
  if(r.food<0.4) want='farm';
  else if(pop>=r.houses-1) want = res.mat>60 ? 'block' : 'hut';
  else if(have('mine')===0) want='mine';
  else if(r.pow<0.3) want='plant';
  else if(res.mat>capacity()*0.85) want='depot';
  else if(have('armory')===0&&worldIndex>1) want='armory';
  else if(myPeople().some(u=>u.wounded)&&have('clinic')===0) want='clinic';
  else if(have('turret')<1+Math.floor(raidNo/3)) want='turret';
  else if(have('lab')===0&&res.mat>110) want='lab';
  else if(have('shrine')===0&&res.mat>120) want='shrine';
  else if(have('fort')===0&&res.mat>160) want='fort';
  else if(have('market')===0&&settlements.some(s=>s.relation==='alleato')) want='market';
  else if(have('green')===0&&SEASONS[season].food<0.8&&res.mat>90) want='green';
  else if(have('workshop')===0&&res.food>capacity()*0.6) want='workshop';
  else if(have('wall')<Math.min(8,Math.floor(pop/3))) want='wall';
  else if(r.food<1.2) want='farm';
  else if(idleCount()>0) want='mine';

  // non apre più cantieri di quanti la manodopera ne possa servire
  const maxSites=Math.max(1,Math.min(3,Math.floor(workforce()/4)));
  if(want&&openSites().length<maxSites){
    const B=BUILDINGS[want];
    // taglia scelta in base a quanto è ricca e popolosa la colonia
    let sz=1;
    if(B.jobs>0||B.houses){
      if(res.mat>(B.cost.mat||0)*4&&pop>14) sz=3;
      else if(res.mat>(B.cost.mat||0)*2.5&&pop>8) sz=2;
    }
    while(sz>1&&(res.mat<(B.cost.mat||0)*sz||res.pow<(B.cost.pow||0)*sz)) sz--;
    if(res.mat>=(B.cost.mat||0)*sz&&res.pow>=(B.cost.pow||0)*sz){
      const spot=pickSpot(want,sz);
      if(spot){
        res.mat-=(B.cost.mat||0)*sz; res.pow-=(B.cost.pow||0)*sz;
        startSite(spot,want,'you',sz);
      }
    }
  }
  // se un deposito è troppo lontano dai cantieri, ne piazza uno in mezzo
  if(!openSites().length&&FC.mine.length>6&&res.mat>60){
    const far=FC.mine.filter(t=>BUILDINGS[t.building].ships&&haulSteps(t)>6);
    if(far.length>=2&&!tiles.some(t=>t.site&&t.site.kind==='depot')){
      const spot=pickSpot('depot',1);
      if(spot&&res.mat>=BUILDINGS.depot.cost.mat){
        res.mat-=BUILDINGS.depot.cost.mat;
        startSite(spot,'depot','you',1);
      }
    }
  }
  for(const s of settlements) if(canAlly(s)&&res.mat>110) allyWith(s);
}
/* Prima sceglieva a caso tra le caselle confinanti, e la colonia si sfilacciava.
   Ora ogni candidata riceve un punteggio: quanti tuoi edifici tocca, quanto è
   vicina al centro della colonia, e un bonus se è servita da una strada.
   Le mura fanno il contrario: le vuoi sul bordo, non in mezzo alle case.    */
function colonyCenter(){
  const mine=playerBuildings();
  if(!mine.length) return null;
  const c=new THREE.Vector3();
  for(const t of mine) c.add(t.center);
  return c.normalize();
}
function pickSpot(kind,size){
  size=size||1;
  const B=BUILDINGS[kind];
  const ok=t=>tileAllows(t,kind,size);
  const mine=playerBuildings();
  if(!mine.length){ const any=tiles.filter(ok); return any.length?any[0]:null; }
  const centre=colonyCenter();
  const own=new Set(mine.map(t=>t.id));

  let best=null, bestScore=-1e9;
  for(const t of tiles){
    if(!ok(t)) continue;
    let adj=0, road=0;
    for(const n of t.neighbors){
      if(own.has(n)) adj++;
      if(hasFlag(tiles[n],'road')) road++;
    }
    if(adj===0) continue;                       // mai staccata dalla colonia
    const near=t.center.dot(centre);            // 1 = cuore della colonia
    // penalizza i posti lontani dal magazzino: i blocchi vanno portati a piedi
    const haul = B.blocks ? Math.min(12,haulSteps(t)) : 0;
    let score = B.wall ? (6-adj)*2 + (1-near)*8
                       : adj*3 + near*10 + road*1.5 - haul*0.9;
    score += Math.random()*0.8;                 // rompe i pareggi senza sparpagliare
    if(score>bestScore){ bestScore=score; best=t; }
  }
  if(best) return best;
  const any=tiles.filter(ok).sort((a,b)=>b.center.dot(centre)-a.center.dot(centre));
  return any[0]||null;
}

/* ═══════════════ interfaccia ═══════════════ */
