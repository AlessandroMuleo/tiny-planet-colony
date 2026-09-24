/* ── random e rumore ──────────────────────────────────────────── */
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function randomUnit(rnd){
  const z=rnd()*2-1, a=rnd()*Math.PI*2, r=Math.sqrt(1-z*z);
  return new THREE.Vector3(r*Math.cos(a), r*Math.sin(a), z);
}
function makeNoise(seed){
  const rnd=mulberry32(seed), waves=[];
  for(let i=0;i<15;i++) waves.push({dir:randomUnit(rnd), freq:0.9+rnd()*4.4,
    amp:1/(1+i*0.52), phase:rnd()*Math.PI*2});
  return p=>{ let s=0,tot=0;
    for(const w of waves){ s+=w.amp*Math.sin(p.dot(w.dir)*w.freq+w.phase); tot+=w.amp; }
    return s/tot; };
}

/* ── geosfera: duale di un icosaedro suddiviso ────────────────── */
function buildHexasphere(subdiv){
  const t=(1+Math.sqrt(5))/2;
  const base=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],
              [0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
    .map(v=>new THREE.Vector3(v[0],v[1],v[2]).normalize());
  const baseFaces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],
                   [11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],
                   [3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const verts=[], vmap=new Map(), tris=[];
  const key=v=>v.x.toFixed(5)+','+v.y.toFixed(5)+','+v.z.toFixed(5);
  function addVert(v){
    const n=v.clone().normalize(), k=key(n);
    if(vmap.has(k)) return vmap.get(k);
    verts.push(n); vmap.set(k,verts.length-1); return verts.length-1;
  }
  for(const f of baseFaces){
    const A=base[f[0]], B=base[f[1]], C=base[f[2]], rows=[];
    for(let i=0;i<=subdiv;i++){
      const L=A.clone().lerp(B,i/subdiv), Rt=A.clone().lerp(C,i/subdiv), row=[];
      for(let j=0;j<=i;j++) row.push(addVert(i===0?L:L.clone().lerp(Rt,j/i)));
      rows.push(row);
    }
    for(let i=1;i<=subdiv;i++) for(let j=0;j<i;j++){
      tris.push([rows[i-1][j],rows[i][j],rows[i][j+1]]);
      if(j<i-1) tris.push([rows[i-1][j],rows[i][j+1],rows[i-1][j+1]]);
    }
  }
  const centroids=tris.map(tr=>verts[tr[0]].clone().add(verts[tr[1]]).add(verts[tr[2]]).normalize());
  const around=verts.map(()=>[]), neigh=verts.map(()=>new Set());
  tris.forEach((tr,ti)=>{
    for(const v of tr) around[v].push(ti);
    neigh[tr[0]].add(tr[1]); neigh[tr[0]].add(tr[2]);
    neigh[tr[1]].add(tr[0]); neigh[tr[1]].add(tr[2]);
    neigh[tr[2]].add(tr[0]); neigh[tr[2]].add(tr[1]);
  });
  return verts.map((center,i)=>{
    const n=center.clone();
    let u=new THREE.Vector3(0,0,1).cross(n);
    if(u.lengthSq()<1e-6) u=new THREE.Vector3(1,0,0).cross(n);
    u.normalize();
    const w=n.clone().cross(u);
    const corners=around[i].map(ti=>centroids[ti])
      .sort((a,b)=>Math.atan2(a.dot(w),a.dot(u))-Math.atan2(b.dot(w),b.dot(u)));
    return {id:i, center:n, corners, neighbors:[...neigh[i]]};
  });
}

