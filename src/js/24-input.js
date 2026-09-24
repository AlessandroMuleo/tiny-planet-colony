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
  updateCamera();
});
el.addEventListener('pointerup',e=>{dragging=false; if(moved<5) pick(e.clientX,e.clientY);});
el.addEventListener('wheel',e=>{
  e.preventDefault();
  dist=Math.min(80,Math.max(18,dist+Math.sign(e.deltaY)*2.2));
  updateCamera();
},{passive:false});

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function pick(cx,cy){
  ndc.x=(cx/innerWidth)*2-1; ndc.y=-(cy/innerHeight)*2+1;
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObject(terrainMesh)[0];
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
