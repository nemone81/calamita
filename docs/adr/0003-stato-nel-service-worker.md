# ADR 0003 — Lo stato vive nel service worker

**Stato:** accettata · 2026-09-23

## Contesto
Le chip estratte devono essere disponibili mentre si compila un form. Ma il documento
sta quasi sempre su **un tab** e il form su **un altro**.

## Decisione
Lo stato vive nel **service worker**, su `chrome.storage.session`. Il pannello lo
rispecchia e non lo possiede.

`storage.session` e non una variabile di modulo perché un service worker MV3 viene
terminato e riavviato di continuo: una variabile sparirebbe senza preavviso, e le
chip con lei.

## Conseguenze
- Le chip sopravvivono al cambio di tab e al riavvio del service worker.
- Muoiono con la sessione del browser, che è il comportamento voluto: contengono
  dati personali e non hanno motivo di persistere su disco.
- Ogni modifica passa per un messaggio; il service worker trasmette `stato-cambiato`
  e il pannello si ridisegna. Il pannello non scrive mai direttamente.
