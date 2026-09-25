function capacity(){
  let c=BASE_STORE;
  for(const t of tiles) if(isMine(t)) c+=storeOf(t);
  // la capienza in orbita resta anche con l'orbita spenta: le scorte non spariscono
  for(const o of orbit) if(o.built) c+=(ORBITALS[o.kind].store||0)*ORBIT_LEVELS[o.level||1].mul;
  return c;
}
/* lo specchio solare toglie il morso all'inverno */
/* dal livello 2 lo specchio scalda anche le altre stagioni */
const seasonFood = () => { const m=orbMul('mirror');
  return m ? Math.max(1+0.2*(m-1), SEASONS[season].food) : SEASONS[season].food; };
/* ── taglia della struttura (1–3): più grande = più posti e più capienza ── */
const sizeOf   = t => t.size||1;
const jobsOf   = t => (BUILDINGS[t.building].jobs||0)*sizeOf(t);
const housesOf = t => (BUILDINGS[t.building].houses||0)*sizeOf(t);
const storeOf  = t => (BUILDINGS[t.building].store||0)*sizeOf(t);
const workedTiles   = () => tiles.filter(t=>isMine(t)&&jobsOf(t)>0);
/* quanto ci mette un colono a riempire un carico: d'inverno il doppio */
const harvestTime = () => 7/Math.max(0.35, seasonFood());
const assignedTotal = () => tiles.reduce((n,t)=>n+(isMine(t)?(t.workers||0):0),0);
const buildersCount = () => myLabor().filter(u=>u.builder).length;
const idleCount     = () => Math.max(0,workforce()-assignedTotal()-buildersCount());
/* dove si portano i carichi: deposito o capanna più vicini */
const storageTiles  = () => tiles.filter(t=>isMine(t)&&storeOf(t)>0);

/* FC.mine è la fotografia di inizio fotogramma: un edificio può essere caduto
   nel frattempo, quindi questi helper riverificano sempre con isMine */
/* edifici attivi con una certa proprietà: con jobs, solo se hanno addetti */
const activeFlag = f => FC.mine.some(t=>isMine(t)&&hasFlag(t,f)&&(!jobsOf(t)||(t.workers||0)>0));
/* un pozzo a portata d'acqua */
const wellNear = t => FC.mine.some(w=>isMine(w)&&hasFlag(w,'well')&&
  surfacePos(w).distanceTo(surfacePos(t))<BUILDINGS[w.building].range);
/* il cibo che i granai conservano; il resto marcisce piano (SPOIL a tick) */
const SPOIL = 0.01, FRESH_BASE = 60;
const granaryCover = () => FRESH_BASE+FC.mine.reduce((n,t)=>n+(isMine(t)?(BUILDINGS[t.building].granary||0)*sizeOf(t):0),0);

function rates(){
  let food=FOOD_DRIP, matr=DRIP, pow=0, scir=0, barr=0, houses=0, jobs=0, tribute=0;
  const S=seasonFood()*(trait.harsh?0.85:1), P=techProd()*legacy(), d=demography();
  // eat: quanto mangiano i civili, che vanno da soli al magazzino (qui serve
  // solo a mostrare il saldo nell'HUD). upkeep: le razioni di soldati e
  // guardiani, che non hanno bisogni propri e si scalano dalla scorta a ogni tick
  let eat=0, upkeep=0;
  for(const u of units){
    if(u.faction!=='you') continue;
    if(hasNeeds(u)) eat+=eatRate(u);
    else if(u.kind==='guardian') upkeep+=0.30;
    else if(isPerson(u)) upkeep+=AGES[u.stage].eat;
  }
  for(const t of tiles){
    if(!isMine(t)) continue;
    const B=BUILDINGS[t.building], w=t.workers||0;
    houses+=housesOf(t); jobs+=jobsOf(t);
    const w2=(t.effWorkers!==undefined?t.effWorkers:w);
    if(B.eats){                                     // l'officina brucia cibo, la fonderia materiali
      food-=(B.eats.food||0)*w2; matr-=(B.eats.mat||0)*w2;
    }
    if(B.per){
      food+=(B.per.food||0)*w2*(B.noSeason?1:S)*P*(trait.food||1)*(boomT>0?1.4:1)*(famineT>0&&!B.noSeason?0.5:1)*(1+techSum('food'))
           *(B.noSeason||!B.per.food?1:weatherFood(t));      // la serra è al riparo dal tempo
      matr+=(B.per.mat||0)*(B.per.mat>0?w2*P*(trait.mat||1):w);
      pow +=(B.per.pow||0)*w2*P*(trait.pow||1);
      scir+=(B.per.sci||0)*w2*P;
      barr+=(B.per.bar||0)*w2*P*(1+techSum('bar'));
    }
    if(B.drain) pow-=B.drain;
  }
  if(!spaceOffline) for(const o of orbit) if(o.built) pow-=ORBITALS[o.kind].drain||0;
  scir+=ORBITALS.telescope.sci*orbMul('telescope');
  // i letti dell'habitat restano anche al buio: chi ci vive non se ne va
  for(const o of orbit) if(o.built&&ORBITALS[o.kind].houses) houses+=ORBITALS[o.kind].houses*ORBIT_LEVELS[o.level||1].mul;
  for(const s of settlements) tribute += s.relation==='alleato' ? 0.6 : s.relation==='assoggettato' ? 1.4 : 0;
  if(tiles.some(t=>isMine(t)&&BUILDINGS[t.building].trade&&(t.workers||0)>0)) tribute*=1.6;
  tribute*=1+techSum('caravan');
  const block = pop>=houses ? 'servono letti' : (food-eat-upkeep<=0 && res.food<=8) ? 'serve cibo'
              : res.food<=8 ? 'scorte basse' : null;
  const spoil=Math.max(0,res.food-granaryCover())*SPOIL*(1-techSum('spoil'));
  return {food:food-eat-upkeep-spoil, stock:food-upkeep-spoil, spoil, mat:matr+tribute, pow:pow-pop*USE,
    sci:scir, bar:barr, houses, jobs, demo:d, block};
}
/* chi produce davvero: solo chi è al lavoro (o sta portando il raccolto).
   Un colono che mangia, dorme o scappa non rende, e l'umore pesa sulla resa. */
function dutyTick(){
  for(const t of tiles) if(isMine(t)&&jobsOf(t)>0) t.effWorkers=0;
  for(const u of units){
    if(u.faction!=='you'||!u.job||!isMine(u.job)) continue;
    if(hasNeeds(u)&&u.act!=='work') continue;
    const k=skillKey(u.job);
    // sulla sabbia, senza un pozzo vicino, si rende il 40% in meno
    const dry=u.job.biome==='sand'&&!wellNear(u.job)?0.6:1;
    u.job.effWorkers=(u.job.effWorkers||0)+workPower(u)*moodWork(u)*skillMul(u,k)*dry;
    if(hasNeeds(u)) practice(u,k,1);
  }
}

function setWorkers(tile,delta){
  if(!tile||!isMine(tile)) return;
  const max=jobsOf(tile), now=tile.workers||0;
  if(delta>0&&idleCount()<=0){ toast('Nessun colono libero.'); return; }
  const next=Math.max(0,Math.min(max,now+delta));
  if(next===now) return;
  tile.workers=next; syncJobs(); setInspector(tile); refreshHUD();
}
function fillWorkers(tile){
  if(!tile||!isMine(tile)) return;
  const free=jobsOf(tile)-(tile.workers||0);
  tile.workers=(tile.workers||0)+Math.min(free,idleCount());
  syncJobs(); setInspector(tile); refreshHUD();
}
function trimWorkers(){
  // il tetto sono le braccia disponibili (assoggettati compresi, bambini e
  // feriti esclusi), non "pop": con dei thrall licenziava addetti a caso
  let over=assignedTotal()-workforce();
  if(over<=0) return;
  for(const t of workedTiles().sort((a,b)=>(b.workers||0)-(a.workers||0))){
    while(over>0&&t.workers>0){ t.workers--; over--; }
    if(over<=0) break;
  }
}
function syncJobs(){
  const slots=[];
  for(const t of workedTiles()){
    t.effWorkers=0;
    for(let i=0;i<(t.workers||0);i++) slots.push(t);
  }
  // bambini e feriti non lavorano: vengono saltati nell'assegnazione
  let able=myLabor().filter(u=>workPower(u)>0)
    .sort((a,b)=>(a.kind==='thrall'?1:0)-(b.kind==='thrall'?1:0));
  // due portatori per ogni cantiere aperto, riservati prima di tutto il resto:
  // senza questo nessuno porta i blocchi e i coloni sembrano vagare a caso
  // il numero di portatori scala con quanto manca da consegnare, non è fisso a 2:
  // un cantiere da 21 blocchi con due uomini era interminabile
  let blocksLeft=0;
  for(const t of FC.sites){
    if(!t.site) continue;                     // completato in questo stesso frame
    blocksLeft += Math.max(0, t.site.need-t.site.have);
  }
  // con la utility AI i bambini non portano più blocchi e i portatori si fermano
  // per mangiare e dormire: la squadra è un po' più grande per compensare
  const wanted=Math.min(8, Math.ceil(blocksLeft/3));
  const needBuilders=Math.min(wanted, Math.max(0, able.length-1));
  // la squadra si prende prima tra chi ci è già, poi tra chi non ha un lavoro,
  // e a parità tra i costruttori più esperti: così i contadini restano nei campi
  const crewOrder=able.slice().sort((a,b)=>
    (b.builder?1:0)-(a.builder?1:0) || (a.job?1:0)-(b.job?1:0) ||
    (a.kind==='thrall'?1:0)-(b.kind==='thrall'?1:0) || skillXp(b,'build')-skillXp(a,'build'));
  const crew=crewOrder.slice(0,needBuilders);
  able=able.filter(u=>!crew.includes(u));
  for(const u of crew){
    u.builder=true;
    if(u.job){ u.job=null; u.mode='idle'; dropCarry(u); }
    if(u.kind!=='worker'&&u.kind!=='thrall') morph(u,'worker');
  }
  for(const u of able) u.builder=false;
  const unable=myLabor().filter(u=>workPower(u)===0);
  for(const u of unable){ if(u.job){ u.job=null; u.mode='idle'; dropCarry(u); } }
  const placed=placeWorkers(able,slots);
  able.forEach(u=>{
    const t=placed.get(u)||null;
    if(u.job!==t){ u.mode='idle'; u.workT=0; dropCarry(u); }
    u.job=t;
    let want='idle';
    if(t) want=BUILDINGS[t.building].armory?(t.unit||'spear'):'worker';
    // un assoggettato resta tale: lavora, ma non riceve armi
    if(u.kind!=='thrall'&&want!==u.kind) morph(u,want);
    if(t) t.effWorkers=(t.effWorkers||0)+workPower(u);
  });
  for(const u of unable) if(u.kind!=='idle'&&u.kind!=='thrall') morph(u,'idle');
  refreshArmy();
}
/* Chi ha già un posto lo tiene; i posti liberi vanno a chi è più esperto
   in quel mestiere (i coloni prima degli assoggettati). Prima si ripartiva
   da capo a ogni cambiamento e i coloni saltavano da un lavoro all'altro:
   con le abilità, spostarli a caso butterebbe via l'esperienza.         */
function placeWorkers(able,slots){
  const free=new Map();
  for(const t of slots) free.set(t,(free.get(t)||0)+1);
  const out=new Map(), rest=[];
  for(const u of able){
    if(u.job&&free.get(u.job)>0){ out.set(u,u.job); free.set(u.job,free.get(u.job)-1); }
    else rest.push(u);
  }
  for(const [t,n] of free){
    const k=skillKey(t);
    for(let i=0;i<n&&rest.length;i++){
      let bi=0;
      for(let j=1;j<rest.length;j++){
        const a=rest[j], b=rest[bi];
        const ta=a.kind==='thrall'?1:0, tb=b.kind==='thrall'?1:0;
        if(ta<tb||(ta===tb&&skillXp(a,k)>skillXp(b,k))) bi=j;
      }
      out.set(rest[bi],t); rest.splice(bi,1);
    }
  }
  return out;
}
function morph(u,kind){
  const carried=!!u.hasCargo;
  // un soldato non ragiona più da civile: le sue prenotazioni tornano libere
  if(!UNITS[kind].civil){ releaseAll(u); u.act=null; }
  dropCarry(u);
  planetGroup.remove(u.mesh);
  const m=unitMesh(kind);
  m.g.position.copy(u.mesh.position);
  m.g.quaternion.copy(u.mesh.quaternion);
  planetGroup.add(m.g);
  u.mesh=m.g; u.body=m.body; u.kind=kind;
  u.hpMax=UNITS[kind].hp; u.hp=Math.min(u.hp,u.hpMax)||u.hpMax;
  u.speed=UNITS[kind].speed*(0.85+Math.random()*0.3);
  if(carried&&UNITS[kind].civil) takeCarry(u,0xb8925e);
}

/* ogni tick i coloni invecchiano, guariscono, e prima o poi muoiono */
function ageTick(){
  let changed=false;
  for(let i=units.length-1;i>=0;i--){
    const u=units[i];
    if(u.faction!=='you') continue;
    if(!isPerson(u)&&u.kind!=='guardian'&&u.kind!=='thrall') continue;
    if(isPerson(u)){
      u.age++;
      const st=stageAt(u.age);
      if(u.age>=AGES.elder.until){
        killUnit(u,i,true); pop=Math.max(0,pop-1); changed=true; mourn(0.15);
        toast('Un anziano è morto di vecchiaia.');
        continue;
      }
      if(st!==u.stage){ applyAge(u); changed=true;
        if(st==='adult') toast('Un bambino è diventato adulto.'); }
    }
    // ferite: guarigione naturale lenta, molto più rapida vicino a un ospedale
    // in un letto di casa si guarisce tre volte più in fretta
    const inBed = u.from && isMine(u.from) && housesOf(u.from)>0;
    if(u.wounded){
      u.hp=Math.min(u.hpMax,u.hp+SELF_HEAL*(inBed?3:1));
      if(u.hp>=u.hpMax*0.85){ u.wounded=false; applyAge(u); changed=true; }
    } else if(u.hp<u.hpMax*WOUND_AT){
      u.wounded=true; applyAge(u); changed=true;
      toast('Un colono è rimasto ferito: portatelo in ospedale.');
    }
  }
  if(changed){ trimWorkers(); syncJobs(); }
}

function economyTick(){
  worldAge++;
  ageTick();
  if(needsTick()){ trimWorkers(); syncJobs(); }
  // "pop" veniva aggiornato a mano in sei punti diversi e prima o poi si
  // sfasava dai coloni reali: ora si riallinea alla fonte a ogni tick
  pop=myPeople().length;
  if(checkCollapse()) return;
  if(boomT>0) boomT--;
  randomEventTick();
  dutyTick();
  const r=rates(), cap=capacity(), clamp=v=>Math.min(cap,Math.max(0,v));
  res.food=clamp(res.food+r.stock);      // i civili mangiano da soli, al magazzino
  res.mat =clamp(res.mat +r.mat);
  res.pow =clamp(res.pow +r.pow);
  res.bar =clamp((res.bar||0)+r.bar);

  // ricerca: va al nodo scelto dell'albero (25-progress.js)
  researchTick(r.sci);
  statsTick();
  if(worldAge%10===0&&$('stats').classList.contains('on')) renderStats();
  // stagioni
  seasonT++;
  if(seasonT>=SEASON_LEN){
    seasonT=0; season=(season+1)%SEASONS.length;
    applySeason();
    toast('È arrivato/a '+SEASONS[season].name+'.');
  }
  // popolazione
  if(res.food>8&&pop<r.houses){
    pop++;
    const baby=spawnUnit('worker','you',randomHome());
    baby.age=0; applyAge(baby);           // nasce bambino: non lavora ancora
    syncJobs();
    toast('È nato un colono.');
  }
  // la fame non fa più sparire un colono a caso: ognuno ha il suo stomaco
  // (needsTick, in 15-colonists.js)

  sendCaravans();
  // la torre di segnalazione avvista la navetta 25 secondi prima
  if(!raidActive&&raidIn===26&&activeFlag('watch')&&!weatherNow().fog){
    raidWarned=true; logEvent('🔭 La torre avvista una navetta: incursione tra 25 secondi. Bambini al riparo!');
  }
  if(!raidActive){ raidIn--; if(raidIn<=0){ raidWarned=false; spawnRaid(); raidIn=raidInterval(); } }
  raidersTick(); narratorTick(); choiceTick(); chainTick(); socialTick(); achievementTick(); weatherTick(); spaceTick();
  for(const s of settlements) rivalThink(s);
  diplomacyTick();
  if(auto) autoThink();
  refreshHUD(r);
  // l'ispettore mostrava integrità e addetti fermi al momento del clic
  if(selected) setInspector(selected);
  autoSaveT++;
}

/* santuario e roccaforte */
function structureTick(dt){
  for(const t of FC.mine){
    // la cache è di inizio frame: nel frattempo l'edificio può essere caduto
    if(!t.building||t.site) continue;
    const B=BUILDINGS[t.building];
    if(!B) continue;
    if(B.spawns && res.pow>0){
      t.spawnT+=dt;
      if(t.spawnT>=B.every){
        t.spawnT=0;
        const have=units.filter(u=>u.faction==='you'&&u.kind===B.spawns).length;
        const sources=tiles.filter(x=>isMine(x)&&BUILDINGS[x.building].spawns===B.spawns).length;
        if(have<B.cap*Math.max(1,sources)){
          spawnUnit(B.spawns,'you',t);
          toast(B.spawnMsg); refreshHUD();
        }
      }
    }
    if(B.heal && (B.drain?res.pow>0:true) && (B.jobs?((t.workers||0)>0):true)){   // ora solo l'ospedale
      const tp=surfacePos(t,.4);
      for(const u of nearbyUnits(t,true)){
        if(u.faction!=='you'||u.hp>=u.hpMax) continue;
        if(tp.distanceTo(u.mesh.position)<B.range) u.hp=Math.min(u.hpMax,u.hp+B.heal*dt);
      }
    }
  }
}

/* ═══════════════ spostamenti: nessuno cammina sull'acqua ═══════ */
