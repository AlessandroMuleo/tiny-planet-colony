/* l'alleanza non si compra più con un dono solo: i doni alzano la
   benevolenza (vedi giftTo, più sotto), e a 75 il clan diventa alleato */
function declareWar(s){
  if(s.relation==='conquistato') return;
  if(s.relation!=='assoggettato'){ s.goodwill=-100; s.log.unshift('−100 guerra dichiarata'); }
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
  !tiles.some(t=>t.settlement===s&&hasFlag(t,'core')) &&
  tiles.some(t=>t.settlement===s&&t.building) &&
  !units.some(u=>u.settlement===s);
function subjugate(s){
  if(!canSubjugate(s)) return;
  s.relation='assoggettato'; s.unrest=0; s.request=null;
  const camps=tiles.filter(t=>t.settlement===s&&t.building).length;
  const n=Math.min(6,Math.max(1,Math.floor(camps*0.7)));
  const home=tiles.find(t=>t.settlement===s&&t.building)||s.core;
  for(let i=0;i<n;i++){
    const u=spawnUnit('thrall','you',home);
    u.stage='adult'; u.age=AGES.child.until; u.origin=s;   // da dove viene: serve per le rivolte
  }
  if(army.target===s) recall();
  syncJobs();
  toast(s.name+' è assoggettato: '+n+' lavoratori e 1,4 materiali di tributo.');
  refreshHUD();
}

function checkConquest(s){
  if(s.relation==='conquistato'||s.relation==='assoggettato') return;
  if(tiles.some(t=>t.settlement===s&&t.building)) return;
  const byYou=s.relation==='ostile';
  s.relation='conquistato';
  for(let i=units.length-1;i>=0;i--) if(units[i].settlement===s) killUnit(units[i],i);
  // il bottino è tuo solo se eri in guerra con loro: se li hanno distrutti
  // un altro clan o i predoni, non ti spetta niente
  if(!byYou){ if(army.target===s) recall(); logEvent(s.name+' è stato spazzato via.'); refreshHUD(); return; }
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
  const troops=units.filter(u=>u.settlement===s&&u.kind==='soldier').length;

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
  if(s.mat>=20&&troops<(Math.ceil(owned.length*0.8)+2)*personalityOf(s).troops){
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

/* ═══════════════ benevolenza ═══════════════
   Il rapporto con un clan non è più una parola ma un numero, da −100 a
   +100, come in RimWorld. La parola (ostile, neutrale, alleato) si ricava
   dal numero, con un margine perché non si ribalti per un punto:
   si diventa ostili a −40 e si torna neutrali sopra −25; alleati a 75,
   e si smette sotto 60. Col tempo il numero torna verso il carattere
   naturale del clan.                                                  */
const GOODWILL = {HOSTILE:-40, UNHOSTILE:-25, ALLY:75, UNALLY:60, DRIFT:0.02};
const PERSONALITIES = {
  mercanti:     {label:'mercanti',     natural:20,  gift:1.3, border:0.7, caravan:1.4, troops:0.8,
                 note:'apprezzano doni e scambi, mandano carovane ricche'},
  guerrieri:    {label:'guerrieri',    natural:-15, gift:0.8, border:1.2, caravan:0.7, troops:1.4,
                 note:'si armano in fretta e perdonano poco'},
  isolazionisti:{label:'isolazionisti',natural:0,   gift:0.7, border:2.0, caravan:0,   troops:1.0,
                 note:'non commerciano e odiano chi costruisce ai loro confini'}
};
const GIFT_COST={mat:40, food:20}, PEACE_COST={mat:60}, MEDIATE_COST={mat:40};
const personalityOf = s => PERSONALITIES[s.personality]||PERSONALITIES.mercanti;
const settled = s => s.relation==='conquistato'||s.relation==='assoggettato';

/* dopo aver creato i clan di un mondo: carattere, benevolenza, rapporti tra loro */
function initDiplomacy(rnd){
  const ids=Object.keys(PERSONALITIES);
  for(const s of settlements){
    s.personality=ids[Math.floor(rnd()*ids.length)];
    s.goodwill=Math.round(personalityOf(s).natural+rnd()*20-10);
    s.ties={}; s.request=null; s.reqT=90+Math.floor(rnd()*120);
    s.unrest=0; s.giftT=0; s.log=[];
    updateRelation(s,true);
  }
  for(const a of settlements) for(const b of settlements)
    if(a!==b&&a.ties[b.name]===undefined){
      setTie(a,b,Math.round(rnd()*80-40));
    }
}
/* la parola che corrisponde al numero, con il margine di isteresi */
function updateRelation(s,silent){
  if(settled(s)) return;
  const g=s.goodwill, was=s.relation;
  let rel=was;
  if(was==='ostile'){ if(g>GOODWILL.UNHOSTILE) rel=g>=GOODWILL.ALLY?'alleato':'neutrale'; }
  else if(was==='alleato'){ if(g<GOODWILL.UNALLY) rel=g<=GOODWILL.HOSTILE?'ostile':'neutrale'; }
  else rel = g<=GOODWILL.HOSTILE?'ostile' : g>=GOODWILL.ALLY?'alleato' : 'neutrale';
  if(rel===was) return;
  s.relation=rel;
  if(rel!=='ostile'&&army.target===s) recall();
  if(!silent) logEvent(s.name+(rel==='ostile'?' ci è ora ostile.':rel==='alleato'?' è ora nostro alleato.':' torna neutrale.'));
}
/* ogni variazione passa di qui: il motivo resta nel registro del clan */
function shiftGoodwill(s,delta,why){
  if(!s||settled(s)||!delta) return;
  s.goodwill=Math.max(-100,Math.min(100,s.goodwill+delta));
  if(why&&Math.abs(delta)>=1){
    s.log.unshift((delta>0?'+':'')+Math.round(delta)+' '+why);
    if(s.log.length>5) s.log.length=5;
  }
  updateRelation(s);
}

/* ── azioni del giocatore ── */
const canGift = s => !settled(s)&&s.relation!=='ostile'&&(s.giftT||0)<=0&&
  res.mat>=GIFT_COST.mat&&res.food>=GIFT_COST.food;
function giftTo(s){
  if(!canGift(s)) return;
  res.mat-=GIFT_COST.mat; res.food-=GIFT_COST.food; s.giftT=30;
  shiftGoodwill(s,25*personalityOf(s).gift*(activeFlag('embassy')?1.5:1)*(1+techSum('gift')),'dono');
  // aiutare un clan in guerra irrita il suo nemico
  for(const o of settlements) if(o!==s&&atWar(s,o)) shiftGoodwill(o,-10,'hai aiutato '+s.name);
  toast(s.name+' accetta il dono ('+Math.round(s.goodwill)+').'); refreshHUD();
}
const canMakePeace = s => s.relation==='ostile'&&!settled(s)&&res.mat>=PEACE_COST.mat;
function makePeace(s){
  if(!canMakePeace(s)) return;
  res.mat-=PEACE_COST.mat;
  if(army.target===s) recall();
  shiftGoodwill(s,Math.max(35,GOODWILL.UNHOSTILE+5-s.goodwill),'trattato di pace');
  toast('Offerta di pace a '+s.name+': '+(s.relation==='ostile'?'rifiutata.':'accettata.')); refreshHUD();
}

/* ── clan tra loro: si alleano o si fanno guerra, e tu puoi mediare ── */
/* guerra con margine: comincia a −60 e finisce solo sopra −30, altrimenti
   un rapporto che oscilla intorno alla soglia accendeva e spegneva la
   guerra ogni pochi secondi */
const WAR_AT=-60, TRUCE_AT=-30;
const tie = (a,b) => (a.ties&&a.ties[b.name])||0;
const atWar = (a,b) => a!==b&&!settled(a)&&!settled(b)&&!!(a.wars&&a.wars[b.name]);
function setTie(a,b,v){
  v=Math.max(-100,Math.min(100,v)); a.ties[b.name]=v; b.ties[a.name]=v;
  a.wars=a.wars||{}; b.wars=b.wars||{};
  const w = a.wars[b.name] ? v<=TRUCE_AT : v<=WAR_AT;
  a.wars[b.name]=w; b.wars[a.name]=w;
}
const mediateCost = () => MEDIATE_COST.mat*(activeFlag('embassy')?0.5:1);
const canMediate = (a,b) => atWar(a,b)&&res.mat>=mediateCost();
function mediate(a,b){
  if(!canMediate(a,b)) return;
  res.mat-=mediateCost();
  setTie(a,b,tie(a,b)+45);
  shiftGoodwill(a,10,'mediazione'); shiftGoodwill(b,10,'mediazione');
  toast('Mediazione tra '+a.name+' e '+b.name+(atWar(a,b)?': la guerra continua.':': tregua firmata.')); refreshHUD();
}

/* ── richieste a tempo, portate da un emissario a piedi ── */
function sendEnvoy(s){
  const home=tiles.find(t=>t.settlement===s&&t.building);
  if(!home||!FC.storage.length) return;
  const kind=s.personality==='guerrieri'?'mat':s.personality==='isolazionisti'?'food':(Math.random()<0.5?'food':'mat');
  const req={kind, amount:30+10*Math.floor(Math.random()*4), deadline:60};
  // su un altro continente non si arriva a piedi: il messaggio viene via mare
  if(!FC.storage.some(t=>reachable(home,t))){ receiveRequest(s,req,' (via mare)'); return; }
  const u=spawnUnit('envoy','rival',home);
  u.settlement=s; u.lifeT=0; u.delivered=false; u.req=req;
  takeCarry(u,0xffe08a);
}
function receiveRequest(s,req,how){
  if(settled(s)||s.relation==='ostile'||s.request) return;
  s.request={...req, accepted:false};
  logEvent('📜 '+s.name+' chiede '+req.amount+(req.kind==='food'?' cibo':' materiali')+
    ' entro '+req.deadline+' secondi'+(how||'')+'.');
  if(auto) govAnswer(s);
}
function envoyGoal(u){
  if(u.delivered) return u.settlement?u.settlement.core:u.from;
  const st=nearestStorage(u.from);
  if(st&&u.from===st){
    u.delivered=true; dropCarry(u);
    if(u.settlement) receiveRequest(u.settlement,u.req);
  }
  return st||u.from;
}
function answerRequest(s,yes){
  const r=s.request; if(!r||r.accepted) return;
  if(!yes){ s.request=null; shiftGoodwill(s,-5,'richiesta rifiutata'); toast('Richiesta di '+s.name+' rifiutata.'); refreshHUD(); return; }
  r.accepted=true; toast('Richiesta di '+s.name+' accettata: consegna entro '+r.deadline+' secondi.'); refreshHUD();
}
function deliverRequest(s){
  const r=s.request; if(!r||!r.accepted||res[r.kind]<r.amount) return;
  res[r.kind]-=r.amount; s.request=null;
  shiftGoodwill(s,15*personalityOf(s).gift*(1+techSum('gift')),'richiesta esaudita');
  toast(s.name+' ringrazia: richiesta esaudita.'); refreshHUD();
}
/* il governatore risponde da solo: accetta solo se può permetterselo */
function govAnswer(s){
  const r=s.request; if(!r) return;
  if(res[r.kind]>=r.amount*1.5){ answerRequest(s,true); deliverRequest(s); }
  else answerRequest(s,false);
}

/* ── un tick di diplomazia ── */
function diplomacyTick(){
  for(const s of settlements){
    if(s.relation==='conquistato') continue;
    if(s.relation==='assoggettato'){ unrestTick(s); continue; }
    const P=personalityOf(s);
    // deriva verso il carattere naturale
    const diff=P.natural-s.goodwill;
    s.goodwill+=Math.sign(diff)*Math.min(GOODWILL.DRIFT,Math.abs(diff));
    // un'ambasciata aperta avvicina i clan da sola, fino a 50
    if(activeFlag('embassy')&&s.goodwill<50) s.goodwill+=0.03;
    // costruire ai loro confini li irrita, di continuo
    let near=0;
    for(const t of FC.mine) for(const x of s.tiles) if(x.building&&t.center.dot(x.center)>0.985){ near++; break; }
    if(near){ s.borderAcc=(s.borderAcc||0)+near*0.03*P.border;
      if(s.borderAcc>=1){ shiftGoodwill(s,-Math.floor(s.borderAcc),'costruisci ai loro confini'); s.borderAcc%=1; } }
    else updateRelation(s);
    if(s.giftT>0) s.giftT--;
    // richieste: una alla volta, portata da un emissario
    if(s.request){
      if(--s.request.deadline<=0){
        const acc=s.request.accepted; s.request=null;
        shiftGoodwill(s,acc?-20:-8,acc?'promessa non mantenuta':'richiesta ignorata');
        logEvent(s.name+(acc?': non hai consegnato quanto promesso.':': la richiesta è scaduta senza risposta.'));
      }
    } else if(s.relation!=='ostile'&&--s.reqT<=0){
      s.reqT=150+Math.floor(Math.random()*150);
      if(!units.some(u=>u.kind==='envoy'&&u.settlement===s&&!u.delivered)) sendEnvoy(s);
    }
    // rapporti con gli altri clan: oscillano, i guerrieri litigano più spesso
    for(const o of settlements){
      if(o===s||settled(o)||s.name>o.name) continue;
      const pull=(s.personality==='guerrieri'||o.personality==='guerrieri')?-0.06:
                 (s.personality==='mercanti'&&o.personality==='mercanti')?0.06:0;
      const was=atWar(s,o);
      setTie(s,o,tie(s,o)+pull+(Math.random()-0.5)*0.8);
      if(atWar(s,o)!==was) logEvent(was?'Tregua tra '+s.name+' e '+o.name+'.':'⚔ '+s.name+' e '+o.name+' sono in guerra.');
    }
    // migranti: dai clan amici arriva gente, se ci sono letti
    if(s.goodwill>60&&rates().houses>pop&&Math.random()<0.004*(1+techSum('migrants'))){
      const u=spawnUnit('worker','you',s.core);
      u.age=AGES.child.until+10; applyAge(u); pop++; syncJobs();
      shiftGoodwill(s,2,'un loro migrante accolto');
      logEvent(u.name+', dal '+s.name+', si unisce alla colonia.');
    }
  }
}
/* un predone ucciso vicino a un clan, con tue unità lì accanto: li hai aiutati */
function raiderFellNear(u){
  for(const s of settlements){
    if(settled(s)||s.relation==='ostile') continue;
    if(!s.tiles.some(t=>t.building&&t.center.dot(u.from.center)>0.97)) continue;
    const helped=units.some(o=>o.faction==='you'&&o.mesh.position.distanceTo(u.mesh.position)<3.5);
    if(helped) shiftGoodwill(s,6,'aiuto contro i predoni');
  }
}

/* ── rivolte: gli assoggettati non restano buoni per sempre ──
   Il malcontento sale se vicino a loro non c'è una guarnigione e se chi
   lavora per te è scontento; a 100 si ribellano.                       */
function garrisonNear(s){
  return units.filter(u=>u.faction==='you'&&!UNITS[u.kind].civil&&
    u.from.center.dot(s.core.center)>0.9).length;
}
function unrestTick(s){
  const thralls=units.filter(u=>u.kind==='thrall'&&u.origin===s);
  const needed=Math.ceil(thralls.length/3)+1;
  const guard=garrisonNear(s);
  const mood=thralls.length?thralls.reduce((m,u)=>m+needsOf(u).mood,0)/thralls.length:0.5;
  const grow=(Math.max(0,1-guard/needed)*0.4+Math.max(0,0.45-mood)*1.5)*(1-techSum('unrest'));
  s.unrest=Math.max(0,Math.min(100,(s.unrest||0)+grow-0.2));
  if(s.unrest<100) return;
  // rivolta: il clan torna ostile e i suoi assoggettati impugnano le armi
  s.relation='ostile'; s.goodwill=-80; s.unrest=0;
  s.log.unshift('rivolta');
  for(let i=units.length-1;i>=0;i--){
    const u=units[i];
    if(u.kind!=='thrall'||u.origin!==s) continue;
    const at=u.from;
    killUnit(u,i);
    spawnUnit('soldier','rival',at).settlement=s;
  }
  trimWorkers(); syncJobs();
  logEvent('🔥 Rivolta! '+s.name+' si ribella: gli assoggettati hanno preso le armi.');
}
