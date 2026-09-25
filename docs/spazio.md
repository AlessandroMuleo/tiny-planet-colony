# Spazio

Le strutture orbitali si comprano dal catalogo **Orbita**. Una carta per
struttura: se non c'è ancora, un clic la lancia; se è già in orbita, un clic
la migliora. Il numero in basso a destra è il livello.

## Strutture

| Struttura | Costo | Consumo | Effetto |
|---|---|---|---|
| Stazione orbitale | 120 mat · 60 en | — | +220 di capienza; serve a tutte le altre |
| Specchio solare | 90 mat · 80 en | — | annulla la carestia invernale |
| Cannone orbitale | 140 mat · 110 en | 1 | colpisce i predoni sul pianeta |
| Occhio profondo | 100 mat · 70 en | 0,4 | +45 secondi tra un'incursione e l'altra |
| Base lunare | 160 mat · 90 en | 0,8 | +40 materiali ogni 40 secondi |
| **Scudo orbitale** | 150 mat · 100 en · 20 lingotti | 1,2 | abbatte il 40% di ogni navetta prima che atterri (almeno un predone arriva), devia le meteore, protegge dalle tempeste solari |
| **Telescopio orbitale** | 110 mat · 70 en · 10 lingotti | 0,5 | +0,8 ricerca; 30 secondi prima di un'incursione segna dove atterrerà la navetta |
| **Raccoglitore di asteroidi** | 170 mat · 110 en · 25 lingotti | 0,9 | ogni 50 secondi una capsula scende vicino a un magazzino con 12 lingotti e 20 materiali |
| **Satellite meteo** | 90 mat · 80 en · 10 lingotti | 0,6 | siccità più lieve (campi −15% invece di −30%), niente fulmini |
| **Habitat orbitale** | 200 mat · 120 en · 30 lingotti | 1,0 | 16 letti; chi ci abita ha +0,03 di umore («vista sulle stelle») |

Le cinque in grassetto sono **avanzate**: servono la stazione e un
*Controllo missioni* a terra con almeno un addetto.

## Livelli

| Livello | Costo del passaggio | Effetto |
|---|---|---|
| 1 | — | ×1 |
| 2 | 60 mat · 20 lingotti | ×1,5 |
| 3 | 100 mat · 45 lingotti | ×2 |

Il moltiplicatore vale per quello che la struttura *fa* (capienza, danni del
cannone, ricerca, capsule, letti, ritardo delle incursioni, taglio dello
scudo fino all'80%), non per il consumo. Lo specchio al livello 2 e 3 fa
anche crescere i campi d'inverno oltre il normale.

## Edifici a terra

- **Controllo missioni** (80 mat · 30 en · 15 lingotti, 2 addetti): sblocca
  le strutture avanzate, +0,5 ricerca a testa.
- **Ascensore spaziale** (160 mat · 60 en · 40 lingotti, 2 addetti): le
  strutture orbitali costano il 40% in meno, le navette per la luna e le
  capsule vanno due volte più veloci.

## Tempesta solare

Un evento casuale, possibile solo con qualcosa in orbita. Se lo scudo è
acceso non succede nulla; altrimenti per 35 secondi tutte le strutture
orbitali sono spente: niente effetti, niente consumi, niente capienza in più
oltre a quella dei magazzini a terra.

Una struttura con consumo si spegne anche quando l'energia è a zero.

## Il governatore

Una decisione orbitale per ragionamento, solo con scorte abbondanti: lancia
una struttura se dopo il pagamento resta almeno il 60% del costo, e la
migliora se ha il doppio del costo del livello. Cosa vuole dipende dalla
colonia: cannone e scudo con la minaccia, specchio d'inverno, raccoglitore se
servono lingotti, habitat se mancano letti, telescopio se c'è ricerca da fare.
Il Controllo missioni e l'Ascensore sono progetti come gli altri.

## Traguardi

Costellazione (cinque strutture in orbita), Sotto lo scudo, Minatori
stellari, Ingegneria orbitale (una struttura al livello 3).

## Nel codice

Tutto sta in `src/js/25-space.js`: `orbitalOn(k)` dice se una struttura
funziona, `orbMul(k)` quanto rende (0 se spenta). Gli altri moduli leggono
solo questi due.
