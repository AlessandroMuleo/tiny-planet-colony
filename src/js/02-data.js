/* ── biomi ────────────────────────────────────────────────────── */
const BIOMES = {
  ocean:  {label:'Oceano',   top:0x27618f, side:0x1b4467, build:false, water:true, lift:-0.34},
  sand:   {label:'Sabbia',   top:0xd6c187, side:0xa8935f, build:true,  lift:0.10},
  meadow: {label:'Prateria', top:0x74b45c, side:0x4a7a3c, build:true,  season:true, lift:0.30},
  soil:   {label:'Terra',    top:0x9b7550, side:0x6d5038, build:true,  lift:0.55},
  rock:   {label:'Roccia',   top:0x7f8792, side:0x565d68, build:true,  lift:0.95},
  volcano:{label:'Vulcano',  top:0x3a2622, side:0x241512, build:false, lift:1.25},
  lava:   {label:'Lava',     top:0xff5a1f, side:0x8a2a0c, build:false, lift:1.10}
};

/* ── edifici ──────────────────────────────────────────────────────
   cat    = catalogo in cui compare
   blocks = blocchetti che i coloni devono trasportare al cantiere
   ships  = quanti carichi di prodotto genera (animazione + resa)
   Il comportamento sta nei campi, non in controlli sul nome sparsi nel
   codice: un edificio nuovo si aggiunge qui e basta.
   guard    = le truppe non schierate ci stanno di guardia
   quiet    = il completamento non si annuncia (strade, mura)
   fixed    = non si amplia
   trade    = con addetti: tributi +60% e scambio con i clan
   heal     = cura i feriti nel raggio (range)
   dps      = spara da solo nel raggio: tuo contro i nemici, rivale contro chi è in guerra
   spawns   = genera un'unità ogni "every" secondi, fino a "cap" per struttura
   core     = cuore di un clan: finché regge, il clan non si assoggetta
   launch   = da qui si parte per un nuovo mondo (e partono le navette lunari)
   granary  = cibo che conserva senza che marcisca (per taglia)
   tavern   = svago: chi ci passa torna più contento
   school   = i bambini ci studiano un mestiere
   embassy  = doni più efficaci, mediazione a metà prezzo
   watch    = avvista le navette dei predoni prima che atterrino
   memorial = il lutto pesa la metà e passa prima
   well     = acqua: sulla sabbia, senza un pozzo vicino, si rende meno  */
const BUILDINGS = {
  hut:    {cat:'base', name:'Capanna',  cost:{mat:10},        blocks:3,  effect:'4 posti letto',        jobs:0, houses:4, hp:25, store:40, guard:true},
  block:  {cat:'base', name:'Alloggi',  cost:{mat:34},        blocks:7,  effect:'12 posti letto',       jobs:0, houses:12, hp:40, store:30, guard:true},
  farm:   {cat:'base', name:'Fattoria', cost:{mat:14},        blocks:4,  effect:'1,3 cibo a testa',     jobs:2, per:{food:1.3}, ships:'food', hp:25},
  mine:   {cat:'base', name:'Miniera',  cost:{mat:18},        blocks:5,  effect:'0,8 materiali a testa',jobs:3, per:{mat:0.8}, ships:'mat', needs:['rock','soil'], hp:28},
  plant:  {cat:'base', name:'Centrale', cost:{mat:24},        blocks:6,  effect:'2 energia a testa',    jobs:2, per:{pow:2}, hp:28},
  depot:  {cat:'base', name:'Deposito', cost:{mat:22},        blocks:5,  effect:'+150 di capienza',     jobs:0, store:150, hp:30},
  road:   {cat:'base', name:'Strada',   cost:{mat:4},         blocks:1,  effect:'chi ci passa va il 60% più veloce', jobs:0, road:true, quiet:true, fixed:true, hp:15},
  workshop:{cat:'base',name:'Officina', cost:{mat:40},        blocks:7,  effect:'converte 1,6 cibo in 1,1 materiali a testa', jobs:3, per:{mat:1.1}, eats:{food:1.6}, ships:'mat', hp:32},
  green:  {cat:'base', name:'Serra',    cost:{mat:48,pow:20}, blocks:8,  effect:'1,5 cibo a testa, immune alle stagioni', jobs:2, per:{food:1.5}, ships:'food', noSeason:true, drain:0.6, hp:28},
  market: {cat:'base', name:'Mercato',  cost:{mat:38},        blocks:6,  effect:'+60% ai tributi e abilita lo scambio', jobs:1, trade:true, hp:30, store:60},
  foundry:{cat:'base', name:'Fonderia', cost:{mat:45},        blocks:7,  effect:'converte 1,2 materiali in 0,5 lingotti a testa', jobs:2, per:{bar:0.5}, eats:{mat:1.2}, hp:35},
  granary:{cat:'base', name:'Granaio',  cost:{mat:30},        blocks:5,  effect:'conserva 150 cibo: fuori dai granai il cibo marcisce', jobs:0, granary:150, hp:30},
  well:   {cat:'base', name:'Pozzo',    cost:{mat:12},        blocks:2,  effect:'acqua per la sabbia: senza, lì si rende il 40% in meno', jobs:0, well:true, range:4.5, hp:20},
  clinic: {cat:'base', name:'Ospedale',  cost:{mat:35},       blocks:6,  effect:'cura i feriti nel raggio', jobs:2, heal:1.6, range:5.5, hp:30},

  dock:   {cat:'acqua',name:'Molo',     cost:{mat:12},        blocks:3,  effect:'rende il mare percorribile', jobs:0, water:true, hp:20},
  fishery:{cat:'acqua',name:'Peschiera',cost:{mat:20},        blocks:4,  effect:'1,6 cibo a testa, sul mare', jobs:2, per:{food:1.6}, ships:'food', water:true, hp:22},

  wall:   {cat:'difesa',name:'Mura',    cost:{mat:8},         blocks:2,  effect:'barriera: i nemici non la attraversano', jobs:0, wall:true, quiet:true, hp:120},
  armory: {cat:'difesa',name:'Armeria', cost:{mat:30},        blocks:7,  effect:'addestra lancieri o arcieri', jobs:3, per:{mat:-0.3}, armory:true, guard:true, hp:45},
  turret: {cat:'difesa',name:'Torretta',cost:{mat:30,pow:15,bar:8}, blocks:8,  effect:'spara da sola sui nemici', jobs:0, drain:0.4, range:5.0, dps:3.5, hp:35},
  shrine: {cat:'difesa',name:'Santuario',cost:{mat:45,pow:20},blocks:9,  effect:'un guardiano ogni 25s', jobs:0, drain:0.5, spawns:'guardian', every:25, cap:4, guard:true, hp:40,
          spawnMsg:'Il santuario ha generato un guardiano.'},
  fort:   {cat:'difesa',name:'Roccaforte',cost:{mat:80,pow:25},blocks:12,effect:'rifugio per bambini e feriti durante le incursioni', jobs:2, drain:0.3, shelter:true, range:4.0, guard:true, hp:150},

  tavern: {cat:'vita',name:'Taverna',   cost:{mat:36},        blocks:6,  effect:'svago: chi ci passa torna più contento', jobs:1, tavern:true, hp:28},
  school: {cat:'vita',name:'Scuola',    cost:{mat:40},        blocks:7,  effect:'i bambini studiano un mestiere e crescono già esperti', jobs:1, school:true, hp:30},
  memorial:{cat:'vita',name:'Memoriale',cost:{mat:30},        blocks:5,  effect:'il lutto pesa la metà e passa prima', jobs:0, memorial:true, fixed:true, hp:40},
  embassy:{cat:'vita',name:'Ambasciata',cost:{mat:50,bar:10}, blocks:8,  effect:'doni +50%, mediazione a metà prezzo, i clan si avvicinano da soli', jobs:1, embassy:true, hp:35},
  watch:  {cat:'difesa',name:'Torre di segnalazione',cost:{mat:25}, blocks:5, effect:'avvista le navette 25 s prima e dà l\'allarme', jobs:1, watch:true, hp:30},

  lab:    {cat:'scienza',name:'Centro ricerca',cost:{mat:55,pow:30}, blocks:9, effect:'0,9 ricerca a testa', jobs:2, per:{sci:0.9}, hp:35},

  pad:    {cat:'speciale',name:'Rampa di lancio', cost:{mat:70,pow:40,bar:25}, blocks:14, effect:'parti per un nuovo mondo', jobs:4, launch:true, hp:50},

  keep:   {cat:null, name:'Roccaforte rivale', cost:{}, blocks:0, effect:'cuore di un popolo rivale', jobs:0, hp:70, core:true, rivalOnly:true},
  camp:   {cat:null, name:'Accampamento',      cost:{}, blocks:0, effect:'insediamento rivale',      jobs:0, hp:32, rivalOnly:true},
  rfarm:  {cat:null, name:'Campi rivali',      cost:{}, blocks:0, effect:'nutre l\'espansione del clan', jobs:0, hp:26, rivalOnly:true},
  rtower: {cat:null, name:'Torre rivale',      cost:{}, blocks:0, effect:'difende il territorio del clan', jobs:0, hp:38, range:4.4, dps:2.8, rivalOnly:true}
};

/* ── strutture orbitali: non stanno su una casella, stanno in cielo ──
   Si costruiscono dal catalogo Orbita senza selezionare terreno.
   Restano su questo pianeta: se parti, le lasci indietro.               */
const ORBITALS = {
  station:{name:'Stazione orbitale', cost:{mat:120,pow:60}, effect:'+220 di capienza · richiesta dalle altre',
           store:220, hub:true},
  mirror: {name:'Specchio solare',   cost:{mat:90,pow:80},  effect:'annulla la carestia invernale'},
  cannon: {name:'Cannone orbitale',  cost:{mat:140,pow:110},effect:'colpisce i predoni da orbita · 1 energia',
           drain:1.0, dps:4.2},
  eye:    {name:'Occhio profondo',   cost:{mat:100,pow:70}, effect:'+45s tra un\'incursione e l\'altra',
           drain:0.4, delay:45},
  moonbase:{name:'Base lunare',      cost:{mat:160,pow:90}, effect:'spedizioni sulla luna: +40 materiali ogni 40s',
           drain:0.8, every:40, haul:40}
};
const ICONS = {
  hut:'🏠', block:'🏘', farm:'🌾', mine:'⛏', plant:'⚡', depot:'📦', clinic:'✚',
  road:'🛣', workshop:'🔧', green:'🌱', market:'⚖',
  dock:'⚓', fishery:'🐟',
  wall:'🧱', armory:'⚔', turret:'🎯', shrine:'🔯', fort:'🏰',
  lab:'🔬', pad:'🚀', foundry:'🔥', granary:'🌽', well:'💧', tavern:'🍺', school:'📚',
  memorial:'🕯', embassy:'🤝', watch:'🔭',
  station:'🛰', mirror:'🪞', cannon:'💥', eye:'👁', moonbase:'🌙'
};

const CATALOGS = [
  {id:'base',    label:'Colonia'},
  {id:'acqua',   label:'Mare'},
  {id:'difesa',  label:'Difesa'},
  {id:'vita',    label:'Vita'},
  {id:'scienza', label:'Ricerca'},
  {id:'speciale',label:'Spazio'},
  {id:'orbita',  label:'Orbita'}
];

/* ── costi: materiali, energia e lingotti ─────────────────────────
   Tutto ciò che si paga passa di qui, così una risorsa nuova non va
   aggiunta a mano in dieci punti del codice.                          */
const COST_KEYS = ['mat','pow','bar'];
const COST_LABEL = {mat:'mat', pow:'en', bar:'lingotti'};
const canPay = (cost,n=1) => COST_KEYS.every(k=>!cost[k]||res[k]>=cost[k]*n);
function pay(cost,n=1){ for(const k of COST_KEYS) if(cost[k]) res[k]-=cost[k]*n; }
const costText = (cost,n=1) => COST_KEYS.filter(k=>cost[k]).map(k=>cost[k]*n+' '+COST_LABEL[k]).join(' · ');

/* ── ricerca: ora è un albero a rami (25-progress.js); resa e armi
   sommano gli effetti dei nodi completati ─────────────────────────── */
const techProd = () => 1 + techSum('prod');
const techWar  = () => 1 + techSum('war');
/* il costo di un edificio, con gli sconti della ricerca (la rampa) */
function costOf(key){
  const c={...BUILDINGS[key].cost};
  if(key==='pad'&&typeof techSum==='function') for(const k in c) c[k]=Math.round(c[k]*(1-techSum('padCost')));
  return c;
}

/* ── unità ────────────────────────────────────────────────────── */
const UNITS = {
  worker:  {label:'colono',    hp:10, dmg:0.6, range:0.9, speed:.40, color:0xffd9a8, civil:true},
  idle:    {label:'inattivo',  hp:10, dmg:0.6, range:0.9, speed:.40, color:0x76839c, civil:true},
  spear:   {label:'lanciere',  hp:13, dmg:2.4, range:1.1, speed:.50, color:0xdfe9ff},
  bow:     {label:'arciere',   hp:8,  dmg:1.9, range:2.9, speed:.45, color:0x9fe3bd},
  guardian:{label:'guardiano', hp:26, dmg:3.2, range:1.2, speed:.32, color:0xffc46b},
  raider:  {label:'predone',   hp:12, dmg:2.6, range:1.1, speed:.34, color:0x9b3fd4},
  soldier: {label:'soldato',   hp:11, dmg:2.2, range:1.1, speed:.42, color:0xe0616b},
  thrall:  {label:'assoggettato', hp:10, dmg:0.4, range:0.9, speed:.42, color:0xb99a86, civil:true},
  caravan: {label:'carovana',  hp:14, dmg:0,   range:0,   speed:.34, color:0xe8c88a},
  envoy:   {label:'emissario', hp:9,  dmg:0,   range:0,   speed:.38, color:0xffe08a}
};
const MILITARY = ['spear','bow','guardian'];
/* chi conta come popolazione: i soldati restano coloni, solo con un altro mestiere */
const PEOPLE = ['worker','idle','spear','bow'];
/* gli assoggettati lavorano ma non sono coloni: non occupano letti,
   non hanno figli, non invecchiano e non impugnano armi */
const LABOR  = ['worker','idle','spear','bow','thrall'];
const THRALL_WORK = 0.8, THRALL_EAT = 0.30;
const MILITIA_RANGE = 3.5;   // un adulto sano va a difendere entro questa distanza
const FLEE_RANGE   = 4.2;   // bambini, feriti e assoggettati scappano entro questa

/* ── poteri del giocatore: costano energia, colpiscono dove clicchi ── */
const POWERS = {
  bolt: {label:'Fulmine', cost:20, dmg:35,  icon:'⚡'},
  rain: {label:'Pioggia', cost:15, food:30, icon:'🌧'},
  heal: {label:'Cura',    cost:15, range:5.5, icon:'✨'}
};

/* ═══════════════ scena ═══════════════ */
