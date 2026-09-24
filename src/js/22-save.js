   Tutto in localStorage, in chiaro. È voluto: è il punto di partenza per
   un caso di studio sulla fiducia nel client (modificare il salvataggio
   a mano è il primo "cheat" che chiunque prova).                       */
const SAVE_KEY='tiny-planet-colony-save-v1';
function snapshot(){
  const si=s=>s?settlements.indexOf(s):-1;
  return {v:1, when:Date.now(), worldIndex, worldSeed, trait:trait.id,
    res:{...res}, pop, sci, tech, season, seasonT, raidIn, raidNo, worldAge, dayT,
    eventIn, boomT, padCargoMat, padCargoFood, grief, raidWarned,
    narrator:{phase:narrator.phase,t:narrator.t,hurt:narrator.hurt}, choice, famineT, exiles, chainT,
    researched:[...researched], researching, stats, achFlags, weather, difficulty,
    army:{size:army.size, target:si(army.target)},
    settlements:settlements.map(s=>({name:s.name, core:s.core.id, relation:s.relation,
      mat:s.mat, thinkT:s.thinkT, tradeT:s.tradeT||0,
      pers:s.personality, gw:s.goodwill, ties:s.ties, req:s.request, reqT:s.reqT,
      unrest:s.unrest||0, giftT:s.giftT||0, log:s.log, wars:s.wars})),
    tiles:tiles.filter(t=>t.building).map(t=>({id:t.id, b:t.building, o:t.owner, sz:sizeOf(t),
      hp:t.hp, w:t.workers||0, un:t.unit, set:si(t.settlement), sp:t.spawnT||0,
      st:t.site?{need:t.site.need, have:t.site.have, up:!!t.site.upgrade}:null})),
    units:units.map(u=>({k:u.kind, f:u.faction, at:u.from.id, hp:u.hp, age:u.age,
      wd:!!u.wounded, set:si(u.settlement), dep:!!u.deployed,
      load:u.load, dl:!!u.delivered, life:u.lifeT||0,
      nd:u.needs?[u.needs.food,u.needs.rest,u.needs.mood]:null,
      nm:u.name, tr:u.traits, sk:u.skills, org:si(u.origin), rq:u.req||null, fun:u.funT||0, st:u.study||null,
      uid:u.uid||0, bd:u.bonds||null, sor:u.sorrowT||0})),
    orbit:orbit.map(o=>o.kind), moonCrew:moonCrew.length};
}
function saveGame(silent){
  if(launching||gameOver) return;           // a metà volo o a colonia perduta non si salva
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(snapshot()));
    if(!silent) toast('Partita salvata.');
  }catch(e){ if(!silent) toast('Salvataggio non riuscito: il browser blocca la memoria locale.'); }
}
function readSave(){
  try{ const raw=localStorage.getItem(SAVE_KEY); return raw?JSON.parse(raw):null; }
  catch(e){ return null; }
}
function loadGame(){
  const d=readSave();
  if(!d||d.v!==1){ toast('Nessuna partita salvata in questo browser.'); return; }
  try{ restore(d); }
  catch(e){ fail('Il salvataggio è danneggiato: '+e.message); return; }
  toast('Partita ripresa: mondo n° '+worldIndex+'.');
}
function restore(d){
  quiet=true;
  try{
    worldIndex=d.worldIndex; worldSeed=d.worldSeed;
    generateWorld(worldSeed);
    // via ciò che generateWorld ha messo: capanna, fattoria, clan, coloni
    for(const u of units) planetGroup.remove(u.mesh);
    units=[];
    for(const t of tiles){
      if(!t.building) continue;
      const m=buildMeshes.get(t.id); if(m) planetGroup.remove(m);
      buildMeshes.delete(t.id);
      Object.assign(t,{building:null,owner:null,site:null,workers:0,hp:0,hpMax:0,settlement:null,size:1});
    }
    trait=TRAITS.find(x=>x.id===d.trait)||trait;
    settlements=d.settlements.map(s=>({name:s.name, core:tiles[s.core], relation:s.relation,
      tiles:[], mat:s.mat, thinkT:s.thinkT, tradeT:s.tradeT}));
    // salvataggi di prima della benevolenza: si ricava un numero dalla parola
    const gw0={ostile:-60, neutrale:0, alleato:80};
    settlements.forEach((s,i)=>{
      const e=d.settlements[i];
      Object.assign(s,{personality:PERSONALITIES[e.pers]?e.pers:'mercanti',
        goodwill:e.gw!==undefined?e.gw:(gw0[s.relation]||0), ties:e.ties||{}, request:e.req||null,
        reqT:e.reqT||120, unrest:e.unrest||0, giftT:e.giftT||0, log:e.log||[], wars:e.wars||{}});
    });
    for(const e of d.tiles){
      const t=tiles[e.id];
      if(!t||!BUILDINGS[e.b]) continue;
      t.size=e.sz||1;
      if(e.st){
        openSite(t,e.b,e.o,e.st.need,e.st.up);
        for(let i=0;i<Math.min(e.st.have,e.st.need-1);i++) addBlockToSite(t);
        t.hp=Math.max(1,Math.min(t.hpMax,e.hp));
      } else {
        finish(t,e.b,e.o);
        t.hp=Math.max(1,Math.min(t.hpMax,e.hp));
      }
      t.workers=Math.min(e.w,jobsOf(t)); t.unit=e.un||'spear'; t.spawnT=e.sp;
      if(e.set>=0&&settlements[e.set]){ t.settlement=settlements[e.set]; settlements[e.set].tiles.push(t); }
    }
    for(const e of d.units){
      const at=tiles[e.at];
      if(!at||!UNITS[e.k]) continue;
      const u=spawnUnit(e.k,e.f,at);
      u.state='ok'; u.mesh.scale.setScalar(1);
      u.hp=Math.min(u.hpMax,e.hp); u.age=e.age; u.wounded=e.wd;
      if(isPerson(u)||u.kind==='thrall') applyAge(u);
      u.settlement=e.set>=0?settlements[e.set]||null:null;
      u.deployed=e.dep;
      // salvataggi di prima dei bisogni: il colono parte sazio e riposato
      if(e.nd) u.needs={food:e.nd[0], rest:e.nd[1], mood:e.nd[2]};
      u.funT=e.fun||0; u.study=e.st||null; u.sorrowT=e.sor||0;
      if(e.uid){ u.uid=e.uid; nextUid=Math.max(nextUid,e.uid+1); } if(e.bd) u.bonds={...e.bd};
      if(e.nm){ u.name=e.nm; u.traits=(e.tr||[]).filter(id=>PERSON_TRAITS[id]); u.skills={...(e.sk||{})}; }
      if(e.org>=0&&settlements[e.org]) u.origin=settlements[e.org];
      if(e.k==='envoy'){ u.lifeT=e.life; u.req=e.rq; u.delivered=e.dl||!e.rq; if(!u.delivered) takeCarry(u,0xffe08a); }
      if(e.k==='caravan'){ u.load=e.load; u.delivered=e.dl; u.lifeT=e.life; if(!e.dl) takeCarry(u,0xd9a441); }
    }
    Object.assign(res,d.res); res.bar=res.bar||0;
    pop=myPeople().length; sci=d.sci;
    // salvataggi di prima dell'albero: i vecchi livelli diventano i primi nodi dell'economia e dell'esercito
    researched=new Set((d.researched||['tools','weapons','rotation'].slice(0,d.tech||0)).filter(id=>RESEARCH[id]));
    tech=researched.size; achFlags=d.achFlags||{};
    difficulty=DIFFICULTY[d.difficulty]?d.difficulty:'normale';
    weather=d.weather&&WEATHER[d.weather.kind]?{...d.weather}:{kind:'sereno',t:120}; applyWeather(); researching=RESEARCH[d.researching]?d.researching:null; stats=d.stats||[]; season=d.season; seasonT=d.seasonT;
    raidIn=d.raidIn; raidNo=d.raidNo; worldAge=d.worldAge; dayT=d.dayT;
    eventIn=d.eventIn; boomT=d.boomT; grief=d.grief||0; raidWarned=!!d.raidWarned;
    narrator=d.narrator&&NARRATOR_PHASES[d.narrator.phase]?{...d.narrator}:{phase:'calma',t:0,hurt:0};
    choice=d.choice&&CHOICE_EVENTS[d.choice.id]?d.choice:null; famineT=d.famineT||0; exiles=d.exiles||0; chainT=d.chainT||0;
    hideChoice(); if(choice&&!auto) showChoice(); padCargoMat=d.padCargoMat; padCargoFood=d.padCargoFood;
    army.size=d.army.size; army.target=d.army.target>=0?settlements[d.army.target]||null:null;
    for(const k of d.orbit){ addOrbital(k); const o=orbit[orbit.length-1]; o.built=true; o.rise=1; }
    for(let i=0;i<d.moonCrew;i++) landOnMoon();
    raidActive=units.some(u=>u.faction==='raider');
    document.getElementById('w-count').textContent=
      (worldIndex===1?'primo mondo':'mondo n° '+worldIndex)+' · '+trait.name+' ('+trait.note+')'+
      (worldIndex>1?' · eredità +'+Math.round((legacy()-1)*100)+'%':'');
    rebuildFrameCache(); bumpWalk(); trimWorkers(); syncJobs();
    applySeason(); nightOn=null;
    $('a-list').dataset.sig='';
  } finally { quiet=false; }
  refreshHUD();
}

/* ═══════════════ colonia perduta ═══════════════ */
