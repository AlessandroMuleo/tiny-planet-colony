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
| 11-economy | risorse, lavoro, età, tick economico |
| 12-pathing | campi di distanza, cache di frame |
| 13-colonists | cervello dei coloni e delle unità |
| 14-combat | combattimento, incursioni |
| 15-diplomacy · 16-trade | diplomazia, clan rivali, carovane |
| 17-events | poteri del giocatore, **eventi casuali** |
| 18-auto | governatore automatico |
| 19-ui … 23-main | interfaccia, salvataggio, input, ciclo principale |

## Comandi

```sh
npm install          # solo three.js, per la simulazione
npm run build        # ricompone dist/tiny-planet-colony.html
npm test             # build + simulazione rapida (300 tick, pochi secondi)
npm run sim          # simulazione lunga (900 tick, qualche minuto)
```

`node test/sim.mjs --only rivali --ticks 500 --verbose` lancia solo alcuni
scenari, con la durata scelta, e stampa anche i messaggi del gioco.

## La simulazione di prova

Gira il codice vero del gioco (three.js r128, lo stesso della CDN) con DOM e
renderer finti e `Math.random` a seme fisso. Cinque scenari: primo mondo con
e senza governatore, e mondi con clan rivali. A ogni tick controlla che:

- `pop` coincida con i coloni che esistono davvero;
- nessuna risorsa sia negativa, `NaN` o oltre la capienza;
- nessun edificio abbia più addetti dei posti, e nessun colono lavori su un
  edificio non suo o senza posti;
- gli addetti totali non superino le braccia disponibili;
- i cantieri siano coerenti (tipo, proprietario, blocchi ≤ necessari) e
  nessun portatore resti più di 3 tick legato a un cantiere chiuso;
- salute e posizioni delle unità siano numeri validi.

Un cantiere fermo da 240 tick è un avviso, non un errore.

Ogni scenario stampa un'**impronta** della partita. Con lo stesso seme, un
refactor che non cambia il comportamento deve lasciarla identica: è il modo
più rapido per accorgersi di aver cambiato qualcosa senza volerlo.

## Aggiungere cose

- **Un edificio:** una voce in `BUILDINGS` (02-data) e un modello in
  `buildingMesh` (06-meshes). Il comportamento viene dai campi (`guard`,
  `trade`, `heal`, `dps`, `spawns`, `core`, `launch`…), descritti sopra la
  tabella: non servono controlli sul nome altrove.
- **Un evento casuale:** una voce in `EVENTS` (17-events), con `weight` e
  `run()`.
