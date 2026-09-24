try{
  loadAchievements();
  res=startingRes();
  generateWorld(worldSeed);
  applySeason();
  updateCamera();
  refreshHUD();
  if(URLP.has('auto')) $('b-auto').click();
  const prev=readSave();
  if(prev&&prev.v===1) toast('C\'è una partita salvata (mondo n° '+prev.worldIndex+'): premi «carica» per riprenderla.');
}catch(e){ fail(e.message+'\n'+(e.stack||'').split('\n')[1]); }

let last=performance.now(), acc=0, frames=0, fpsAcc=0, fps=0;
(function loop(now){
  requestAnimationFrame(loop);
  const raw=Math.min(0.05,(now-last)/1000); last=now;
  const dt=raw*speedMul;
  try{
    if(autoSpin){ theta+=dt*0.04; updateCamera(); }
    stepDay(dt);
    stepUnits(dt);
    stepProps(dt);
    stepOrbit(dt, now/1000);
    stepFX(dt);
    stepMoon(dt, now/1000);
    ringPaint+=raw;
    if(ringPaint>=0.16){ ringPaint=0; updateRings(); }
    seasonPaint+=raw;
    if(seasonPaint>=0.25){ seasonPaint=0; applySeason(); }   // sfumatura continua
    resolveCombat(dt);
    structureTick(dt);
    acc+=dt;
    // prima: acc=0 buttava via il resto, a 4× si perdeva fino al 20% dei tick
    while(acc>=1&&!gameOver){ acc-=1; economyTick(); }
    if(autoSaveT>=30){ autoSaveT=0; saveGame(true); }
    renderer.render(scene,camera);
  }catch(e){ fail(e.message+'\n'+(e.stack||'').split('\n')[1]); return; }

  frames++; fpsAcc+=raw;
  if(fpsAcc>=0.5){
    fps=Math.round(frames/fpsAcc); frames=0; fpsAcc=0;
    $('diag').textContent=fps+' fps · '+renderer.info.render.triangles.toLocaleString('it')+
      ' triangoli · '+tiles.length+' caselle · '+units.length+' unità · '+speedMul+'×';
    if(renderer.info.render.triangles===0)
      fail('WebGL non disegna nulla: probabile accelerazione hardware disattivata.');
  }
})(last);
