# ADR 0001 — Niente OCR

**Stato:** accettata · 2026-09-23

## Contesto
I documenti da cui si copiano i dati sono di due specie: PDF ed email con testo
selezionabile, e scansioni o foto. Il primo istinto è trattarle come due percorsi:
estrazione dal testo per gli uni, OCR (Tesseract.js) per gli altri.

## Decisione
**Nessun OCR.** Un modello multimodale legge immagine e testo con lo stesso codice,
quindi la scansione entra dalla stessa porta del testo — cambia il blocco di contenuto
nella richiesta, non l'architettura.

## Conseguenze
- Una dipendenza pesante in meno e un percorso in meno da mantenere.
- La scansione **richiede** un provider configurato: senza chiave, il testo si estrae
  comunque in locale, l'immagine no. È un limite accettabile perché le regex locali
  su una scansione non avrebbero comunque nulla da leggere.
- `Provider.supportaImmagini` esiste perché non è detto che tutti i modelli lo facciano.
