let theta=0.7, phi=1.15, dist=36, dragging=false, lastX=0, lastY=0, moved=0, autoSpin=true;
function updateCamera(){
  camera.position.set(dist*Math.sin(phi)*Math.cos(theta),dist*Math.cos(phi),dist*Math.sin(phi)*Math.sin(theta));
  camera.lookAt(0,0,0);
}
const el=renderer.domElement;
el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);
  dragging=true;lastX=e.clientX;lastY=e.clientY;moved=0;autoSpin=false;});
el.addEventListener('pointermove',e=>{
  if(!dragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  lastX=e.clientX; lastY=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
  theta-=dx*0.006; phi=Math.min(Math.PI-0.12,Math.max(0.12,phi-dy*0.006));
  if(moved>5) followed=null;             // trascinare la vista smette di seguire
  updateCamera();
});
el.addEventListener('pointerup',e=>{dragging=false; if(moved<5) pick(e.clientX,e.clientY);});
el.addEventListener('wheel',e=>{
  e.preventDefault();
  dist=Math.min(80,Math.max(18,dist+Math.sign(e.deltaY)*2.2));
  updateCamera();
},{passive:false});

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
/* il colono seguito dalla camera: si sceglie cliccandolo, Esc o un
   trascinamento della vista lo lasciano andare */
let followed=null;
/* i coloni sono minuscoli: vale un clic entro 0,35 dalla figura, purché
   il pianeta non la nasconda */
function pickColonist(terrainDist){
  const tmp=new THREE.Vector3();
  let best=null, bd=Infinity;
  for(const u of units){
    if(!hasNeeds(u)||!u.mesh.visible) continue;
    u.mesh.getWorldPosition(tmp);
    if(ray.ray.distanceToPoint(tmp)>0.35) continue;
    const along=tmp.clone().sub(ray.ray.origin).dot(ray.ray.direction);
    if(along<0||along>terrainDist+0.6) continue;
    if(along<bd){ bd=along; best=u; }
  }
  return best;
}
function follow(u){
  followed=u; autoSpin=false;
  if(marker){ planetGroup.remove(marker); marker=null; }
  selected=u.from; setInspector(selected); refreshTray(); clearRange();
  toast('Segui '+(u.name||'il colono')+'. Esc o trascina la vista per smettere.');
}
/* la camera si porta dolcemente sopra il colono seguito */
function followTick(dt){
  if(!followed) return;
  if(!units.includes(followed)){ followed=null; return; }
  const p=new THREE.Vector3(); followed.mesh.getWorldPosition(p); p.normalize();
  const phiT=Math.min(Math.PI-0.12,Math.max(0.12,Math.acos(p.y))), thetaT=Math.atan2(p.z,p.x);
  let d=thetaT-theta; d=Math.atan2(Math.sin(d),Math.cos(d));
  const k=Math.min(1,dt*3);
  theta+=d*k; phi+=(phiT-phi)*k;
  updateCamera();
  if(selected!==followed.from){ selected=followed.from; setInspector(selected); }
}
function pick(cx,cy){
  ndc.x=(cx/innerWidth)*2-1; ndc.y=-(cy/innerHeight)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObject(terrainMesh)[0];
  if(!activePower){
    const u=pickColonist(hit?hit.distance:Infinity);
    if(u){ follow(u); return; }
  }
  followed=null;
  if(!hit){
    if(!activePower){ selected=null; setInspector(null); refreshTray(); }
    return;
  }
  const tile=tiles[faceToTile[hit.faceIndex]];
  if(activePower){ castPower(activePower,tile); setPower(activePower); return; }
  selected=tile;
  setInspector(selected); refreshTray(); updateRangeVisual(selected);
  if(marker) planetGroup.remove(marker);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,6,16),
    new THREE.MeshBasicMaterial({color:0xff7a3c}));
  orientTo(ring,selected,.03); ring.rotateX(Math.PI/2);
  planetGroup.add(ring); marker=ring;
}
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

/* ═══════════════ avvio e loop ═══════════════ */
