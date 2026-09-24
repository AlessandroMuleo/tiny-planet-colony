const tileRadius = t => R + BIOMES[t.biome].lift;
const surfacePos = (t,lift=0) => t.center.clone().multiplyScalar(tileRadius(t)+lift);
const isMine = t => t.building && t.owner==='you' && !t.site;
/* la casella ha un edificio con questa proprietà (vedi BUILDINGS) */
const hasFlag = (t,f) => !!(t.building && BUILDINGS[t.building][f]);
/* Una struttura sta su una casella sola. La taglia resta, ma vale sui numeri
   — posti di lavoro, letti, capienza, integrità — non sull'area occupata:
   gli edifici che si mangiavano due anelli di caselle erano un pugno in un occhio. */
const footprint = tile => [tile];
const playerBuildings = () => tiles.filter(isMine);
/* percorribile: terra, oppure mare con un molo o una struttura marina sopra */
const walkable = t => BIOMES[t.biome].build ||
  (t.building && BUILDINGS[t.building].water) || (t.site && BUILDINGS[t.site.kind].water);
/* Una casella con mura tue non è invalicabile per i nemici: costa carissima.
   Se esiste un giro più corto di WALL_COST passi lo prendono, altrimenti
   sfondano. Vedi la Dijkstra in distField().                             */
const blocksFoe = t => t.owner==='you' &&
  ((t.building&&BUILDINGS[t.building].wall)||(t.site&&BUILDINGS[t.site.kind].wall));
const walkableFoe = t => walkable(t) && !blocksFoe(t);

function generateWorld(seed){
  planetGroup.clear();
  buildMeshes.clear(); faceToTile=[]; units=[]; settlements=[]; cargos=[]; props=[];
  selected=null; marker=null; launching=null; rangeMesh=null; activeFX=[]; setInspector(null);
  raidIn=160; raidNo=0; raidActive=false; army={size:0,target:null};
  season=0; seasonT=0; worldAge=0;
  beams=new THREE.Group(); planetGroup.add(beams);
  ringGroup=new THREE.Group(); planetGroup.add(ringGroup); rings.clear();
  if(orbitGroup) scene.remove(orbitGroup);
  orbit=[]; orbitGroup=new THREE.Group(); scene.add(orbitGroup);
  if(moon) scene.remove(moon);
  for(const r of moonRuns) scene.remove(r.mesh);
  moonRuns=[]; moonCrew.length=0; moon=makeMoon(); scene.add(moon);

  const noise=makeNoise(seed), rnd=mulberry32(seed^0x9e37);
  trait = worldIndex===1 ? TRAITS[0] : TRAITS[Math.floor(rnd()*TRAITS.length)];
  tiles=buildHexasphere(SUBDIV);

  let peak=null, peakH=-9;
  for(const t of tiles){
    t.h=noise(t.center.clone().multiplyScalar(1.5));
    t.building=null; t.owner=null; t.workers=0; t.unit='spear';
    t.hp=0; t.hpMax=0; t.settlement=null; t.spawnT=0; t.shipT=0; t.site=null;
    if(t.h>peakH){ peakH=t.h; peak=t; }
  }
  for(const t of tiles){
    const h=t.h;
    t.biome = h<-0.14?'ocean' : h<0.00?'sand' : h<0.28?'meadow' : h<0.52?'soil' : 'rock';
  }
  peak.biome='lava';
  for(const n of peak.neighbors) if(tiles[n].biome!=='ocean') tiles[n].biome='volcano';

  buildTerrainMesh();

  const start=tiles.filter(t=>t.biome==='meadow')
    .sort((a,b)=>Math.abs(a.center.y)-Math.abs(b.center.y))[0] || tiles.find(t=>BIOMES[t.biome].build);
  finish(start,'hut','you');
  const near=start.neighbors.map(i=>tiles[i]).find(t=>BIOMES[t.biome].build && !t.building);
  if(near) finish(near,'farm','you');

  for(let i=0;i<pop;i++) spawnUnit('worker','you',start);
  for(const t of tiles) if(isMine(t) && jobsOf(t)>0)
    t.workers=Math.min(jobsOf(t), idleCount());

  makeSettlements(start,rnd);
  // senza questo syncJobs leggeva i cantieri del pianeta appena lasciato
  rebuildFrameCache();
  syncJobs();

  document.getElementById('w-name').textContent=NAMES[(worldIndex-1)%NAMES.length];
  document.getElementById('w-count').textContent=
    (worldIndex===1?'primo mondo':'mondo n° '+worldIndex)+' · '+trait.name+' ('+trait.note+')'+
    (worldIndex>1?' · eredità +'+Math.round((legacy()-1)*100)+'%':'');
}

/* si nasce in casa, non dall'altra parte del mondo: prima una capanna,
   poi qualsiasi struttura tua, e solo come ultima spiaggia una casella a caso */
function randomHome(){
  const beds=tiles.filter(t=>isMine(t)&&housesOf(t)>0);
  if(beds.length) return beds[Math.floor(Math.random()*beds.length)];
  const any=playerBuildings();
  if(any.length) return any[Math.floor(Math.random()*any.length)];
  const home=tiles.filter(t=>BIOMES[t.biome].build);
  return home[Math.floor(Math.random()*home.length)]||tiles[0];
}

function buildTerrainMesh(){
  const pos=[], col=[], c=new THREE.Color();
  const push=(v,hex)=>{ pos.push(v.x,v.y,v.z); c.setHex(hex); col.push(c.r,c.g,c.b); };
  for(const t of tiles){
    const B=BIOMES[t.biome], rr=tileRadius(t);
    const top=t.corners.map(p=>p.clone().multiplyScalar(rr));
    const bot=t.corners.map(p=>p.clone().multiplyScalar(R-SKIRT));
    const mid=t.center.clone().multiplyScalar(rr);
    t.colStart=col.length/3;                       // per la ritinta stagionale
    for(let i=0;i<top.length;i++){ const j=(i+1)%top.length;
      push(mid,B.top); push(top[i],B.top); push(top[j],B.top); faceToTile.push(t.id); }
    t.colTop=col.length/3 - t.colStart;
    for(let i=0;i<top.length;i++){ const j=(i+1)%top.length;
      push(top[i],B.side); push(bot[i],B.side); push(bot[j],B.side); faceToTile.push(t.id);
      push(top[i],B.side); push(bot[j],B.side); push(top[j],B.side); faceToTile.push(t.id); }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  terrainColor=new THREE.Float32BufferAttribute(col,3);
  g.setAttribute('color',terrainColor);
  g.computeVertexNormals();
  terrainMesh=new THREE.Mesh(g,new THREE.MeshPhongMaterial({
    vertexColors:true,flatShading:true,shininess:0,specular:0x000000}));
  terrainMesh.frustumCulled=false;
  planetGroup.add(terrainMesh);
  planetGroup.add(new THREE.Mesh(new THREE.SphereGeometry(R-SKIRT-0.05,28,20),
    new THREE.MeshBasicMaterial({color:0x121a2b})));
}

/* Il colore non scatta al cambio di stagione: scorre di continuo tra la tinta
   di quella corrente e quella successiva, in proporzione a quanto è avanzata. */
const _cA=new THREE.Color(), _cB=new THREE.Color(), _cM=new THREE.Color();
function applySeason(){
  if(!terrainColor) return;
  const k=Math.min(1,Math.max(0,seasonT/SEASON_LEN));
  _cA.setHex(SEASONS[season].tint);
  _cB.setHex(SEASONS[(season+1)%SEASONS.length].tint);
  _cM.copy(_cA).lerp(_cB,k);
  // lo specchio solare tiene il pianeta a primavera perenne
  if(hasOrbital('mirror')) _cM.lerp(new THREE.Color(SEASONS[0].tint),0.6);
  for(const t of tiles){
    if(!BIOMES[t.biome].season) continue;
    for(let i=0;i<t.colTop;i++) terrainColor.setXYZ(t.colStart+i,_cM.r,_cM.g,_cM.b);
  }
  terrainColor.needsUpdate=true;
}

/* ── popoli rivali ────────────────────────────────────────────── */
function makeSettlements(start,rnd){
  const howMany=Math.min(2, worldIndex-1);
  for(let s=0;s<howMany;s++){
    const far=tiles.filter(t=>BIOMES[t.biome].build && !t.building &&
      t.center.dot(start.center)<0.15 &&
      settlements.every(x=>t.center.dot(x.core.center)<0.55));
    if(!far.length) continue;
    const core=far[Math.floor(rnd()*far.length)];
    const set={name:'Clan '+CLANS[Math.floor(rnd()*CLANS.length)],
               core, relation:'neutrale', tiles:[core], mat:30, thinkT:0};
    finish(core,'keep','rival'); core.settlement=set;
    let hasFarm=false, hasTower=false;
    for(const n of core.neighbors){
      const t=tiles[n];
      if(!(BIOMES[t.biome].build && !t.building && rnd()<0.75)) continue;
      let kind='camp';
      if(!hasFarm && rnd()<0.6){ kind='rfarm'; hasFarm=true; }
      else if(!hasTower && rnd()<0.5){ kind='rtower'; hasTower=true; }
      finish(t,kind,'rival'); t.settlement=set; set.tiles.push(t);
    }
    const guards=2+Math.floor(rnd()*3)+Math.floor(worldIndex/2);
    for(let i=0;i<guards;i++){
      const u=spawnUnit('soldier','rival',set.tiles[i%set.tiles.length]);
      u.settlement=set;
    }
    settlements.push(set);
  }
}

/* ═══════════════ mesh degli edifici ═══════════════ */
