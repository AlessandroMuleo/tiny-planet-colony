const hasMarket = () => FC.mine.some(t=>hasFlag(t,'trade')&&(t.workers||0)>0);
/* una carovana parte dal clan alleato, cammina fino a un tuo magazzino e scarica */
function caravanGoal(u){
  if(u.delivered) return u.settlement?u.settlement.core:u.from;
  const st=nearestStorage(u.from);
  if(st&&u.from===st){
    const bonus=hasMarket()?1.6:1;
    const mat=Math.round(u.load*bonus), food=Math.round(u.load*0.5*bonus);
    res.mat=Math.min(capacity(),res.mat+mat);
    res.food=Math.min(capacity(),res.food+food);
    u.delivered=true; dropCarry(u);
    toast('Carovana di '+(u.settlement?u.settlement.name:'un alleato')+': +'+mat+' materiali, +'+food+' cibo.');
    refreshHUD();
  }
  return st||u.from;
}
function sendCaravans(){
  for(const s of settlements){
    if(s.relation!=='alleato'&&s.relation!=='assoggettato') continue;
    s.tradeT=(s.tradeT||0)+1;
    const every=s.relation==='alleato'?35:50;
    if(s.tradeT<every) continue;
    s.tradeT=0;
    const home=tiles.find(t=>t.settlement===s&&t.building);
    if(!home||!FC.storage.length) continue;
    const u=spawnUnit('caravan','rival',home);
    u.settlement=s; u.load=s.relation==='alleato'?22:14; u.delivered=false; u.lifeT=0;
    takeCarry(u,0xd9a441);
  }
  // le carovane che hanno consegnato tornano a casa e spariscono
  for(let i=units.length-1;i>=0;i--){
    const u=units[i];
    if(u.kind!=='caravan') continue;
    u.lifeT=(u.lifeT||0)+1;
    if(u.lifeT>160||(u.delivered&&u.settlement&&u.from===u.settlement.core)) killUnit(u,i);
  }
}
/* scambio immediato al mercato: cibo contro materiali, o viceversa */
function tradeWith(s,dir){
  if(!hasMarket()){ toast('Serve un mercato con un addetto.'); return; }
  if(s.relation!=='alleato'&&s.relation!=='assoggettato'){ toast('Serve un accordo con questo clan.'); return; }
  if(dir==='buy'){
    if(res.food<40){ toast('Servono 40 cibo.'); return; }
    res.food-=40; res.mat=Math.min(capacity(),res.mat+32);
    toast('Scambiati 40 cibo per 32 materiali.');
  } else {
    if(res.mat<40){ toast('Servono 40 materiali.'); return; }
    res.mat-=40; res.food=Math.min(capacity(),res.food+32);
    toast('Scambiati 40 materiali per 32 cibo.');
  }
  refreshHUD();
}

/* ═══════════════ poteri del giocatore ═══════════════ */
