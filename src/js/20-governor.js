/* Quanto è lontano un punto dal magazzino più vicino, in passi reali.
   Serve a non aprire cantieri dall'altra parte del continente. */
function haulSteps(t){
  const st=nearestOf(t,FC.storage);
  if(!st) return 99;
  const d=distField(st)[t.id];
  return d<0?99:Math.round(d/STEP_COST);
}
/* ── governatore a utility ─────────────────────────────────────────
   Stesso motore dei coloni (14-utility.js), applicato alla colonia intera.
   Ogni progetto di costruzione riceve un punteggio dalle "pressioni" della
   colonia; si apre il cantiere del migliore. Se il migliore costa più di
   quanto c'è, si aspetta e si risparmia: non si ripiega su qualcosa di
   meno utile solo perché costa poco.                                    */
function govContext(){
  const r=rates();
  const mineOrSite=t=>isMine(t)||(t.site&&t.owner==='you');
  const count={};
  for(const t of tiles) if(t.building&&mineOrSite(t)) count[t.building]=(count[t.building]||0)+1;
  const eat=Math.max(0.5, r.stock-r.food);            // quanto si mangia a tick
  let freeJobs=0;
  for(const t of workedTiles()) freeJobs+=jobsOf(t)-(t.workers||0);
  const idle=idleCount();
  return {r, count:k=>count[k]||0, cap:capacity(), eat,
    foodDays: res.food/eat,                           // tick di cibo in magazzino
    freeBeds: r.houses-pop,
    jobless: Math.max(0, idle-freeJobs),              // disoccupati: servono posti di lavoro
    threat: Math.min(1,(raidNo+1)/6)*(raidIn<40||raidActive?1:0.7),
    wounded: myPeople().filter(u=>u.wounded).length,
    allies: settlements.some(s=>s.relation==='alleato'||s.relation==='assoggettato'),
    winter: SEASONS[season].food<0.8,
    spoil: r.spoil,
    moodAvg: (()=>{ const m=units.filter(u=>hasNeeds(u)&&u.needs); return m.length?m.reduce((s,u)=>s+u.needs.mood,0)/m.length:0.6; })(),
    children: myPeople().filter(u=>u.stage==='child').length,
    // lavori all'asciutto: sulla sabbia sempre, in siccità anche i campi
    dryJobs: FC.mine.filter(t=>isMine(t)&&jobsOf(t)>0&&!wellNear(t)&&
      (t.biome==='sand'||(weather.kind==='siccita'&&BUILDINGS[t.building].per&&BUILDINGS[t.building].per.food>0))).length,
    // lingotti: servono per torrette, ambasciata e rampa
    wantBars: (tech>=1||raidNo>=2||settlements.length>0)&&(res.bar||0)<40};
}
/* considerazioni che ricorrono */
const gAfford = key => consider('si può pagare', c=>{
  const cost=costOf(key);
  return Math.min(...COST_KEYS.map(k=>cost[k]?(res[k]||0)/cost[k]:1));
}, CURVES.linear(0.7,0.3));
const gNone = (key,n=1) => consider('ne mancano', c=>1-c.count(key)/n, CURVES.step(.01));
/* i disoccupati non sono una condizione ma un bonus: moltiplicarli come le
   altre considerazioni abbassava tutti i progetti produttivi quando tutti
   avevano un lavoro, e con il cibo a zero la fattoria perdeva con le capanne */
const withJobs = base => c => base*(1+0.5*Math.min(1,c.jobless/6));
const gFood = consider('cibo scarso', c=>Math.max(1-c.foodDays/80, c.r.food<0?0.75:0), CURVES.logistic(.45,8));

const GOV_PROJECTS={
  farm:    {label:'Fattoria', weight:withJobs(1.1), considerations:[gFood, gAfford('farm')]},
  fishery: {label:'Peschiera', weight:withJobs(1.0), considerations:[gFood, gAfford('fishery')]},
  green:   {label:'Serra', weight:0.85, considerations:[gFood,
    consider('inverno o carestia', c=>is(c.winter||c.r.food<0)), gAfford('green')]},
  // i letti vengono subito dopo il cibo: senza letti non nasce nessuno,
  // ed è la crescita a tenere viva la colonia
  hut:     {label:'Capanna', weight:1.25, considerations:[
    consider('letti finiti', c=>1-c.freeBeds/4, CURVES.logistic(.6,10)),
    consider('pochi materiali', c=>1-res.mat/120, CURVES.linear(0.7,0.3)), gAfford('hut')]},
  block:   {label:'Alloggi', weight:1.25, considerations:[
    consider('letti finiti', c=>1-c.freeBeds/8, CURVES.logistic(.6,10)),
    consider('materiali in abbondanza', c=>res.mat/120, CURVES.power(1.5)), gAfford('block')]},
  mine:    {label:'Miniera', weight:withJobs(0.9), considerations:[
    consider('materiali scarsi', c=>Math.max(1-res.mat/Math.min(c.cap,220), 1-c.count('mine')), CURVES.linear(0.8,0.2)),
    gAfford('mine')]},
  workshop:{label:'Officina', weight:withJobs(0.6), considerations:[
    consider('cibo in avanzo', c=>c.foodDays/150, CURVES.logistic(.6,8)),
    consider('materiali scarsi', c=>1-res.mat/Math.min(c.cap,220)), gAfford('workshop')]},
  // l'energia non è vitale come cibo e letti, ma ricerca, torrette e santuari
  // la chiedono: sotto i letti, alla pari con la miniera
  plant:   {label:'Centrale', weight:0.85, considerations:[
    consider('energia in calo', c=>0.6-c.r.pow, CURVES.logistic(.3,8)),
    consider('poca energia in scorta', c=>1-res.pow/Math.min(c.cap,120), CURVES.linear(0.8,0.2)),
    gAfford('plant')]},
  depot:   {label:'Deposito', weight:0.9, considerations:[
    // l'energia piena non chiede spazio: serve per cibo e materiali
    consider('magazzini pieni', c=>Math.max(res.food,res.mat)/c.cap, CURVES.logistic(.85,18)),
    gAfford('depot')]},
  clinic:  {label:'Ospedale', weight:0.9, considerations:[
    consider('feriti', c=>c.wounded/3, CURVES.linear(0.7,0.3)), gNone('clinic'), gAfford('clinic')]},
  turret:  {label:'Torretta', weight:0.8, considerations:[
    consider('minaccia', c=>c.threat),
    consider('poche difese', c=>1-c.count('turret')/(1+Math.floor(raidNo/3))), gAfford('turret')]},
  armory:  {label:'Armeria', weight:0.8, considerations:[
    consider('minaccia', c=>Math.max(c.threat, worldIndex>1?0.8:0)), gNone('armory'), gAfford('armory')]},
  wall:    {label:'Mura', weight:0.5, considerations:[
    consider('minaccia', c=>c.threat),
    consider('mura da completare', c=>1-c.count('wall')/Math.max(1,Math.min(8,Math.floor(pop/3)))), gAfford('wall')]},
  lab:     {label:'Centro ricerca', weight:0.7, considerations:[
    consider('ricerca da fare', c=>is(researchLeft()>0)), gNone('lab'),
    consider('colonia avviata', c=>res.mat/110, CURVES.logistic(.8,10)), gAfford('lab')]},
  shrine:  {label:'Santuario', weight:0.55, considerations:[
    consider('minaccia', c=>c.threat), gNone('shrine'),
    consider('colonia ricca', c=>res.mat/120, CURVES.logistic(.85,10)), gAfford('shrine')]},
  fort:    {label:'Roccaforte', weight:0.55, considerations:[
    consider('minaccia', c=>c.threat), gNone('fort'),
    consider('colonia ricca', c=>res.mat/160, CURVES.logistic(.85,10)), gAfford('fort')]},
  foundry: {label:'Fonderia', weight:withJobs(0.75), considerations:[
    consider('servono lingotti', c=>is(c.wantBars)), gNone('foundry'),
    consider('materiali per fonderli', c=>res.mat/100, CURVES.logistic(.6,8)), gAfford('foundry')]},
  granary: {label:'Granaio', weight:0.9, considerations:[
    consider('cibo che marcisce', c=>c.spoil/2, CURVES.logistic(.4,8)), gAfford('granary')]},
  well:    {label:'Pozzo', weight:0.8, considerations:[
    consider('lavori all\'asciutto', c=>c.dryJobs/2, CURVES.linear(1,0)), gAfford('well')]},
  tavern:  {label:'Taverna', weight:0.7, considerations:[
    consider('umore basso', c=>1-c.moodAvg, CURVES.logistic(.45,10)), gNone('tavern', 1+Math.floor(pop/60)),
    gAfford('tavern')]},
  school:  {label:'Scuola', weight:0.6, considerations:[
    consider('bambini', c=>c.children/8, CURVES.linear(1,0)), gNone('school'), gAfford('school')]},
  memorial:{label:'Memoriale', weight:0.6, considerations:[
    consider('lutto', c=>grief*2, CURVES.linear(1,0)), gNone('memorial'), gAfford('memorial')]},
  embassy: {label:'Ambasciata', weight:0.6, considerations:[
    consider('ci sono clan', c=>is(settlements.some(s=>!settled(s)))), gNone('embassy'), gAfford('embassy')]},
  watch:   {label:'Torre di segnalazione', weight:0.6, considerations:[
    consider('minaccia', c=>c.threat), gNone('watch'), gAfford('watch')]},
  control: {label:'Controllo missioni', weight:0.6, considerations:[
    consider('stazione in orbita', c=>is(hasOrbital('station'))), gNone('control'),
    consider('colonia ricca', c=>res.mat/200, CURVES.logistic(.8,10)), gAfford('control')]},
  elevator:{label:'Ascensore spaziale', weight:0.5, considerations:[
    consider('molta orbita', c=>orbit.filter(o=>o.built).length/4, CURVES.linear(1,0)), gNone('elevator'),
    consider('colonia ricca', c=>res.mat/300, CURVES.logistic(.8,10)), gAfford('elevator')]},
  market:  {label:'Mercato', weight:0.6, considerations:[
    consider('alleati', c=>is(c.allies)), gNone('market'), gAfford('market')]}
};
/* Rendimenti decrescenti: un cantiere aperto risponde già in parte alla sua
   pressione, ma la pressione resta finché non è finito. Senza questo il
   progetto in testa (quasi sempre il cibo) vinceva tre cantieri su tre e
   i bisogni secondari, come l'energia, non arrivavano mai. Ogni cantiere
   aperto della stessa categoria moltiplica il punteggio per GOV_DECAY.   */
const GOV_DECAY = 0.45;
const projectKind = k => {
  const B=BUILDINGS[k];
  if(B.houses) return 'houses';
  if(B.per) for(const r in B.per) if(B.per[r]>0) return r;
  return k;
};
function rankProjects(c){
  const open={};
  for(const t of openSites()) if(t.owner==='you'){ const k=projectKind(t.site.kind); open[k]=(open[k]||0)+1; }
  return explain(GOV_PROJECTS,c,null)
    .map(p=>({...p, score:p.score*Math.pow(GOV_DECAY, open[projectKind(p.action)]||0)}))
    .sort((a,b)=>b.score-a.score);
}
/* sotto questa soglia il progetto migliore non vale un cantiere */
const GOV_MIN = 0.25;
let govLast=null;                 // l'ultima decisione, con i motivi (tooltip di «auto»)

/* gli addetti: ogni posto libero ha un punteggio secondo la risorsa che produce */
function govStaff(c){
  const need={
    food: 0.4+0.6*clamp01(1-c.foodDays/80)+(c.r.food<0?0.4:0),
    mat:  0.3+0.6*clamp01(1-res.mat/Math.min(c.cap,220)),
    pow:  0.3+0.7*clamp01(0.6-c.r.pow),
    sci:  researchLeft()?0.45:0.05,
    bar:  c.wantBars?0.6:0.1
  };
  const score=t=>{
    const B=BUILDINGS[t.building];
    if(B.armory) return 0.2+0.8*c.threat;
    if(B.launch) return 0.1;
    const k=skillKey(t);
    return k?need[k]:0.3;
  };
  const open=workedTiles().filter(t=>(t.workers||0)<jobsOf(t)).sort((a,b)=>score(b)-score(a));
  for(const t of open) while((t.workers||0)<jobsOf(t)&&idleCount()>0) t.workers++;
  syncJobs();
}

function autoThink(){
  const c=govContext();
  if(idleCount()>0) govStaff(c);

  // non apre più cantieri di quanti la manodopera ne possa servire
  // uno ogni 4 braccia, fino a 6: con 3 fissi una colonia grande restava con
  // decine di coloni fermi e i materiali accumulati in magazzino
  const maxSites=Math.max(1,Math.min(6,Math.floor(workforce()/4)));
  if(openSites().length<maxSites){
    const ranked=rankProjects(c);
    const best=ranked[0];
    govLast=ranked.slice(0,3);
    $('b-auto').title='Governatore — '+ranked.slice(0,3).map(p=>p.label+' '+p.score.toFixed(2)).join(' · ');
    if(best&&best.score>=GOV_MIN){
      const want=best.action, B=BUILDINGS[want];
      // taglia scelta in base a quanto è ricca e popolosa la colonia
      let sz=1;
      if((B.jobs>0||B.houses||B.granary)&&!B.fixed){
        if(canPay(costOf(want),4)&&pop>14) sz=3;
        else if(canPay(costOf(want),2.5)&&pop>8) sz=2;
      }
      const cost=costOf(want);
      while(sz>1&&!canPay(cost,sz)) sz--;
      if(canPay(cost,sz)){
        const spot=pickSpot(want,sz);
        if(spot){ pay(cost,sz); startSite(spot,want,'you',sz); }
      }
      // altrimenti si aspetta: il progetto migliore resta quello, si risparmia
    }
  }
  // se un deposito è troppo lontano dai cantieri, ne piazza uno in mezzo
  if(!openSites().length&&FC.mine.length>6&&res.mat>60){
    const far=FC.mine.filter(t=>BUILDINGS[t.building].ships&&haulSteps(t)>6);
    if(far.length>=2&&!tiles.some(t=>t.site&&t.site.kind==='depot')){
      const spot=pickSpot('depot',1);
      if(spot&&res.mat>=BUILDINGS.depot.cost.mat){
        res.mat-=BUILDINGS.depot.cost.mat;
        startSite(spot,'depot','you',1);
      }
    }
  }
  // diplomazia: doni finché non sono alleati, pace con chi è ostile se non c'è
  // un esercito schierato, e le richieste in sospeso
  govOrbit(c);
  for(const s of settlements){
    if(canGift(s)&&s.goodwill<GOODWILL.ALLY&&res.mat>110) giftTo(s);
    else if(canMakePeace(s)&&army.target!==s&&res.mat>140) makePeace(s);
    // due clan amici in guerra tra loro: meglio la pace, i commerci ne soffrono
    for(const o of settlements)
      if(atWar(s,o)&&s.goodwill>20&&o.goodwill>20&&res.mat>150&&canMediate(s,o)) mediate(s,o);
    if(s.request&&!s.request.accepted) govAnswer(s);
    else if(s.request&&s.request.accepted&&res[s.request.kind]>=s.request.amount) deliverRequest(s);
  }
}
/* Prima sceglieva a caso tra le caselle confinanti, e la colonia si sfilacciava.
   Ora ogni candidata riceve un punteggio: quanti tuoi edifici tocca, quanto è
   vicina al centro della colonia, e un bonus se è servita da una strada.
   Le mura fanno il contrario: le vuoi sul bordo, non in mezzo alle case.    */
function colonyCenter(){
  const mine=playerBuildings();
  if(!mine.length) return null;
  const c=new THREE.Vector3();
  for(const t of mine) c.add(t.center);
  return c.normalize();
}
function pickSpot(kind,size){
  size=size||1;
  const B=BUILDINGS[kind];
  const ok=t=>tileAllows(t,kind,size);
  const mine=playerBuildings();
  if(!mine.length){ const any=tiles.filter(ok); return any.length?any[0]:null; }
  const centre=colonyCenter();
  const own=new Set(mine.map(t=>t.id));

  let best=null, bestScore=-1e9;
  for(const t of tiles){
    if(!ok(t)) continue;
    let adj=0, road=0;
    for(const n of t.neighbors){
      if(own.has(n)) adj++;
      if(hasFlag(tiles[n],'road')) road++;
    }
    if(adj===0) continue;                       // mai staccata dalla colonia
    const near=t.center.dot(centre);            // 1 = cuore della colonia
    // penalizza i posti lontani dal magazzino: i blocchi vanno portati a piedi
    const haul = B.blocks ? Math.min(12,haulSteps(t)) : 0;
    let score = B.wall ? (6-adj)*2 + (1-near)*8
                       : adj*3 + near*10 + road*1.5 - haul*0.9;
    score += Math.random()*0.8;                 // rompe i pareggi senza sparpagliare
    if(score>bestScore){ bestScore=score; best=t; }
  }
  if(best) return best;
  const any=tiles.filter(ok).sort((a,b)=>b.center.dot(centre)-a.center.dot(centre));
  return any[0]||null;
}

/* ═══════════════ interfaccia ═══════════════ */
