# Come decidono i coloni

I coloni non seguono una lista fissa di priorità. A ogni ragionamento, circa
tre volte al secondo, danno un punteggio da 0 a 1 a ogni azione possibile e
fanno quella che vale di più. È lo schema *Infinite Axis Utility System* di
Dave Mark (GDC 2013 e 2015).

- Il motore generico è in `src/js/14-utility.js`: curve, considerazioni,
  punteggio, scelta, spiegazione.
- Le azioni dei coloni, i bisogni e le prenotazioni sono in
  `src/js/15-colonists.js`.

## I pezzi

**Considerazione.** Legge un dato del mondo e lo porta tra 0 e 1 (l'*input*),
poi lo fa passare per una *curva di risposta*. Il risultato dice quanto
l'azione ha senso per quel motivo. Esempio: «fame» legge `1 − sazietà`.

**Curva di risposta.** Trasforma l'input nel punteggio. Quelle disponibili:

| Curva | Forma | Uso tipico |
|---|---|---|
| `linear(m, b)` | retta | salute persa → voglia di curarsi |
| `power(k)` | k > 1 sale tardi, k < 1 sale subito | vicinanza del nemico |
| `logistic(mid, steep)` | gradino morbido, vale 0,5 in `mid` | fame, stanchezza |
| `step(t)` | 0 sotto t, 1 da t in su | interruttori: «ha un lavoro» |

**Azione.** Un peso e una lista di considerazioni. Il punteggio è il peso per
il prodotto delle considerazioni. Basta uno zero per escludere l'azione: un
bambino non combatte.

**Compensazione.** Moltiplicando molti numeri minori di 1 il prodotto crolla.
Un'azione con sei considerazioni a 0,9 (0,53) perderebbe contro una con una
sola considerazione a 0,6, solo perché ha più fattori. Ogni fattore viene
quindi rialzato in proporzione a quanti sono:
`v + (1 − v) · (1 − 1/n) · v`.

**Inerzia.** L'azione in corso vale il 15% in più. Senza, un colono
cambierebbe idea a ogni ragionamento per differenze di pochi centesimi.

## Le azioni

| Azione | Peso | Considerazioni |
|---|---|---|
| scappare | 1,2 | nemico vicino · vulnerabile (bambino, ferito, assoggettato, o salute bassa) |
| difendere | 1,0 | sa combattere · nemico vicino · in salute |
| mangiare | 1,0 | fame (logistica, metà a 0,6) · c'è cibo · un magazzino |
| al riparo | 0,95 | incursione · indifeso · c'è un rifugio |
| dormire | 0,9 | stanchezza (logistica) · è notte (di giorno vale 0,55) · al sicuro |
| curarsi | 0,85 | ferito · salute persa |
| lavorare | 0,6 | ha un lavoro |
| costruire | 0,55 | può lavorare senza incarico · c'è un cantiere con blocchi liberi |
| tornare a casa | 0,1 | nessuna: è il ripiego |

## Un esempio con i numeri

Un contadino sta lavorando: il suo punteggio è `0,6 × 1,15 = 0,69`, con
l'inerzia. Quando smette per andare a mangiare?

*Mangiare* ha tre considerazioni, quindi la compensazione è `1 − 1/3 = 0,667`.
C'è cibo e c'è un magazzino, quindi quelle due valgono 1. Resta la fame:

| Sazietà | Fame | Curva logistica | Dopo la compensazione | Punteggio |
|---|---|---|---|---|
| 0,45 | 0,55 | 0,38 | 0,53 | 0,53 → continua a lavorare |
| 0,39 | 0,61 | 0,52 | 0,69 | 0,69 → pareggio |
| 0,35 | 0,65 | 0,62 | 0,78 | 0,78 → va a mangiare |

Per farlo mangiare prima basta spostare il centro della curva (`mid`) da 0,6
a 0,5. Il codice resta lo stesso.

Per vedere tutto questo in gioco, seleziona una casella con dei coloni:
l'ispettore mostra i loro bisogni e le tre azioni col punteggio più alto.
Accanto a ciascuna c'è la considerazione che la frena di più.

## Bisogni

Tre valori tra 0 e 1 per ogni civile (coloni e assoggettati). I soldati
mangiano dalla scorta comune e non dormono, come prima.

- **Sazietà.** Scende in 60 tick. Si mangia al magazzino, scalando dalla
  scorta quanto serve per tornare sazi. A stomaco vuoto, un colono ha il 4%
  di probabilità a tick di andarsene.
- **Riposo.** Scende in 140 tick di veglia. Un sonno completo dura 25 tick in
  un letto e 40 per terra.
- **Umore.** Si avvicina a un obiettivo fatto di voci: di base 0,6; fame,
  stanchezza, ferite, sovraffollamento e lutto lo abbassano; un letto e
  l'annata abbondante lo alzano. A 0,5 la resa al lavoro è quella normale:
  va dal −40% a umore 0 al +40% a umore 1. Sotto 0,2 il colono ha l'1% di
  probabilità a tick di andarsene.

Chi mangia, dorme o scappa non produce: la resa di un edificio conta solo
chi sta davvero lavorando.

## Tratti

Ogni colono nasce con un nome e da zero a due tratti. I tratti non hanno
codice proprio: moltiplicano il peso di alcune azioni o cambiano un bisogno.
Per questo costano poco una volta che la utility AI esiste.

| Tratto | Effetto |
|---|---|
| pigro | lavorare e costruire ×0,85, dormire ×1,15 |
| coraggioso | difendere ×1,3, scappare ×0,7 |
| pauroso | scappare ×1,35, difendere ×0,75 (esclude coraggioso) |
| ingegnoso | impara il 50% più in fretta |
| goloso | la fame conta ×1,2: va a mangiare prima |
| robusto | regge il 30% in più senza dormire |
| allegro | +0,1 all'obiettivo dell'umore |

Un tratto nuovo è una voce in `PERSON_TRAITS`.

## Abilità

Si impara lavorando: un punto di esperienza per ogni tick passato al lavoro,
otto per ogni blocco consegnato a un cantiere. Il bonus è
`0,6 · xp / (xp + 200)`: +30% a 200 punti, e non supera mai il +60%. I primi
tick valgono più degli ultimi.

| Mestiere | Da dove viene | Cosa migliora |
|---|---|---|
| agricoltura | fattorie, serre, peschiere | la resa |
| estrazione | miniere, officine | la resa |
| energia | centrali | la resa |
| ricerca | centri ricerca | la resa |
| costruzione | blocchi consegnati | la velocità di chi fa la spola |

Perché le abilità contino, i coloni non devono saltare da un lavoro all'altro.
Prima ogni nascita o cantiere nuovo ridistribuiva tutti i posti da capo: in
600 tick un colono cambiava lavoro in media più di una volta. Ora chi ha un
posto lo tiene, e i posti liberi vanno a chi è più esperto in quel mestiere.
Con gli stessi semi, i cambi di lavoro in 600 tick sono scesi da 968–1743 a
26–36.

## Il governatore

La modalità automatica usa lo stesso motore, applicato alla colonia intera
(`src/js/20-governor.js`). Ogni progetto di costruzione riceve un punteggio
dalle pressioni della colonia: tick di cibo in magazzino, letti liberi,
materiali, energia, minaccia, feriti, alleati. Si apre il cantiere del
progetto migliore. Se costa più di quello che c'è, il governatore aspetta e
risparmia invece di ripiegare su qualcosa di meno utile.

| Progetto | Peso | Cosa lo spinge |
|---|---|---|
| Fattoria, Peschiera | 1,1 · 1,0 | cibo scarso |
| Capanna, Alloggi | 1,25 | letti finiti (capanna se i materiali sono pochi, alloggi se abbondano) |
| Miniera | 0,9 | materiali scarsi, oppure nessuna miniera |
| Centrale | 0,85 | energia in calo e poca in scorta |
| Deposito | 0,9 | cibo o materiali vicino alla capienza |
| Ospedale | 0,9 | feriti, nessun ospedale |
| Torretta, Armeria, Mura | 0,8 · 0,8 · 0,5 | minaccia |
| Centro ricerca, Santuario, Roccaforte, Mercato, Serra, Officina | 0,55–0,85 | colonia avviata o ricca, alleati, inverno, cibo in avanzo |

Due correzioni rispetto a un punteggio puro:

- **Disoccupati come bonus.** I coloni senza lavoro alzano il peso dei progetti
  che creano posti (fattorie, miniere, officine) fino al +50%. All'inizio erano
  una considerazione moltiplicativa: quando tutti lavoravano, abbassava quei
  progetti, e con il cibo a zero la fattoria perdeva contro le capanne. La
  simulazione l'ha mostrato con quattro colonie estinte su cinque.
- **Rendimenti decrescenti.** Ogni cantiere aperto della stessa categoria (cibo,
  letti, materiali…) moltiplica il punteggio per 0,45. Senza, il cibo vinceva
  tutti i cantieri e l'energia non arrivava mai, quindi niente ricerca.

I posti di lavoro liberi vanno prima dove la pressione è più alta: cibo se
scarseggia, materiali, energia, ricerca, armeria se c'è minaccia. I cantieri
aperti sono uno ogni 4 lavoratori, fino a 6.

Passando il mouse su «auto» si leggono i tre progetti col punteggio più alto
all'ultima decisione.

## Prenotazioni

Un portatore che sceglie un cantiere prenota un blocco, e un cantiere non
riceve mai più portatori dei blocchi che gli mancano. Chi va a dormire
prenota un letto. Le prenotazioni si liberano quando il colono cambia
azione, muore o diventa soldato. La simulazione controlla a ogni tick che
i conti tornino.
