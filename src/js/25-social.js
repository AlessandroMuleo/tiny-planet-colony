/* ═══════════════ amicizie e traguardi ═══════════════ */

/* ── amicizie ────────────────────────────────────────────────────────
   Chi lavora sullo stesso edificio o dorme sotto lo stesso tetto si
   affeziona. Un legame va da 0 a 1; da FRIEND_AT in su è un'amicizia.
   Gli amici vicini alzano l'umore; perderne uno lo abbassa per un po',
   più del lutto generale. I legami non curati si affievoliscono.       */
const FRIEND_AT = 0.5, BOND_GAIN = 0.04, BOND_DECAY = 0.001, MAX_BONDS = 6;
let nextUid = 1;
const uidOf = u => u.uid || (u.uid = nextUid++);
const bondOf = (u,v) => (u.bonds&&u.bonds[uidOf(v)])||0;
function addBond(u,v,k){
  u.bonds=u.bonds||{};
  const id=uidOf(v); u.bonds[id]=Math.min(1,(u.bonds[id]||0)+k);
}
/* ogni 5 tick: gruppi di coloni sulla stessa casella di lavoro o di sonno */
function socialTick(){
  if(worldAge%5) return;
  const groups=new Map();
  for(const u of units){
    if(!hasNeeds(u)||u.stage==='child') continue;
    // i legami che non si coltivano si affievoliscono
    if(u.bonds) for(const id in u.bonds){ u.bonds[id]-=BOND_DECAY*5; if(u.bonds[id]<=0) delete u.bonds[id]; }
    // colleghi dello stesso edificio (anche mentre portano il raccolto),
    // compagni di stanza, e chi è in taverna nello stesso momento
    const place = u.act==='work'&&u.job ? u.job : u.act==='sleep'&&u.bed&&u.from===u.bed ? u.bed :
                  u.act==='relax' ? u.from : null;
    if(!place) continue;
    if(!groups.has(place)) groups.set(place,[]);
    groups.get(place).push(u);
  }
  for(const g of groups.values()){
    if(g.length<2||g.length>12) continue;       // in una folla non ci si conosce
    for(const a of g) for(const b of g) if(a!==b) addBond(a,b,BOND_GAIN*traitMul(a,'social'));
  }
  // si tengono solo i legami più forti
  for(const u of units) if(u.bonds){
    const ids=Object.keys(u.bonds);
    if(ids.length>MAX_BONDS) ids.sort((a,b)=>u.bonds[a]-u.bonds[b]).slice(0,ids.length-MAX_BONDS).forEach(id=>delete u.bonds[id]);
  }
}
const friendsOf = u => units.filter(v=>v!==u&&hasNeeds(v)&&bondOf(u,v)>=FRIEND_AT);
const friendNear = u => units.some(v=>v!==u&&hasNeeds(v)&&bondOf(u,v)>=FRIEND_AT&&
  (v.from===u.from||u.from.neighbors.includes(v.from.id)));
/* chiamata da killUnit: gli amici di chi se ne va ne soffrono */
function mournFriend(u,died){
  if(!u.uid) return;
  let sad=0;
  for(const v of units){
    if(v===u||!hasNeeds(v)||bondOf(v,u)<FRIEND_AT) continue;
    v.sorrowT=died?120:60; delete v.bonds[u.uid]; sad++;
  }
  if(sad&&died&&u.name) logEvent('🕯 '+sad+(sad===1?' amico piange':' amici piangono')+' '+u.name+'.');
}

/* ── traguardi ───────────────────────────────────────────────────────
   Restano nel browser anche tra una partita e l'altra (localStorage a
   parte dal salvataggio). Si controllano ogni 10 tick.                 */
const ACH_KEY = 'tiny-planet-colony-achievements';
const ACHIEVEMENTS = {
  pop10:    {label:'Villaggio',         desc:'10 coloni',                    test:()=>myPeople().length>=10},
  pop50:    {label:'Borgo',             desc:'50 coloni',                    test:()=>myPeople().length>=50},
  pop150:   {label:'Città',             desc:'150 coloni',                   test:()=>myPeople().length>=150},
  research1:{label:'Prima scoperta',    desc:'completa un nodo di ricerca',  test:()=>researched.size>=1},
  branch:   {label:'Specialista',       desc:'completa un ramo della ricerca',
             test:()=>BRANCHES.some(b=>Object.keys(RESEARCH).filter(k=>RESEARCH[k].branch===b).every(k=>researched.has(k)))},
  raids5:   {label:'Veterani di guerra',desc:'sopravvivi a 5 incursioni',    test:()=>raidNo>=5&&!raidActive},
  ally:     {label:'Amici lontani',     desc:'stringi un\'alleanza',          test:()=>settlements.some(s=>s.relation==='alleato')},
  peace:    {label:'Pacificatore',      desc:'due clan in pace grazie a te', test:()=>achFlags.mediated},
  subject:  {label:'Signore',           desc:'assoggetta un clan',           test:()=>settlements.some(s=>s.relation==='assoggettato')},
  wed:      {label:'Fiori d\'arancio',  desc:'un matrimonio con un clan',    test:()=>achFlags.married},
  friends:  {label:'Legami',            desc:'un colono con tre amici',      test:()=>units.some(u=>hasNeeds(u)&&friendsOf(u).length>=3)},
  master:   {label:'Maestro',           desc:'un colono con +40% in un mestiere',
             test:()=>units.some(u=>u.skills&&Object.keys(u.skills).some(k=>skillMul(u,k)>=1.4))},
  ingots:   {label:'Età del ferro',     desc:'100 lingotti in magazzino',    test:()=>(res.bar||0)>=100},
  world2:   {label:'Oltre il cielo',    desc:'raggiungi il secondo mondo',   test:()=>worldIndex>=2},
  world5:   {label:'Nomadi delle stelle',desc:'raggiungi il quinto mondo',   test:()=>worldIndex>=5},
  orbit5:   {label:'Costellazione',     desc:'cinque strutture in orbita',  test:()=>orbit.filter(o=>o.built).length>=5},
  shielded: {label:'Sotto lo scudo',    desc:'lo scudo abbatte una navetta', test:()=>achFlags.shielded},
  asteroid: {label:'Minatori stellari', desc:'una capsula dagli asteroidi',  test:()=>achFlags.asteroid},
  maxorbit: {label:'Ingegneria orbitale',desc:'una struttura al livello 3',  test:()=>orbit.some(o=>(o.level||1)>=3)},
  storm:    {label:'Tempesta perfetta', desc:'respingi un\'incursione durante un temporale',
             test:()=>achFlags.stormRaid}
};
let achieved=new Set(), achFlags={};
function loadAchievements(){
  try{ achieved=new Set(JSON.parse(localStorage.getItem(ACH_KEY)||'[]').filter(id=>ACHIEVEMENTS[id])); }
  catch(e){ achieved=new Set(); }
}
function achievementTick(){
  if(worldAge%10) return;
  for(const id in ACHIEVEMENTS){
    if(achieved.has(id)||!ACHIEVEMENTS[id].test()) continue;
    achieved.add(id);
    logEvent('🏆 Traguardo: '+ACHIEVEMENTS[id].label+' — '+ACHIEVEMENTS[id].desc+'.');
    try{ localStorage.setItem(ACH_KEY,JSON.stringify([...achieved])); }catch(e){}
  }
}
function achievementsHTML(){
  return '<div class="ach"><h4>Traguardi '+achieved.size+'/'+Object.keys(ACHIEVEMENTS).length+'</h4><div class="ach-grid">'+
    Object.keys(ACHIEVEMENTS).map(id=>{
      const A=ACHIEVEMENTS[id], on=achieved.has(id);
      return '<div class="ach-i'+(on?' on':'')+'" title="'+A.desc+'"><b>'+(on?'🏆 ':'')+A.label+'</b><span>'+A.desc+'</span></div>';
    }).join('')+'</div></div>';
}
