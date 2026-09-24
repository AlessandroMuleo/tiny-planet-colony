function siteMesh(){
  const g=new THREE.Group();
  for(const [x,z] of [[.3,.3],[-.3,.3],[.3,-.3],[-.3,-.3]]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.5),
      new THREE.MeshPhongMaterial({color:0xc7a06a,flatShading:true,shininess:0}));
    p.position.set(x,.25,z); g.add(p);
  }
  return g;
}
function blockMesh(hex){
  return new THREE.Mesh(new THREE.BoxGeometry(.17,.17,.17),mat(hex));
}
function startSite(tile,kind,owner,size){
  const B=BUILDINGS[kind];
  tile.size=size||1;
  if(!B.blocks){ finish(tile,kind,owner); return; }
  openSite(tile,kind,owner,B.blocks*tile.size,false);
}
/* un'impalcatura sulla casella: per una costruzione nuova, per un
   ampliamento (upgrade) o quando si ricarica una partita salvata */
function openSite(tile,kind,owner,need,upgrade){
  const old=buildMeshes.get(tile.id);
  if(old) planetGroup.remove(old);
  tile.building=kind; tile.owner=owner;
  tile.hp=1; tile.hpMax=BUILDINGS[kind].hp*sizeOf(tile);
  tile.site={kind, need, have:0, stack:[], upgrade:!!upgrade};
  const g=siteMesh(); orientTo(g,tile);
  g.scale.setScalar(0.9+0.14*sizeOf(tile));
  planetGroup.add(g);
  buildMeshes.set(tile.id,g);
  bumpWalk();
}
/* i blocchetti già consegnati restano impilati, si vede il progresso */
function addBlockToSite(tile){
  const s=tile.site; if(!s) return;
  s.have++;
  // prima il cantiere restava a 1 punto integrità fino alla fine: un predone
  // di passaggio lo cancellava anche a un blocco dal completamento
  tile.hp=Math.max(tile.hp, tile.hpMax*s.have/s.need);
  const g=buildMeshes.get(tile.id);
  if(g){
    const b=blockMesh(0xb8925e);
    const n=s.stack.length;
    b.position.set(((n%2)-.5)*.22, .09+Math.floor(n/2)*.19, ((Math.floor(n/2)%2)-.5)*.22);
    g.add(b); s.stack.push(b);
  }
  if(s.have>=s.need){
    const was=s.upgrade;
    finish(tile, s.kind, tile.owner);
    if(tile.owner==='you'){
      trimWorkers(); syncJobs();
      if(!BUILDINGS[s.kind].quiet) toast(BUILDINGS[s.kind].name+(was?' ampliata a '+sizeOf(tile)+'×.':' completata.'));
    }
  }
}
/* costruzione completata: l'impalcatura lascia il posto all'edificio */
function finish(tile,kind,owner){
  const old=buildMeshes.get(tile.id);
  if(old) planetGroup.remove(old);
  tile.building=kind; tile.owner=owner; tile.site=null;
  if(!tile.size) tile.size=1;
  tile.hp=(BUILDINGS[kind].hp||25)*tile.size; tile.hpMax=tile.hp; tile.spawnT=0; tile.shipT=0;
  const mesh=buildingMesh(kind);
  // scarto contenuto: si nota che è più grande senza debordare dalla casella
  mesh.scale.setScalar(0.86+0.15*tile.size);
  orientTo(mesh,tile);
  planetGroup.add(mesh);
  buildMeshes.set(tile.id,mesh);
  bumpWalk();
  if(selected===tile) setInspector(tile);
}
function destroyBuilding(tile){
  const mesh=buildMeshes.get(tile.id);
  if(mesh) planetGroup.remove(mesh);
  buildMeshes.delete(tile.id);
  const was=BUILDINGS[tile.building].name, mine=tile.owner==='you';
  const set=tile.settlement;
  tile.building=null; tile.owner=null; tile.workers=0; tile.hp=0; tile.hpMax=0;
  tile.settlement=null; tile.site=null;
  tile.size=1;
  bumpWalk(); syncJobs(); refreshHUD();
  if(selected===tile) setInspector(tile);
  if(mine){ toast(was+': distrutta.'); narratorHurt(0.5); }
  if(set) checkConquest(set);
}

/* ═══════════════ unità ═══════════════ */
