# La mente dei coloni

La utility AI ([utility-ai.md](utility-ai.md)) sceglie un'azione per volta
e al ragionamento dopo ha già dimenticato tutto. `src/js/15-mind.js` le
aggiunge memoria, piani, lavoro di squadra e carattere. Nessuna di queste
cose ha un comportamento a parte: ognuna cambia un input della utility
AI, un percorso o un bersaglio.

## Ricordi dei luoghi

Ogni colono tiene fino a otto ricordi, ognuno con una casella, un tipo e
una forza da 0 a 1:

| Tipo | Quando nasce | Forza | Sbiadisce in |
|---|---|---|---|
| pericolo | il colono viene colpito lì | 0,6 | ~150 tick |
| pericolo | vede cadere un compagno (entro un paio di caselle) | 0,5 | ~110 tick |
| pericolo | vede atterrare una navetta di predoni | 0,7 | ~160 tick |
| lutto | lì è morto un suo amico | 1 | ~500 tick |

Cosa cambiano:

- **Il percorso.** Tra i passi che avvicinano alla meta, il colono prende
  quello che lo porta più lontano dai luoghi che teme. Non torna mai
  indietro e non fa giri lunghi: se le vie buone sono due, prende quella
  senza brutti ricordi. Chi va a difendere o a soccorrere non ci bada.
- **Il cantiere.** Tra i cantieri vicini sceglie il primo che non teme.
- **L'umore.** Stare dove è morto un amico vale −0,05 («ricordi dolorosi»).

I ricordi passano anche di bocca in bocca (vedi *Voci*).

**Strade.** Ora i coloni conoscono le strade. Il campo di distanze è una
Dijkstra in cui un passo su strada costa 2 e uno fuori strada 3. Su una
strada si cammina 1,6 volte più in fretta, quindi un giro più lungo che
passa per la strada può essere il percorso più rapido, e i coloni lo
prendono.

## Piani a più passi

Un piano è una fila di passi. Il passo in testa vale almeno 0,85 nella
scelta dell'azione, e un piano che non si chiude in 150 tick si
abbandona.

| Piano | Quando | Passi |
|---|---|---|
| lavoro lontano | sta per andare a un lavoro distante almeno 6 passi, con fame o sonno | mangiare → dormire → lavorare (solo i passi che servono) |
| cena prima di dormire | sta per andare a dormire con fame | mangiare → dormire |
| un blocco di strada | ha appena portato il raccolto al magazzino e c'è un cantiere a meno di 3 passi dal suo lavoro | portare un blocco → lavorare |

L'ultimo è quello che si nota di più. Prima un lavoratore non costruiva
mai: al magazzino posava il raccolto e tornava a mani vuote. Ora, se il
cantiere è sulla strada, porta un blocco (al massimo uno ogni 30 tick). I
cantieri finiscono prima e le colonie crescono di più: nella simulazione
da 900 tick le popolazioni finali sono più alte in quasi tutti gli
scenari.

L'ispettore mostra il piano in corso, con il motivo, e alla voce della
scelta segna «nel piano».

## Squadra

Si ricalcola a ogni tick economico, solo quando ci sono nemici in giro.

- **Bersaglio comune.** Il nemico più malconcio vicino a chi difende.
  Chi lo ha a tiro colpisce lui e non il primo che capita; chi è a meno di
  1,5 volte la distanza di difesa gli va incontro. Gli altri affrontano il
  nemico più vicino.
- **Capo squadra.** Chi ha più esperienza di combattimento, un mestiere
  nuovo che si impara difendendo. L'esperienza aumenta i danni come ogni
  altra abilità (fino a +60%). Chi sta accanto al capo colpisce il 20% più
  forte. Il gioco annuncia il capo una volta per incursione.
- **Ritirata.** Se la squadra è in inferiorità di due a uno (con almeno
  tre nemici), oppure in inferiorità e con meno del 60% di salute media,
  ripiega tutta insieme per 12 tick. Chi sa combattere, in ritirata, si
  considera vulnerabile e scappa. Prima di un'altra ritirata passano 30 tick.
- **Soccorso.** Un adulto sano vicino a un ferito lontano dall'ospedale
  se lo carica in spalla e ce lo porta. Il ferito viene prenotato, così
  due soccorritori non se lo contendono. Tra i due nasce un legame.

## Carattere e voci

Accanto ai legami di amicizia ci sono le **rivalità**, da 0 a 1. Da 0,5 in
su due coloni sono rivali: un rivale vicino vale −0,06 di umore, e con un
rivale non si fa amicizia.

- **Liti.** Nascono tra coloni della stessa casella (lavoro, alloggio,
  taverna). È più probabile se hanno tratti che non vanno d'accordo
  (pigro e robusto, coraggioso e pauroso, socievole e solitario, allegro e
  solitario, due golosi) o se sono di cattivo umore. Una lite rovina
  anche l'amicizia.
- **Pace.** In taverna (−0,15 ogni cinque tick), con un amico comune
  presente (−0,06), o lavorando o dormendo vicini se tutti e due sono di
  buon umore (−0,03). Le rivalità sbiadiscono anche da sole.
- **Voci.** Tra conoscenti, o in taverna, un colono racconta il suo
  ricordo più forte: l'altro lo impara a metà forza. Un amico, poi, si
  schiera nelle liti dell'amico: la rivalità passa un po' anche a lui.

## Storia personale

Ogni colono tiene gli ultimi sei fatti della sua vita, e il primo (sbarco,
arrivo o nascita) resta sempre. Gli altri: prima amicizia, ferita, lutto,
lite, pace, soccorso dato o ricevuto, guida della difesa, esperienza in un
mestiere, sbarco su un mondo nuovo. I veterani se la portano dietro.
L'ispettore mostra gli ultimi tre fatti, i rivali e i luoghi che il
colono teme.

## Fumetti

Le liti (💢), le paci (🤝), le voci (💬), i soccorsi (🚑), il capo
squadra (⚔) e la ritirata (↩) compaiono per due secondi sopra la testa
dei coloni, al massimo dieci alla volta.

## Nella simulazione

A ogni tick si controlla che:

- i ricordi e le rivalità siano validi;
- i piani abbiano solo passi conosciuti;
- chi porta un ferito e il ferito puntino l'uno all'altro;
- nessuno porti qualcuno mentre è portato a sua volta.

Ogni scenario stampa quanti piani, blocchi di strada, soccorsi, liti,
paci e voci ci sono stati. Capo squadra, ritirata, soccorso, lite e pace
devono comparire almeno una volta nella suite.

**Un bug trovato così.** Le paci restavano a zero. Il motivo: esisteva già
una `makePeace` per la pace tra clan in `17-diplomacy.js`, che sostituiva
in silenzio quella nuova, e le paci tra coloni chiamavano la funzione
diplomatica. Ora `tools/build.mjs` si ferma se due moduli dichiarano lo
stesso nome globale.
