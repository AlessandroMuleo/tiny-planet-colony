/* ═══════════════ la mente dei coloni ═══════════════
   Quello che la utility AI da sola non fa, perché sceglie un'azione per
   volta e dimentica tutto al ragionamento dopo:
   - ricordi: i luoghi dove si è stati feriti o dove è morto un amico;
   - piani: due o tre azioni decise insieme, eseguite in fila;
   - squadra: chi difende si coordina, e chi è ferito viene soccorso;
   - carattere: rivalità, liti, paci, voci che girano, una storia personale.
   Tutto passa comunque dalla utility AI: un ricordo sposta il percorso e
   la scelta del cantiere, un piano alza il punteggio della sua azione, la
   squadra cambia bersaglio e considerazioni. Niente comportamenti a parte. */

/* statistiche della partita, per la schermata e per la simulazione */
let mindStats = {plans:0, couriers:0, rescues:0, quarrels:0, peace:0, rumors:0};

/* ── ricordi dei luoghi ──────────────────────────────────────────────
   Ogni colono tiene al massimo MEM.MAX ricordi {t: casella, k: tipo, w: forza}.
   Un pericolo sbiadisce in ~250 tick, un lutto nel doppio.            */
const MEM = {MAX:8, FADE:0.004, MIN:0.05, SEE:0.98};
const MEM_KINDS = {danger:'pericolo', death:'lutto'};
function remember(u,tile,kind,w){
  if(!hasNeeds(u)||!tile) return;
  const m=u.mem||(u.mem=[]);
  const e=m.find(x=>x.t===tile.id&&x.k===kind);
  if(e){ e.w=Math.max(e.w,Math.min(1,w)); return; }
  m.push({t:tile.id, k:kind, w:Math.min(1,w)});
  if(m.length>MEM.MAX){ m.sort((a,b)=>b.w-a.w); m.length=MEM.MAX; }
}
/* chi vede un fatto lo ricorda: i coloni entro un paio di caselle */
function witness(tile,kind,w){
  for(const u of units) if(hasNeeds(u)&&u.from.center.dot(tile.center)>MEM.SEE) remember(u,tile,kind,w);
}
/* quanto il colono teme una casella: il ricordo pesa pieno lì, a metà accanto */
function fearOf(u,t){
  if(!u.mem) return 0;
  let f=0;
  for(const m of u.mem){
    if(m.t===t.id) f+=m.w;
    else if(tiles[m.t].neighbors.includes(t.id)) f+=m.w*0.5;
  }
  return f;
}
/* per stepToward: chi va incontro al nemico o a un ferito non si ferma ai ricordi */
const avoidFor = u => u.mem&&u.act!=='fight'&&u.act!=='rescue' ? t=>fearOf(u,t) : null;
const painfulPlace = u => !!u.mem&&u.mem.some(m=>m.k==='death'&&m.w>0.3&&
  (m.t===u.from.id||u.from.neighbors.includes(m.t)));

/* ── storia personale ────────────────────────────────────────────────
   Gli ultimi fatti importanti della vita di un colono. Il primo (arrivo o
   nascita) resta sempre. Frasi senza accordo di genere: i nomi non dicono
   chi è uomo e chi donna.                                              */
const STORY_MAX = 6;
function addStory(u,text){
  if(!hasNeeds(u)) return;
  const s=u.story||(u.story=[]);
  s.push({t:worldAge, x:text});
  if(s.length>STORY_MAX) s.splice(1,s.length-STORY_MAX);
}

/* ── fumetti sopra la testa ──────────────────────────────────────────
   Uno sprite con un'emoji, per due secondi. Al massimo BUBBLE_MAX alla
   volta, e niente senza canvas (la simulazione non ne ha).             */
const BUBBLE_MAX = 10, bubbleTex = new Map();
let bubbles = 0;
function bubble(u,emoji){
  if(!u||!u.mesh||bubbles>=BUBBLE_MAX) return;
  let tex=bubbleTex.get(emoji);
  if(!tex){
    const cv=document.createElement('canvas');
    if(!cv.getContext) return;
    cv.width=cv.height=64;
    const g=cv.getContext('2d');
    if(!g) return;
    g.fillStyle='#fff'; g.strokeStyle='#1b2230'; g.lineWidth=4;
    g.beginPath(); g.arc(32,32,27,0,Math.PI*2); g.fill(); g.stroke();
    g.font='34px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(emoji,32,34);
    tex=new THREE.CanvasTexture(cv); bubbleTex.set(emoji,tex);
  }
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false, fog:false}));
  sp.scale.setScalar(.75); sp.renderOrder=5; bubbles++;
  addFX(sp,2.2,k=>{
    sp.position.copy(u.mesh.position).multiplyScalar(1.06);
    sp.material.opacity=Math.min(1,k*4);
  },()=>{ bubbles--; sp.material.dispose(); });
}

/* ── piani ───────────────────────────────────────────────────────────
   Un piano è una fila di passi. Il passo in testa vale almeno PLAN_FLOOR
   nella scelta (vedi ctx.commit in 14-utility): abbastanza per battere il
   lavoro e il sonno, non abbastanza per battere un nemico addosso o la
   fuga. Un passo è finito quando la sua condizione è vera; un piano che
   non si chiude in PLAN_TTL tick si abbandona.                         */
const PLAN_FLOOR = 0.85, PLAN_TTL = 150;
const PLAN_STEPS = {
  eat:     {label:'mangiare',          done:u=>needsOf(u).food>=0.9},
  sleep:   {label:'dormire',           done:u=>needsOf(u).rest>=0.95},
  courier: {label:'portare un blocco', done:(u,s)=>s.done||!s.site.site},
  work:    {label:'lavorare',          done:u=>!u.job||(u.act==='work'&&u.from===u.job)}
};
const planHead = u => u.plan&&u.plan.steps[0];
function makePlan(u,steps,why){ u.plan={steps, why, at:worldAge}; mindStats.plans++; }
function advancePlan(u){
  const p=u.plan;
  if(!p) return;
  if(worldAge-p.at>PLAN_TTL){ u.plan=null; return; }
  while(p.steps.length&&PLAN_STEPS[p.steps[0].do].done(u,p.steps[0])) p.steps.shift();
  if(!p.steps.length) u.plan=null;
}
const planText = u => u.plan ? u.plan.steps.map(s=>PLAN_STEPS[s.do].label).join(' → ') : '';
/* Decide un piano prima di un'azione: next è l'azione appena scelta.
   Restituisce true se ha fatto un piano (e allora si sceglie di nuovo). */
function planAhead(u,next){
  if(u.plan||next===u.act) return false;
  const n=needsOf(u), food=res.food>=1;
  if(next==='work'&&u.job&&u.from!==u.job){
    // un lavoro lontano: prima si mangia e si dorme, se ce n'è bisogno
    const d=distField(u.job)[u.from.id];
    if(d<6*STEP_COST) return false;
    const steps=[];
    if(n.food<0.55&&food) steps.push({do:'eat'});
    if(n.rest<0.35&&!FC.raiders.length) steps.push({do:'sleep'});
    if(!steps.length) return false;
    makePlan(u,[...steps,{do:'work'}],'lavoro lontano');
    return true;
  }
  if(next==='sleep'&&n.food<0.5&&food){
    makePlan(u,[{do:'eat'},{do:'sleep'}],'cena prima di dormire');
    return true;
  }
  return false;
}
/* chi porta il raccolto al magazzino, se accanto al suo lavoro c'è un
   cantiere a cui mancano blocchi, ne prende uno per la strada del ritorno */
const COURIER_EVERY = 30;
function planCourier(u){
  if(u.plan||!u.job||worldAge-(u.courierAt||-99)<COURIER_EVERY) return;
  const job=u.job, fj=distField(job);
  const site=nearestOf(job,FC.sites,t=>t.site&&t.owner==='you'&&freeBlocks(t)>0&&
    fj[t.id]>=0&&fj[t.id]<=3*STEP_COST&&reachable(u.from,t));
  if(!site) return;
  u.courierAt=worldAge;
  makePlan(u,[{do:'courier',site},{do:'work'}],'un blocco di strada');
}
function courierOk(u){
  const s=planHead(u);
  if(!s||s.do!=='courier'||!s.site.site||s.site.owner!=='you') return false;
  return (u.claim===s.site&&holdsBlock(u)) || freeBlocks(s.site)>0;
}
function courierRun(u){
  const s=planHead(u);
  const g=buildRun(u,s.site);
  if(g) return g;
  s.done=true; mindStats.couriers++;
  u.act=null;
  return u.from;
}

/* ── squadra ─────────────────────────────────────────────────────────
   Si ricalcola a ogni tick economico, solo con dei nemici in giro.
   - bersaglio comune: il nemico più malconcio vicino a chi difende; chi
     lo ha a tiro colpisce lui (16-combat), gli altri gli si avvicinano;
   - capo: chi ha più esperienza di combattimento; chi gli sta vicino
     colpisce il 20% più forte;
   - ritirata: squadra in forte inferiorità, o in inferiorità e malconcia
     (i feriti smettono da soli di difendere: la salute media di chi resta
     non basta a dire che le cose vanno male) → tutti al riparo insieme,
     poi RETREAT_COOL tick prima di poter ripiegare di nuovo.            */
const squad = {target:null, captain:null, retreatT:0, cool:0, fighters:0, foes:0, loggedRaid:-1};
const RETREAT_T = 12, RETREAT_COOL = 30;
function squadTick(){
  if(squad.retreatT>0) squad.retreatT--;
  if(squad.cool>0) squad.cool--;
  if(!FC.danger){ squad.target=null; squad.captain=null; squad.fighters=squad.foes=0; return; }
  const fighters=units.filter(u=>isPerson(u)&&u.act==='fight');
  squad.fighters=fighters.length;
  let cap=null;
  for(const u of fighters){ practice(u,'war',2); if(!cap||skillXp(u,'war')>skillXp(cap,'war')) cap=u; }
  if(cap&&fighters.length>=3&&squad.loggedRaid!==raidNo){
    squad.loggedRaid=raidNo;
    logEvent('⚔ '+cap.name+' guida la difesa.');
    addStory(cap,'Alla guida della difesa'); bubble(cap,'⚔');
  }
  squad.captain=cap;
  let best=null, bh=Infinity;
  const foes=new Set();
  for(const u of fighters) for(const o of nearbyUnits(u.from,true)){
    if(!hostile(u,o)||o.state==='landing'||o.hp<=0) continue;
    foes.add(o);
    if(o.hp<bh){ bh=o.hp; best=o; }
  }
  squad.target=best; squad.foes=foes.size;
  if(fighters.length&&!squad.retreatT&&!squad.cool){
    const hp=fighters.reduce((s,u)=>s+u.hp/u.hpMax,0)/fighters.length;
    const outnumbered=foes.size>=3&&foes.size>=2*fighters.length;
    if(outnumbered||(hp<0.6&&foes.size>fighters.length)){
      squad.retreatT=RETREAT_T; squad.cool=RETREAT_T+RETREAT_COOL;
      logEvent('⚔ La squadra ripiega: troppi feriti.');
      for(const u of fighters) bubble(u,'↩');
    }
  }
}
/* per 16-combat: il bersaglio comune, se u ce l'ha a tiro */
function squadAim(u,range){
  const t=squad.target;
  if(u.faction!=='you'||!t||t.hp<=0||t.state==='landing') return null;
  return u.mesh.position.distanceTo(t.mesh.position)<range ? t : null;
}
/* per unitDamage: +20% accanto al capo */
const nearCaptain = u => { const c=squad.captain;
  return !!c&&c!==u&&u.faction==='you'&&(c.from===u.from||u.from.neighbors.includes(c.from.id)); };

/* ── soccorso ────────────────────────────────────────────────────────
   Un adulto sano vicino a un ferito lontano dall'ospedale se lo carica
   in spalla e ce lo porta. Il ferito "prenotato" (rescuer) non viene
   conteso da due soccorritori.                                         */
let casualties = [];
const healer = t => isMine(t)&&!!BUILDINGS[t.building].heal&&(t.workers||0)>0;
const atHospital = v => FC.mine.some(t=>healer(t)&&(t===v.from||t.neighbors.includes(v.from.id)));
function rescueTick(){
  casualties=units.filter(v=>hasNeeds(v)&&v.wounded&&!v.carriedBy&&!atHospital(v));
}
function findCasualty(u){
  if(u.carrying) return u.carrying;
  let best=null, bd=MEM.SEE-0.01;
  for(const v of casualties){
    if(v===u||v.carriedBy||(v.rescuer&&v.rescuer!==u)) continue;
    const d=u.from.center.dot(v.from.center);
    if(d>bd){ bd=d; best=v; }
  }
  return best;
}
function rescueRun(u,c){
  let v=u.carrying;
  if(!v){
    v=c.casualty;
    if(!v||!units.includes(v)){ u.act=null; return u.from; }
    v.rescuer=u; u.rescuing=v;
    if(v.from!==u.from) return v.from;
    u.carrying=v; v.carriedBy=u; bubble(u,'🚑');
  }
  if(u.from!==c.hospital) return c.hospital;
  releaseRescue(u);
  v.from=v.to=c.hospital; v.t=1; mindStats.rescues++;
  logEvent('🚑 '+u.name+' ha portato '+v.name+' in ospedale.');
  addStory(u,'Ha soccorso '+v.name); addStory(v,'In ospedale grazie a '+u.name);
  addBond(v,u,0.3); addBond(u,v,0.15);
  u.act=null;
  return u.from;
}
/* scioglie soccorritore e ferito, da entrambe le parti (anche alla morte) */
function releaseRescue(u){
  const v=u.carrying||u.rescuing;
  if(v){ if(v.carriedBy===u) v.carriedBy=null; if(v.rescuer===u) v.rescuer=null; }
  u.carrying=null; u.rescuing=null;
  const c=u.carriedBy;
  if(c){ if(c.carrying===u) c.carrying=null; if(c.rescuing===u) c.rescuing=null; if(c.act==='rescue') c.act=null; }
  u.carriedBy=null; u.rescuer=null;
}

/* ── carattere: rivalità, liti, paci, voci ───────────────────────────
   feud va da 0 a 1 come i legami; da FEUD_AT in su è una rivalità: un
   rivale vicino guasta l'umore e blocca l'amicizia. Le liti nascono tra
   tratti che non vanno d'accordo e tra chi è di cattivo umore; la pace
   si fa in taverna. Le voci girano tra conoscenti: i ricordi dei luoghi
   pericolosi e, tra amici, da che parte stare in una lite.            */
const FEUD_AT = 0.5, FEUD_FADE = 0.002;
const feudOf = (u,v) => (u.feud&&u.feud[uidOf(v)])||0;
function addFeud(u,v,k){
  const f=u.feud||(u.feud={}), id=uidOf(v);
  const x=Math.min(1,(f[id]||0)+k);
  if(x<=0.001) delete f[id]; else f[id]=x;
  if(!Object.keys(f).length) delete u.feud;
}
const rivalsOf = u => u.feud ? units.filter(v=>v!==u&&hasNeeds(v)&&feudOf(u,v)>=FEUD_AT) : [];
const rivalNear = u => !!u.feud&&nearbyUnits(u.from,false).some(v=>v!==u&&hasNeeds(v)&&feudOf(u,v)>=FEUD_AT);
const CLASH = [['lazy','sturdy'],['brave','timid'],['friendly','loner'],['cheerful','loner'],['glutton','glutton']];
function clash(a,b){
  let k=0;
  const A=a.traits||[], B=b.traits||[];
  for(const [x,y] of CLASH) if((A.includes(x)&&B.includes(y))||(A.includes(y)&&B.includes(x))) k++;
  return k;
}
let lastQuarrelLog = -99;
function quarrel(a,b){
  addFeud(a,b,0.6); addFeud(b,a,0.6);
  for(const [x,y] of [[a,b],[b,a]]) if(x.bonds&&x.bonds[uidOf(y)]){
    x.bonds[uidOf(y)]-=0.3; if(x.bonds[uidOf(y)]<=0) delete x.bonds[uidOf(y)];
  }
  addStory(a,'Lite con '+b.name); addStory(b,'Lite con '+a.name);
  bubble(a,'💢'); bubble(b,'💢');
  mindStats.quarrels++;
  if(worldAge-lastQuarrelLog>=40){ lastQuarrelLog=worldAge; logEvent('💢 '+a.name+' e '+b.name+' hanno litigato.'); }
}
function reconcile(a,b,k,where){
  const before=Math.max(feudOf(a,b),feudOf(b,a));
  addFeud(a,b,-k); addFeud(b,a,-k);
  if(before>=0.3&&Math.max(feudOf(a,b),feudOf(b,a))<0.3){
    addStory(a,'Pace con '+b.name); addStory(b,'Pace con '+a.name);
    addBond(a,b,0.15); addBond(b,a,0.15);
    bubble(a,'🤝'); bubble(b,'🤝');
    mindStats.peace++;
    logEvent('🤝 '+a.name+' e '+b.name+' hanno fatto pace'+where+'.');
  }
}
/* una voce passa da a a b */
function gossip(a,b,byUid){
  if(bondOf(a,b)<0.15&&a.act!=='relax') return;      // non si confida a sconosciuti
  // il ricordo più forte: "da quella parte hanno attaccato"
  if(a.mem){
    const m=a.mem.reduce((x,y)=>y.w>x.w?y:x);
    if(m.w>=0.3&&!(b.mem&&b.mem.some(x=>x.t===m.t&&x.k===m.k&&x.w>=m.w*0.5))){
      remember(b,tiles[m.t],m.k,m.w*0.5); mindStats.rumors++; bubble(a,'💬');
    }
  }
  // tra amici: si prende le parti dell'amico in una lite
  if(a.feud&&bondOf(b,a)>=FRIEND_AT) for(const id in a.feud){
    const v=byUid.get(+id);
    if(v&&v!==b&&a.feud[id]>=FEUD_AT&&feudOf(b,v)<FEUD_AT){ addFeud(b,v,0.12); mindStats.rumors++; }
  }
}
/* chiamata da socialTick con i gruppi della stessa casella */
function talkTick(groups){
  const byUid=new Map();
  for(const u of units) if(u.uid) byUid.set(u.uid,u);
  for(const g of groups.values()){
    if(g.length<2||g.length>12) continue;
    for(let i=0;i<g.length;i++) for(let j=i+1;j<g.length;j++){
      // in taverna: chi si svaga e chi ci lavora stanno nello stesso gruppo
      const a=g[i], b=g[j], tavern=a.act==='relax'||b.act==='relax';
      const feuding=feudOf(a,b)>0||feudOf(b,a)>0;
      if(feuding){
        // la pace si fa in taverna, o quando c'è un amico comune a mediare
        const friend=g.some(x=>x!==a&&x!==b&&bondOf(a,x)>=FRIEND_AT&&bondOf(b,x)>=FRIEND_AT);
        if(tavern) reconcile(a,b,0.15,' in taverna');
        else if(friend) reconcile(a,b,0.06,' grazie a un amico comune');
        // col buon umore, fianco a fianco al lavoro o sotto lo stesso tetto, la rabbia passa prima
        else if(needsOf(a).mood>0.6&&needsOf(b).mood>0.6)
          reconcile(a,b,0.03,a.act==='sleep'?' sotto lo stesso tetto':' lavorando insieme');
      } else {
        const sour=(needsOf(a).mood<0.4?1:0)+(needsOf(b).mood<0.4?1:0);
        const p=0.002+0.01*clash(a,b)+0.006*sour-(tavern?0.002:0);
        if(Math.random()<p){ quarrel(a,b); continue; }
      }
      if(Math.random()<0.1) gossip(a,b,byUid);
      if(Math.random()<0.1) gossip(b,a,byUid);
    }
  }
}

/* ── un tick della mente: ricordi e rivalità sbiadiscono, squadra, feriti ── */
function mindTick(){
  for(const u of units){
    if(u.mem){
      for(const m of u.mem) m.w-=MEM.FADE*(m.k==='death'?0.5:1);
      u.mem=u.mem.filter(m=>m.w>=MEM.MIN);
      if(!u.mem.length) delete u.mem;
    }
    if(u.feud) for(const id in u.feud){
      u.feud[id]-=FEUD_FADE;
      if(u.feud[id]<=0.001) delete u.feud[id];
    }
    if(u.feud&&!Object.keys(u.feud).length) delete u.feud;
  }
  squadTick();
  rescueTick();
}
function resetMind(){
  mindStats={plans:0, couriers:0, rescues:0, quarrels:0, peace:0, rumors:0};
  squad.target=squad.captain=null; squad.retreatT=squad.cool=squad.fighters=squad.foes=0; squad.loggedRaid=-1;
  casualties=[]; lastQuarrelLog=-99; bubbles=0;
}
