function buildingMesh(kind){
  const g=new THREE.Group();
  if(kind==='hut'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.62,.44,.62),mat(0xe8d9be)); b.position.y=.22; g.add(b);
    const r=new THREE.Mesh(new THREE.ConeGeometry(.52,.42,4),mat(0xc4553f)); r.position.y=.63; r.rotation.y=Math.PI/4; g.add(r);
    for(const x of [-.14,.14]){
      const w=new THREE.Mesh(new THREE.BoxGeometry(.13,.14,.02),
        new THREE.MeshBasicMaterial({color:0xffd9a0}));
      w.position.set(x,.24,.32); w.userData.light=true; w.visible=false; g.add(w);
    }
  } else if(kind==='farm'){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.86,.1,.86),mat(0x6b4a30)); p.position.y=.05; g.add(p);
    // le spighe crescono col lavoro e spariscono alla mietitura
    for(let i=-1;i<=1;i++){
      const r=new THREE.Mesh(new THREE.BoxGeometry(.72,.30,.16),mat(0xd8c25a));
      r.position.set(0,.10,i*.26);
      r.userData.crop=true; r.scale.y=0.02;
      g.add(r);
    }
  } else if(kind==='mine'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.6),mat(0x5d6470)); b.position.y=.15; g.add(b);
    const tw=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.7),mat(0x8b939f)); tw.position.y=.6; g.add(tw);
    const w=new THREE.Mesh(new THREE.TorusGeometry(.17,.045,6,10),mat(0xd9a441));
    w.position.y=.92; w.rotation.y=Math.PI/2; w.userData.spin=true; g.add(w);
  } else if(kind==='plant'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.34,.5,7),mat(0x4d5a72)); b.position.y=.25; g.add(b);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.55,7),mat(0x8fd98a)); c.position.y=.75; g.add(c);
    const pw=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),
      new THREE.MeshBasicMaterial({color:0x8fffb0}));
    pw.position.y=1.0; pw.userData.light=true; pw.visible=false; g.add(pw);
  } else if(kind==='block'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.8,.72,.6),mat(0xe0d3b8)); b.position.y=.36; g.add(b);
    const r=new THREE.Mesh(new THREE.BoxGeometry(.88,.12,.68),mat(0xa8563f)); r.position.y=.78; g.add(r);
    for(const x of [-.24,0,.24]) for(const y of [.28,.56]){
      const w=new THREE.Mesh(new THREE.BoxGeometry(.13,.15,.02),
        new THREE.MeshBasicMaterial({color:0xffd9a0}));
      w.position.set(x,y,.31); w.userData.light=true; w.visible=false; g.add(w);
    }
  } else if(kind==='clinic'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.7,.4,.6),mat(0xeef2f8)); b.position.y=.2; g.add(b);
    const r=new THREE.Mesh(new THREE.BoxGeometry(.76,.1,.66),mat(0x7fb0c9)); r.position.y=.44; g.add(r);
    const c1=new THREE.Mesh(new THREE.BoxGeometry(.30,.09,.02),
      new THREE.MeshBasicMaterial({color:0xff6b6b}));
    c1.position.set(0,.62,.0); g.add(c1);
    const c2=new THREE.Mesh(new THREE.BoxGeometry(.09,.30,.02),
      new THREE.MeshBasicMaterial({color:0xff6b6b}));
    c2.position.set(0,.62,.0); g.add(c2);
    const w=new THREE.Mesh(new THREE.BoxGeometry(.4,.14,.02),
      new THREE.MeshBasicMaterial({color:0xffd9a0}));
    w.position.set(0,.22,.31); w.userData.light=true; w.visible=false; g.add(w);
  } else if(kind==='road'){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.9,.06,.5),mat(0x8b8577)); p.position.y=.03; g.add(p);
    for(let i=-1;i<=1;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.18,.03,.42),mat(0xa8a294));
      s.position.set(i*.3,.06,0); g.add(s);
    }
  } else if(kind==='workshop'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.7,.4,.6),mat(0x6f6357)); b.position.y=.2; g.add(b);
    const r=new THREE.Mesh(new THREE.BoxGeometry(.76,.1,.66),mat(0x4d443b)); r.position.y=.44; g.add(r);
    const ch=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.55,6),mat(0x8d8578));
    ch.position.set(.22,.72,0); g.add(ch);
    const gear=new THREE.Mesh(new THREE.TorusGeometry(.16,.05,5,8),mat(0xd9a441));
    gear.position.set(-.18,.55,.2); g.add(gear);
    const w=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.02),new THREE.MeshBasicMaterial({color:0xffa860}));
    w.position.set(-.1,.2,.31); w.userData.light=true; w.visible=false; g.add(w);
  } else if(kind==='green'){
    const base=new THREE.Mesh(new THREE.BoxGeometry(.84,.1,.7),mat(0x6b7a5e)); base.position.y=.05; g.add(base);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshPhongMaterial({color:0xb8ecd0,flatShading:true,shininess:0,transparent:true,opacity:.75}));
    dome.position.y=.1; dome.scale.z=.85; g.add(dome);
    for(let i=-1;i<=1;i++){
      const r=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.1),mat(0x5f9c4a));
      r.position.set(0,.10,i*.18); r.userData.crop=true; r.scale.y=0.02; g.add(r);
    }
    const lw=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({color:0xc8ffd8}));
    lw.position.y=.5; lw.userData.light=true; lw.visible=false; g.add(lw);
  } else if(kind==='market'){
    const f=new THREE.Mesh(new THREE.BoxGeometry(.9,.08,.9),mat(0x8a7458)); f.position.y=.04; g.add(f);
    for(const [x,z] of [[.36,.36],[-.36,.36],[.36,-.36],[-.36,-.36]]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.55),mat(0x6b5238));
      p.position.set(x,.32,z); g.add(p);
    }
    const cover=new THREE.Mesh(new THREE.ConeGeometry(.75,.28,4),mat(0xd8734f));
    cover.position.y=.72; cover.rotation.y=Math.PI/4; g.add(cover);
    for(const [x,z,c] of [[.15,.1,0xa8c14e],[-.16,-.08,0x9aa4b2]]){
      const crate=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),mat(c));
      crate.position.set(x,.18,z); g.add(crate);
    }
    const mw=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffd9a0}));
    mw.position.y=.5; mw.userData.light=true; mw.visible=false; g.add(mw);
  } else if(kind==='depot'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.5,8),mat(0xb8a184)); b.position.y=.25; g.add(b);
    const c=new THREE.Mesh(new THREE.ConeGeometry(.44,.26,8),mat(0x8a7458)); c.position.y=.63; g.add(c);
  } else if(kind==='dock'){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.8,.12,.8),mat(0x8a6f4e)); p.position.y=.28; g.add(p);
    for(const [x,z] of [[.3,.3],[-.3,.3],[.3,-.3],[-.3,-.3]]){
      const l=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5),mat(0x6b5238)); l.position.set(x,.05,z); g.add(l); }
  } else if(kind==='fishery'){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.84,.12,.84),mat(0x8a6f4e)); p.position.y=.28; g.add(p);
    const h=new THREE.Mesh(new THREE.BoxGeometry(.44,.3,.44),mat(0xd7e2ea)); h.position.y=.49; g.add(h);
    const r=new THREE.Mesh(new THREE.ConeGeometry(.38,.26,4),mat(0x3f7fa8)); r.position.y=.75; r.rotation.y=Math.PI/4; g.add(r);
    for(const [x,z] of [[.32,.32],[-.32,-.32]]){
      const l=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5),mat(0x6b5238)); l.position.set(x,.05,z); g.add(l); }
  } else if(kind==='wall'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.78,.46,.30),mat(0x646c78)); b.position.y=.23; g.add(b);
    for(let i=-2;i<=2;i++){
      const c=new THREE.Mesh(new THREE.BoxGeometry(.11,.14,.32),mat(0x858f9d));
      c.position.set(i*.15,.52,0); g.add(c);
    }
    for(const x of [-.39,.39]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,.56,6),mat(0x4c525c));
      p.position.set(x,.28,0); g.add(p);
    }
  } else if(kind==='rfarm'){
    const p=new THREE.Mesh(new THREE.BoxGeometry(.86,.1,.86),mat(0x4a2e28)); p.position.y=.05; g.add(p);
    for(let i=-1;i<=1;i++){
      const r=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.16),mat(0xb5633a));
      r.position.set(0,.16,i*.26); g.add(r);
    }
    const shed=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),mat(0x6b3b42)); shed.position.set(-.25,.2,-.25); g.add(shed);
    const flag=new THREE.Mesh(new THREE.BoxGeometry(.18,.1,.02),mat(0xe0616b)); flag.position.set(.37,.38,.28); g.add(flag);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.45),mat(0x8c796b)); pole.position.set(.28,.25,.28); g.add(pole);
  } else if(kind==='rtower'){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,.4,6),mat(0x523037)); base.position.y=.2; g.add(base);
    const mid=new THREE.Mesh(new THREE.CylinderGeometry(.22,.28,.55,6),mat(0x6b3b42)); mid.position.y=.62; g.add(mid);
    const plat=new THREE.Mesh(new THREE.CylinderGeometry(.34,.24,.12,6),mat(0x3a1f24)); plat.position.y=.92; g.add(plat);
    for(let i=0;i<4;i++){ const a=(i/4)*Math.PI*2;
      const spk=new THREE.Mesh(new THREE.ConeGeometry(.04,.22,4),mat(0xe0616b));
      spk.position.set(Math.cos(a)*.28,1.02,Math.sin(a)*.28); g.add(spk); }
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshBasicMaterial({color:0xff4555}));
    gem.position.y=1.04; g.add(gem);
  } else if(kind==='armory'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.66,.4,.66),mat(0x59616e)); b.position.y=.2; g.add(b);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(.34,.42,.22,6),mat(0x3f4652)); r.position.y=.5; g.add(r);
    for(const x of [.22,-.22]){ const s=new THREE.Mesh(new THREE.ConeGeometry(.07,.42,4),mat(0xdfe9ff));
      s.position.set(x,.72,0); g.add(s); }
    const aw=new THREE.Mesh(new THREE.BoxGeometry(.34,.12,.02),
      new THREE.MeshBasicMaterial({color:0xffb26b}));
    aw.position.set(0,.2,.34); aw.userData.light=true; aw.visible=false; g.add(aw);
  } else if(kind==='shrine'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.42,.46,.18,6),mat(0x4a4436)); b.position.y=.09; g.add(b);
    for(let i=0;i<3;i++){ const a=i/3*Math.PI*2;
      const p=new THREE.Mesh(new THREE.BoxGeometry(.09,.62,.09),mat(0xbfae86));
      p.position.set(Math.cos(a)*.28,.4,Math.sin(a)*.28); g.add(p); }
    const o=new THREE.Mesh(new THREE.OctahedronGeometry(.2),mat(0xffc46b)); o.position.y=.86; g.add(o);
  } else if(kind==='turret'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.34,.4,.24,6),mat(0x4b5361)); b.position.y=.12; g.add(b);
    const h=new THREE.Mesh(new THREE.SphereGeometry(.2,7,5),mat(0x6f7a8c)); h.position.y=.34; g.add(h);
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.6),mat(0xff7a3c));
    bar.position.set(0,.42,.22); bar.rotation.x=Math.PI/2.4; g.add(bar);
  } else if(kind==='fort'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,.58,.6,8),mat(0x6a7280)); b.position.y=.3; g.add(b);
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2;
      const m2=new THREE.Mesh(new THREE.BoxGeometry(.14,.18,.14),mat(0x848d9c));
      m2.position.set(Math.cos(a)*.46,.68,Math.sin(a)*.46); g.add(m2); }
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.5,6),mat(0x8f98a8)); t.position.y=.85; g.add(t);
    const fw=new THREE.Mesh(new THREE.BoxGeometry(.5,.14,.02),
      new THREE.MeshBasicMaterial({color:0xffd9a0}));
    fw.position.set(0,.3,.5); fw.userData.light=true; fw.visible=false; g.add(fw);
    const f=new THREE.Mesh(new THREE.BoxGeometry(.26,.16,.02),mat(0xff7a3c)); f.position.set(.16,1.15,0); g.add(f);
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.45),mat(0xd8d2c4)); p.position.y=1.12; g.add(p);
  } else if(kind==='lab'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.6,.34,.6),mat(0x40506b)); b.position.y=.17; g.add(b);
    const d=new THREE.Mesh(new THREE.SphereGeometry(.32,10,7,0,Math.PI*2,0,Math.PI/2),mat(0x8fd0f0));
    d.position.y=.34; g.add(d);
    const a=new THREE.Mesh(new THREE.TorusGeometry(.3,.02,4,14),mat(0xffc46b));
    a.position.y=.5; a.rotation.x=Math.PI/2.6; g.add(a);
    const lw=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),
      new THREE.MeshBasicMaterial({color:0x9fe3ff}));
    lw.position.y=.42; lw.userData.light=true; lw.visible=false; g.add(lw);
  } else if(kind==='pad'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,.56,.16,8),mat(0x4a5266)); b.position.y=.08; g.add(b);
    for(let i=0;i<4;i++){ const a=i/4*Math.PI*2;
      const l=new THREE.Mesh(new THREE.BoxGeometry(.07,.4,.07),mat(0x6f7a8c));
      l.position.set(Math.cos(a)*.42,.28,Math.sin(a)*.42); g.add(l); }
  } else if(kind==='keep'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,.55,6),mat(0x6b3b42)); b.position.y=.28; g.add(b);
    const c=new THREE.Mesh(new THREE.ConeGeometry(.52,.4,6),mat(0xe0616b)); c.position.y=.75; g.add(c);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.5),mat(0xd8d2c4)); pole.position.y=1.15; g.add(pole);
    const flag=new THREE.Mesh(new THREE.BoxGeometry(.26,.16,.02),mat(0xe0616b)); flag.position.set(.14,1.3,0); g.add(flag);
  } else if(kind==='foundry'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.7,.42,.6),mat(0x5a4f48)); b.position.y=.21; g.add(b);
    const ch=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.7,6),mat(0x3e3632)); ch.position.set(.2,.6,-.12); g.add(ch);
    const glow=new THREE.Mesh(new THREE.BoxGeometry(.3,.14,.02),new THREE.MeshBasicMaterial({color:0xff8a3c}));
    glow.position.set(-.1,.2,.31); g.add(glow);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.1),mat(0xd9a441)); bar.position.set(-.22,.47,.1); g.add(bar);
  } else if(kind==='granary'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.6,10),mat(0xd8c49a)); b.position.y=.3; g.add(b);
    const r=new THREE.Mesh(new THREE.ConeGeometry(.36,.3,10),mat(0x9a6a3c)); r.position.y=.75; g.add(r);
    const s=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.4,8),mat(0xc9b284)); s.position.set(.32,.2,.1); g.add(s);
  } else if(kind==='well'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.26,.28,.22,10),mat(0x9a9488)); b.position.y=.11; g.add(b);
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.02,10),mat(0x3d8fc4)); w.position.y=.22; g.add(w);
    for(const x of [-.22,.22]){ const p=new THREE.Mesh(new THREE.BoxGeometry(.05,.4,.05),mat(0x6b5238)); p.position.set(x,.36,0); g.add(p); }
    const r=new THREE.Mesh(new THREE.ConeGeometry(.34,.18,4),mat(0x8a5a3c)); r.position.y=.64; r.rotation.y=Math.PI/4; g.add(r);
  } else if(kind==='tavern'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.72,.44,.56),mat(0xb88a5c)); b.position.y=.22; g.add(b);
    const r=new THREE.Mesh(new THREE.BoxGeometry(.8,.12,.64),mat(0x7a4a2c)); r.position.y=.5; g.add(r);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(.16,.12,.02),mat(0xffc46b)); sign.position.set(.3,.36,.3); g.add(sign);
    const w=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.02),new THREE.MeshBasicMaterial({color:0xffc070}));
    w.position.set(-.1,.24,.29); w.userData.light=true; w.visible=false; g.add(w);
  } else if(kind==='school'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.76,.4,.52),mat(0xe2d6c0)); b.position.y=.2; g.add(b);
    const r=new THREE.Mesh(new THREE.ConeGeometry(.5,.3,4),mat(0x3f7fa8)); r.position.y=.55; r.rotation.y=Math.PI/4; r.scale.set(1.1,1,.8); g.add(r);
    const bell=new THREE.Mesh(new THREE.SphereGeometry(.07,6,5),mat(0xd9a441)); bell.position.y=.78; g.add(bell);
  } else if(kind==='memorial'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,.5),mat(0x9a9aa2)); b.position.y=.06; g.add(b);
    const o=new THREE.Mesh(new THREE.BoxGeometry(.14,.7,.14),mat(0xd7dbe2)); o.position.y=.47; g.add(o);
    const f=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),new THREE.MeshBasicMaterial({color:0xffe0a0}));
    f.position.set(.18,.18,.18); f.userData.light=true; f.visible=false; g.add(f);
  } else if(kind==='embassy'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.74,.36,.6),mat(0xeae4d6)); b.position.y=.18; g.add(b);
    for(const x of [-.26,-.09,.09,.26]){ const c=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.34,6),mat(0xffffff)); c.position.set(x,.2,.33); g.add(c); }
    const d=new THREE.Mesh(new THREE.SphereGeometry(.2,10,6,0,Math.PI*2,0,Math.PI/2),mat(0x8fd98a)); d.position.y=.36; g.add(d);
  } else if(kind==='watch'){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,.9,6),mat(0x8a7a64)); b.position.y=.45; g.add(b);
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.28,.2,.1,6),mat(0x6b5238)); p.position.y=.94; g.add(p);
    const l=new THREE.Mesh(new THREE.SphereGeometry(.08,6,5),new THREE.MeshBasicMaterial({color:0xffe08a})); l.position.y=1.06; g.add(l);
  } else if(kind==='control'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.8,.36,.64),mat(0xd7e2ea)); b.position.y=.18; g.add(b);
    const d=new THREE.Mesh(new THREE.SphereGeometry(.26,10,6,0,Math.PI*2,0,Math.PI/2),mat(0x9aa4b2)); d.position.set(-.18,.36,0); g.add(d);
    const dish=new THREE.Mesh(new THREE.SphereGeometry(.22,10,5,0,Math.PI*2,0,Math.PI/3),mat(0xffffff));
    dish.position.set(.24,.62,0); dish.rotation.x=-Math.PI/4; g.add(dish);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.3),mat(0x8d97a6)); pole.position.set(.24,.48,0); g.add(pole);
    const w=new THREE.Mesh(new THREE.BoxGeometry(.4,.1,.02),new THREE.MeshBasicMaterial({color:0x50d2ff}));
    w.position.set(.1,.22,.33); w.userData.light=true; w.visible=false; g.add(w);
  } else if(kind==='elevator'){
    // la base a terra e un cavo che sale oltre le nuvole
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,.3,8),mat(0x5b6472)); b.position.y=.15; g.add(b);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.2,6),mat(0x9aa4b2)); t.position.y=.9; g.add(t);
    const cable=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,6,4),mat(0xd8d2c4)); cable.position.y=4.4; g.add(cable);
    const car=new THREE.Mesh(new THREE.BoxGeometry(.16,.2,.16),mat(0xffc46b)); car.position.y=2.4; car.userData.lift=true; g.add(car);
  } else if(kind==='camp'){
    const b=new THREE.Mesh(new THREE.ConeGeometry(.36,.5,5),mat(0x8a4a52)); b.position.y=.25; g.add(b);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.3),mat(0xd8d2c4)); r.position.y=.62; g.add(r);
  }
  return g;
}
