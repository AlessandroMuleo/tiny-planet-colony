const NAMES=['Kepler-9c','Vesta','Ilo','Brenna','Tarsis','Cinabro','Nyx','Orrò','Sillabe','Ember','Aldo-IV','Marisa'];
const CLANS=['Vurr','Kesh','Tallim','Oran','Zibbe','Nakar','Serth'];

let tiles=[], faceToTile=[], terrainMesh=null, terrainColor=null, buildMeshes=new Map(), beams=null;
let units=[], settlements=[], cargos=[], props=[];
let selected=null, marker=null;
let worldSeed=Date.now()%99999, worldIndex=1;
let res={food:22, mat:60, pow:12}, pop=3;
let sci=0, tech=0;
let season=0, seasonT=0;
let raidIn=70, raidNo=0, raidActive=false;
let army={size:0,target:null};
let auto=false, speedMul=1, launching=null;
let orbit=[], orbitGroup=null, seasonPaint=0, worldAge=0;
let buildSize=1, showCargo=true, ringPaint=0;
let padCargoMat=40, padCargoFood=20;
let activePower=null, activeFX=[], rangeMesh=null, dayCycle=true;
let quiet=false, eventLog=[], logOpen=false, gameOver=false, autoSaveT=0, lastSpeed=1;
let eventIn=110, boomT=0;       // eventi casuali: prossimo tra N tick; raccolto abbondante per N tick

/* ═══════════════ helper mondo ═══════════════ */
