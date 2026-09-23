# ADR 0004 — Gli SDK dei provider si caricano a richiesta

**Stato:** accettata · 2026-09-23

## Contesto
I tre SDK ufficiali (`@anthropic-ai/sdk`, `openai`, `@google/genai`) pesano
**950 kB minificati** (200 kB gzip) — misurato, non stimato. Il piano prevedeva come
ripiego adattatori a `fetch` puro se il peso fosse stato fuori scala.

## Decisione
Si tengono gli SDK ufficiali e si caricano con `import()` dinamico, **solo** quando
l'utente conferma un'estrazione o chiede l'elenco dei modelli.

## Conseguenze
- Il service worker carica **6,9 kB** all'avvio invece di quasi un megabyte.
  Conta perché in MV3 il service worker riparte di continuo, e il giro senza AI —
  che è il v0, quello che si usa sempre — non deve pagarne il parsing.
- I metadati dei provider stanno in `provider/registro.ts`, che non importa nessun
  SDK: la pagina delle opzioni mostra cinque nomi senza trascinarsi dietro le librerie.
- Il ripiego a `fetch` puro resta possibile ma non serve più.
