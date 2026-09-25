/* ── raggio d'azione: la calotta segue la curvatura del pianeta ───
   Il raggio in combattimento è una distanza 3D dal centro della struttura.
   L'insieme dei punti di superficie a quella distanza è un cerchio sulla
   sfera: lo ricavo esattamente, invece di appoggiare una semisfera piatta
   che sprofonderebbe nel terreno ai bordi.                             */
function clearRange(){
  if(rangeMesh){
    rangeMesh.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
    planetGroup.remove(rangeMesh); rangeMesh=null;
  }
}
function updateRangeVisual(tile){
  clearRange();
  if(!tile) return;
  const kind=tile.building||(tile.site?tile.site.kind:null);
  if(!kind) return;
  const B=BUILDINGS[kind];
  if(!B||!B.range) return;

  const Rc=tileRadius(tile)+0.4, Rs=R+0.55, d=B.range;
  let cosT=(Rc*Rc+Rs*Rs-d*d)/(2*Rc*Rs);
  if(cosT>=1) return;
  cosT=Math.max(-1,cosT);
  const ang=Math.acos(cosT);

  const n=tile.center.clone();
  let u=new THREE.Vector3(0,0,1).cross(n);
  if(u.lengthSq()<1e-6) u=new THREE.Vector3(1,0,0).cross(n);
  u.normalize();
  const w=n.clone().cross(u);
  const col=tile.owner==='rival'?0xe0616b:(B.heal?0x7fb0c9:(B.shelter?0x8fd98a:0xff7a3c));

  const ringPts=[], capPos=[];
  const SEG=48;
  const at=(a,r)=>n.clone().multiplyScalar(Math.cos(r))
    .add(u.clone().multiplyScalar(Math.sin(r)*Math.cos(a)))
    .add(w.clone().multiplyScalar(Math.sin(r)*Math.sin(a)))
    .normalize().multiplyScalar(Rs);
  for(let i=0;i<=SEG;i++) ringPts.push(at(i/SEG*Math.PI*2, ang));
  for(let i=0;i<SEG;i++){
    const a0=i/SEG*Math.PI*2, a1=(i+1)/SEG*Math.PI*2;
    const c=n.clone().multiplyScalar(Rs), p0=at(a0,ang), p1=at(a1,ang);
    capPos.push(c.x,c.y,c.z, p0.x,p0.y,p0.z, p1.x,p1.y,p1.z);
  }
  const g=new THREE.Group();
  const cap=new THREE.BufferGeometry();
  cap.setAttribute('position',new THREE.Float32BufferAttribute(capPos,3));
  g.add(new THREE.Mesh(cap,new THREE.MeshBasicMaterial({
    color:col,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false})));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({color:col,transparent:true,opacity:.85})));
  planetGroup.add(g); rangeMesh=g;
}

/* ── giorno e notte ───────────────────────────────────────────
   Il sole gira attorno al pianeta; di notte la luce ambientale cala e le
   strutture abitate accendono le finestre.                          */
let dayT=0.25, nightOn=null;
const DAY_LEN=110;                      // secondi per un giro completo
function stepDay(dt){
  if(!dayCycle){
    if(nightOn!==false){ nightOn=false; updateLights(); }
    sun.intensity=1.15*(weatherNow().light||1); rim.intensity=0.45; scene.children[0].intensity=0.9*(weatherNow().light||1);
    return;
  }
  dayT=(dayT+dt/DAY_LEN)%1;
  const a=dayT*Math.PI*2;
  sun.position.set(Math.cos(a)*40, Math.sin(a)*18, Math.sin(a)*34);
  // quanto è alto il sole rispetto all'emisfero illuminato
  const h=Math.max(-1,Math.min(1,Math.sin(a)*0.55+Math.cos(a)*0.45));
  const day=Math.max(0,Math.min(1,(h+0.35)/0.9));
  sun.intensity=(0.12+1.05*day)*(weatherNow().light||1);
  rim.intensity=0.5-0.18*day;
  scene.children[0].intensity=(0.34+0.56*day)*Math.min(1.05,weatherNow().light||1);   // luce ambientale
  const isNight=day<0.42;
  if(isNight!==nightOn){ nightOn=isNight; updateLights(); }
}
/* accese solo dove c'è davvero qualcuno */
function updateLights(){
  for(const [id,mesh] of buildMeshes){
    const t=tiles[id];
    if(!t||!t.building) continue;
    const occupied = t.owner==='you' && !t.site &&
      (jobsOf(t)>0 ? (t.workers||0)>0 : housesOf(t)>0 ? pop>0 : true);
    mesh.traverse(o=>{ if(o.userData&&o.userData.light) o.visible=!!nightOn&&occupied; });
  }
}

/* ── anelli di avanzamento sopra le strutture ─────────────────
   Un cerchio che si chiude: sui cantieri mostra i blocchi consegnati,
   sulle fattorie e miniere quanto manca al prossimo carico.        */
let ringGroup=null;
const rings=new Map();
function ringFor(id,color){
  let r=rings.get(id);
  if(!r){
    r=new THREE.Mesh(new THREE.RingGeometry(.30,.42,18,1,0,0.001),
      new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.9}));
    ringGroup.add(r); rings.set(id,r);
  }
  return r;
}
function setRing(tile,p,color){
  const r=ringFor(tile.id,color);
  r.geometry.dispose();
  r.geometry=new THREE.RingGeometry(.30,.42,18,1,Math.PI/2,-Math.max(0.001,p)*Math.PI*2);
  r.material.color.setHex(color);
  r.position.copy(surfacePos(tile,1.35));
  r.lookAt(camera.position);
  r.visible=true;
}
/* La coltura cresce in proporzione al lavoro dell'addetto: quando lui parte
   col carico, il campo è raso. È lo stesso valore che muove l'anello. */
function setCrop(tile,p){
  const g=buildMeshes.get(tile.id);
  if(!g) return;
  g.traverse(o=>{ if(o.userData&&o.userData.crop){
    o.scale.y=Math.max(0.02,p);
    o.position.y=0.10+0.15*p;
  }});
}
function updateRings(){
  if(!ringGroup) return;
  for(const r of rings.values()) r.visible=false;
  for(const t of FC.sites){ if(t.site) setRing(t, t.site.have/t.site.need, 0xffc46b); }
  for(const t of FC.mine){
    const B=BUILDINGS[t.building];
    if(!B||!B.ships||!(t.workers>0)) continue;
    let best=0, hauling=false;
    for(const u of units){
      if(u.job!==t) continue;
      if(u.mode==='work') best=Math.max(best,u.workT/harvestTime());
      if(u.mode==='haul') hauling=true;
    }
    setCrop(t, hauling&&best===0 ? 0 : Math.min(1,best));
    if(best>0) setRing(t, Math.min(1,best), 0x8fd98a);
  }
}

/* ── strutture orbitali ─────────────────────────────────────── */
