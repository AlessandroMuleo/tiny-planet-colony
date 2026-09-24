const $=id=>document.getElementById(id);
const fmt=n=>Math.floor(n).toString();
const sign=n=>(n>=0?'+':'')+n.toFixed(1);
let openCat=null;

function refreshHUD(r){
  r=r||rates();
  $('s-food').textContent=fmt(res.food);
  $('s-mat').textContent =fmt(res.mat)+'/'+capacity();
  $('s-pow').textContent =fmt(res.pow);
  $('s-pop').textContent =pop;
  $('s-war').textContent =myTroops().length;
  const d=r.demo||demography();
  $('s-demo').textContent=d.child+'·'+d.adult+'·'+d.elder;
  const hurt=myPeople().filter(u=>u.wounded).length;
  $('r-hurt').textContent=hurt?hurt+' ferit'+(hurt===1?'o':'i'):'';
  $('r-hurt').className='rate'+(hurt?' neg':'');
  $('s-build').textContent=buildersCount();
  $('s-orbit').textContent=orbit.filter(o=>o.built).length+
    (orbit.some(o=>!o.built)?' (+1)':'');
  const set=(el,v)=>{const e=$(el);e.textContent=sign(v);e.className='rate'+(v<0?' neg':'');};
  set('r-food',r.food); set('r-mat',r.mat); set('r-pow',r.pow);
  const idle=idleCount();
  $('r-pop').textContent=pop+'/'+r.houses+' posti · '+idle+' liber'+(idle===1?'o':'i')+
    (r.block?' · '+r.block:'');
  $('r-pop').className='rate'+((idle>0||r.block)?' neg':'');
  $('s-raid').textContent=raidActive?'in corso':Math.max(0,raidIn)+'s';
  $('r-raid').textContent=raidActive?raiders().length+' nemici':'';
  $('r-raid').className='rate'+(raidActive||raidIn<15?' neg':'');
  $('s-season').textContent=SEASONS[season].name+(boomT>0?' · abbondanza '+boomT+'s':'');
  $('s-tech').textContent='liv. '+tech;
  $('r-tech').textContent = tech>0
    ? '+'+Math.round((techProd()-1)*100)+'% rese, +'+Math.round((techWar()-1)*100)+'% danno'+
      (tech<3?' · '+Math.floor(sci)+'/'+TECH_COST[tech+1]:'')
    : Math.floor(sci)+'/'+TECH_COST[1]+' al 1° livello';
  $('s-thrall').textContent=myThralls().length;
  refreshTray(); refreshArmy();
}

function setInspector(tile){
  const box=$('inspector');
  if(!tile){ box.classList.remove('on'); clearRange(); return; }
  const B=BIOMES[tile.biome];
  $('i-title').innerHTML='<span class="swatch" style="background:#'+
    B.top.toString(16).padStart(6,'0')+'"></span>'+B.label;
  const crew=$('i-crew'), kinds=$('i-kinds'), demoRow=$('i-demorow'), disb=$('i-disbandrow');
  crew.style.display='none'; kinds.style.display='none'; demoRow.style.display='none';
  disb.style.display='none'; $('i-cargorow').style.display='none';
  $('i-uprow').style.display='none';
  if(tile.owner==='you') demoRow.style.display='block';
  if(isMine(tile)){
    const B=BUILDINGS[tile.building], up=$('i-upgrade'), rp=$('i-repair');
    const canUp=sizeOf(tile)<3&&B.blocks>0&&!B.fixed;
    up.style.display=canUp?'':'none';
    if(canUp){
      up.textContent='amplia a '+(sizeOf(tile)+1)+'× · '+(B.cost.mat||0)+'m'+(B.cost.pow?' '+B.cost.pow+'e':'');
      up.disabled=raidActive||res.mat<(B.cost.mat||0)||res.pow<(B.cost.pow||0);
      up.title=raidActive?'Non durante un\'incursione':'Torna cantiere per '+B.blocks+' blocchi, poi rende di più (U)';
    }
    const hurt=tile.hp<tile.hpMax-0.5;
    rp.style.display=hurt?'':'none';
    if(hurt){ const c=repairCost(tile); rp.textContent='ripara · '+c+'m'; rp.disabled=res.mat<c; }
    if(canUp||hurt) $('i-uprow').style.display='flex';
  }

  if(tile.site){
    const D=BUILDINGS[tile.site.kind];
    $('i-body').textContent=(tile.site.upgrade?'Ampliamento a ':'Cantiere ')+sizeOf(tile)+'×: '+D.name+
      ' — '+tile.site.have+'/'+tile.site.need+' blocchi consegnati · integrità '+
      Math.round(tile.hp)+'/'+tile.hpMax+'. I coloni liberi fanno la spola dal magazzino.';
  } else if(tile.building){
    const D=BUILDINGS[tile.building];
    const who=tile.owner==='rival'?(tile.settlement?tile.settlement.name:'rivale'):'tua';
    $('i-body').textContent=D.name+' '+sizeOf(tile)+'× ('+who+') — '+D.effect+
      (tile.hpMax?'  ·  '+Math.max(0,Math.round(tile.hp))+'/'+tile.hpMax+' integrità':'');
    if(tile.owner==='you'&&jobsOf(tile)>0){
      const w=tile.workers||0;
      const eff=Math.round((tile.effWorkers||0)*10)/10;
      $('i-count').textContent=w+'/'+jobsOf(tile);
      if(eff!==w) $('i-count').textContent+=' ('+eff+' effettivi)';
      $('i-minus').disabled=w<=0;
      $('i-plus').disabled =w>=jobsOf(tile)||idleCount()<=0;
      $('i-fill').disabled =w>=jobsOf(tile)||idleCount()<=0;
      crew.style.display='flex';
      if(D.launch){
        padCargoMat=Math.min(padCargoMat,cargoMax('mat'));
        padCargoFood=Math.min(padCargoFood,cargoMax('food'));
        $('cm-amt').textContent=padCargoMat;
        $('cf-amt').textContent=padCargoFood;
        $('cm-minus').disabled=padCargoMat<=0;
        $('cm-plus').disabled=padCargoMat>=cargoMax('mat');
        $('cf-minus').disabled=padCargoFood<=0;
        $('cf-plus').disabled=padCargoFood>=cargoMax('food');
        $('c-launch').disabled=!!launching||w<=0;
        $('c-launch').title=w<=0?'Serve almeno un addetto alla rampa':
          'All\'arrivo i magazzini tengono '+ARRIVAL_CAP+' per risorsa';
        $('i-cargorow').style.display='flex';
      }
      if(D.armory){
        kinds.style.display='flex';
        if(w>0) disb.style.display='block';
        for(const b of kinds.children) b.classList.toggle('on',b.dataset.kind===(tile.unit||'spear'));
      }
    }
  } else {
    $('i-body').textContent = BIOMES[tile.biome].water
      ? 'Mare aperto. Ci puoi costruire un molo o una peschiera.'
      : BIOMES[tile.biome].build ? 'Libera. Apri un catalogo e scegli cosa costruirci.'
                                 : 'Qui non si può costruire.';
  }
  box.classList.add('on');
}

const canAfford=B=>(!B.cost.mat||res.mat>=B.cost.mat)&&(!B.cost.pow||res.pow>=B.cost.pow);
function tileAllows(tile,key){
  if(!tile||tile.building||tile.site) return false;
  const B=BUILDINGS[key], bio=BIOMES[tile.biome];
  if(B.water ? !bio.water : !bio.build) return false;
  return !B.needs||B.needs.includes(tile.biome);
}
function refreshTray(){
  const cats=$('cats'), tray=$('tray');
  if(!cats.dataset.built){
    for(const c of CATALOGS){
      const b=document.createElement('button');
      b.textContent=c.label; b.dataset.cat=c.id;
      b.addEventListener('click',()=>{ openCat=openCat===c.id?null:c.id; refreshTray(); });
      cats.appendChild(b);
    }
    cats.dataset.built='1';
  }
  for(const b of cats.children) b.classList.toggle('on',b.dataset.cat===openCat);
  // BUG: questa riga stava DOPO due return anticipati, quindi bastava aprire
  // il catalogo Orbita (o chiudere tutto) e 2×/3× sparivano per sempre.
  $('sizes').classList.toggle('on', !!openCat && openCat!=='orbita');

  tray.classList.toggle('on',!!openCat);
  if(!openCat){ tray.innerHTML=''; tray.dataset.cat=''; return; }

  if(openCat==='orbita'){
    if(tray.dataset.cat!=='orbita'){
      tray.innerHTML=''; tray.dataset.cat='orbita';
      for(const key in ORBITALS){
        const O=ORBITALS[key];
        const b=document.createElement('button');
        b.className='card launch'; b.dataset.orb=key;
        b.textContent=ICONS[key]||'●';
        attachTip(b,O.name,O.cost.mat+' mat · '+O.cost.pow+' en',O.effect);
        b.addEventListener('click',()=>buildOrbital(key));
        tray.appendChild(b);
      }
    }
    for(const b of tray.children){
      const k=b.dataset.orb, O=ORBITALS[k];
      const need=!O.hub&&!hasOrbital('station');
      b.disabled = hasOrbital(k)||orbit.some(o=>o.kind===k)||need||
                   res.mat<O.cost.mat||res.pow<O.cost.pow;
      b.title = need ? 'Serve prima la Stazione orbitale' : '';
    }
    return;
  }

  if(tray.dataset.cat!==openCat){
    tray.innerHTML=''; tray.dataset.cat=openCat;
    for(const key in BUILDINGS){
      const B=BUILDINGS[key];
      if(B.rivalOnly||B.cat!==openCat) continue;
      const b=document.createElement('button');
      b.className='card'+(B.launch?' launch':'');
      b.dataset.key=key;
      b.textContent=ICONS[key]||'●';
      b.dataset.mat=B.cost.mat||0; b.dataset.pow=B.cost.pow||0; b.dataset.bl=B.blocks;
      attachTip(b,B.name,'',B.effect);
      b.addEventListener('click',()=>construct(key));
      tray.appendChild(b);
    }
  }
  for(const b of tray.children){
    const B=BUILDINGS[b.dataset.key];
    const m=(+b.dataset.mat)*buildSize, p=(+b.dataset.pow)*buildSize, bl=(+b.dataset.bl)*buildSize;
    b._tipCost=m+' mat'+(p?' · '+p+' en':'')+' · '+bl+' blocchi'+(buildSize>1?'  ·  taglia '+buildSize+'×':'');
    b.disabled=!selected||!tileAllows(selected,b.dataset.key)||!canAffordSize(B);
  }
}
const canAffordSize=B=>res.mat>=(B.cost.mat||0)*buildSize&&res.pow>=(B.cost.pow||0)*buildSize;

function refreshArmy(){
  const troops=myTroops();
  army.size=Math.min(army.size,troops.length);
  $('a-size').textContent=army.size+'/'+troops.length;
  $('a-minus').disabled=army.size<=0;
  $('a-plus').disabled =army.size>=troops.length;
  const list=$('a-list');
  if(!settlements.length){
    if(list.dataset.sig!=='none'){
      list.dataset.sig='none';
      list.innerHTML='<p style="margin:0;font-size:12px;color:var(--ink-dim)">'+
        'Nessun popolo su questo mondo. I vicini compaiono dal secondo pianeta.</p>';
    }
    return;
  }
  // Prima la lista si ricostruiva da zero a ogni secondo: un clic che cadeva
  // a cavallo del ridisegno finiva su un pulsante già rimosso e si perdeva.
  // Ora si ridisegna solo se cambia qualcosa che si vede.
  const noTroops=myTroops().length===0, mk=hasMarket();
  const sig=JSON.stringify(settlements.map(s=>[s.name,s.relation,
    tiles.filter(t=>t.settlement===s&&t.building).length,
    units.filter(u=>u.settlement===s).length,
    canAlly(s),canSubjugate(s),army.target===s,
    mk&&res.food>=40,mk&&res.mat>=40,noTroops]));
  if(list.dataset.sig===sig) return;
  list.dataset.sig=sig;
  list.innerHTML='';
  for(const s of settlements){
    const alive=tiles.filter(t=>t.settlement===s&&t.building).length;
    const guards=units.filter(u=>u.settlement===s).length;
    const d=document.createElement('div'); d.className='settle';
    d.innerHTML='<div class="nm">'+s.name+'<span class="rel '+s.relation+'">'+s.relation+'</span></div>'+
      '<div class="meta">'+alive+' strutture · '+guards+' soldati</div>';
    const acts=document.createElement('div'); acts.className='acts';
    if(s.relation!=='conquistato'&&s.relation!=='assoggettato'){
      const a=document.createElement('button');
      a.textContent='alleati ('+ALLY_COST.mat+'m)';
      a.disabled=!canAlly(s);
      a.addEventListener('click',()=>allyWith(s));
      acts.appendChild(a);
      if(canSubjugate(s)){
        const sub=document.createElement('button');
        sub.textContent='assoggetta';
        sub.addEventListener('click',()=>subjugate(s));
        acts.appendChild(sub);
      }
      if(s.relation==='alleato'){
        const b1=document.createElement('button');
        b1.textContent='40 cibo → 32 mat';
        b1.disabled=!hasMarket()||res.food<40;
        b1.addEventListener('click',()=>tradeWith(s,'buy'));
        acts.appendChild(b1);
        const b2=document.createElement('button');
        b2.textContent='40 mat → 32 cibo';
        b2.disabled=!hasMarket()||res.mat<40;
        b2.addEventListener('click',()=>tradeWith(s,'sell'));
        acts.appendChild(b2);
      }
      const w=document.createElement('button'); w.className='war';
      w.textContent=army.target===s?'richiama':'attacca';
      w.disabled=myTroops().length===0&&army.target!==s;
      w.addEventListener('click',()=>army.target===s?recall():declareWar(s));
      acts.appendChild(w);
    } else {
      const a=document.createElement('button');
      a.textContent=s.relation==='assoggettato'?'assoggettato · tributo 1,4':'conquistato';
      a.disabled=true;
      acts.appendChild(a);
    }
    d.appendChild(acts); list.appendChild(d);
  }
}

/* etichetta che segue il mouse: il nome sta fuori dal pulsante, così le
   icone restano piccole anche con venti edifici in catalogo */
function attachTip(el,name,cost,effect){
  el._tipName=name; el._tipCost=cost; el._tipEffect=effect;
  el.addEventListener('mouseenter',()=>showTip(el));
  el.addEventListener('mousemove',()=>placeTip(el));
  el.addEventListener('mouseleave',hideTip);
  el.addEventListener('focus',()=>showTip(el));
  el.addEventListener('blur',hideTip);
}
function showTip(el){
  const t=$('tip');
  t.innerHTML='<b>'+el._tipName+'</b>'+
    (el._tipCost?'<span class="c">'+el._tipCost+'</span>':'')+
    '<span class="e">'+el._tipEffect+'</span>';
  t.classList.add('on'); placeTip(el);
}
function placeTip(el){
  const t=$('tip'), r=el.getBoundingClientRect();
  t.style.left=Math.min(innerWidth-260,Math.max(8,r.left+r.width/2-125))+'px';
  t.style.top=(r.top-t.offsetHeight-10)+'px';
}
function hideTip(){ $('tip').classList.remove('on'); }

let toastTimer;
function toast(msg,ev){
  if(quiet) return;                      // durante il caricamento di una partita
  eventLog.push({t:worldAge,w:worldIndex,msg,ev:!!ev});
  if(eventLog.length>120) eventLog.shift();
  if(logOpen) renderLog();
  const el=$('toast'); el.textContent=msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('on'),ev?4200:2600);
}
const logEvent=msg=>toast(msg,true);
function renderLog(){
  const list=$('log-list'), mmss=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  list.innerHTML='';
  for(let i=eventLog.length-1;i>=0;i--){
    const e=eventLog[i], li=document.createElement('li');
    if(e.ev) li.className='ev';
    const tm=document.createElement('time'); tm.textContent=mmss(e.t);
    tm.title='mondo n° '+e.w;
    const tx=document.createElement('span'); tx.textContent=e.msg;
    li.append(tm,tx); list.appendChild(li);
  }
  $('log-count').textContent=eventLog.length+' voci';
}
function toggleLog(){
  logOpen=!logOpen;
  $('log').classList.toggle('on',logOpen); $('b-log').classList.toggle('on',logOpen);
  if(logOpen) renderLog();
}

/* ═══════════════ pausa e velocità ═══════════════ */
function setSpeed(m){
  if(m>0) lastSpeed=m;
  speedMul=m;
  for(const x of $('speeds').children) x.classList.toggle('on',+x.dataset.mul===m);
}
const togglePause=()=>setSpeed(speedMul>0?0:lastSpeed);

/* ═══════════════ ampliare e riparare ═══════════════
   Ampliare non è istantaneo: la struttura torna cantiere per la sola
   parte nuova, e intanto non produce. Riparare costa materiali in
   proporzione al danno.                                               */
const canUpgrade=t=>!!t&&isMine(t)&&sizeOf(t)<3&&
  BUILDINGS[t.building].blocks>0&&!BUILDINGS[t.building].fixed&&!raidActive;
function upgradeBuilding(tile){
  if(!tile||!isMine(tile)) return;
  if(raidActive){ toast('Non si amplia durante un\'incursione.'); return; }
  if(!canUpgrade(tile)) return;
  const B=BUILDINGS[tile.building], cm=B.cost.mat||0, cp=B.cost.pow||0;
  if(res.mat<cm||res.pow<cp){
    toast('Per ampliare servono '+cm+' materiali'+(cp?' e '+cp+' energia':'')+'.'); return;
  }
  res.mat-=cm; res.pow-=cp;
  const hp=tile.hp;
  tile.size=sizeOf(tile)+1;
  openSite(tile,tile.building,'you',B.blocks,true);
  tile.hp=hp;                             // l'edificio esistente non torna a 1
  trimWorkers(); syncJobs(); setInspector(tile); refreshHUD();
  toast(B.name+': ampliamento a '+tile.size+'× — servono '+B.blocks+' blocchi.');
}
function repairCost(t){
  const B=BUILDINGS[t.building], miss=1-t.hp/t.hpMax;
  return Math.max(1,Math.ceil((B.cost.mat||6)*sizeOf(t)*0.4*miss));
}
function repairBuilding(tile){
  if(!tile||!isMine(tile)||tile.hp>=tile.hpMax) return;
  const c=repairCost(tile);
  if(res.mat<c){ toast('Per riparare servono '+c+' materiali.'); return; }
  res.mat-=c; tile.hp=tile.hpMax;
  setInspector(tile); refreshHUD();
  toast(BUILDINGS[tile.building].name+' riparata per '+c+' materiali.');
}

/* ═══════════════ salvataggio ═══════════════
