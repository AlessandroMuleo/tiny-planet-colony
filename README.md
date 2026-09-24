# Colonia — pianeta minuscolo

Colony sim su una geosfera di 1.212 caselle, in un solo file HTML con three.js.
Logistica a blocchi, stagioni, ricerca, clan rivali, incursioni, spazio.

**Per giocare:** apri `dist/tiny-planet-colony.html` nel browser.

## Struttura

```
src/shell.html     l'HTML della pagina, con i segnaposto per CSS e script
src/style.css      lo stile
src/js/NN-*.js     il gioco, diviso per argomento; l'ordine dei numeri conta
tools/build.mjs    ricompone tutto in dist/tiny-planet-colony.html
test/headless.mjs  carica il gioco in Node senza browser né GPU
test/sim.mjs       la simulazione di prova
```

I moduli sono script classici che condividono lo scope globale, come quando
stavano in un unico `<script>`: la build li concatena in ordine, senza
trasformarli.

| Modulo | Contenuto |
|---|---|
| 00-config | costanti, età, stagioni |
| 01-util | numeri casuali, rumore, geosfera |
| 02-data | biomi, **edifici**, orbitali, unità, poteri |
| 03-scene · 04-state | scena three.js, stato globale |
| 05-world | generazione del mondo, terreno, clan iniziali |
| 06-meshes · 07-visuals · 08-orbit | modelli 3D, giorno/notte, orbita e luna |
| 09-sites · 10-units | cantieri, unità |
| 12-economy | risorse, lavoro, età, tick economico |
| 13-pathing | campi di distanza, cache di frame |
| 14-utility | **utility AI**: curve, considerazioni, punteggi, spiegazioni |
| 15-colonists | azioni, bisogni e prenotazioni dei coloni; cervello delle altre unità |
| 16-combat | combattimento, incursioni |
| 17-diplomacy · 18-trade | diplomazia, clan rivali, carovane |
| 19-events | poteri del giocatore, **eventi casuali** |
| 20-governor | governatore automatico |
| 21-ui … 24-input | interfaccia, salvataggio, ciclo di vita, input |
| 25-progress | albero della ricerca, veterani, statistiche |
| 26-main | avvio e ciclo principale |

## Comandi

```sh
npm install          # solo three.js, per la simulazione
npm run build        # ricompone dist/tiny-planet-colony.html
npm test             # build + simulazione (900 tick, circa 20 secondi)
npm run sim:quick    # simulazione corta (300 tick, pochi secondi)
```

`node test/sim.mjs --only rivali --ticks 500 --verbose` lancia solo alcuni
scenari, con la durata scelta, e stampa anche i messaggi del gioco.
`--trace 30` stampa ogni 30 tick cosa stanno facendo i coloni e i loro
bisogni medi.

## La simulazione di prova

Gira il codice vero del gioco (three.js r128, lo stesso della CDN) con DOM e
renderer finti e `Math.random` a seme fisso. Otto scenari: primo mondo con
e senza governatore, mondi con clan rivali, una partita salvata e ricaricata
a metà, una partenza per il mondo successivo coi veterani, e un clan
assoggettato senza guarnigione. Col governatore la colonia
deve arrivare viva alla fine, e alcuni scenari devono vedere certi eventi
(una richiesta di un clan, una rivolta). A ogni tick controlla che:

- `pop` coincida con i coloni che esistono davvero;
- nessuna risorsa sia negativa, `NaN` o oltre la capienza;
- nessun edificio abbia più addetti dei posti, e nessun colono lavori su un
  edificio non suo o senza posti;
- gli addetti totali non superino le braccia disponibili;
- i cantieri siano coerenti (tipo, proprietario, blocchi ≤ necessari) e
  nessun portatore resti più di 3 tick legato a un cantiere chiuso;
- le prenotazioni di blocchi e letti coincidano con chi le tiene, nessun
  cantiere abbia più blocchi prenotati di quanti gliene mancano e nessun
  alloggio più coloni a letto dei posti;
- benevolenza, malcontento e richieste dei clan siano validi, e le guerre
  tra clan valgano da entrambe le parti;
- bisogni, salute e posizioni delle unità siano numeri validi.

Dopo il caricamento a metà partita controlla anche che coloni, bisogni e
scorte siano gli stessi di prima del salvataggio.

Un cantiere fermo da 240 tick è un avviso, non un errore.

Ogni scenario stampa un'**impronta** della partita. Con lo stesso seme, un
refactor che non cambia il comportamento deve lasciarla identica: è il modo
più rapido per accorgersi di aver cambiato qualcosa senza volerlo.

## Come decidono i coloni

Con una utility AI: ogni azione riceve un punteggio da curve di risposta sui
bisogni e sulla situazione, e si fa quella che vale di più. I dettagli, con un
esempio numerico, sono in [docs/utility-ai.md](docs/utility-ai.md). Ogni
colono ha un nome, da zero a due tratti che correggono le sue curve, e abilità
che crescono con la pratica. In gioco, selezionando una casella con dei coloni
l'ispettore mostra nome, tratti, mestiere migliore, bisogni e le tre azioni
col punteggio più alto.

## Diplomazia

I clan hanno una benevolenza da −100 a +100 e una personalità. Mandano
emissari con richieste a tempo, si fanno guerra tra loro, e gli assoggettati
possono ribellarsi. I dettagli sono in [docs/diplomazia.md](docs/diplomazia.md).

## Edifici

Oltre a quelli di base ci sono fonderia (lingotti), granaio (il cibo
marcisce), pozzo (acqua sulla sabbia), taverna, scuola, memoriale,
ambasciata e torre di segnalazione. Cosa cambia ognuno è in
[docs/edifici.md](docs/edifici.md).

## Narratore

Le incursioni crescono con la ricchezza e seguono un ciclo di calma,
tensione e picco, con una fase di ripresa dopo una batosta. Alcuni eventi
chiedono una scelta, e un'epidemia non curata può finire con un clan di
esuli. Dettagli in [docs/narratore.md](docs/narratore.md).

## Progressione

Un albero della ricerca a quattro rami, veterani che portano nome, tratti e
abilità nel mondo successivo, e una schermata di statistiche. Dettagli in
[docs/progressione.md](docs/progressione.md).

## Aggiungere cose

- **Un edificio:** una voce in `BUILDINGS` (02-data) e un modello in
  `buildingMesh` (06-meshes). Il comportamento viene dai campi (`guard`,
  `trade`, `heal`, `dps`, `spawns`, `core`, `launch`…), descritti sopra la
  tabella: non servono controlli sul nome altrove.
- **Un evento casuale:** una voce in `EVENTS` (19-events), con `weight` e
  `run()`.
- **Un'azione dei coloni:** una voce in `COLONIST_ACTIONS` (15-colonists), con
  peso, considerazioni e `run()`.
- **Un tratto dei coloni:** una voce in `PERSON_TRAITS` (15-colonists).
- **Un nodo di ricerca:** una voce in `RESEARCH` (25-progress), con ramo,
  livello, costo ed effetto; l'effetto si legge con `techSum('chiave')`.
- **Un evento con scelta:** una voce in `CHOICE_EVENTS` (19-events), con
  `when()`, testo e opzioni, ognuna con `run()` e `score(c)` per il
  governatore.
