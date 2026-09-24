# Edifici della Fase 3

Ogni edificio introduce una scelta, non solo un numero più alto.

| Edificio | Catalogo | Costo | Cosa cambia |
|---|---|---|---|
| Fonderia | Colonia | 45 mat | Converte 1,2 materiali in 0,5 **lingotti** a testa. I lingotti sono una seconda risorsa: servono per torrette (8), ambasciata (10) e rampa di lancio (25). |
| Granaio | Colonia | 30 mat | Il cibo oltre i primi 60 **marcisce** dell'1% a tick, se non è in un granaio (150 per taglia). Accumulare migliaia di cibo non è più gratis. |
| Pozzo | Colonia | 12 mat | Sulla **sabbia**, senza un pozzo entro 4,5, si rende il 40% in meno. |
| Taverna | Vita | 36 mat | Nuova azione dei coloni, *svago*: con l'umore basso vanno in taverna e per 90 tick hanno +0,15 all'umore. Serve un oste. |
| Scuola | Vita | 40 mat | Nuova azione dei bambini, *a scuola*: di giorno studiano un mestiere e diventano adulti già esperti. Serve un maestro. |
| Memoriale | Vita | 30 mat | Il lutto per una morte pesa la metà e passa il doppio più in fretta. |
| Ambasciata | Vita | 50 mat, 10 lingotti | Doni +50%, mediazione tra clan a metà prezzo, e i clan si avvicinano da soli fino a 50 di benevolenza. |
| Torre di segnalazione | Difesa | 25 mat | Avvista la navetta dei predoni 25 secondi prima: i bambini vanno al riparo prima che atterri. |

Il governatore ha un progetto per ciascuno: fonderia quando servono
lingotti, granaio quando il cibo marcisce, pozzo quando ci sono lavori
all'asciutto, taverna quando l'umore medio è basso, scuola quando ci sono
bambini, memoriale dopo un lutto, ambasciata se ci sono clan, torre se c'è
minaccia.

I costi ora passano tutti da `canPay`, `pay` e `costText` (02-data): per
aggiungere una risorsa basta metterla in `COST_KEYS`.
