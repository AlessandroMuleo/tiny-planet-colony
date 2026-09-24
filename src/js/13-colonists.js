function civilBrain(u,dt){
  // 0. milizia: se un nemico è a tiro, il colono molla tutto e lo affronta.
  //    Fa poco danno, ma dieci coloni valgono un lanciere.
  const canFight = !u.wounded && u.stage!=='child' && u.kind!=='thrall';
  let foe=null, bd=canFight?MILITIA_RANGE:FLEE_RANGE;
  for(const o of nearbyUnits(u.from,true)){
    if(!hostile(u,o)||o.state==='landing') continue;
    const d=u.mesh.position.distanceTo(o.mesh.position);
    if(d<bd){ bd=d; foe=o; }
  }
  if(foe){
    dropCarry(u); u.mode='idle';
    // adulti sani: milizia. Bambini, feriti e assoggettati: al riparo.
    if(canFight) return foe.from;
    const refuge = nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].shelter)
                || nearestOf(u.from,FC.beds,t=>reachable(u.from,t));
    if(refuge&&refuge!==u.from) return refuge;
    const away=u.from.neighbors.map(n=>tiles[n]).filter(walkable)
      .sort((a,b)=>a.center.dot(foe.from.center)-b.center.dot(foe.from.center));
    if(away.length) return away[0];
  }
  // 0a. durante un'incursione, chi non sa difendersi corre al rifugio
  if(FC.raiders.length&&(u.stage==='child'||u.wounded)){
    dropCarry(u); u.mode='idle';
    const f=nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].shelter);
    if(f) return f;
  }
  // 0b. ferito: smette tutto e cerca l'ospedale più vicino
  if(u.wounded){
    dropCarry(u); u.mode='idle';
    return nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].heal)||u.from;
  }
  // 1. senza incarico: fa il portatore per i cantieri aperti
  if(!u.job){
    if(u.site&&!u.site.site){ u.site=null; }   // il cantiere è finito mentre arrivava
    if(u.mode==='fetch'||u.mode==='deliver'){
      if(!u.site||!u.site.site){ u.mode='idle'; dropCarry(u); }
    }
    if(u.mode==='idle'){
      const site=reachableSites(u.from)
        .sort((a,b)=>b.center.dot(u.from.center)-a.center.dot(u.from.center))[0];
      if(site){ u.site=site; u.mode='fetch'; return nearestStorage(u.from); }
      // niente da costruire: si raduna al villaggio invece di girare a vuoto
      return nearestOf(u.from,FC.beds,t=>reachable(u.from,t))
          || nearestOf(u.from,FC.mine,t=>reachable(u.from,t));
    }
    if(u.mode==='fetch'){
      const st=nearestStorage(u.from);
      if(!st) { u.mode='idle'; return null; }
      if(u.from===st){ takeCarry(u,0xb8925e); u.mode='deliver'; return u.site; }
      return st;
    }
    if(u.mode==='deliver'){
      if(u.from===u.site){
        dropCarry(u);
        addBlockToSite(u.site);
        u.mode=u.site && u.site.site ? 'fetch' : 'idle';
        return null;
      }
      return u.site;
    }
    return null;
  }
  // 2. con un incarico: lavora sul posto e ogni tanto porta il raccolto
  const B=BUILDINGS[u.job.building];
  if(u.mode==='haul'){
    const st=nearestStorage(u.from);
    if(!st||u.from===st){ dropCarry(u); u.mode='work'; u.workT=0; return u.job; }
    return st;
  }
  if(u.mode!=='work'){ u.mode='work'; u.workT=0; }
  if(u.from!==u.job) return u.job;
  // fermo sull'edificio: sta lavorando
  u.workT+=dt;
  if(B.ships && u.workT>harvestTime()){
    u.workT=0;
    takeCarry(u, B.ships==='food'?0xa8c14e:0x9aa4b2);
    u.mode='haul';
    return nearestStorage(u.from);
  }
  return u.job;
}

function goalTile(u,dt){
  if(u.faction==='raider'){
    // saccheggiano il bersaglio più vicino, tuo o dei clan: non ce l'hanno
    // con te in particolare, ce l'hanno col pianeta
    const mine=nearestOf(u.from,FC.mine), theirs=nearestOf(u.from,FC.rivalB);
    if(mine&&theirs)
      return u.from.center.dot(mine.center)>=u.from.center.dot(theirs.center)?mine:theirs;
    return mine||theirs||nearestOf(u.from,FC.sites,t=>!!t.site)||u.from;
  }
  if(u.faction==='rival'){
    const set=u.settlement;
    if(u.kind==='caravan') return caravanGoal(u);
    if(FC.raiders.length){
      let best=null,bd=-2;
      for(const e of FC.raiders){ const d=u.from.center.dot(e.from.center);
        if(d>bd){ bd=d; best=e.from; } }
      if(best) return best;
    }
    if(set&&set.relation==='ostile') return nearestOf(u.from,FC.mine);
    return set?set.core:u.from;
  }
  if(UNITS[u.kind].civil) return civilBrain(u,dt);

  // SCHIERATE: marciano sull'obiettivo, ignorando le scaramucce a casa
  if(u.deployed&&army.target&&army.target.relation==='ostile'){
    const foe=nearestFoeUnit(u);
    if(foe&&u.mesh.position.distanceTo(foe.mesh.position)<4) return foe.from;
    const t=nearestTile(u.from,x=>x.settlement===army.target&&!!x.building);
    if(t) return t;
  }
  // NON SCHIERATE: restano di guardia e ingaggiano solo chi entra in casa
  const foe=nearestFoeUnit(u);
  if(foe){
    const atHome=nearestTile(foe.from,t=>isMine(t));
    const near=atHome&&foe.from.center.dot(atHome.center)>0.90;
    if(near||foe.faction==='raider') return foe.from;
  }
  // se dei predoni sono a terra, li intercetta anche se non sono adiacenti
  if(FC.raiders.length){
    let best=null,bd=-2;
    for(const e of FC.raiders){ const d=u.from.center.dot(e.from.center);
      if(d>bd){ bd=d; best=e.from; } }
    if(best) return best;
  }
  return nearestOf(u.from,FC.defense);
}

function stepUnits(dt){
  rebuildFrameCache();
  for(const u of units){
    if(u.state==='landing'){ u.mesh.scale.setScalar(.55+.45*Math.min(1,u.land)); continue; }
    const fly=false;   // i predoni ora camminano: se volassero le mura non conterebbero
    // l'obiettivo si ricalcola all'arrivo su una nuova casella o ogni ~0,3 s,
    // non a ogni fotogramma: è qui che se ne andavano le prestazioni
    u.think=(u.think||0)-dt;
    if(u.goal===undefined||u.lastFrom!==u.from||u.think<=0){
      u.goal=goalTile(u,dt); u.lastFrom=u.from; u.think=0.25+Math.random()*0.2;
    }
    const goal=u.goal;
    const parked = goal && goal===u.from && u.to===u.from;

    if(parked){
      // fermo al lavoro: leggera oscillazione, così si vede che è attivo
      u.bob+=dt*3;
      const dir=u.from.center;
      u.mesh.position.copy(dir.clone().multiplyScalar(
        tileRadius(u.from)+0.17+(u.job?Math.abs(Math.sin(u.bob))*0.05:0)));
      u.mesh.quaternion.setFromUnitVectors(UP,dir);
      continue;
    }
    // solo strade finite: un cantiere ha già building==='road' e dava il bonus
    const road=t=>t.building==='road'&&!t.site;
    const onRoad=road(u.from)||road(u.to);
    u.t+=dt*u.speed*(onRoad?1.6:1);
    if(u.t>=1){
      u.t=0; u.from=u.to;
      if(goal&&goal!==u.from) u.to=stepToward(u.from,goal,fly,u.faction!=='you');
      else {
        const opts=u.from.neighbors.map(i=>tiles[i]).filter(t=>fly||walkable(t));
        u.to=(goal===u.from)?u.from:(opts.length?opts[Math.floor(Math.random()*opts.length)]:u.from);
      }
    }
    const dir=u.from.center.clone().lerp(u.to.center,u.t).normalize();
    const r=THREE.MathUtils.lerp(tileRadius(u.from),tileRadius(u.to),u.t);
    u.mesh.position.copy(dir.clone().multiplyScalar(r+(fly?0.35:0.17)));
    u.mesh.quaternion.setFromUnitVectors(UP,dir);
  }
}

/* ═══════════════ combattimento ═══════════════ */
