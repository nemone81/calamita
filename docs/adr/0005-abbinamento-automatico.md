# ADR 0005 — Abbinamento automatico, ma con anteprima

**Stato:** accettata · 2026-09-23 · *sostituisce la scelta «mappatura fuori dal v0» della spec*

## Contesto
Il v0 chiedeva di cliccare un campo e poi la chip, per ogni valore. Alla prova dei fatti
è ancora troppo lavoro: se lo strumento deve togliere il ciclo alt-tab, non può
sostituirlo con un ciclo clic-clic.

La spec aveva rimandato la mappatura al v1 con una ragione precisa: **con form sempre
nuovi l'abbinamento sbaglierà**, e un riempimento sbagliato e invisibile è peggio di
nessun riempimento — soprattutto su un modulo che poi si firma.

## Decisione
Abbinamento automatico **deterministico** (nessun modello), seguito da un'**anteprima**
che si conferma. L'anteprima mostra per ogni riga il valore, il campo di destinazione e
**il motivo**; le righe sotto 0.8 di punteggio sono segnalate; ogni riga si può togliere.

Ordine dei segnali, dal più forte:

1. `autocomplete` uguale da entrambe le parti → 1.0
2. l'etichetta del campo nomina il tipo della chip → 0.9 (0.97 col checksum confermato)
3. chip e campo parlano dello stesso concetto (nome, cognome, indirizzo…) → 0.85-0.95
4. `<input type="email">` e simili → 0.8
5. somiglianza fra le etichette → 0.5-0.8
6. un `<select>` che ha proprio quell'opzione → 0.75
7. `maxlength` che combacia con un tipo di lunghezza fissa → 0.6

Sotto **0.45** non si propone nulla: la chip resta da piazzare a mano, e lo si dice.

L'assegnazione è un greedy sulle coppie ordinate, non l'ottimo globale. Con dieci campi
la differenza non si vede, e l'ordine è spiegabile a chi guarda — che qui conta di più.

## Conseguenze
- Il percorso manuale resta: serve per ciò che l'abbinamento non trova, e serve **sempre**
  perché è il ripiego quando sbaglia.
- Si riscansiona il DOM **subito prima** di riempire: fra l'anteprima e il clic la pagina
  può cambiare, e riempire per indice una lista vecchia significa scrivere nel campo sbagliato.
- `mappa/abbina.ts` è puro e testato senza browser; il giro completo è provato in e2e
  contro le tre fixture, React compreso.
- Il vocabolario è italiano e va allargato con l'uso: `mappa/vocabolario.ts` è il posto.
