function checkCollapse(){
  if(myPeople().length>0||myThralls().length>0) return false;
  gameOver=true;
  $('over-body').textContent='Non resta nessuno a portare avanti il villaggio. Hai raggiunto il mondo n° '+
    worldIndex+' con '+tech+' ricerche completate su '+Object.keys(RESEARCH).length+'.';
  $('over').classList.add('on');
  $('over-restart').focus();
  return true;
}
function restartGame(){
  $('over').classList.remove('on');
  gameOver=false;
  worldIndex=1; worldSeed=Date.now()%99999;
  res=startingRes(); pop=3; sci=0; tech=0; eventIn=110; boomT=0;
  researched=new Set(); researching=null; stats=[]; veterans=[];
  generateWorld(worldSeed); applySeason(); refreshHUD();
  toast('Una nuova colonia atterra su '+NAMES[0]+'.');
}

/* ordinare una costruzione apre un cantiere: i materiali si pagano subito,
   i blocchi devono arrivare a piedi */
function construct(key){
  const B=BUILDINGS[key];
  if(!selected||!tileAllows(selected,key)||!canAffordSize(B)) return;
  const s=buildSize;
  pay(costOf(key),s);
  startSite(selected,key,'you',s);
  setInspector(selected); refreshHUD();
  toast('Cantiere '+s+'× aperto: servono '+(B.blocks*s)+' blocchi dal magazzino.');
}
/* mandare in orbita: parte subito, ma ci mette qualche secondo a salire */
/* buildOrbital e i miglioramenti orbitali sono in 25-space.js */

/* demolire: restituisce metà dei materiali spesi */
function demolish(tile){
  if(!tile||tile.owner!=='you') return;
  const kind=tile.site?tile.site.kind:tile.building;
  const B=BUILDINGS[kind];
  const back=Math.floor((B.cost.mat||0)*sizeOf(tile)*0.5);
  res.mat=Math.min(capacity(),res.mat+back);
  destroyBuilding(tile);
  toast(B.name+' demolita. Recuperati '+back+' materiali.');
}

/* la rampa non teletrasporta: il razzo parte davvero */
function launchFrom(tile){
  padCargoMat =Math.min(padCargoMat, cargoMax('mat'));
  padCargoFood=Math.min(padCargoFood,cargoMax('food'));
  res.mat-=padCargoMat; res.food-=padCargoFood;   // sottratti dalle scorte qui
  const crew=boardVeterans(tile);
  const m=rocketMesh(); orientTo(m,tile);
  planetGroup.add(m);
  launching={mesh:m, tile, t:0};
  toast('Decollo: '+crew+' veterani, '+padCargoMat+' materiali e '+padCargoFood+' cibo a bordo.');
  refreshHUD();
}
function nextWorld(){
  worldIndex++; worldSeed=(worldSeed*1103515245+12345)%2147483647;
  res.mat=padCargoMat; res.food=padCargoFood; res.pow=12; res.bar=0;   // sbarca solo il carico
  pop=Math.max(3,veterans.length);
  generateWorld(worldSeed); applySeason();
  toast('Atterrati su '+NAMES[(worldIndex-1)%NAMES.length]+'.');
  landVeterans(); refreshHUD();
}

/* comandi */
$('i-minus').addEventListener('click',()=>setWorkers(selected,-1));
$('i-plus') .addEventListener('click',()=>setWorkers(selected,1));
$('i-fill') .addEventListener('click',()=>fillWorkers(selected));
$('i-demolish').addEventListener('click',()=>demolish(selected));
$('i-disband').addEventListener('click',()=>{
  if(!selected||!selected.building||!BUILDINGS[selected.building].armory) return;
  const n=selected.workers||0;
  selected.workers=0; syncJobs(); setInspector(selected); refreshHUD();
  toast(n+(n===1?' soldato torna':' soldati tornano')+' a fare il colono.');
});
for(const b of $('i-kinds').children)
  b.addEventListener('click',()=>{
    if(!selected||!selected.building||!BUILDINGS[selected.building].armory) return;
    selected.unit=b.dataset.kind; syncJobs(); setInspector(selected); refreshHUD();
  });
$('a-minus').addEventListener('click',()=>{army.size=Math.max(0,army.size-1);applyDeploy();});
$('a-plus') .addEventListener('click',()=>{army.size=Math.min(myTroops().length,army.size+1);applyDeploy();});
function applyDeploy(){
  const troops=myTroops();
  troops.forEach((u,i)=>u.deployed=!!army.target&&i<army.size);
  refreshArmy();
}
for(const b of $('sizes').querySelectorAll('button'))
  b.addEventListener('click',()=>{
    buildSize=+b.dataset.size;
    for(const x of $('sizes').querySelectorAll('button')) x.classList.toggle('on',x===b);
    refreshTray();

  });
/* All'atterraggio ci sono solo la capanna e la scorta base: tutto ciò che
   supera quella capienza veniva tagliato in silenzio al primo tick. */
const ARRIVAL_CAP=BASE_STORE+BUILDINGS.hut.store;
const cargoMax=k=>Math.min(ARRIVAL_CAP,Math.floor(res[k]));
$('cm-minus').addEventListener('click',()=>{ padCargoMat=Math.max(0,padCargoMat-20); setInspector(selected); });
$('cm-plus') .addEventListener('click',()=>{ padCargoMat=Math.min(cargoMax('mat'),padCargoMat+20); setInspector(selected); });
$('cf-minus').addEventListener('click',()=>{ padCargoFood=Math.max(0,padCargoFood-20); setInspector(selected); });
$('cf-plus') .addEventListener('click',()=>{ padCargoFood=Math.min(cargoMax('food'),padCargoFood+20); setInspector(selected); });
for(const k in POWERS) $('p-'+k).addEventListener('click',()=>setPower(k));
$('b-day').addEventListener('click',()=>{
  dayCycle=!dayCycle;
  $('b-day').classList.toggle('on',dayCycle);
  toast(dayCycle?'Ciclo giorno/notte attivo.':'Luce fissa: pieno giorno.');
});
$('c-launch').addEventListener('click',()=>{
  if(!selected||launching||!isMine(selected)||!BUILDINGS[selected.building].launch) return;
  if(!(selected.workers>0)){ toast('Serve almeno un addetto alla rampa.'); return; }
  launchFrom(selected);
});
$('b-cargo').addEventListener('click',()=>{
  showCargo=!showCargo;
  $('b-cargo').classList.toggle('on',showCargo);
  if(!showCargo) clearAllCargoMeshes();
  toast(showCargo?'Carichi visibili.':'Carichi nascosti: il trasporto continua, non si disegna.');
});
$('b-auto').addEventListener('click',()=>{
  auto=!auto; $('b-auto').classList.toggle('on',auto);
  toast(auto?'Modalità automatica: i coloni si organizzano da soli.':'Modalità automatica disattivata.');
});
for(const b of $('speeds').children)
  b.addEventListener('click',()=>setSpeed(+b.dataset.mul));
$('b-save').addEventListener('click',()=>saveGame(false));
$('b-load').addEventListener('click',loadGame);
$('b-log').addEventListener('click',toggleLog);
$('b-research').addEventListener('click',toggleResearch);
$('b-share').addEventListener('click',()=>{
  const url=location.origin+location.pathname+'?seed='+worldSeed+(worldIndex>1?'&mondo='+worldIndex:'')+
    (difficulty!=='normale'?'&difficolta='+difficulty:'');
  const done=()=>toast('Link copiato: riapre questo pianeta (seme '+worldSeed+').');
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(done,()=>toast(url));
  else toast(url);
});
$('b-stats').addEventListener('click',toggleStats);
$('stats-mode').addEventListener('click',()=>{ statsTable=!statsTable; renderStats(); });
$('i-upgrade').addEventListener('click',()=>upgradeBuilding(selected));
$('i-repair').addEventListener('click',()=>repairBuilding(selected));
$('over-restart').addEventListener('click',restartGame);

/* scorciatoie: le azioni più frequenti senza dover inseguire i pulsanti */
function deselect(){
  followed=null;
  selected=null; setInspector(null); refreshTray();
  if(marker){ planetGroup.remove(marker); marker=null; }
}
addEventListener('keydown',e=>{
  if(gameOver||e.altKey) return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='s'){ e.preventDefault(); saveGame(false); return; }
  if(e.ctrlKey||e.metaKey) return;
  if(k===' '){
    e.preventDefault();
    if(document.activeElement&&document.activeElement.tagName==='BUTTON') document.activeElement.blur();
    togglePause();
  }
  else if(k==='1') setSpeed(1);
  else if(k==='2') setSpeed(2);
  else if(k==='3') setSpeed(4);
  else if(k==='a') $('b-auto').click();
  else if(k==='t') toggleResearch();
  else if(k==='s') toggleStats();
  else if(k==='f') setPower('bolt');
  else if(k==='r') setPower('rain');
  else if(k==='c') setPower('heal');
  else if(k==='u') upgradeBuilding(selected);
  else if(k==='l') toggleLog();
  else if(k==='escape'){ if(activePower) setPower(activePower); else deselect(); }
});

/* ═══════════════ camera e input ═══════════════ */
