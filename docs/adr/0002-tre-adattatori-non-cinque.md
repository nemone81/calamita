# ADR 0002 — Tre adattatori per cinque provider

**Stato:** accettata · 2026-09-23

## Contesto
L'estensione deve supportare Claude, OpenAI, Gemini, Grok e Muse con la chiave
dell'utente. Cinque provider sembrano cinque integrazioni.

## Decisione
**Tre adattatori.** Grok (xAI) e Muse (Meta, `api.meta.ai/v1`) parlano il protocollo
OpenAI: cambia la base URL, non il codice. Restano tre dialetti veri:

| Dialetto | Provider | Come si impone lo schema |
|---|---|---|
| Anthropic | Claude | `output_config.format` |
| OpenAI | OpenAI, Grok, Muse | `response_format: json_schema` |
| Google | Gemini | `responseSchema` (e niente `additionalProperties`) |

Lo **schema JSON del record canonico è uno solo**, tradotto tre volte.

## Conseguenze
- Aggiungere un provider OpenAI-compatibile costa una riga in `openai.ts`.
- `perGoogle()` esiste solo per togliere `additionalProperties`, che Google rifiuta.
- Gli id dei modelli stanno tutti in `modelli.ts` e la pagina delle opzioni può
  chiedere all'account l'elenco vero: scriverli a memoria invecchia in settimane.
