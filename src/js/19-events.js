function setPower(p){
  activePower = activePower===p ? null : p;
  for(const k in POWERS) $('p-'+k).classList.toggle('pwr-on', activePower===k);
  if(activePower) toast(POWERS[p].icon+' '+POWERS[p].label+': clicca un punto del pianeta.');
}
function addFX(obj,life,update,onEnd){ planetGroup.add(obj); activeFX.push({obj,life,max:life,update,onEnd}); }
function stepFX(dt){
  for(let i=activeFX.length-1;i>=0;i--){
    const fx=activeFX[i];
    fx.life-=dt;
    const k=Math.max(0,fx.life/fx.max);
    if(fx.update) fx.update(k);
    if(fx.life<=0){
      fx.obj.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
      planetGroup.remove(fx.obj); activeFX.splice(i,1);
      if(fx.onEnd) fx.onEnd();
    }
  }
}

/* ═══════════════ eventi casuali ═══════════════
   Ogni 90–170 s (non durante un'incursione) succede qualcosa che la
   colonia non ha scelto: va gestito, non solo subito.
   Ogni evento è una voce della tabella: weight è quanto spesso esce
   rispetto agli altri, run() lo fa accadere. Un evento nuovo si aggiunge
   qui senza toccare il resto.                                        */
const EVENTS={
  meteor:{weight:1, run(){
    // tre impatti: uno vicino alla colonia, due a caso. Danneggiano ciò che
    // colpiscono ma lasciano frammenti di minerale da raccogliere
    // lo scudo orbitale devia i meteoriti prima che tocchino terra
    if(orbitalOn('shield')){ logEvent('🛡 Lo scudo orbitale devia una pioggia di meteoriti.'); return; }
    const land=tiles.filter(t=>BIOMES[t.biome].build);
    const home=playerBuildings();
    const hits=[];
    if(home.length){
      const h=home[Math.floor(Math.random()*home.length)];
      const n=h.neighbors.map(i=>tiles[i]).filter(t=>BIOMES[t.biome].build);
      hits.push(n.length?n[Math.floor(Math.random()*n.length)]:h);
    }
    while(hits.length<3&&land.length) hits.push(land[Math.floor(Math.random()*land.length)]);
    hits.forEach((t,i)=>meteor(t,0.9+i*0.45));
    logEvent('☄ Pioggia di meteoriti in arrivo: tre impatti.');
  }},
  plague:{weight:1, run(){
    const healthy=myPeople().filter(u=>!u.wounded&&u.stage!=='child');
    if(!healthy.length){ eventIn=20; return false; }
    // un ospedale funzionante dimezza il contagio
    const clinic=FC.mine.some(t=>hasFlag(t,'heal')&&(t.workers||0)>0);
    const n=Math.max(1,Math.ceil(healthy.length*(clinic?0.1:0.22)));
    for(let i=0;i<n;i++){
      const u=healthy.splice(Math.floor(Math.random()*healthy.length),1)[0];
      if(!u) break;
      u.hp=u.hpMax*0.3; u.wounded=true; applyAge(u);
    }
    trimWorkers(); syncJobs();
    chainT=45;                            // tra 45 secondi: carestia, se nessuno cura
    logEvent('🦠 Epidemia: '+n+(n===1?' colono si è ammalato':' coloni si sono ammalati')+
      (clinic?' (l\'ospedale ha contenuto il contagio).':'. Un ospedale con addetti la conterrebbe.'));
  }},
  refugees:{weight:1, run(){
    const free=rates().houses-myPeople().length;
    const n=Math.min(3,free);
    if(n<=0){ logEvent('🧳 Dei profughi sono passati oltre: non c\'erano letti liberi.'); return false; }
    for(let i=0;i<n;i++) spawnUnit('worker','you',randomHome());   // arrivano adulti
    pop=myPeople().length;
    syncJobs();
    logEvent('🧳 Sono arrivati '+n+(n===1?' profugo: ora è un colono.':' profughi: ora sono coloni.'));
  }},
  // solo se c'è qualcosa in orbita da spegnere
  flare:{get weight(){ return orbit.some(o=>o.built)?0.7:0; }, run(){ return solarFlare(); }},
  harvest:{weight:1, run(){
    boomT=35;
    logEvent('🌾 Annata eccezionale: +40% cibo dai campi per 35 secondi.');
  }}
};
/* estrazione pesata: con pesi tutti uguali coincide con la vecchia
   scelta uniforme, e consuma un solo numero casuale */
function pickEvent(){
  const keys=Object.keys(EVENTS);
  const total=keys.reduce((n,k)=>n+EVENTS[k].weight,0);
  let r=Math.random()*total;
  for(const k of keys){ r-=EVENTS[k].weight; if(r<0) return k; }
  return keys[keys.length-1];
}
function randomEventTick(){
  if(worldAge<60||raidActive) return;
  if(--eventIn>0) return;
  eventIn=90+Math.floor(Math.random()*80);
  // una volta su tre l'evento chiede una scelta; in picco di tensione mai
  // eventi buoni per caso, in ripresa più spesso l'annata abbondante
  if(Math.random()<0.35&&offerChoice()) return;
  let k=pickEvent();
  if(narrator.phase==='ripresa'&&Math.random()<0.5) k='harvest';
  fireEvent(k);
}
function fireEvent(kind){
  if(EVENTS[kind].run()===false) return;   // non è successo niente: HUD invariato
  refreshHUD();
}
function meteor(tile,delay){
  const sky=tile.center.clone().multiplyScalar(R+30), ground=surfacePos(tile,0.2);
  const g=new THREE.Group();
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,0),
    new THREE.MeshBasicMaterial({color:0xffa060}));
  const trail=new THREE.Mesh(new THREE.ConeGeometry(.28,2.2,6,1,true),
    new THREE.MeshBasicMaterial({color:0xff7a3c,transparent:true,opacity:.55}));
  trail.position.y=1.2; rock.add(trail);
  rock.quaternion.setFromUnitVectors(UP,tile.center);
  rock.position.copy(sky); g.add(rock);
  const life=delay+0.8;
  addFX(g,life,k=>{
    const p=Math.min(1,Math.max(0,(1-k)*life-delay)/0.8);
    rock.visible=(1-k)*life>=delay;
    rock.position.lerpVectors(sky,ground,p*p);
  },()=>impact(tile));
}
function impact(tile){
  // lampo d'impatto
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.9,10,8),
    new THREE.MeshBasicMaterial({color:0xffd08a,transparent:true}));
  flash.position.copy(surfacePos(tile,0.2));
  const g=new THREE.Group(); g.add(flash);
  addFX(g,0.6,k=>{ flash.material.opacity=k; flash.scale.setScalar(1+(1-k)*2); });
  if(tile.building){
    const mine=tile.owner==='you';
    damageBuilding(tile,35);
    if(mine&&tile.building) toast('Un meteorite ha colpito '+BUILDINGS[tile.building].name+'.');
  }
  for(const u of nearbyUnits(tile,false)) if(u.state!=='landing') u.hp-=6;
  // i frammenti valgono solo se un magazzino è a portata di passo:
  // un sasso caduto dall'altra parte del mondo non lo raccoglie nessuno
  if(BIOMES[tile.biome].build&&FC.storage.length&&haulSteps(tile)<=12){
    res.mat=Math.min(capacity(),res.mat+12);
    toast('☄ Frammenti di meteorite raccolti: +12 materiali.');
  }
}
function castPower(kind,tile){
  const P=POWERS[kind];
  if(res.pow<P.cost){ toast('Energia insufficiente: servono '+P.cost+'.'); return; }
  res.pow-=P.cost;
  const target=surfacePos(tile,0.2);

  if(kind==='bolt'){
    const sky=tile.center.clone().multiplyScalar(R+24), pts=[sky];
    for(let i=1;i<9;i++){
      const p=sky.clone().lerp(target,i/9);
      p.add(new THREE.Vector3((Math.random()-.5)*2.4,(Math.random()-.5)*2.4,(Math.random()-.5)*2.4));
      pts.push(p);
    }
    pts.push(target);
    const g=new THREE.Group();
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({color:0xa8f5ff,transparent:true}));
    const spark=new THREE.Mesh(new THREE.SphereGeometry(.7,8,6),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true}));
    spark.position.copy(target); g.add(line); g.add(spark);
    addFX(g,0.3,k=>{ line.material.opacity=k; spark.material.opacity=k*.8; spark.scale.setScalar(1+(1-k)*3); });
    let hit=0;
    for(const o of nearbyUnits(tile,true)){
      if(o.state==='landing') continue;
      if(o.faction==='raider'||(o.faction==='rival'&&o.settlement&&o.settlement.relation==='ostile')){
        o.hp-=P.dmg; hit++;
      }
    }
    toast(hit?'Fulmine: '+hit+(hit===1?' nemico folgorato.':' nemici folgorati.'):'Fulmine a vuoto.');

  } else if(kind==='rain'){
    const pts=[];
    for(let i=0;i<40;i++) pts.push(target.clone().add(
      new THREE.Vector3((Math.random()-.5)*3.2, Math.random()*4+1, (Math.random()-.5)*3.2)));
    const cloud=new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.PointsMaterial({color:0x70c0ff,size:.35,transparent:true}));
    const g=new THREE.Group(); g.add(cloud);
    addFX(g,1.6,k=>{ cloud.material.opacity=k; cloud.position.y-=.05; });
    res.food=Math.min(capacity(),res.food+P.food);
    for(const u of units) if(u.job&&BUILDINGS[u.job.building].ships==='food') u.workT+=harvestTime()*0.5;
    toast('Pioggia fertile: +'+P.food+' cibo, raccolti accelerati.');

  } else {
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(P.range/2,P.range/2,9,16,1,true),
      new THREE.MeshBasicMaterial({color:0xffea78,transparent:true,side:THREE.DoubleSide}));
    cyl.position.copy(target);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tile.center);
    const g=new THREE.Group(); g.add(cyl);
    addFX(g,0.9,k=>{ cyl.material.opacity=k*.45; cyl.scale.x=cyl.scale.z=1+(1-k)*.4; });
    let healed=0;
    for(const u of units){
      if(u.faction!=='you'||u.mesh.position.distanceTo(target)>=P.range) continue;
      u.hp=u.hpMax;
      if(u.wounded){ u.wounded=false; applyAge(u); }
      healed++;
    }
    if(healed) syncJobs();
    toast('Cura solare: '+healed+' rimessi in forze.');
  }
  refreshHUD();
}

/* ═══════════════ modalità automatica ═══════════════ */

/* ═══════════════ il narratore ═══════════════
   Al posto del timer fisso, come i narratori di RimWorld:
   · la forza di un'incursione dipende da quanto vale la colonia;
   · la tensione segue un ciclo: calma, tensione che cresce, picco;
   · dopo una batosta la pressione cala per un po' (ripresa), così ci si
     può rialzare invece di crollare a cascata.                          */
const NARRATOR_PHASES = {
  calma:    {label:'calma',     len:180, every:1.45, size:0.8, next:'tensione'},
  tensione: {label:'tensione',  len:140, every:1.0,  size:1.0, next:'picco'},
  picco:    {label:'picco',     len:90,  every:0.6,  size:1.3, next:'calma'},
  ripresa:  {label:'ripresa',   len:150, every:2.0,  size:0.6, next:'calma'}
};
let narrator={phase:'calma', t:0, hurt:0};
const narratorPhase = () => NARRATOR_PHASES[narrator.phase]||NARRATOR_PHASES.calma;
/* quanto vale la colonia: scorte, edifici, persone */
function colonyWealth(){
  let w=res.food*0.3+res.mat+res.pow*0.5+(res.bar||0)*3;
  for(const t of FC.mine) if(isMine(t)) w+=(BUILDINGS[t.building].cost.mat||0)*sizeOf(t)*0.6;
  w+=myPeople().length*15;
  return w;
}
/* quanti predoni: cresce con la radice della ricchezza, non in proporzione,
   altrimenti una colonia grande verrebbe schiacciata */
function raidSize(){
  const pts=Math.sqrt(Math.max(0,colonyWealth()))*0.12*(1+0.15*(worldIndex-1));
  return Math.max(1,Math.min(14,Math.round(pts*narratorPhase().size*diff().raid)));
}
function raidInterval(){
  return Math.round((100+ORBITALS.eye.delay*orbMul('eye'))*
    (trait.raid?0.65:trait.calm?1.5:1)*narratorPhase().every);
}
/* le perdite recenti: ogni colono perso vale 1, ogni edificio 0,5 */
function narratorHurt(k){ narrator.hurt+=k; }
function narratorTick(){
  narrator.hurt=Math.max(0,narrator.hurt-0.02);
  // una batosta è relativa: 4 perdite contano per un villaggio, non per una città
  if(narrator.phase!=='ripresa'&&narrator.hurt>=Math.max(4,pop*0.08)){
    narrator.phase='ripresa'; narrator.t=0; narrator.hurt=0;
    raidIn=Math.max(raidIn,raidInterval());
    logEvent('🌤 Dopo le perdite, la pressione cala: un periodo di ripresa.');
    return;
  }
  if(++narrator.t<narratorPhase().len) return;
  narrator.t=0; narrator.phase=narratorPhase().next;
  if(narrator.phase==='picco') logEvent('🌩 Il pericolo cresce: incursioni più fitte e più forti.');
}

/* ── eventi con una scelta ──────────────────────────────────────────
   Due opzioni, due conseguenze. Una finestra chiede cosa fare; se non
   rispondi in tempo vale la prima opzione (la più prudente). In modalità
   automatica sceglie il governatore, con lo stesso motore a punteggio:
   ogni opzione ha uno score(c) sul contesto della colonia.            */
const CHOICE_EVENTS = {
  chased:{weight:1, when:()=>rates().houses-pop>=2,
    title:'Profughi inseguiti',
    text:()=>'Tre profughi chiedono asilo, ma li inseguono dei predoni. Se li accogli, i predoni arrivano subito.',
    options:[
      {label:'respingili', run:()=>{ logEvent('I profughi proseguono il loro viaggio.'); },
       score:c=>0.4},
      {label:'accoglili (+3 coloni, arrivano 3 predoni)', run:()=>{
        for(let i=0;i<3;i++) spawnUnit('worker','you',randomHome());
        pop=myPeople().length; syncJobs();
        if(!raidActive) spawnRaidOf(3);
        logEvent('🧳 Tre profughi accolti. I loro inseguitori sono già qui.');
      }, score:c=>c.troops>=3||c.turrets>=2?0.8:0.25}
    ]},
  merchant:{weight:1, when:()=>res.food>=50,
    title:'Mercante di passaggio',
    text:()=>'Un mercante offre 60 materiali in cambio di 50 cibo.',
    options:[
      {label:'lascia perdere', run:()=>{}, score:c=>0.3},
      {label:'scambia (−50 cibo, +60 materiali)', run:()=>{
        res.food-=50; res.mat=Math.min(capacity(),res.mat+60);
        logEvent('Scambio col mercante: +60 materiali.');
      }, score:c=>c.foodDays>60&&res.mat<capacity()*0.7?0.8:0.2}
    ]},
  traveler:{weight:0.8, when:()=>rates().houses-pop>=1,
    title:'Viandante malato',
    text:()=>'Un viandante febbricitante bussa alla porta. Accoglierlo è giusto, ma può contagiare.',
    options:[
      {label:'mandalo via (umore −)', run:()=>{
        for(const u of units) if(hasNeeds(u)&&u.needs) u.needs.mood=Math.max(0,u.needs.mood-0.05);
        logEvent('Il viandante se ne va. Qualcuno non l\'ha presa bene.');
      }, score:c=>0.35},
      {label:'accoglilo (+1 colono, rischio epidemia)', run:()=>{
        spawnUnit('worker','you',randomHome()); pop=myPeople().length; syncJobs();
        if(Math.random()<0.5) fireEvent('plague');
        else logEvent('Il viandante guarisce e resta con voi.');
      }, score:c=>c.clinic?0.8:0.3}
    ]},
  deserters:{weight:0.8, when:()=>settlements.some(s=>!settled(s)&&s.relation!=='alleato'),
    title:'Disertori',
    text:()=>{ const s=narrator.target; return 'Due soldati del '+(s?s.name:'clan')+' disertano e chiedono di unirsi a voi. Il clan non gradirà.'; },
    options:[
      {label:'rifiuta', run:()=>{}, score:c=>0.4},
      {label:'accoglili (+2 coloni, −15 benevolenza)', run:()=>{
        for(let i=0;i<2;i++) spawnUnit('worker','you',randomHome());
        pop=myPeople().length; syncJobs();
        if(narrator.target) shiftGoodwill(narrator.target,-15,'hai accolto i loro disertori');
        logEvent('Due disertori si uniscono alla colonia.');
      }, score:c=>narrator.target&&narrator.target.goodwill<0?0.7:0.3}
    ], prepare:()=>{ const c=settlements.filter(s=>!settled(s)&&s.relation!=='alleato');
      narrator.target=c[Math.floor(Math.random()*c.length)]||null; }}
};
let choice=null;               // {id, deadline}: la scelta in attesa di risposta
const CHOICE_TIME = 30;
function offerChoice(){
  const ids=Object.keys(CHOICE_EVENTS).filter(k=>CHOICE_EVENTS[k].when());
  if(!ids.length||choice) return false;
  const total=ids.reduce((n,k)=>n+CHOICE_EVENTS[k].weight,0);
  let r=Math.random()*total, id=ids[ids.length-1];
  for(const k of ids){ r-=CHOICE_EVENTS[k].weight; if(r<0){ id=k; break; } }
  const E=CHOICE_EVENTS[id];
  if(E.prepare) E.prepare();
  choice={id, deadline:CHOICE_TIME};
  logEvent('❓ '+E.title+': '+E.text());
  if(auto) govChoose(); else showChoice();
  return true;
}
function resolveChoice(i){
  if(!choice) return;
  const E=CHOICE_EVENTS[choice.id], opt=E.options[i]||E.options[0];
  choice=null; hideChoice();
  opt.run(); refreshHUD();
}
function choiceTick(){
  if(!choice) return;
  if(auto){ govChoose(); return; }      // «auto» acceso con una scelta aperta: decide il governatore
  if(--choice.deadline<=0){ logEvent('Nessuna risposta: si fa la scelta prudente.'); resolveChoice(0); }
  else if(!auto) showChoice();
}
/* il governatore sceglie l'opzione col punteggio più alto */
function govChoose(){
  if(!choice) return;
  const E=CHOICE_EVENTS[choice.id];
  const c={troops:myTroops().length, turrets:FC.mine.filter(t=>isMine(t)&&hasFlag(t,'dps')).length,
    foodDays:res.food/Math.max(0.5,rates().stock-rates().food), clinic:activeFlag('heal')};
  let best=0, bs=-1;
  E.options.forEach((o,i)=>{ const s=o.score(c); if(s>bs){ bs=s; best=i; } });
  logEvent('Il governatore sceglie: '+E.options[best].label+'.');
  resolveChoice(best);
}
function showChoice(){
  if(!choice) return;
  const E=CHOICE_EVENTS[choice.id], box=$('choice');
  if(box.dataset.id!==choice.id){
    box.dataset.id=choice.id;
    $('choice-title').textContent=E.title;
    $('choice-text').textContent=E.text();
    const acts=$('choice-acts'); acts.innerHTML='';
    E.options.forEach((o,i)=>{
      const b=document.createElement('button'); b.textContent=o.label;
      b.addEventListener('click',()=>resolveChoice(i)); acts.appendChild(b);
    });
  }
  $('choice-time').textContent=choice.deadline+'s';
  box.classList.add('on');
}
function hideChoice(){ const box=$('choice'); box.classList.remove('on'); box.dataset.id=''; }

/* ── catene di eventi ──────────────────────────────────────────────
   Un'epidemia non curata diventa carestia (i campi rendono la metà);
   durante la carestia chi se ne va per fame non sparisce: se sono in
   tre, fondano un clan rivale di esuli, che ce l'ha con te.            */
let famineT=0, exiles=0, chainT=0;   // exiles<0: questa carestia ha già i suoi esuli
function chainTick(){
  if(chainT>0&&--chainT===0){
    if(!activeFlag('heal')){
      famineT=80;
      logEvent('🥀 L\'epidemia non curata ha svuotato i campi: carestia per 80 secondi.');
    } else logEvent('L\'ospedale ha fermato il contagio prima che toccasse i raccolti.');
  }
  if(famineT>0&&--famineT===0){ exiles=0; logEvent('La carestia è finita.'); }
}
/* chiamata quando un colono se ne va per fame */
function starvedAway(u){
  if(famineT<=0||exiles<0) return;
  exiles++;
  if(exiles<3) return;
  exiles=-1;                          // un solo clan di esuli per carestia
  foundExileClan(u.from);
}
/* i rapporti tra clan sono indicizzati per nome: due clan con lo stesso
   nome si confondevano (una guerra "da una parte sola") */
function uniqueClanName(base){
  const roman=['',' II',' III',' IV',' V',' VI'];
  for(const r of roman) if(!settlements.some(s=>s.name===base+r)) return base+r;
  return base+' '+settlements.length;
}
function foundExileClan(near){
  const spots=tiles.filter(t=>BIOMES[t.biome].build&&!t.building&&
    near.center.dot(t.center)<0.5&&settlements.every(s=>s.core.center.dot(t.center)<0.8));
  if(!spots.length) return;
  const core=spots[Math.floor(Math.random()*spots.length)];
  const s={name:uniqueClanName('Esuli di '+NAMES[(worldIndex-1)%NAMES.length]), core, relation:'neutrale', tiles:[core],
    mat:20, thinkT:0, personality:'guerrieri', goodwill:-35, ties:{}, wars:{}, request:null,
    reqT:200, unrest:0, giftT:0, log:['−35 ci hanno lasciati alla fame']};
  finish(core,'keep','rival'); core.settlement=s;
  for(const o of settlements) setTie(s,o,0);
  settlements.push(s);
  for(let i=0;i<3;i++) spawnUnit('soldier','rival',core).settlement=s;
  $('a-list').dataset.sig='';
  logEvent('⚑ Gli esuli della carestia hanno fondato un loro clan: '+s.name+'. Non vi hanno perdonato.');
}
