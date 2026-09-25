function orbitalMesh(kind){
  const g=new THREE.Group();
  if(kind==='station'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.5,8),mat(0xc9d2de)); g.add(b);
    const r=new THREE.Mesh(new THREE.TorusGeometry(1.1,.12,6,16),mat(0x8d97a6));
    r.rotation.x=Math.PI/2; g.add(r);
    for(const x of [1.5,-1.5]){ const p=new THREE.Mesh(new THREE.BoxGeometry(1.3,.06,.7),mat(0x3f6fa8));
      p.position.x=x; g.add(p); }
  } else if(kind==='mirror'){
    const d=new THREE.Mesh(new THREE.CircleGeometry(1.5,10),mat(0xffe9b0)); g.add(d);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.7),mat(0x8d97a6));
    b.rotation.x=Math.PI/2; b.position.z=-.35; g.add(b);
  } else if(kind==='cannon'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,1.1),mat(0x5b6472)); g.add(b);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.7,6),mat(0xff7a3c));
    t.rotation.x=Math.PI/2; t.position.z=1.1; g.add(t);
  } else if(kind==='moonbase'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(1.2,.6,1.0),mat(0x7a8492)); g.add(b);
    const pad=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.1,8),mat(0x4a5266)); pad.position.y=.35; g.add(pad);
    const s=new THREE.Mesh(new THREE.ConeGeometry(.22,.7,6),mat(0xe6ecf5)); s.position.y=.75; g.add(s);
  } else if(kind==='eye'){
    const d=new THREE.Mesh(new THREE.SphereGeometry(.55,12,8,0,Math.PI*2,0,Math.PI/2),mat(0xd7e2ea));
    d.rotation.x=Math.PI/2.2; g.add(d);
    const r=new THREE.Mesh(new THREE.TorusGeometry(.85,.06,5,14),mat(0x9fe3bd));
    r.rotation.y=Math.PI/3; g.add(r);
  } else if(kind==='shield'){
    // un anello di generatori con una bolla di campo attorno
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.45),mat(0x7fb0c9)); g.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.08,6,18),mat(0x9aa4b2)); g.add(ring);
    const bub=new THREE.Mesh(new THREE.SphereGeometry(1.35,14,10),
      new THREE.MeshBasicMaterial({color:0x7fd4ff,transparent:true,opacity:.14,depthWrite:false}));
    g.add(bub);
  } else if(kind==='telescope'){
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,1.8,10),mat(0xe6ecf5));
    tube.rotation.x=Math.PI/2; g.add(tube);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.3,12),new THREE.MeshBasicMaterial({color:0x3e95d8}));
    lens.position.z=-.91; lens.rotation.y=Math.PI; g.add(lens);
    for(const x of [1,-1]){ const p=new THREE.Mesh(new THREE.BoxGeometry(1.1,.05,.6),mat(0x3f6fa8)); p.position.x=x*.9; g.add(p); }
  } else if(kind==='miner'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.6,.9),mat(0x8a7a64)); g.add(b);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.4,6),mat(0xd9a441));
    arm.rotation.z=Math.PI/2; arm.position.x=.9; g.add(arm);
    const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.45,0),mat(0x6f6357)); rock.position.x=1.8; g.add(rock);
  } else if(kind==='weathersat'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.7),mat(0xc9d2de)); g.add(b);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(.5,10,6,0,Math.PI*2,0,Math.PI/3),mat(0xffffff));
    dish.position.z=.5; dish.rotation.x=-Math.PI/2; g.add(dish);
    for(const x of [1,-1]){ const p=new THREE.Mesh(new THREE.BoxGeometry(.9,.04,.45),mat(0x3f6fa8)); p.position.x=x*.75; g.add(p); }
  } else if(kind==='habitat'){
    // anello rotante con i moduli abitativi
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.25,.22,8,20),mat(0xd7e2ea)); g.add(ring);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.8,10),mat(0x9aa4b2)); hub.rotation.x=Math.PI/2; g.add(hub);
    for(let i=0;i<4;i++){ const a=i/4*Math.PI*2;
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.2,5),mat(0x8d97a6));
      sp.position.set(Math.cos(a)*.62,Math.sin(a)*.62,0); sp.rotation.z=a+Math.PI/2; g.add(sp); }
    const glow=new THREE.Mesh(new THREE.TorusGeometry(1.25,.06,6,20),new THREE.MeshBasicMaterial({color:0xffe0a0}));
    glow.position.z=.2; g.add(glow);
  }
  return g;
}
const hasOrbital = k => orbit.some(o=>o.kind===k&&o.built);

/* ── la luna e le spedizioni ──────────────────────────────────
   Un satellite vero in scena: la navetta della base lunare ci va,
   resta un attimo e torna col carico. Niente risorse dal nulla. */
let moon=null, moonRuns=[];
function makeMoon(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.IcosahedronGeometry(2.4,1),mat(0x9aa2ad));
  g.add(b);
  for(let i=0;i<7;i++){
    const c=new THREE.Mesh(new THREE.CircleGeometry(0.3+Math.random()*0.5,7),mat(0x757d88));
    const d=randomUnit(mulberry32(i*13+5));
    c.position.copy(d.multiplyScalar(2.38));
    c.lookAt(0,0,0); c.rotateY(Math.PI);
    g.add(c);
  }
  return g;
}
function shuttleMesh(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.ConeGeometry(.3,1.0,6),mat(0xe6ecf5)); g.add(b);
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,.5,6),mat(0xb9c3d0));
  t.position.y=-.6; g.add(t);
  const f=new THREE.Mesh(new THREE.ConeGeometry(.2,.5,6),mat(0x50d2ff));
  f.position.y=-1.0; f.rotation.x=Math.PI; f.userData.flame=true; g.add(f);
  return g;
}
/* un colono in tuta: casco dorato, resta sulla luna e ci lavora */
function suitMesh(){
  const g=new THREE.Group();
  // r128 non ha CapsuleGeometry: il ternario che avevo scritto veniva letto
  // come `new THREE.CapsuleGeometry` e lanciava prima ancora di scegliere.
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.10,.13,.26,7),mat(0xf2f4f8));
  b.position.y=.13; g.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),mat(0xffd27a));
  h.position.y=.32; g.add(h);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.12,.14,.08),mat(0x9aa4b2));
  pack.position.set(0,.16,-.11); g.add(pack);
  const flag=new THREE.Mesh(new THREE.BoxGeometry(.14,.09,.01),mat(0xff7a3c));
  flag.position.set(.14,.3,0); g.add(flag);
  return g;
}
function moonPos(t){
  const a=t*0.07, tilt=-0.55, rr=R+26;
  return new THREE.Vector3(Math.cos(a)*rr, Math.sin(a)*rr*Math.sin(tilt), Math.sin(a)*rr*Math.cos(tilt));
}
/* Ogni spedizione porta un colono sulla luna: parte come un razzo dalla
   superficie, atterra, lo lascia lì in tuta, e torna col carico. I coloni
   lunari restano visibili sul satellite e ne aumentano la resa.        */
const moonCrew=[];
function moonYield(){ return Math.round((ORBITALS.moonbase.haul + moonCrew.length*6)*Math.max(1,orbMul('moonbase'))); }
function stepMoon(dt,clock){
  if(!moon) return;
  moon.position.copy(moonPos(clock));
  moon.rotation.y+=dt*0.15;

  const base=orbit.find(o=>o.kind==='moonbase'&&o.built);
  if(base&&res.pow>0&&!spaceOffline){
    base.fireT=(base.fireT||0)+dt;
    if(base.fireT>=ORBITALS.moonbase.every){
      base.fireT=0;
      // parte dal suolo: preferisce la rampa, altrimenti una struttura tua
      const padTile = FC.mine.find(t=>hasFlag(t,'launch'))
                   || FC.mine.find(t=>t.building==='depot') || FC.mine[0];
      if(padTile){
        markLaunch(padTile);
        const takesColonist = pop>3 && moonCrew.length<8;
        const m=shuttleMesh(); scene.add(m);
        m.position.copy(surfacePos(padTile,0.4));
        moonRuns.push({mesh:m,t:0,phase:'up',tile:padTile,crew:takesColonist});
        if(takesColonist){
          // cercava solo kind==='worker': se in quel momento tutti i coloni
          // erano assegnati come idle/lancieri/arcieri non ne trovava nessuno,
          // eppure scalava "pop" lo stesso, sfasando il conteggio.
          const i=units.findIndex(u=>isPerson(u)&&u.stage!=='child'&&!u.wounded);
          if(i>=0){ pop=Math.max(1,pop-1); killUnit(units[i],i); trimWorkers(); syncJobs(); }
        }
        toast('Razzo lunare in partenza da '+BUILDINGS[padTile.building].name+
              (takesColonist?', con un colono a bordo.':'.'));
      }
    }
  }

  for(let i=moonRuns.length-1;i>=0;i--){
    const r=moonRuns[i];
    r.t+=dt*(r.phase==='up'?0.5:0.22)*(hasElevator()?2:1);   // con l'ascensore la navetta parte già in quota
    const k=Math.min(1,r.t);
    if(r.phase==='up'){
      // accensione: sale dal pianeta prima di puntare la luna
      const dir=r.tile.center;
      r.mesh.position.copy(dir.clone().multiplyScalar(tileRadius(r.tile)+0.4+k*k*14));
      r.mesh.quaternion.setFromUnitVectors(UP,dir);
      r.mesh.traverse(o=>{ if(o.userData&&o.userData.flame) o.scale.setScalar(1+Math.random()*0.6); });
      if(k>=1){ r.phase='out'; r.t=0; r.from=r.mesh.position.clone(); }
    } else if(r.phase==='out'){
      r.mesh.position.lerpVectors(r.from,moon.position,k);
      r.mesh.lookAt(moon.position);
      if(k>=1){
        r.phase='back'; r.t=0;
        if(r.crew) landOnMoon();
      }
    } else {
      const home=surfacePos(r.tile,0.4);
      r.mesh.position.lerpVectors(moon.position,home,k);
      r.mesh.lookAt(home);
      if(k>=1){
        scene.remove(r.mesh); moonRuns.splice(i,1);
        const got=moonYield();
        res.mat=Math.min(capacity(),res.mat+got);
        toast('Rientro dalla luna: +'+got+' materiali'+
              (moonCrew.length?' ('+moonCrew.length+' coloni lunari al lavoro)':'')+'.');
        refreshHUD();
      }
    }
  }
}
/* un anello che pulsa sulla casella da cui parte il razzo, così si vede */
function markLaunch(tile){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.07,8,20),
    new THREE.MeshBasicMaterial({color:0x50d2ff,transparent:true}));
  orientTo(g,tile,.06); ring.rotation.x=Math.PI/2; g.add(ring);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,3.4,12,1,true),
    new THREE.MeshBasicMaterial({color:0x50d2ff,transparent:true,side:THREE.DoubleSide}));
  col.position.y=1.7; g.add(col);
  addFX(g,2.6,k=>{
    ring.material.opacity=k; col.material.opacity=k*0.35;
    ring.scale.setScalar(1+(1-k)*0.7);
  });
}
function landOnMoon(){
  const s=suitMesh();
  const rnd=mulberry32(moonCrew.length*77+13);
  const d=randomUnit(rnd);
  s.position.copy(d.clone().multiplyScalar(2.45));
  s.quaternion.setFromUnitVectors(UP,d);
  moon.add(s);                 // figlio della luna: le orbita insieme
  moonCrew.push(s);
  toast('Un colono ha messo piede sulla luna.');
}
function orbitalPos(i,total,t){
  const a=(i/Math.max(1,total))*Math.PI*2 + t*0.12;
  const tilt=0.42;
  const rr=R+9;
  return new THREE.Vector3(Math.cos(a)*rr, Math.sin(a)*rr*Math.sin(tilt), Math.sin(a)*rr*Math.cos(tilt));
}
function addOrbital(kind){
  const m=orbitalMesh(kind);
  orbitGroup.add(m);
  // sale dal pianeta invece di apparire già in orbita
  orbit.push({kind, mesh:m, built:false, rise:0, fireT:0, level:1});
}
function stepOrbit(dt,clock){
  if(!orbitGroup) return;
  orbit.forEach((o,i)=>{
    const target=orbitalPos(i,orbit.length,clock);
    if(!o.built){
      o.rise=Math.min(1,o.rise+dt*0.35);
      o.mesh.position.copy(target.clone().multiplyScalar(0.35+0.65*o.rise));
      o.mesh.scale.setScalar(0.35+0.65*o.rise);
      if(o.rise>=1){ o.built=true; toast(ORBITALS[o.kind].name+' operativa in orbita.'); refreshHUD(); }
    } else {
      o.mesh.position.copy(target);
    }
    o.mesh.lookAt(0,0,0);
  });
}

/* il razzo, separato: compare solo quando la rampa lancia */
function rocketMesh(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.ConeGeometry(.24,1.05,7),mat(0xf2f4f8)); b.position.y=.65; g.add(b);
  const f=new THREE.Mesh(new THREE.ConeGeometry(.16,.34,7),mat(0xff7a3c)); f.position.y=.06; f.rotation.x=Math.PI; g.add(f);
  return g;
}
/* navetta che porta i predoni: scende, li sbarca, risale */
function dropshipMesh(){
  const g=new THREE.Group();
  const h=new THREE.Mesh(new THREE.CylinderGeometry(.1,.62,.5,6),mat(0x3a1c52)); h.position.y=.3; g.add(h);
  const r=new THREE.Mesh(new THREE.TorusGeometry(.55,.06,5,12),mat(0x9b3fd4)); r.position.y=.18; r.rotation.x=Math.PI/2; g.add(r);
  const e=new THREE.Mesh(new THREE.OctahedronGeometry(.16),mat(0xd96bff)); e.position.y=.62; g.add(e);
  return g;
}

function orientTo(obj,tile,lift=0){
  obj.position.copy(surfacePos(tile,lift));
  obj.quaternion.setFromUnitVectors(UP,tile.center);
}

/* ── cantiere: l'edificio nasce come impalcatura ─────────────── */
