const ALLY_COST={mat:40,food:20};
const canAlly = s => s.relation==='neutrale'&&res.mat>=ALLY_COST.mat&&res.food>=ALLY_COST.food;
function allyWith(s){
  if(!canAlly(s)) return;
  res.mat-=ALLY_COST.mat; res.food-=ALLY_COST.food;
  s.relation='alleato';
  toast(s.name+' accetta il dono: alleanza stretta.'); refreshHUD();
}
function declareWar(s){
  if(s.relation==='conquistato') return;
  s.relation='ostile'; army.target=s;
  if(army.size===0) army.size=myTroops().length;
  applyDeploy();
  toast('Guerra dichiarata a '+s.name+'.'); refreshHUD();
}
function recall(){
  army.target=null;
  for(const u of myTroops()) u.deployed=false;
  toast('Truppe richiamate a difesa.'); refreshHUD();
}
/* Assoggettare invece di radere al suolo: le loro strutture restano in piedi
   e versano un tributo, e i superstiti passano a lavorare per te.        */
const canSubjugate = s => (s.relation==='ostile') &&
  !tiles.some(t=>t.settlement===s&&t.building==='keep') &&
  tiles.some(t=>t.settlement===s&&t.building) &&
  !units.some(u=>u.settlement===s);
function subjugate(s){
  if(!canSubjugate(s)) return;
  s.relation='assoggettato';
  const camps=tiles.filter(t=>t.settlement===s&&t.building).length;
  const n=Math.min(6,Math.max(1,Math.floor(camps*0.7)));
  const home=tiles.find(t=>t.settlement===s&&t.building)||s.core;
  for(let i=0;i<n;i++){
    const u=spawnUnit('thrall','you',home);
    u.stage='adult'; u.age=AGES.child.until;
  }
  if(army.target===s) recall();
  syncJobs();
  toast(s.name+' è assoggettato: '+n+' lavoratori e 1,4 materiali di tributo.');
  refreshHUD();
}

function checkConquest(s){
  if(s.relation==='conquistato'||s.relation==='assoggettato') return;
  if(tiles.some(t=>t.settlement===s&&t.building)) return;
  s.relation='conquistato';
  for(let i=units.length-1;i>=0;i--) if(units[i].settlement===s) killUnit(units[i],i);
  // unico punto del codice dove il bottino non era clampato alla capienza:
  // dopo una conquista le scorte potevano superare il tetto mostrato in HUD
  const cap=capacity();
  res.mat=Math.min(cap,res.mat+60); res.food=Math.min(cap,res.food+30);
  if(army.target===s) recall();
  toast(s.name+' è caduto. Bottino: 60 materiali, 30 cibo.'); refreshHUD();
}

/* ═══════════════ i rivali crescono da soli ═══════════════ */
/* I clan hanno la loro economia: il reddito cresce con le strutture, quindi
   l'espansione è composta. Il vecchio tetto fisso a 9 li congelava. */
const RIVAL_COST={camp:26, rfarm:34, rtower:46, keep:50};
function rivalThink(s){
  if(s.relation==='conquistato') return;
  if(s.relation==='assoggettato'){ return; }   // non crescono più: lavorano per te
  const owned=tiles.filter(t=>t.settlement===s&&t.building);
  const has=k=>owned.filter(t=>t.building===k).length;

  // reddito: base + strutture + campi. Un alleato investe meno nell'espansione.
  const income=(0.5+owned.length*0.22+has('rfarm')*0.55)*(s.relation==='alleato'?0.6:1);
  s.mat+=income;
  s.thinkT++;
  if(s.thinkT<5) return;
  s.thinkT=0;
  if(!owned.length) return;

  // il tetto cresce col tempo e col mondo: l'unico limite vero resta la
  // terra libera intorno a loro. Se li ignori, si prendono il pianeta.
  const cap=12+worldIndex*6+Math.floor(worldAge/150);
  const troops=units.filter(u=>u.settlement===s).length;

  // 1. senza roccaforte non c'è clan: la ricostruiscono per prima cosa
  if(!has('keep')&&s.mat>=RIVAL_COST.keep){
    s.mat-=RIVAL_COST.keep; finish(owned[0],'keep','rival'); return;
  }
  // 2. scelgono cosa serve: prima i campi (reddito), poi le torri, poi terreno
  let want='camp';
  if(has('rfarm')<Math.ceil(owned.length/3)) want='rfarm';
  else if(has('rtower')<Math.floor(owned.length/4)) want='rtower';
  const cost=RIVAL_COST[want];
  if(s.mat>=cost&&owned.length<cap){
    const cand=[];
    for(const t of owned) for(const n of t.neighbors){
      const x=tiles[n];
      if(BIOMES[x.biome].build&&!x.building) cand.push(x);
    }
    if(cand.length){
      const spot=cand[Math.floor(Math.random()*cand.length)];
      s.mat-=cost;
      finish(spot,want,'rival'); spot.settlement=s; s.tiles.push(spot);
      return;
    }
  }
  // 3. se non c'è più spazio o soldi per costruire, addestrano
  if(s.mat>=20&&troops<Math.ceil(owned.length*0.8)+2){
    s.mat-=20;
    const home=owned[Math.floor(Math.random()*owned.length)];
    spawnUnit('soldier','rival',home).settlement=s;
  }
}

/* ═══════════════ carattere dei mondi ed eredità ═══════════════
   Ogni pianeta ha un tratto che ne cambia l'economia, e ogni mondo
   colonizzato lascia un bonus permanente: così andare avanti ha un senso
   misurabile invece di essere solo un nuovo terreno da riempire.     */
const TRAITS = [
  {id:'fertile', name:'Terre fertili',   note:'+30% cibo',        food:1.30},
  {id:'ricco',   name:'Vene profonde',   note:'+35% materiali',   mat:1.35},
  {id:'gelido',  name:'Inverni lunghi',  note:'stagioni più dure', harsh:true},
  {id:'ventoso', name:'Cieli tempestosi',note:'+40% energia',     pow:1.40},
  {id:'ostile',  name:'Rotta dei predoni',note:'incursioni più fitte', raid:true},
  {id:'quieto',  name:'Angolo tranquillo',note:'incursioni rade',  calm:true}
];
let trait=TRAITS[0];
const legacy = () => 1 + 0.06*(worldIndex-1);   // +6% a tutto per mondo colonizzato

/* ═══════════════ commercio e carovane ═══════════════ */
