function setPower(p){
  activePower = activePower===p ? null : p;
  for(const k in POWERS) $('p-'+k).classList.toggle('pwr-on', activePower===k);
  if(activePower) toast(POWERS[p].icon+' '+POWERS[p].label+': clicca un punto del pianeta.');
}
function addFX(obj,life,update,onEnd){ planetGroup.add(obj); activeFX.push({obj,life,max:life,update,onEnd}); }
function stepFX(dt){
  for(let i=activeFX.length-1;i>=0;i--){
    const fx=activeFX[i];
    fx.life-=dt;
    const k=Math.max(0,fx.life/fx.max);
    if(fx.update) fx.update(k);
    if(fx.life<=0){
      fx.obj.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
      planetGroup.remove(fx.obj); activeFX.splice(i,1);
      if(fx.onEnd) fx.onEnd();
    }
  }
}

/* ═══════════════ eventi casuali ═══════════════
   Ogni 90–170 s (non durante un'incursione) succede qualcosa che la
   colonia non ha scelto: va gestito, non solo subito.
   Ogni evento è una voce della tabella: weight è quanto spesso esce
   rispetto agli altri, run() lo fa accadere. Un evento nuovo si aggiunge
   qui senza toccare il resto.                                        */
const EVENTS={
  meteor:{weight:1, run(){
    // tre impatti: uno vicino alla colonia, due a caso. Danneggiano ciò che
    // colpiscono ma lasciano frammenti di minerale da raccogliere
    const land=tiles.filter(t=>BIOMES[t.biome].build);
    const home=playerBuildings();
    const hits=[];
    if(home.length){
      const h=home[Math.floor(Math.random()*home.length)];
      const n=h.neighbors.map(i=>tiles[i]).filter(t=>BIOMES[t.biome].build);
      hits.push(n.length?n[Math.floor(Math.random()*n.length)]:h);
    }
    while(hits.length<3&&land.length) hits.push(land[Math.floor(Math.random()*land.length)]);
    hits.forEach((t,i)=>meteor(t,0.9+i*0.45));
    logEvent('☄ Pioggia di meteoriti in arrivo: tre impatti.');
  }},
  plague:{weight:1, run(){
    const healthy=myPeople().filter(u=>!u.wounded&&u.stage!=='child');
    if(!healthy.length){ eventIn=20; return false; }
    // un ospedale funzionante dimezza il contagio
    const clinic=FC.mine.some(t=>hasFlag(t,'heal')&&(t.workers||0)>0);
    const n=Math.max(1,Math.ceil(healthy.length*(clinic?0.1:0.22)));
    for(let i=0;i<n;i++){
      const u=healthy.splice(Math.floor(Math.random()*healthy.length),1)[0];
      if(!u) break;
      u.hp=u.hpMax*0.3; u.wounded=true; applyAge(u);
    }
    trimWorkers(); syncJobs();
    logEvent('🦠 Epidemia: '+n+(n===1?' colono si è ammalato':' coloni si sono ammalati')+
      (clinic?' (l\'ospedale ha contenuto il contagio).':'. Un ospedale con addetti la conterrebbe.'));
  }},
  refugees:{weight:1, run(){
    const free=rates().houses-myPeople().length;
    const n=Math.min(3,free);
    if(n<=0){ logEvent('🧳 Dei profughi sono passati oltre: non c\'erano letti liberi.'); return false; }
    for(let i=0;i<n;i++) spawnUnit('worker','you',randomHome());   // arrivano adulti
    pop=myPeople().length;
    syncJobs();
    logEvent('🧳 Sono arrivati '+n+(n===1?' profugo: ora è un colono.':' profughi: ora sono coloni.'));
  }},
  harvest:{weight:1, run(){
    boomT=35;
    logEvent('🌾 Annata eccezionale: +40% cibo dai campi per 35 secondi.');
  }}
};
/* estrazione pesata: con pesi tutti uguali coincide con la vecchia
   scelta uniforme, e consuma un solo numero casuale */
function pickEvent(){
  const keys=Object.keys(EVENTS);
  const total=keys.reduce((n,k)=>n+EVENTS[k].weight,0);
  let r=Math.random()*total;
  for(const k of keys){ r-=EVENTS[k].weight; if(r<0) return k; }
  return keys[keys.length-1];
}
function randomEventTick(){
  if(worldAge<60||raidActive) return;
  if(--eventIn>0) return;
  eventIn=90+Math.floor(Math.random()*80);
  fireEvent(pickEvent());
}
function fireEvent(kind){
  if(EVENTS[kind].run()===false) return;   // non è successo niente: HUD invariato
  refreshHUD();
}
function meteor(tile,delay){
  const sky=tile.center.clone().multiplyScalar(R+30), ground=surfacePos(tile,0.2);
  const g=new THREE.Group();
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,0),
    new THREE.MeshBasicMaterial({color:0xffa060}));
  const trail=new THREE.Mesh(new THREE.ConeGeometry(.28,2.2,6,1,true),
    new THREE.MeshBasicMaterial({color:0xff7a3c,transparent:true,opacity:.55}));
  trail.position.y=1.2; rock.add(trail);
  rock.quaternion.setFromUnitVectors(UP,tile.center);
  rock.position.copy(sky); g.add(rock);
  const life=delay+0.8;
  addFX(g,life,k=>{
    const p=Math.min(1,Math.max(0,(1-k)*life-delay)/0.8);
    rock.visible=(1-k)*life>=delay;
    rock.position.lerpVectors(sky,ground,p*p);
  },()=>impact(tile));
}
function impact(tile){
  // lampo d'impatto
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.9,10,8),
    new THREE.MeshBasicMaterial({color:0xffd08a,transparent:true}));
  flash.position.copy(surfacePos(tile,0.2));
  const g=new THREE.Group(); g.add(flash);
  addFX(g,0.6,k=>{ flash.material.opacity=k; flash.scale.setScalar(1+(1-k)*2); });
  if(tile.building){
    const mine=tile.owner==='you';
    damageBuilding(tile,35);
    if(mine&&tile.building) toast('Un meteorite ha colpito '+BUILDINGS[tile.building].name+'.');
  }
  for(const u of nearbyUnits(tile,false)) if(u.state!=='landing') u.hp-=6;
  // i frammenti valgono solo se un magazzino è a portata di passo:
  // un sasso caduto dall'altra parte del mondo non lo raccoglie nessuno
  if(BIOMES[tile.biome].build&&FC.storage.length&&haulSteps(tile)<=12){
    res.mat=Math.min(capacity(),res.mat+12);
    toast('☄ Frammenti di meteorite raccolti: +12 materiali.');
  }
}
function castPower(kind,tile){
  const P=POWERS[kind];
  if(res.pow<P.cost){ toast('Energia insufficiente: servono '+P.cost+'.'); return; }
  res.pow-=P.cost;
  const target=surfacePos(tile,0.2);

  if(kind==='bolt'){
    const sky=tile.center.clone().multiplyScalar(R+24), pts=[sky];
    for(let i=1;i<9;i++){
      const p=sky.clone().lerp(target,i/9);
      p.add(new THREE.Vector3((Math.random()-.5)*2.4,(Math.random()-.5)*2.4,(Math.random()-.5)*2.4));
      pts.push(p);
    }
    pts.push(target);
    const g=new THREE.Group();
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0xa8f5ff,transparent:true}));
    const spark=new THREE.Mesh(new THREE.SphereGeometry(.7,8,6),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true}));
    spark.position.copy(target); g.add(line); g.add(spark);
    addFX(g,0.3,k=>{ line.material.opacity=k; spark.material.opacity=k*.8; spark.scale.setScalar(1+(1-k)*3); });
    let hit=0;
    for(const o of nearbyUnits(tile,true)){
      if(o.state==='landing') continue;
      if(o.faction==='raider'||(o.faction==='rival'&&o.settlement&&o.settlement.relation==='ostile')){
        o.hp-=P.dmg; hit++;
      }
    }
    toast(hit?'Fulmine: '+hit+(hit===1?' nemico folgorato.':' nemici folgorati.'):'Fulmine a vuoto.');

  } else if(kind==='rain'){
    const pts=[];
    for(let i=0;i<40;i++) pts.push(target.clone().add(
      new THREE.Vector3((Math.random()-.5)*3.2, Math.random()*4+1, (Math.random()-.5)*3.2)));
    const cloud=new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({color:0x70c0ff,size:.35,transparent:true}));
    const g=new THREE.Group(); g.add(cloud);
    addFX(g,1.6,k=>{ cloud.material.opacity=k; cloud.position.y-=.05; });
    res.food=Math.min(capacity(),res.food+P.food);
    for(const u of units) if(u.job&&BUILDINGS[u.job.building].ships==='food') u.workT+=harvestTime()*0.5;
    toast('Pioggia fertile: +'+P.food+' cibo, raccolti accelerati.');

  } else {
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(P.range/2,P.range/2,9,16,1,true),
      new THREE.MeshBasicMaterial({color:0xffea78,transparent:true,side:THREE.DoubleSide}));
    cyl.position.copy(target);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tile.center);
    const g=new THREE.Group(); g.add(cyl);
    addFX(g,0.9,k=>{ cyl.material.opacity=k*.45; cyl.scale.x=cyl.scale.z=1+(1-k)*.4; });
    let healed=0;
    for(const u of units){
      if(u.faction!=='you'||u.mesh.position.distanceTo(target)>=P.range) continue;
      u.hp=u.hpMax;
      if(u.wounded){ u.wounded=false; applyAge(u); }
      healed++;
    }
    if(healed) syncJobs();
    toast('Cura solare: '+healed+' rimessi in forze.');
  }
  refreshHUD();
}

/* ═══════════════ modalità automatica ═══════════════ */
