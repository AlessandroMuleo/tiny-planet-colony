/* ═══════════════ progressione tra mondi ═══════════════
   Tre cose: un albero della ricerca a rami (al posto dei tre livelli in
   fila), i veterani che salgono sulla rampa e portano nel mondo nuovo
   quello che hanno imparato, e le statistiche della partita.           */

/* ── albero della ricerca ────────────────────────────────────────────
   Quattro rami da tre nodi. Un nodo richiede il precedente dello stesso
   ramo. La ricerca accumulata va al nodo scelto; se non ne scegli uno, lo
   sceglie il governatore (o il primo disponibile). I nodi restano tuoi
   quando cambi mondo.                                                  */
const RESEARCH = {
  tools:    {branch:'economia',   tier:1, name:'Attrezzi',          cost:90,  effect:'+18% a tutte le rese',            prod:0.18},
  rotation: {branch:'economia',   tier:2, name:'Rotazione colture', cost:200, effect:'+20% cibo, il cibo marcisce la metà', food:0.2, spoil:0.5},
  metallurgy:{branch:'economia',  tier:3, name:'Metallurgia',       cost:400, effect:'+50% lingotti e +10% a tutte le rese', bar:0.5, prod:0.1},
  weapons:  {branch:'militare',   tier:1, name:'Armi',              cost:90,  effect:'+22% danno di truppe e torrette', war:0.22},
  forts:    {branch:'militare',   tier:2, name:'Fortificazioni',    cost:200, effect:'edifici +50% integrità, torrette +1 di portata', fort:0.5},
  tactics:  {branch:'militare',   tier:3, name:'Tattica',           cost:400, effect:'la milizia colpisce il doppio, +22% danno', militia:1, war:0.22},
  languages:{branch:'diplomazia', tier:1, name:'Lingue',            cost:90,  effect:'doni e richieste esaudite +50% benevolenza', gift:0.5},
  commerce: {branch:'diplomazia', tier:2, name:'Commercio',         cost:200, effect:'carovane +50%, tributi +50%', caravan:0.5},
  charisma: {branch:'diplomazia', tier:3, name:'Carisma',           cost:400, effect:'malcontento degli assoggettati dimezzato, migranti ×2', unrest:0.5, migrants:1},
  rocketry: {branch:'spazio',     tier:1, name:'Propulsione',       cost:90,  effect:'la rampa costa il 30% in meno', padCost:0.3},
  orbital:  {branch:'spazio',     tier:2, name:'Meccanica orbitale',cost:200, effect:'strutture orbitali −25%', orbitCost:0.25},
  cryo:     {branch:'spazio',     tier:3, name:'Criogenia',         cost:400, effect:'+4 veterani a bordo della rampa', veterans:4}
};
const BRANCHES = ['economia','militare','diplomazia','spazio'];
let researched=new Set(), researching=null;
const hasTech = id => researched.has(id);
/* somma di un effetto su tutti i nodi completati */
const techSum = key => { let s=0; for(const id of researched) s+=RESEARCH[id][key]||0; return s; };
const canResearch = id => !researched.has(id) &&
  Object.values(RESEARCH).filter(n=>n.branch===RESEARCH[id].branch&&n.tier<RESEARCH[id].tier)
    .every(n=>researched.has(Object.keys(RESEARCH).find(k=>RESEARCH[k]===n)));
const researchOpen = () => Object.keys(RESEARCH).filter(canResearch);
const researchLeft = () => Object.keys(RESEARCH).length-researched.size;

function chooseResearch(id){
  if(!canResearch(id)) return;
  researching=id; renderResearch();
  toast('Ricerca: '+RESEARCH[id].name+'.');
}
/* il governatore sceglie secondo le pressioni: minaccia → militare,
   clan → diplomazia, rampa già costruita o vicina → spazio, altrimenti economia */
function govResearch(){
  const open=researchOpen();
  if(!open.length) return null;
  const threat=Math.min(1,(raidNo+1)/6), clans=settlements.some(s=>!settled(s));
  const score=id=>{
    const n=RESEARCH[id];
    const b={economia:0.8, militare:0.3+0.6*threat, diplomazia:clans?0.6:0.05,
             spazio:FC.mine.some(t=>isMine(t)&&hasFlag(t,'launch'))?0.7:0.25}[n.branch];
    return b/n.tier;
  };
  return open.sort((a,b)=>score(b)-score(a))[0];
}
/* chiamata a ogni tick con la ricerca prodotta */
function researchTick(points){
  if(points<=0||!researchLeft()) return;
  if(!researching||!canResearch(researching)) researching=auto?govResearch():researchOpen()[0];
  if(!researching) return;
  sci+=points;
  const n=RESEARCH[researching];
  if(sci<n.cost) return;
  sci-=n.cost; researched.add(researching); tech=researched.size;
  logEvent('🔬 Ricerca completata: '+n.name+' — '+n.effect+'.');
  researching=null;
  bumpWalk(); renderResearch();
}

/* ── pannello della ricerca ── */
function toggleResearch(){
  const on=!$('research').classList.contains('on');
  $('research').classList.toggle('on',on); $('b-research').classList.toggle('on',on);
  if(on) renderResearch();
}
function renderResearch(){
  const box=$('research-tree');
  if(!$('research').classList.contains('on')) return;
  box.innerHTML='';
  for(const br of BRANCHES){
    const col=document.createElement('div'); col.className='branch';
    col.innerHTML='<h4>'+br+'</h4>';
    for(const id of Object.keys(RESEARCH).filter(k=>RESEARCH[k].branch===br)){
      const n=RESEARCH[id], done=researched.has(id), cur=researching===id, ok=canResearch(id);
      const b=document.createElement('button');
      b.className='node'+(done?' done':'')+(cur?' cur':'');
      b.disabled=done||!ok;
      b.innerHTML='<b>'+n.name+'</b><span>'+n.effect+'</span><em>'+
        (done?'completata':cur?Math.floor(sci)+'/'+n.cost:n.cost+' ricerca')+'</em>';
      b.addEventListener('click',()=>chooseResearch(id));
      col.appendChild(b);
    }
    box.appendChild(col);
  }
}

/* ── veterani ──────────────────────────────────────────────────────
   Al decollo salgono a bordo i coloni più esperti, fino ai posti della
   rampa (3 + 2 per taglia, più la criogenia). Nel mondo nuovo arrivano
   con nome, tratti, abilità ed età.                                    */
let veterans=[];
function boardVeterans(pad){
  const seats=3+2*sizeOf(pad)+techSum('veterans');
  const xp=u=>Object.values(u.skills||{}).reduce((a,b)=>a+b,0);
  const crew=units.filter(u=>isPerson(u)&&u.stage!=='child'&&u.name)
    .sort((a,b)=>xp(b)-xp(a)).slice(0,seats);
  veterans=crew.map(u=>({name:u.name, traits:[...(u.traits||[])], skills:{...(u.skills||{})}, age:u.age}));
  return veterans.length;
}
/* dopo generateWorld: i primi coloni diventano i veterani sbarcati */
function landVeterans(){
  if(!veterans.length) return;
  const mine=units.filter(u=>u.faction==='you'&&u.kind==='worker');
  veterans.forEach((v,i)=>{
    const u=mine[i]; if(!u) return;
    u.name=v.name; u.traits=v.traits; u.skills=v.skills; u.age=Math.min(v.age,AGES.adult.until-20); applyAge(u);
  });
  const best=veterans.map(v=>{ const k=Object.keys(v.skills).sort((a,b)=>v.skills[b]-v.skills[a])[0];
    return v.name+(k?' ('+SKILLS[k]+')':''); });
  logEvent('🚀 Sbarcano '+veterans.length+' veterani: '+best.slice(0,5).join(', ')+(best.length>5?'…':'')+'.');
  veterans=[];
}

/* ── statistiche ───────────────────────────────────────────────────
   Un campione ogni 10 tick; oltre 400 campioni si dimezza la risoluzione,
   così una partita lunga resta leggera.                                */
let stats=[];
function statsTick(){
  if(worldAge%10) return;
  const minds=units.filter(u=>hasNeeds(u)&&u.needs);
  const live=settlements.filter(s=>!settled(s));
  stats.push({t:worldAge, w:worldIndex, pop:myPeople().length,
    food:Math.round(res.food), mat:Math.round(res.mat), pow:Math.round(res.pow), bar:Math.round(res.bar||0),
    wealth:Math.round(colonyWealth()),
    mood:minds.length?Math.round(100*minds.reduce((s,u)=>s+u.needs.mood,0)/minds.length):null,
    goodwill:live.length?Math.round(live.reduce((s,x)=>s+x.goodwill,0)/live.length):null,
    raids:raidNo});
  if(stats.length>400) stats=stats.filter((_,i)=>i%2===0);
}

/* ── schermata statistiche ───────────────────────────────────────────
   Piccoli multipli: un grafico per misura, ognuno con la sua scala (mai
   due assi sullo stesso grafico). Una serie sola per grafico, quindi un
   solo colore e nessuna legenda: il titolo dice cosa si guarda. Al
   passaggio del mouse, mirino e valore; le linee tratteggiate segnano
   i cambi di mondo. C'è anche la vista a tabella.                       */
const STAT_CHARTS = [
  {key:'pop',      label:'Coloni'},
  {key:'wealth',   label:'Ricchezza'},
  {key:'mood',     label:'Umore medio', unit:'%'},
  {key:'goodwill', label:'Benevolenza media dei clan'},
  {key:'food',     label:'Cibo'},
  {key:'mat',      label:'Materiali'}
];
let statsTable=false;
function toggleStats(){
  const on=!$('stats').classList.contains('on');
  $('stats').classList.toggle('on',on); $('b-stats').classList.toggle('on',on);
  if(on) renderStats();
}
function renderStats(){
  const box=$('stats-body');
  $('stats-mode').textContent=statsTable?'grafici':'tabella';
  if(!stats.length){ box.innerHTML='<p class="muted">Ancora nessun dato: torna tra qualche secondo.</p>'; return; }
  if(statsTable){ box.innerHTML=statsTableHTML(); return; }
  box.innerHTML='';
  for(const C of STAT_CHARTS){
    const pts=stats.filter(s=>s[C.key]!==null&&s[C.key]!==undefined);
    const fig=document.createElement('figure'); fig.className='sc';
    const last=pts.length?pts[pts.length-1][C.key]:null;
    fig.innerHTML='<figcaption><span>'+C.label+'</span><b>'+(last===null?'—':last.toLocaleString('it')+(C.unit||''))+'</b></figcaption>';
    if(pts.length<2){ fig.insertAdjacentHTML('beforeend','<p class="muted">servono più dati</p>'); box.appendChild(fig); continue; }
    fig.appendChild(lineChart(pts,C));
    box.appendChild(fig);
  }
}
function lineChart(pts,C){
  const W=260, H=86, L=34, Rp=6, T=6, B=16;
  const xs=pts.map(p=>p.t), ys=pts.map(p=>p[C.key]);
  const x0=Math.min(...xs), x1=Math.max(...xs);
  let y0=Math.min(0,...ys), y1=Math.max(...ys);
  if(y1===y0) y1=y0+1;
  const X=t=>L+(W-L-Rp)*(t-x0)/Math.max(1,x1-x0), Y=v=>T+(H-T-B)*(1-(v-y0)/(y1-y0));
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('class','sc-svg');
  svg.setAttribute('role','img'); svg.setAttribute('aria-label',C.label+': da '+ys[0]+' a '+ys[ys.length-1]);
  const fmt=v=>Math.abs(v)>=1000?(v/1000).toFixed(1).replace('.',',')+'k':String(Math.round(v));
  let html='';
  // griglia recessiva: zero (o minimo) e massimo
  for(const v of [y0,y1]) html+='<line class="grid" x1="'+L+'" x2="'+(W-Rp)+'" y1="'+Y(v)+'" y2="'+Y(v)+'"/>'+
    '<text class="ax" x="'+(L-4)+'" y="'+(Y(v)+3)+'" text-anchor="end">'+fmt(v)+'</text>';
  // cambi di mondo
  for(let i=1;i<pts.length;i++) if(pts[i].w!==pts[i-1].w)
    html+='<line class="world" x1="'+X(pts[i].t)+'" x2="'+X(pts[i].t)+'" y1="'+T+'" y2="'+(H-B)+'"/>';
  html+='<text class="ax" x="'+L+'" y="'+(H-3)+'">'+x0+'s</text><text class="ax" x="'+(W-Rp)+'" y="'+(H-3)+'" text-anchor="end">'+x1+'s</text>';
  html+='<path class="line" d="'+pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p[C.key]).toFixed(1)).join('')+'"/>';
  html+='<line class="cross" y1="'+T+'" y2="'+(H-B)+'" visibility="hidden"/><circle class="dot" r="4" visibility="hidden"/>';
  html+='<rect class="hit" x="'+L+'" y="0" width="'+(W-L-Rp)+'" height="'+H+'"/>';
  svg.innerHTML=html;
  const tip=document.createElement('div'); tip.className='sc-tip';
  const cross=svg.querySelector('.cross'), dot=svg.querySelector('.dot');
  const hit=svg.querySelector('.hit');
  const move=e=>{
    const r=svg.getBoundingClientRect(), t=x0+(x1-x0)*(((e.clientX-r.left)/r.width*W)-L)/(W-L-Rp);
    let best=pts[0]; for(const p of pts) if(Math.abs(p.t-t)<Math.abs(best.t-t)) best=p;
    const px=X(best.t), py=Y(best[C.key]);
    cross.setAttribute('x1',px); cross.setAttribute('x2',px); cross.setAttribute('visibility','visible');
    dot.setAttribute('cx',px); dot.setAttribute('cy',py); dot.setAttribute('visibility','visible');
    tip.textContent=best.t+'s · mondo '+best.w+' · '+best[C.key].toLocaleString('it')+(C.unit||'');
    tip.style.left=(px/W*100)+'%'; tip.classList.add('on');
  };
  hit.addEventListener('pointermove',move);
  hit.addEventListener('pointerleave',()=>{ cross.setAttribute('visibility','hidden'); dot.setAttribute('visibility','hidden'); tip.classList.remove('on'); });
  const wrap=document.createElement('div'); wrap.className='sc-wrap';
  wrap.appendChild(svg); wrap.appendChild(tip);
  return wrap;
}
function statsTableHTML(){
  const rows=stats.slice(-40).reverse();
  return '<div class="st-scroll"><table class="st"><thead><tr><th>tempo</th><th>mondo</th>'+
    STAT_CHARTS.map(C=>'<th>'+C.label.toLowerCase()+'</th>').join('')+'<th>incursioni</th></tr></thead><tbody>'+
    rows.map(s=>'<tr><td>'+s.t+'s</td><td>'+s.w+'</td>'+
      STAT_CHARTS.map(C=>'<td>'+(s[C.key]===null||s[C.key]===undefined?'—':s[C.key].toLocaleString('it')+(C.unit||''))+'</td>').join('')+
      '<td>'+s.raids+'</td></tr>').join('')+'</tbody></table></div>';
}
