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

## Prenotazioni

Un portatore che sceglie un cantiere prenota un blocco, e un cantiere non
riceve mai più portatori dei blocchi che gli mancano. Chi va a dormire
prenota un letto. Le prenotazioni si liberano quando il colono cambia
azione, muore o diventa soldato. La simulazione controlla a ogni tick che
i conti tornino.
