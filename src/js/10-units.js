function unitMesh(kind){
  const U=UNITS[kind], g=new THREE.Group();
  let body;
  if(kind==='guardian'){
    body=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.42,6),mat(U.color)); body.position.y=.21; g.add(body);
    const h=new THREE.Mesh(new THREE.OctahedronGeometry(.11),mat(0xfff0d0)); h.position.y=.5; g.add(h);
  } else if(kind==='raider'){
    const base=new THREE.Mesh(new THREE.ConeGeometry(.24,.2,5),mat(0x4a1d68));
    base.position.y=.1; base.rotation.x=Math.PI; g.add(base);
    body=new THREE.Mesh(new THREE.OctahedronGeometry(.19),mat(U.color)); body.position.y=.3; g.add(body);
    for(let i=0;i<3;i++){ const a=i/3*Math.PI*2;
      const sp=new THREE.Mesh(new THREE.ConeGeometry(.055,.26,4),mat(0xd96bff));
      sp.position.set(Math.cos(a)*.17,.42,Math.sin(a)*.17);
      sp.rotation.z=-Math.cos(a)*.6; sp.rotation.x=Math.sin(a)*.6; g.add(sp); }
  } else if(kind==='caravan'){
    body=new THREE.Mesh(new THREE.BoxGeometry(.26,.2,.34),mat(U.color)); body.position.y=.16; g.add(body);
    for(const x of [-.14,.14]){
      const wheel=new THREE.Mesh(new THREE.TorusGeometry(.08,.025,4,8),mat(0x6b5238));
      wheel.position.set(x,.08,0); wheel.rotation.y=Math.PI/2; g.add(wheel);
    }
    const load=new THREE.Mesh(new THREE.BoxGeometry(.18,.14,.24),mat(0xb8925e));
    load.position.y=.33; g.add(load);
  } else {
    body=new THREE.Mesh(new THREE.ConeGeometry(.13,.36,6),mat(U.color)); g.add(body);
    if(kind==='spear'||kind==='soldier'){
      const s=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.44),mat(0xff7a3c));
      s.position.set(.12,.12,0); g.add(s);
    } else if(kind==='bow'){
      const b=new THREE.Mesh(new THREE.TorusGeometry(.11,.02,4,8,Math.PI),mat(0xc7a06a));
      b.position.set(.13,.1,0); b.rotation.z=Math.PI/2; g.add(b);
    }
  }
  return {g,body};
}
function spawnUnit(kind,faction,tile){
  const U=UNITS[kind], m=unitMesh(kind);
  planetGroup.add(m.g);
  const u={kind,faction,mesh:m.g,body:m.body,hp:U.hp,hpMax:U.hp,
    from:tile,to:tile,t:1,speed:U.speed*(0.85+Math.random()*0.3),
    job:null,deployed:false,settlement:null,
    state:kind==='raider'?'landing':'ok',land:0,
    mode:'idle',carry:null,site:null,workT:0,bob:Math.random()*6,
    age:0, stage:'adult', wounded:false};
  if(UNITS[kind].civil){ u.age=AGES.child.until+Math.floor(Math.random()*60); applyAge(u); }
  if(faction==='you'&&UNITS[kind].civil) initPerson(u);
  units.push(u);
  return u;
}
function killUnit(u,i,died){
  releaseAll(u); releaseRescue(u);
  if(hasNeeds(u)) mournFriend(u,died===true||u.hp<=0);   // morto, o solo andato via
  dropCarry(u);
  planetGroup.remove(u.mesh);
  units.splice(i,1);
}
function dropCarry(u){
  u.hasCargo=false;
  if(u.carry){ u.mesh.remove(u.carry); u.carry=null; }
}
function takeCarry(u,hex){
  dropCarry(u);
  u.hasCargo=true;
  if(!showCargo) return;                 // il carico esiste comunque, non si disegna
  const b=blockMesh(hex);
  b.position.set(0,.42,0);
  u.mesh.add(b); u.carry=b;
}
function clearAllCargoMeshes(){
  for(const u of units) if(u.carry){ u.mesh.remove(u.carry); u.carry=null; }
}
/* aspetto e capacità cambiano con l'età e con le ferite */
function applyAge(u){
  const st=stageAt(u.age);
  u.stage=st;
  u.mesh.scale.setScalar(AGES[st].scale);
  if(u.body) u.body.material.color.setHex(
    u.wounded ? 0xd98a8a : st==='elder' ? 0xcfc3b0 : UNITS[u.kind].color);
}
const isPerson = u => u.faction==='you'&&PEOPLE.includes(u.kind);
const isLabor  = u => u.faction==='you'&&LABOR.includes(u.kind);
const myPeople = () => units.filter(isPerson);
const myLabor  = () => units.filter(isLabor);
const myThralls= () => units.filter(u=>u.faction==='you'&&u.kind==='thrall');
const demography=()=>{ const d={child:0,adult:0,elder:0};
  for(const u of myPeople()) d[u.stage]++; return d; };
const workPower = u => u.wounded ? 0 : (u.kind==='thrall' ? THRALL_WORK : AGES[u.stage].work);
const workforce = () => myLabor().filter(u=>workPower(u)>0).length;
/* quanto picchia davvero: i bambini no, gli anziani meno, la ricerca aiuta */
function unitDamage(u){
  let d=UNITS[u.kind].dmg;
  if(!d) return 0;
  if(u.kind==='thrall') return 0;   // non combattono: solo fuga, come in civilBrain
  if(isPerson(u)){
    if(u.stage==='child'||u.wounded) return 0;
    if(u.stage==='elder') d*=0.6;
  }
  // la tattica raddoppia i colpi della milizia (coloni civili che difendono)
  if(u.faction==='you'&&UNITS[u.kind].civil) d*=(1+techSum('militia'))*skillMul(u,'war');
  if(nearCaptain(u)) d*=1.2;                     // accanto al capo squadra
  return d*(u.faction==='you'?techWar():1);
}
const myUnits  = () => units.filter(u=>u.faction==='you');
const myCivil  = () => units.filter(u=>u.faction==='you'&&UNITS[u.kind].civil);
const myTroops = () => units.filter(u=>u.faction==='you'&&!UNITS[u.kind].civil);
const raiders  = () => units.filter(u=>u.faction==='raider');

/* ═══════════════ economia e lavoro ═══════════════ */
