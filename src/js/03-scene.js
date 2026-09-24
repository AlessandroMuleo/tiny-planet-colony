const stage=document.getElementById('stage');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(42, innerWidth/innerHeight, 1, 400);
if(!window.WebGLRenderingContext) fail('Questo browser non espone WebGL.');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0x070d1a,1);
stage.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x5a6b8c,0.9));
const sun=new THREE.DirectionalLight(0xfff0dd,1.15); sun.position.set(38,28,22); scene.add(sun);
const rim=new THREE.DirectionalLight(0x4a7fd0,0.45); rim.position.set(-28,-16,-24); scene.add(rim);
(function stars(){
  const g=new THREE.BufferGeometry(), pos=[], rnd=mulberry32(7);
  for(let i=0;i<1600;i++) pos.push(...randomUnit(rnd).multiplyScalar(160+rnd()*120).toArray());
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0x9fb4d8,size:.6,sizeAttenuation:true})));
})();

const planetGroup=new THREE.Group(); scene.add(planetGroup);
const UP=new THREE.Vector3(0,1,0);
const mat=h=>new THREE.MeshPhongMaterial({color:h,flatShading:true,shininess:0,specular:0x000000});

/* ═══════════════ stato ═══════════════ */
