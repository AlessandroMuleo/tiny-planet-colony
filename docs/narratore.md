# Il narratore

Al posto del timer fisso da 120 secondi, le incursioni e gli eventi li
decide un narratore, come in RimWorld (`src/js/19-events.js`).

## Minaccia proporzionata alla ricchezza

La ricchezza della colonia somma le scorte (i lingotti pesano di più), il
valore degli edifici e 15 per colono. I predoni di un'incursione crescono
con la **radice** della ricchezza, per 0,12, più il 15% per ogni mondo
colonizzato, da 1 a 14. Con la radice una colonia grande resta sfidata
senza essere schiacciata. Il tooltip del contatore delle incursioni mostra
quanti predoni arriverebbero adesso.

## Tensione a cicli

| Fase | Durata | Intervallo tra incursioni | Predoni |
|---|---|---|---|
| calma | 180 tick | ×1,45 | ×0,8 |
| tensione | 140 tick | ×1 | ×1 |
| picco | 90 tick | ×0,6 | ×1,3 |
| ripresa | 150 tick | ×2 | ×0,6 |

Le fasi girano calma → tensione → picco → calma. La **ripresa** scatta dopo
una batosta: ogni colono perso in combattimento vale 1, ogni edificio
distrutto 0,5, e le perdite recenti calano di 0,02 a tick. Quando superano
4 (o l'8% della popolazione, se è di più), la pressione cala per un po'.
In ripresa metà degli eventi casuali diventa un'annata abbondante.

## Saccheggio e ritirata

Dopo 60 secondi a terra i predoni prendono 12 materiali e 10 cibo a testa e
ripartono. Prima restavano finché qualcuno non li uccideva: se morivano i
coloni in grado di combattere, due predoni radevano al suolo tutto, alloggi
compresi, e la colonia non poteva più rinascere.

## Eventi con una scelta

Un evento su tre chiede una decisione, in una finestra con due opzioni e 30
secondi per rispondere. Il gioco non si ferma. Senza risposta vale la
prima opzione, la più prudente.

| Evento | Opzioni |
|---|---|
| Profughi inseguiti | respingerli, o accoglierli: +3 coloni e 3 predoni subito |
| Mercante di passaggio | lasciar perdere, o 50 cibo per 60 materiali |
| Viandante malato | mandarlo via (umore −0,05 a tutti), o accoglierlo: +1 colono, 50% di epidemia |
| Disertori | rifiutare, o accoglierli: +2 coloni, −15 benevolenza col loro clan |

In modalità automatica sceglie il governatore: ogni opzione ha un
punteggio sul contesto della colonia (truppe, torrette, giorni di cibo,
ospedale).

## Catene di eventi

Un'**epidemia** avvia un conto alla rovescia di 45 secondi. Se allora non
c'è un ospedale con addetti, scoppia una **carestia**: per 80 secondi i
campi rendono la metà, tranne le serre. Se durante la carestia tre coloni
se ne vanno per fame, fondano un **clan di esuli**: guerrieri, con −35 di
benevolenza. Uno solo per carestia.
