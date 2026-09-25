/* ═══════════════ utility AI ═══════════════
   Schema "Infinite Axis Utility System" (Dave Mark, GDC 2013/2015).
   Ogni azione ha un peso e una lista di considerazioni. Una considerazione
   legge un dato del mondo, lo porta tra 0 e 1 (input) e lo fa passare per
   una curva di risposta: il risultato dice quanto quell'azione ha senso
   *per quel motivo*. Le considerazioni si moltiplicano: basta uno zero
   per escludere l'azione (un bambino non combatte, punto).
   Si sceglie l'azione col punteggio più alto.

   Il vantaggio rispetto a una lista di if: il comportamento si regola
   cambiando le curve, non il codice, e si può sempre spiegare perché un
   colono ha scelto una cosa invece di un'altra (vedi explain()).        */

const clamp01 = x => x<0?0 : x>1?1 : x;

/* ── curve di risposta: x in [0,1] → y in [0,1] ──────────────────── */
const CURVES = {
  linear:   (m=1, b=0)   => x => clamp01(m*x+b),
  // k>1: resta bassa e sale tardi · k<1: sale subito e poi si appiattisce
  power:    (k=2)        => x => clamp01(Math.pow(clamp01(x), k)),
  // a gradino morbido: mid è dove vale 0,5, steep quanto è ripida
  logistic: (mid=.5, steep=10) => x => clamp01(1/(1+Math.exp(-steep*(x-mid)))),
  // vale 1 da threshold in su, 0 sotto
  step:     (threshold=.5) => x => x>=threshold?1:0,
  // costante: una considerazione che conta solo come interruttore
  constant: (v=1)        => () => v
};

/* Una considerazione: {name, input(ctx) → [0,1], curve}.
   Il nome serve solo a spiegare le decisioni. */
const consider = (name, input, curve) => ({name, input, curve: curve||(x=>clamp01(x))});

/* Punteggio di un'azione: peso × prodotto delle considerazioni, con la
   "compensazione" di Dave Mark. Senza, un'azione con 6 considerazioni
   a 0,9 (0,53) perderebbe contro una con 1 considerazione a 0,6, solo
   perché ha più fattori: ogni fattore viene rialzato in proporzione a
   quanti sono.                                                          */
function scoreAction(action, ctx, detail){
  const cs=action.considerations, n=cs.length;
  const mod=n>0 ? 1-1/n : 0;
  let score=action.weight===undefined?1:action.weight;
  if(typeof score==='function') score=score(ctx);
  for(const c of cs){
    let v=c.curve(clamp01(c.input(ctx)));
    if(detail) detail.push({name:c.name, value:v});
    if(v<=0){ score=0; break; }
    v=v+(1-v)*mod*v;          // compensazione
    score*=v;
  }
  return score;
}

/* Sceglie l'azione migliore. current è l'azione in corso: riceve un
   piccolo bonus (inerzia), così un colono non cambia idea a ogni
   ragionamento per differenze di pochi centesimi.                      */
const INERTIA = 1.15;
/* Un impegno (ctx.commit = {action, floor}): l'azione promessa vale almeno
   floor, purché le sue considerazioni non la escludano. È il modo in cui
   un piano a più passi entra in una scelta che guarda solo al presente. */
const committed = (ctx,key,s) => ctx.commit&&ctx.commit.action===key&&s>0 ? Math.max(s,ctx.commit.floor) : s;
function chooseAction(actions, ctx, current){
  let best=null, bestScore=0;
  for(const key in actions){
    let s=committed(ctx,key,scoreAction(actions[key], ctx));
    if(key===current) s*=INERTIA;
    if(s>bestScore){ bestScore=s; best=key; }
  }
  return {action:best, score:bestScore};
}

/* Tutti i punteggi, in ordine, con il contributo di ogni considerazione:
   è quello che l'ispettore mostra alla voce "perché". */
function explain(actions, ctx, current){
  const out=[];
  for(const key in actions){
    const detail=[];
    const raw=scoreAction(actions[key], ctx, detail);
    let s=committed(ctx,key,raw);
    if(s>raw) detail.push({name:'nel piano', value:1});
    if(key===current) s*=INERTIA;
    out.push({action:key, label:actions[key].label||key, score:s, detail});
  }
  return out.sort((a,b)=>b.score-a.score);
}

