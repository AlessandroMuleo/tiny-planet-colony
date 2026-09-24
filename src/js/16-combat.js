function damageBuilding(tile,dmg){
  tile.hp-=dmg;
  if(tile.hp<=0) destroyBuilding(tile);
}
/* chi è al riparo nella roccaforte non viene colpito */
/* Insieme delle caselle protette, ricostruito UNA volta per frame.
   Controllarlo a ogni singolo colpo, come faceva la versione di Gemini,
   riportava decine di migliaia di distanze al frame in mischia.        */
const shelterTiles=new Set(), wallTiles=new Set();
function rebuildProtection(){
  shelterTiles.clear(); wallTiles.clear();
  for(const t of FC.mine){
    const B=BUILDINGS[t.building];
    if(B&&B.shelter){
      shelterTiles.add(t.id);
      for(const n of t.neighbors) shelterTiles.add(n);
    }
  }
  for(const t of FC.walls){
    wallTiles.add(t.id);
    for(const n of t.neighbors) wallTiles.add(n);
  }
}
const sheltered = u => u.faction==='you' &&
  (u.stage==='child'||u.wounded||u.kind==='thrall') && shelterTiles.has(u.from.id);
const behindWalls = u => u.faction==='you' && wallTiles.has(u.from.id);
function resolveCombat(dt){
  if(beams) beams.clear();
  rebuildProtection();
  for(const u of units){
    if(u.state==='landing') continue;
    const U=UNITS[u.kind], dmg=unitDamage(u);
    if(!dmg) continue;
    for(const o of nearbyUnits(u.from, U.range>1.5)){
      if(o.state==='landing'||!hostile(u,o)) continue;
      if(u.mesh.position.distanceTo(o.mesh.position)<U.range){
        if(sheltered(o)) continue;
        o.hp-=(u.faction!=='you'&&behindWalls(o)?dmg*0.6:dmg)*dt;   // 40% in meno dietro le mura
        if(U.range>2&&beams){
          const g=new THREE.BufferGeometry().setFromPoints([u.mesh.position.clone(),o.mesh.position.clone()]);
          beams.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x9fe3bd})));
        }
        break;
      }
    }
  }
  for(const u of units){
    if(u.state==='landing') continue;
    const t=u.from, dmg=unitDamage(u);
    if(!dmg||!t.building) continue;
    if(u.faction==='raider'&&(t.owner==='you'||t.owner==='rival')) damageBuilding(t,dmg*dt);
    else if(u.faction!=='you'&&t.owner==='you') damageBuilding(t,dmg*dt);
    // la mura che sbarra il passo successivo viene abbattuta
    if(u.faction!=='you'&&u.to&&u.to!==t&&blocksFoe(u.to)) damageBuilding(u.to,dmg*dt);
    if(u.faction==='you'&&t.owner==='rival'&&t.settlement&&t.settlement.relation==='ostile')
      damageBuilding(t,dmg*dt);
    if(u.faction==='rival'&&u.settlement&&t.settlement&&atWar(u.settlement,t.settlement))
      damageBuilding(t,dmg*dt);
  }
  for(const t of FC.turrets){
    if(res.pow<=0||!hasFlag(t,'dps')||t.owner!=='you') continue;
    const B=BUILDINGS[t.building], tp=surfacePos(t,.4);
    for(const o of nearbyUnits(t,true)){
      if(o.state==='landing') continue;
      const foe=o.faction==='raider'||
        (o.faction==='rival'&&o.settlement&&o.settlement.relation==='ostile');
      if(!foe) continue;
      if(tp.distanceTo(o.mesh.position)<B.range+(hasTech('forts')?1:0)){
        o.hp-=B.dps*techWar()*dt;
        if(beams){
          const g=new THREE.BufferGeometry().setFromPoints([tp,o.mesh.position.clone()]);
          beams.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xff7a3c})));
        }
        break;
      }
    }
  }
  // torri dei clan: difendono il loro territorio da predoni e da te, se in guerra
  for(const t of FC.rtowers){
    if(!hasFlag(t,'dps')||!t.settlement) continue;
    const B=BUILDINGS[t.building], tp=surfacePos(t,.4);
    for(const o of nearbyUnits(t,true)){
      if(o.state==='landing') continue;
      const foe = o.faction==='raider' ||
        (o.faction==='you'&&t.settlement.relation==='ostile');
      if(!foe||tp.distanceTo(o.mesh.position)>=B.range) continue;
      o.hp-=B.dps*dt;
      if(beams) beams.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([tp,o.mesh.position.clone()]),
        new THREE.LineBasicMaterial({color:0xe0616b})));
      break;
    }
  }
  // cannone orbitale: un colpo alla volta, dall'alto
  for(const o of orbit){
    if(!o.built||o.kind!=='cannon'||res.pow<=0) continue;
    let best=null,bd=1e9;
    for(const e of units){
      if(e.faction!=='raider'||e.state==='landing') continue;
      const d=o.mesh.position.distanceTo(e.mesh.position);
      if(d<bd){ bd=d; best=e; }
    }
    if(best){
      best.hp-=ORBITALS.cannon.dps*techWar()*dt;
      if(beams) beams.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([o.mesh.position.clone(),best.mesh.position.clone()]),
        new THREE.LineBasicMaterial({color:0xffc46b})));
    }
  }
  for(let i=units.length-1;i>=0;i--){
    const u=units[i];
    if(u.hp>0) continue;
    const wasMine=u.faction==='you', kind=u.kind, set=u.settlement;
    if(kind==='raider') raiderFellNear(u);
    // un emissario ucciso prima di consegnare il messaggio è un incidente diplomatico
    if(kind==='envoy'&&set&&!u.delivered){
      shiftGoodwill(set,-30,'emissario ucciso');
      logEvent('⚠ L\'emissario di '+set.name+' è stato ucciso: incidente diplomatico.');
    }
    killUnit(u,i);
    if(wasMine){
      // guardiani e assoggettati non sono "pop": non vanno scalati dalla popolazione
      if(kind!=='guardian'&&kind!=='thrall'){ pop=Math.max(1,pop-1); trimWorkers(); mourn(0.3); narratorHurt(1); }
      syncJobs();
      toast('Hai perso '+(kind==='guardian'?'un guardiano.':kind==='thrall'?'un assoggettato.':'un combattente.'));
      refreshHUD();
    }
    if(set) checkConquest(set);
  }
  if(raidActive&&raiders().length===0&&!props.some(p=>p.payload)){ raidActive=false; toast('Incursione respinta.'); refreshHUD(); }
}

/* ═══════════════ incursioni: la navetta li sbarca ═══════════ */
/* Saccheggio e ritirata: dopo RAID_STAY tick a terra i predoni prendono
   quello che possono e ripartono. Prima restavano finché qualcuno non li
   uccideva: se morivano i coloni in grado di combattere, due predoni
   radevano al suolo tutto, alloggi compresi, e la colonia non poteva più
   rinascere. La simulazione lo mostrava come estinzioni "per sfortuna". */
const RAID_STAY = 60;
function raidersTick(){
  const rs=raiders().filter(u=>u.state!=='landing');
  if(!rs.length) return;
  for(const u of rs) u.lifeT=(u.lifeT||0)+1;
  if(Math.max(...rs.map(u=>u.lifeT))<RAID_STAY) return;
  const cap=n=>Math.min(Math.floor(res.mat),n);
  const mat=cap(12*rs.length), food=Math.min(Math.floor(res.food),10*rs.length);
  res.mat-=mat; res.food-=food;
  for(let i=units.length-1;i>=0;i--) if(units[i].faction==='raider') killUnit(units[i],i);
  raidActive=false;
  logEvent('I predoni ripartono col bottino: −'+mat+' materiali, −'+food+' cibo.');
  refreshHUD();
}
/* la forza la decide il narratore (19-events.js), in base a quanto vale la colonia */
function spawnRaid(){ spawnRaidOf(raidSize()); }
function spawnRaidOf(n){
  const spots=tiles.filter(t=>!t.building&&BIOMES[t.biome].build);
  if(!spots.length) return;
  const site=spots[Math.floor(Math.random()*spots.length)];
  const ship=dropshipMesh();
  planetGroup.add(ship);
  props.push({mesh:ship, tile:site, phase:'down', t:0, payload:n});
  raidNo++; raidActive=true;
  toast('Navetta nemica in avvicinamento: '+n+(n===1?' predone.':' predoni.'));
}
/* navette e razzi: le cose non compaiono e non spariscono dal nulla */
function stepProps(dt){
  for(let i=props.length-1;i>=0;i--){
    const p=props[i];
    p.t+=dt*(p.phase==='wait'?1:0.55);
    const dir=p.tile.center;
    if(p.phase==='down'){
      const k=Math.min(1,p.t);
      p.mesh.position.copy(dir.clone().multiplyScalar(tileRadius(p.tile)+0.5+(1-k)*26));
      p.mesh.quaternion.setFromUnitVectors(UP,dir);
      if(k>=1){
        p.phase='wait'; p.t=0;
        for(let k2=0;k2<p.payload;k2++){
          const u=spawnUnit('raider','raider',p.tile);
          u.state='ok'; u.mesh.scale.setScalar(1);
        }
      }
    } else if(p.phase==='wait'){
      if(p.t>1.4){ p.phase='up'; p.t=0; }
    } else {
      const k=Math.min(1,p.t);
      p.mesh.position.copy(dir.clone().multiplyScalar(tileRadius(p.tile)+0.5+k*26));
      if(k>=1){ planetGroup.remove(p.mesh); props.splice(i,1); }
    }
  }
  if(launching){
    launching.t+=dt*0.5;
    const dir=launching.tile.center, k=launching.t;
    launching.mesh.position.copy(dir.clone().multiplyScalar(tileRadius(launching.tile)+0.1+k*k*40));
    launching.mesh.quaternion.setFromUnitVectors(UP,dir);
    if(k>=1){ planetGroup.remove(launching.mesh); launching=null; nextWorld(); }
  }
}

/* ═══════════════ diplomazia e conquista ═══════════════ */
