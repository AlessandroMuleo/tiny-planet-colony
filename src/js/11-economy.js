function capacity(){
  let c=BASE_STORE;
  for(const t of tiles) if(isMine(t)) c+=storeOf(t);
  for(const o of orbit) if(o.built) c+=ORBITALS[o.kind].store||0;
  return c;
}
/* lo specchio solare toglie il morso all'inverno */
const seasonFood = () => hasOrbital('mirror')
  ? Math.max(1.0, SEASONS[season].food) : SEASONS[season].food;
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

function rates(){
  let food=FOOD_DRIP, matr=DRIP, pow=0, scir=0, houses=0, jobs=0, tribute=0;
  const S=seasonFood()*(trait.harsh?0.85:1), P=techProd()*legacy(), d=demography();
  let eat=d.child*AGES.child.eat+d.adult*AGES.adult.eat+d.elder*AGES.elder.eat;
  for(const u of myTroops()) if(u.kind==='guardian') eat += 0.30;
  eat += myThralls().length*THRALL_EAT;
  for(const t of tiles){
    if(!isMine(t)) continue;
    const B=BUILDINGS[t.building], w=t.workers||0;
    houses+=housesOf(t); jobs+=jobsOf(t);
    const w2=(t.effWorkers!==undefined?t.effWorkers:w);
    if(B.eats) food-=(B.eats.food||0)*w2;          // l'officina brucia cibo
    if(B.per){
      food+=(B.per.food||0)*w2*(B.noSeason?1:S)*P*(trait.food||1)*(boomT>0?1.4:1);
      matr+=(B.per.mat||0)*(B.per.mat>0?w2*P*(trait.mat||1):w);
      pow +=(B.per.pow||0)*w2*P*(trait.pow||1);
      scir+=(B.per.sci||0)*w2*P;
    }
    if(B.drain) pow-=B.drain;
  }
  for(const o of orbit) if(o.built) pow-=ORBITALS[o.kind].drain||0;
  for(const s of settlements) tribute += s.relation==='alleato' ? 0.6 : s.relation==='assoggettato' ? 1.4 : 0;
  if(tiles.some(t=>isMine(t)&&t.building==='market'&&(t.workers||0)>0)) tribute*=1.6;
  const block = pop>=houses ? 'servono letti' : (food-eat<=0 && res.food<=8) ? 'serve cibo'
              : res.food<=8 ? 'scorte basse' : null;
  return {food:food-eat, mat:matr+tribute, pow:pow-pop*USE, sci:scir, houses, jobs, demo:d, block};
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
  const wanted=Math.min(6, Math.ceil(blocksLeft/4));
  const needBuilders=Math.min(wanted, Math.max(0, able.length-1));
  const crew=able.slice(0,needBuilders);
  able=able.slice(needBuilders);
  for(const u of crew){
    u.builder=true;
    if(u.job){ u.job=null; u.mode='idle'; dropCarry(u); }
    if(u.kind!=='worker'&&u.kind!=='thrall') morph(u,'worker');
  }
  for(const u of able) u.builder=false;
  const unable=myLabor().filter(u=>workPower(u)===0);
  for(const u of unable){ if(u.job){ u.job=null; u.mode='idle'; dropCarry(u); } }
  able.forEach((u,i)=>{
    const t=slots[i]||null;
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
function morph(u,kind){
  const carried=!!u.hasCargo;
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
        killUnit(u,i); pop=Math.max(0,pop-1); changed=true;
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
  // "pop" veniva aggiornato a mano in sei punti diversi e prima o poi si
  // sfasava dai coloni reali: ora si riallinea alla fonte a ogni tick
  pop=myPeople().length;
  if(checkCollapse()) return;
  if(boomT>0) boomT--;
  randomEventTick();
  const r=rates(), cap=capacity(), clamp=v=>Math.min(cap,Math.max(0,v));
  res.food=clamp(res.food+r.food);
  res.mat =clamp(res.mat +r.mat);
  res.pow =clamp(res.pow +r.pow);

  // ricerca
  if(r.sci>0 && tech<3){
    sci+=r.sci;
    if(sci>=TECH_COST[tech+1]){ tech++; toast('Ricerca completata: livello '+tech+'. Rese e armi migliorate.'); }
  }
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
  } else if(res.food<=0&&pop>1&&Math.random()<.3){
    // solo un vero colono (non un assoggettato) conta come popolazione:
    // prima si cercava un civile qualsiasi, e un assoggettato ucciso
    // scalava "pop" senza che nessun colono fosse davvero mancante
    const i=units.findIndex(isPerson);
    if(i>=0){ pop--; killUnit(units[i],i); }
    trimWorkers(); syncJobs();
    toast('Il cibo è finito: un colono se n’è andato.');
  }

  sendCaravans();
  if(!raidActive){ raidIn--; if(raidIn<=0){ spawnRaid();
    raidIn=Math.round((120+(hasOrbital('eye')?ORBITALS.eye.delay:0))*(trait.raid?0.65:trait.calm?1.5:1)); } }
  for(const s of settlements) rivalThink(s);
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
        const have=units.filter(u=>u.faction==='you'&&u.kind==='guardian').length;
        const shrines=tiles.filter(x=>isMine(x)&&x.building==='shrine').length;
        if(have<B.cap*Math.max(1,shrines)){
          spawnUnit('guardian','you',t);
          toast('Il santuario ha generato un guardiano.'); refreshHUD();
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
