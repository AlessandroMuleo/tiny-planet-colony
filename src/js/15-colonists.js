/* I coloni non seguono più una lista fissa di priorità: a ogni ragionamento
   danno un punteggio a ogni azione possibile (14-utility.js) e fanno quella
   che vale di più. Le azioni stanno in COLONIST_ACTIONS; la loro esecuzione
   (dove andare, cosa fare all'arrivo) nelle funzioni run().             */

/* ── bisogni ──────────────────────────────────────────────────────
   Valgono tutti tra 0 e 1: 1 = sazio, riposato, contento.
   Li hanno solo i civili (coloni e assoggettati): i soldati mangiano
   dalla scorta comune, come prima, e non dormono.                    */
const NEEDS = {
  FULL:      60,     // tick che un colono regge a stomaco pieno
  AWAKE:     140,    // tick di veglia prima di essere esausto
  BED_REST:  25,     // tick per un sonno completo in un letto
  GROUND_REST: 40,   // ... e per terra, senza letto
  MOOD_EASE: 0.03,   // quanto l'umore si avvicina al suo obiettivo a ogni tick
  LEAVE_AT:  0.2,    // sotto questo umore il colono può andarsene
  LEAVE_P:   0.01,   // probabilità a tick di andarsene, sotto LEAVE_AT
  STARVE_P:  0.04    // probabilità a tick di andarsene a stomaco vuoto
};
const hasNeeds = u => u.faction==='you' && UNITS[u.kind].civil && u.kind!=='caravan';
const needsOf = u => u.needs || (u.needs={food:1, rest:0.5+Math.random()*0.5, mood:0.6});
const eatRate = u => u.kind==='thrall' ? THRALL_EAT : AGES[u.stage].eat;
/* l'umore pesa sul lavoro: 0,5 è la resa normale, 1 dà +40%, 0 dà −40% */
const moodWork = u => hasNeeds(u) ? 0.6+0.8*needsOf(u).mood : 1;
/* lutto della colonia: sale a ogni morte, scende da solo */
let grief=0;
const mourn = k => { grief=Math.min(1,grief+k); };

/* obiettivo dell'umore: da dove viene, voce per voce (lo mostra l'ispettore) */
function moodFactors(u){
  const n=needsOf(u), f=[];
  f.push(['di base', 0.6]);
  if(n.food<=0) f.push(['affamato', -0.45]);
  else if(n.food<0.25) f.push(['ha fame', -0.15]);
  if(n.rest<0.1) f.push(['esausto', -0.25]);
  if(u.slept==='bed') f.push(['ha dormito in un letto', 0.08]);
  else if(u.slept==='ground') f.push(['ha dormito per terra', -0.12]);
  if(u.wounded) f.push(['ferito', -0.15]);
  if(pop>housesTotal()) f.push(['sovraffollamento', -0.1]);
  if(grief>0.05) f.push(['lutto', -0.3*grief]);
  if(boomT>0) f.push(['annata abbondante', 0.08]);
  if(u.kind==='thrall') f.push(['assoggettato', -0.2]);
  for(const id of u.traits||[]) if(PERSON_TRAITS[id].mood) f.push([PERSON_TRAITS[id].label, PERSON_TRAITS[id].mood]);
  return f;
}
/* FC.beds è la fotografia di inizio fotogramma: un alloggio può essere caduto
   nel frattempo, quindi si riverifica con isMine (vedi openSites) */
const housesTotal = () => FC.beds.reduce((n,t)=>n+(isMine(t)?housesOf(t):0),0);
const moodTarget = u => clamp01(moodFactors(u).reduce((s,[,v])=>s+v,0));

/* un tick di bisogni per tutti; restituisce true se qualcuno se n'è andato */
function needsTick(){
  let left=0, starved=0;
  grief=Math.max(0,grief-0.01);
  for(let i=units.length-1;i>=0;i--){
    const u=units[i];
    if(!hasNeeds(u)) continue;
    const n=needsOf(u);
    n.food=Math.max(0, n.food-1/NEEDS.FULL);
    if(u.act==='sleep'&&u.from===u.goal)
      n.rest=Math.min(1, n.rest+1/(u.bed&&u.from===u.bed?NEEDS.BED_REST:NEEDS.GROUND_REST));
    else n.rest=Math.max(0, n.rest-1/(NEEDS.AWAKE*traitMul(u,'awake')));
    n.mood+=(moodTarget(u)-n.mood)*NEEDS.MOOD_EASE;
    // gli assoggettati non se ne vanno: per loro le rivolte arriveranno con la diplomazia
    if(u.kind==='thrall'||myPeople().length<=1) continue;
    const hungry=n.food<=0&&Math.random()<NEEDS.STARVE_P;
    const unhappy=!hungry&&n.mood<NEEDS.LEAVE_AT&&Math.random()<NEEDS.LEAVE_P;
    if(hungry||unhappy){
      killUnit(u,i); pop=Math.max(0,pop-1);
      if(hungry) starved++; else left++;
    }
  }
  if(starved) toast(starved===1?'Il cibo è finito: un colono se n’è andato.':'Il cibo è finito: '+starved+' coloni se ne sono andati.');
  if(left) toast(left===1?'Un colono scontento ha lasciato la colonia.':left+' coloni scontenti hanno lasciato la colonia.');
  return starved+left>0;
}

/* ── chi è: nome, tratti, abilità ──────────────────────────────────
   I tratti non hanno codice proprio: cambiano i pesi delle azioni, la
   fame, il sonno, l'umore o quanto in fretta si impara. Un tratto nuovo
   si aggiunge qui.                                                     */
const PERSON_NAMES=['Ada','Bruno','Carla','Dario','Elsa','Fabio','Gea','Ivo','Lia','Marco',
  'Nora','Otto','Pia','Rino','Sara','Tito','Una','Vito','Zeno','Alba','Ciro','Dora','Enzo',
  'Irma','Leo','Mia','Nico','Olga','Piero','Rita','Sesto','Teo','Vera','Aldo','Bice','Elio'];
const PERSON_TRAITS={
  lazy:    {label:'pigro',      note:'lavora e costruisce meno volentieri, dorme di più',
            weights:{work:0.85, build:0.85, sleep:1.15}},
  brave:   {label:'coraggioso', note:'difende invece di scappare', weights:{fight:1.3, flee:0.7}, not:'timid'},
  timid:   {label:'pauroso',    note:'scappa prima', weights:{flee:1.35, fight:0.75}, not:'brave'},
  clever:  {label:'ingegnoso',  note:'impara il 50% più in fretta', learn:1.5},
  glutton: {label:'goloso',     note:'ha fame prima degli altri', hunger:1.2},
  sturdy:  {label:'robusto',    note:'regge il 30% in più senza dormire', awake:1.3},
  cheerful:{label:'allegro',    note:'di umore migliore', mood:0.1}
};
/* prodotto di un campo numerico su tutti i tratti del colono (1 se nessuno lo ha) */
function traitMul(u,field,key){
  let m=1;
  for(const id of u.traits||[]){
    const T=PERSON_TRAITS[id]; if(!T) continue;
    const v=key?(T[field]&&T[field][key]):T[field];
    if(typeof v==='number') m*=v;
  }
  return m;
}
/* chiamata da spawnUnit per ogni civile tuo: nasce con un nome e 0–2 tratti */
function initPerson(u){
  u.name=PERSON_NAMES[Math.floor(Math.random()*PERSON_NAMES.length)];
  const r=Math.random(), want=r<0.35?0:r<0.8?1:2, ids=Object.keys(PERSON_TRAITS);
  u.traits=[];
  for(let tries=0; u.traits.length<want&&tries<10; tries++){
    const id=ids[Math.floor(Math.random()*ids.length)];
    if(u.traits.includes(id)||u.traits.includes(PERSON_TRAITS[id].not)) continue;
    u.traits.push(id);
  }
  u.skills={};
}

/* abilità: si impara lavorando. A SKILL_HALF punti di esperienza la resa
   è +30%, e non supera mai il +60%: i primi tick valgono più degli ultimi */
const SKILLS={food:'agricoltura', mat:'estrazione', pow:'energia', sci:'ricerca', build:'costruzione'};
const SKILL_HALF=200;
/* il mestiere di un edificio è la sua prima produzione positiva (l'armeria non ne ha) */
const skillKey = t => {
  const B=t&&t.building&&BUILDINGS[t.building];
  if(!B||!B.per) return null;
  for(const k in B.per) if(B.per[k]>0) return k;
  return null;
};
const skillXp = (u,k) => (u.skills&&u.skills[k])||0;
const skillMul = (u,k) => k ? 1+0.6*skillXp(u,k)/(skillXp(u,k)+SKILL_HALF) : 1;
function practice(u,k,amount){
  if(!k||!u.skills) return;
  u.skills[k]=skillXp(u,k)+amount*traitMul(u,'learn');
}
/* il mestiere in cui il colono è più bravo, per l'ispettore */
function bestSkill(u){
  let best=null, xp=0;
  for(const k in u.skills||{}) if(u.skills[k]>xp){ xp=u.skills[k]; best=k; }
  return best?{key:best, label:SKILLS[best], bonus:skillMul(u,best)-1}:null;
}

/* ── prenotazioni ──────────────────────────────────────────────────
   Un portatore che sceglie un cantiere prenota un blocco; un colono che
   va a dormire prenota un letto. Così tre coloni non corrono per l'ultimo
   blocco dello stesso cantiere, e in una capanna da 4 non dormono in 9.
   Una prenotazione vive finché dura l'azione che l'ha presa.           */
const freeBlocks = t => t.site ? t.site.need-t.site.have-(t.site.claims||0) : 0;
/* la prenotazione si lega al cantiere (t.site), non alla casella: se sulla
   stessa casella si apre un cantiere nuovo, non eredita i conti del vecchio */
function claimBlock(u,t){ releaseBlock(u); t.site.claims=(t.site.claims||0)+1; u.claim=t; u.claimed=t.site; }
function releaseBlock(u){
  if(u.claimed) u.claimed.claims--;
  u.claim=null; u.claimed=null;
}
const holdsBlock = u => !!(u.claim && u.claimed && u.claim.site===u.claimed);
const freeBeds = t => isMine(t) ? housesOf(t)-(t.sleepers||0) : 0;
function claimBed(u,t){ releaseBed(u); t.sleepers=(t.sleepers||0)+1; u.bed=t; }
function releaseBed(u){
  if(u.bed) u.bed.sleepers=Math.max(0,(u.bed.sleepers||0)-1);
  u.bed=null;
}
/* chiamata da killUnit: chi esce di scena lascia libero ciò che aveva preso */
function releaseAll(u){ releaseBlock(u); releaseBed(u); }

/* ── contesto: cosa sa il colono quando ragiona ───────────────────── */
function colonistContext(u){
  const canFight = !u.wounded && u.stage!=='child' && u.kind!=='thrall';
  let foe=null, bd=Math.max(MILITIA_RANGE,FLEE_RANGE);
  for(const o of nearbyUnits(u.from,true)){
    if(!hostile(u,o)||o.state==='landing') continue;
    const d=u.mesh.position.distanceTo(o.mesh.position);
    if(d<bd){ bd=d; foe=o; }
  }
  const able = workPower(u)>0;
  // il cantiere si cerca solo se serve: chi ha un lavoro non ci va
  let site=null;
  if(able&&!u.job){
    if(holdsBlock(u)) site=u.claim;
    else site=reachableSites(u.from).filter(t=>freeBlocks(t)>0)
      .sort((a,b)=>b.center.dot(u.from.center)-a.center.dot(u.from.center))[0]||null;
  }
  // i tratti moltiplicano i pesi delle azioni: tw.fight = 1,3 per un coraggioso
  const tw={};
  for(const k in COLONIST_ACTIONS) tw[k]=traitMul(u,'weights',k);
  return {u, n:needsOf(u), tw, hungerMul:traitMul(u,'hunger'), canFight, able, foe, foeDist:foe?bd:Infinity,
    raid:FC.raiders.length>0, site, night:!!nightOn, current:u.act,
    hpRatio:u.hp/u.hpMax};
}

/* ── le azioni ─────────────────────────────────────────────────────
   Ogni azione: label, weight, considerations, run(u,ctx) → casella
   obiettivo. Le curve sono il posto dove si regola il comportamento.  */
const is = v => v?1:0;
/* peso di base, corretto dai tratti del colono */
const W = (base,key) => c => base*(c.tw[key]||1);
const COLONIST_ACTIONS = {
  fight:{label:'difendere', weight:W(1.0,'fight'), considerations:[
    consider('sa combattere',  c=>is(c.canFight), CURVES.step(.5)),
    consider('nemico vicino',  c=>1-c.foeDist/MILITIA_RANGE, CURVES.power(.5)),
    consider('in salute',      c=>c.hpRatio, CURVES.logistic(.45,12))
  ], run:(u,c)=>c.foe.from},

  flee:{label:'scappare', weight:W(1.2,'flee'), considerations:[
    consider('nemico vicino',  c=>1-c.foeDist/FLEE_RANGE, CURVES.power(.5)),
    consider('vulnerabile',    c=>c.canFight ? (1-c.hpRatio) : 1, CURVES.power(2))
  ], run:(u,c)=>{
    const refuge = nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].shelter)
                || nearestOf(u.from,FC.beds,t=>reachable(u.from,t));
    if(refuge&&refuge!==u.from) return refuge;
    const away=u.from.neighbors.map(n=>tiles[n]).filter(walkable)
      .sort((a,b)=>a.center.dot(c.foe.from.center)-b.center.dot(c.foe.from.center));
    return away[0]||u.from;
  }},

  shelter:{label:'al riparo', weight:W(0.95,'shelter'), considerations:[
    consider('incursione',     c=>is(c.raid), CURVES.step(.5)),
    consider('indifeso',       c=>is(c.u.stage==='child'||c.u.wounded), CURVES.step(.5)),
    consider('c\'è un rifugio',c=>is(FC.mine.some(t=>BUILDINGS[t.building].shelter)), CURVES.step(.5))
  ], run:u=>nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].shelter)},

  heal:{label:'curarsi', weight:W(0.85,'heal'), considerations:[
    consider('ferito',         c=>is(c.u.wounded), CURVES.step(.5)),
    consider('salute persa',   c=>1-c.hpRatio, CURVES.linear(.6,.4))
  ], run:u=>nearestOf(u.from,FC.mine,t=>!!BUILDINGS[t.building].heal)
          || u.bed || nearestOf(u.from,FC.beds,t=>reachable(u.from,t)) || u.from},

  eat:{label:'mangiare', weight:W(1.0,'eat'), considerations:[
    consider('fame',           c=>(1-c.n.food)*c.hungerMul, CURVES.logistic(.6,10)),
    consider('c\'è cibo',      c=>res.food>=0.5?1:0.05),
    consider('un magazzino',   c=>is(FC.storage.length||FC.mine.length), CURVES.step(.5))
  ], run:u=>{
    const st=nearestStorage(u.from);
    if(st&&u.from!==st) return st;
    // al magazzino: mangia quanto gli manca, se c'è
    const n=needsOf(u), per=NEEDS.FULL*eatRate(u);
    const take=Math.min((1-n.food)*per, Math.max(0,res.food));
    res.food-=take; n.food=Math.min(1,n.food+take/per);
    u.act=null;                         // fatto: al prossimo ragionamento si sceglie di nuovo
    return u.from;
  }},

  sleep:{label:'dormire', weight:W(0.9,'sleep'), considerations:[
    // chi dorme già continua finché non è riposato: senza, si sveglierebbe
    // appena la stanchezza scende sotto la soglia che l'ha fatto coricare
    consider('stanchezza',     c=>c.current==='sleep' ? (c.n.rest<0.95?1:0) : 1-c.n.rest, CURVES.logistic(.6,10)),
    consider('è notte',        c=>c.night||c.current==='sleep'?1:0.55),
    consider('al sicuro',      c=>is(!c.raid))
  ], run:u=>{
    if(u.bed&&!isMine(u.bed)) releaseBed(u);     // l'alloggio è crollato
    if(!u.bed){
      const bed=nearestOf(u.from,FC.beds,t=>freeBeds(t)>0&&reachable(u.from,t));
      if(bed) claimBed(u,bed);
    }
    const spot=u.bed||u.from;
    if(u.from===spot) u.slept=u.bed?'bed':'ground';
    return spot;
  }},

  work:{label:'lavorare', weight:W(0.6,'work'), considerations:[
    consider('ha un lavoro',   c=>is(c.u.job), CURVES.step(.5))
  ], run:(u,c,dt)=>workRun(u,dt)},

  build:{label:'costruire', weight:W(0.55,'build'), considerations:[
    consider('può lavorare',   c=>is(c.able&&!c.u.job), CURVES.step(.5)),
    consider('un cantiere libero', c=>is(c.site), CURVES.step(.5))
  ], run:(u,c)=>buildRun(u,c.site)},

  gather:{label:'tornare a casa', weight:W(0.1,'gather'), considerations:[], run:u=>
    nearestOf(u.from,FC.beds,t=>reachable(u.from,t)) || nearestOf(u.from,FC.mine,t=>reachable(u.from,t))}
};

/* lavoro: fermo sull'edificio, e ogni tanto porta il raccolto al magazzino */
function workRun(u,dt){
  const B=BUILDINGS[u.job.building];
  if(u.mode==='haul'){
    const st=nearestStorage(u.from);
    if(!st||u.from===st){ dropCarry(u); u.mode='work'; u.workT=0; return u.job; }
    return st;
  }
  if(u.mode!=='work'){ u.mode='work'; u.workT=0; }
  if(u.from!==u.job) return u.job;
  u.workT+=dt;
  if(B.ships && u.workT>harvestTime()){
    u.workT=0;
    takeCarry(u, B.ships==='food'?0xa8c14e:0x9aa4b2);
    u.mode='haul';
    return nearestStorage(u.from);
  }
  return u.job;
}
/* costruzione: prende un blocco al magazzino e lo porta al cantiere prenotato */
function buildRun(u,site){
  if(u.claim!==site||!holdsBlock(u)) claimBlock(u,site);
  if(u.mode!=='fetch'&&u.mode!=='deliver'){ u.mode='fetch'; dropCarry(u); }
  if(u.mode==='fetch'){
    const st=nearestStorage(u.from);
    if(!st){ releaseBlock(u); u.mode='idle'; return null; }
    if(u.from!==st) return st;
    takeCarry(u,0xb8925e); u.mode='deliver';
  }
  if(u.from!==site) return site;
  dropCarry(u);
  releaseBlock(u);
  addBlockToSite(site);
  practice(u,'build',8);
  u.mode='idle';
  return null;
}

/* lascia l'azione in corso: prenotazioni, carichi e stati intermedi */
function leaveAction(u,next){
  releaseBlock(u);
  if(next!=='sleep'&&next!=='heal') releaseBed(u);   // chi si cura può farlo a letto
  dropCarry(u); u.mode='idle';                       // il carico in mano va perso
  u.mesh.visible=true;
}

function civilBrain(u,dt){
  const ctx=colonistContext(u);
  const pick=chooseAction(COLONIST_ACTIONS,ctx,u.act);
  const next=pick.action||'gather';
  if(next!==u.act){ leaveAction(u,next); u.act=next; }
  u.actScore=pick.score;
  const goal=COLONIST_ACTIONS[next].run(u,ctx,dt);
  // chi dorme nel suo letto non si vede: è in casa (le finestre sono accese)
  u.mesh.visible=!(u.act==='sleep'&&u.bed&&u.from===u.bed);
  return goal;
}
/* per l'ispettore e per i test: tutti i punteggi del colono, spiegati */
function explainColonist(u){ return explain(COLONIST_ACTIONS,colonistContext(u),u.act); }

function goalTile(u,dt){
  if(u.faction==='raider'){
    // saccheggiano il bersaglio più vicino, tuo o dei clan: non ce l'hanno
    // con te in particolare, ce l'hanno col pianeta
    const mine=nearestOf(u.from,FC.mine), theirs=nearestOf(u.from,FC.rivalB);
    if(mine&&theirs)
      return u.from.center.dot(mine.center)>=u.from.center.dot(theirs.center)?mine:theirs;
    return mine||theirs||nearestOf(u.from,FC.sites,t=>!!t.site)||u.from;
  }
  if(u.faction==='rival'){
    const set=u.settlement;
    if(u.kind==='caravan') return caravanGoal(u);
    if(FC.raiders.length){
      let best=null,bd=-2;
      for(const e of FC.raiders){ const d=u.from.center.dot(e.from.center);
        if(d>bd){ bd=d; best=e.from; } }
      if(best) return best;
    }
    if(set&&set.relation==='ostile') return nearestOf(u.from,FC.mine);
    return set?set.core:u.from;
  }
  if(UNITS[u.kind].civil) return civilBrain(u,dt);

  // SCHIERATE: marciano sull'obiettivo, ignorando le scaramucce a casa
  if(u.deployed&&army.target&&army.target.relation==='ostile'){
    const foe=nearestFoeUnit(u);
    if(foe&&u.mesh.position.distanceTo(foe.mesh.position)<4) return foe.from;
    const t=nearestTile(u.from,x=>x.settlement===army.target&&!!x.building);
    if(t) return t;
  }
  // NON SCHIERATE: restano di guardia e ingaggiano solo chi entra in casa
  const foe=nearestFoeUnit(u);
  if(foe){
    const atHome=nearestTile(foe.from,t=>isMine(t));
    const near=atHome&&foe.from.center.dot(atHome.center)>0.90;
    if(near||foe.faction==='raider') return foe.from;
  }
  // se dei predoni sono a terra, li intercetta anche se non sono adiacenti
  if(FC.raiders.length){
    let best=null,bd=-2;
    for(const e of FC.raiders){ const d=u.from.center.dot(e.from.center);
      if(d>bd){ bd=d; best=e.from; } }
    if(best) return best;
  }
  return nearestOf(u.from,FC.defense);
}

function stepUnits(dt){
  rebuildFrameCache();
  for(const u of units){
    if(u.state==='landing'){ u.mesh.scale.setScalar(.55+.45*Math.min(1,u.land)); continue; }
    const fly=false;   // i predoni ora camminano: se volassero le mura non conterebbero
    // l'obiettivo si ricalcola all'arrivo su una nuova casella o ogni ~0,3 s,
    // non a ogni fotogramma: è qui che se ne andavano le prestazioni
    u.think=(u.think||0)-dt;
    if(u.goal===undefined||u.lastFrom!==u.from||u.think<=0){
      u.goal=goalTile(u,dt); u.lastFrom=u.from; u.think=0.25+Math.random()*0.2;
    }
    const goal=u.goal;
    const parked = goal && goal===u.from && u.to===u.from;

    if(parked){
      // fermo al lavoro: leggera oscillazione, così si vede che è attivo
      u.bob+=dt*3;
      const dir=u.from.center;
      u.mesh.position.copy(dir.clone().multiplyScalar(
        tileRadius(u.from)+0.17+(u.job?Math.abs(Math.sin(u.bob))*0.05:0)));
      u.mesh.quaternion.setFromUnitVectors(UP,dir);
      continue;
    }
    // solo strade finite: un cantiere ha già il tipo dell'edificio e dava il bonus
    const road=t=>hasFlag(t,'road')&&!t.site;
    const onRoad=road(u.from)||road(u.to);
    // un costruttore esperto fa la spola più in fretta
    u.t+=dt*u.speed*(onRoad?1.6:1)*(u.act==='build'?skillMul(u,'build'):1);
    if(u.t>=1){
      u.t=0; u.from=u.to;
      if(goal&&goal!==u.from) u.to=stepToward(u.from,goal,fly,u.faction!=='you');
      else {
        const opts=u.from.neighbors.map(i=>tiles[i]).filter(t=>fly||walkable(t));
        u.to=(goal===u.from)?u.from:(opts.length?opts[Math.floor(Math.random()*opts.length)]:u.from);
      }
    }
    const dir=u.from.center.clone().lerp(u.to.center,u.t).normalize();
    const r=THREE.MathUtils.lerp(tileRadius(u.from),tileRadius(u.to),u.t);
    u.mesh.position.copy(dir.clone().multiplyScalar(r+(fly?0.35:0.17)));
    u.mesh.quaternion.setFromUnitVectors(UP,dir);
  }
}

/* ═══════════════ combattimento ═══════════════ */
