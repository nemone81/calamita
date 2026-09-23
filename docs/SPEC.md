# Spec: Calamita — i dati si attaccano ai campi giusti

> Stato: **bozza in revisione** · 2026-09-23
> Alla creazione del repo questo file si sposta in `~/Projects/incolla/docs/SPEC.md` (versionato).
> Il nome `incolla` è provvisorio.

## Objective

Compilare form web con dati presi da un documento, senza il ciclo
alt-tab → seleziona → copia → alt-tab → clicca → incolla, ripetuto per ogni campo.

**Utente**: Fabio, uno. Form sempre diversi, documenti sempre diversi.

**Storia d'uso (v0)**
1. Ho un documento aperto (PDF, email, foglio, scansione) e un form web da compilare.
2. Seleziono il testo e premo una scorciatoia — oppure trascino il file/l'immagine nel pannello.
3. Il pannello laterale mostra i valori riconosciuti come **chip** (`CAP → 00184`), correggibili.
4. Clicco un campo del form, clicco la chip: il valore entra. Avanti così.

**Successo**: compilare un form da 8 campi senza mai cambiare finestra, in meno di 30 secondi.

**Non-obiettivo del v0**: indovinare da solo quale chip va in quale campo. È il v1
(vedi *Evoluzione*), e arriva solo se il v0 dimostra di servire davvero.

## Decisioni prese

| Decisione | Scelta | Perché |
|---|---|---|
| Sorgente | testo selezionato, clipboard, file, immagine | il documento può essere selezionabile o scansionato |
| OCR | **nessuno** | un modello multimodale legge immagine e testo con lo stesso codice: Tesseract.js non entra nel progetto |
| Estrazione | **ibrida**: regex locali sempre, AI solo su bottone | i documenti contengono dati personali; il grosso si risolve in locale e a costo zero |
| Chiamata AI | **diretta dall'estensione**, nessun backend | con la chiave dell'utente il proxy non serve mai, nemmeno distribuendo: ognuno paga la sua |
| Provider | **5, a scelta dell'utente**: Claude, OpenAI, Gemini, Grok, Muse | chi installa usa la chiave che ha già |
| Adattatori | **3, non 5** | Grok è OpenAI-compatibile e Muse lo è sia con OpenAI sia con Anthropic: cambia la base URL, non il codice |
| Mappatura automatica | fuori dal v0 | con form sempre nuovi sbaglierà: prima serve il ripiego manuale, che è anche il valore vero |
| Distribuzione | unpacked, solo per me | nessuna policy Web Store da rispettare finché non serve |

## Tech Stack

- **Chrome MV3** — `chrome.sidePanel`, service worker, content script
- **Vite + @crxjs/vite-plugin** — build e HMR dell'estensione
- **TypeScript**, nessun framework UI nel v0 (il pannello è una lista di chip: DOM a mano)
- **Vitest** — estrattori e validatori
- **Playwright** — riempimento dei campi su form reali (carica l'estensione unpacked)
- **Adattatori provider** — `@anthropic-ai/sdk` per Claude (`dangerouslyAllowBrowser: true`);
  formato OpenAI per OpenAI/Grok/Muse con base URL per provider; SDK Google per Gemini.
  La chiamata parte dal **service worker** con `host_permissions` sugli host delle API: lì
  la CORS non si applica come in una pagina web (**da provare per primo nello spike**)
- **pnpm**

## Commands

```
pnpm install
pnpm dev            # build watch + HMR; poi "Carica estensione non pacchettizzata" da dist/
pnpm build          # bundle di produzione in dist/
pnpm test           # vitest run
pnpm test:e2e       # playwright test (form di prova in tests/fixtures/)
pnpm lint           # eslint --fix
pnpm typecheck      # tsc --noEmit
```

## Project Structure

```
src/
  background/       → service worker: scorciatoie, menu contestuale
  sidepanel/        → il pannello: lista chip, editing, bottone "Estrai con AI"
  content/          → iniettato nella pagina: riempimento campi, tracking del campo attivo
  extract/          → estrattori locali (puri, testabili senza browser)
    patterns.ts     → regex per tipo
    validate.ts     → checksum CF / IBAN / P.IVA
    segment.ts      → split righe/tab, parsing "Chiave: valore"
  fill/             → riempimento robusto (native setter + eventi)
  ai/
    estrai.ts       → l'UNICO punto che il resto del codice chiama
    provider/
      tipi.ts       → l'interfaccia Provider + il prompt di estrazione (uno solo, condiviso)
      anthropic.ts  → Claude
      openai.ts     → OpenAI, Grok, Muse (stessa forma, base URL diversa)
      google.ts     → Gemini
      modelli.ts    → id dei modelli e default, in un posto solo
  shared/           → tipi del record canonico
tests/
  fixtures/         → 3 form di controllo (HTML puro, React, label in tabella) + documenti di prova
docs/
  SPEC.md           → questo file
  adr/              → decisioni architetturali
```

## Code Style

Estrattori puri, niente `chrome.*` dentro `extract/` — così girano in vitest senza browser.
Un tipo riconosciuto **non si accontenta della forma: verifica il checksum** quando esiste.

```ts
// src/extract/patterns.ts
export const CODICE_FISCALE: Pattern = {
  type: 'codice-fiscale',
  label: 'Codice fiscale',
  autocomplete: null,              // nessun token WHATWG per il CF
  re: /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z]\d{3}[A-Z]\b/gi,
  validate: (v) => cfCheckChar(v) === v[15].toUpperCase(),
}
```

Il **record canonico** è l'unico contratto fra estrazione e riempimento, e il suo
vocabolario coincide con i token `autocomplete` WHATWG dove esistono — così il v1
eredita la mappatura gratis:

```ts
type Slot = {
  id: string
  type: string                     // 'codice-fiscale' | 'postal-code' | 'email' | ...
  autocomplete: string | null      // token WHATWG, quando c'è
  label: string                    // etichetta mostrata sulla chip
  value: string
  source: 'regex' | 'kv' | 'ai' | 'manual'
  confidence: number               // 0-1; 1 quando il checksum torna
}
```

Italiano per etichette, commenti e nomi di dominio; inglese per i termini tecnici.

## Provider

L'utente sceglie il provider e incolla la **sua** chiave in una pagina di opzioni. Un'interfaccia sola:

```ts
interface Provider {
  id: 'claude' | 'openai' | 'gemini' | 'grok' | 'muse'
  nome: string
  modelloDefault: string
  supportaImmagini: boolean          // il caso scansione: non tutti, e non tutti i modelli
  estrai(input: Input, chiave: string): Promise<Slot[]>
}
```

**Output strutturato, non prosa.** È il punto dove i tre formati divergono davvero e dove sta
il lavoro dell'adattatore: `output_config.format` su Anthropic, `response_format: json_schema`
su OpenAI, `responseSchema` su Google. Lo schema JSON del record canonico è **uno solo**,
tradotto tre volte.

**Gli id dei modelli si verificano al momento dell'implementazione** e stanno tutti in
`modelli.ts` — non si scrivono a memoria, cambiano in fretta. Per Claude il default è
`claude-opus-5`; se la misura dice che basta, `claude-sonnet-5` costa meno.

**Chiavi**: una per provider, in `chrome.storage.local`, inserite a mano nelle opzioni.
Si legge solo quella del provider attivo. Mai in git, mai in un log, mai mostrate in chiaro
dopo il salvataggio (solo `sk-...••••`).

**L'avviso prima della chiamata dice a chi stanno per andare i dati** — "stai per mandare
questo testo a **Gemini**" — non un generico "all'AI". Con cinque destinazioni possibili,
sapere quale è parte del consenso.

## Testing Strategy

Tre livelli, ognuno con un compito diverso:

1. **Unit (vitest)** — `extract/`. Ogni pattern ha casi positivi, negativi e **un falso amico**
   (un numero di 11 cifre che non è una P.IVA, una data che è un numero di protocollo).
   I checksum si testano con valori veri e con una cifra alterata.
2. **Adattatori** — un test per provider che verifica la **forma** della richiesta costruita
   (endpoint, header, schema) senza chiamare davvero. La chiamata vera si collauda a mano,
   una volta per provider, e si annota il risultato: è denaro, non va in CI.
3. **E2E (playwright)** — `fill/` sui 3 form di controllo in `tests/fixtures/`:
   - `plain.html` — input HTML puri con `autocomplete`
   - `react.html` — input controllati React (il caso che rompe l'assegnazione ingenua di `.value`)
   - `legacy.html` — label in celle di tabella, `name="txt1"`, nessun `autocomplete`
   Il test verifica che dopo il click il **framework abbia accettato** il valore, non solo che
   il DOM lo mostri: si rilegge lo stato dopo un blur.
4. **Collaudo reale** — prima di considerare fatto il v0, tre documenti veri (non fixture) e
   tre form veri incontrati per caso. Vedi la skill `collaudo-reale`: i test verdi non vedono
   il documento storto, il form dentro un iframe, il campo che si resetta al blur.

Copertura attesa: `extract/` e `fill/` sopra l'80%. Pannello e service worker non si testano
unitariamente nel v0.

## Boundaries

**Sempre**
- Le regex girano in locale e non escono mai dall'estensione.
- Prima di ogni chiamata AI, il pannello mostra **esattamente cosa sta per uscire** e aspetta conferma.
- Riempimento tramite native setter + `input`/`change` con `bubbles: true`.
- `pnpm test && pnpm typecheck` verdi prima di ogni commit.
- Branch → PR → merge (standard dei repo personali).

**Chiedere prima**
- Aggiungere un permesso al manifest (ogni permesso in più è superficie in più).
- Passare da `activeTab` a `host_permissions: <all_urls>`.
- Persistere i valori estratti su disco (nel v0 vivono solo in memoria, muoiono col pannello).
- Aggiungere una dipendenza.

**Mai**
- La chiave in chiaro nel codice o in git: sta in `chrome.storage.local`, inserita a mano dall'utente.
- Leggere la chiave di un provider che non sia quello attivo.
- Un provider di default preselezionato con una chiave mia dentro.
- Leggere gli appunti senza un gesto esplicito dell'utente.
- Log dei valori estratti, mai, né in console né altrove.
- Riempire un campo senza che l'utente l'abbia scelto (nel v0 non esiste "riempi tutto").

## Success Criteria

Il v0 è fatto quando, misurato su documenti e form veri:

1. Su un documento anagrafico o una fattura, gli estrattori **locali** producono almeno
   6 chip corrette senza chiamare l'AI.
2. Il click su una chip riempie correttamente il campo su **tutti e tre** i form di controllo,
   React incluso, verificato dopo il blur.
3. Un form da 8 campi si compila in **meno di 30 secondi** senza cambiare finestra
   (cronometrato, contro il baseline del copia-incolla manuale sullo stesso form).
4. Su una **scansione**, il bottone "Estrai con AI" produce un record canonico utilizzabile
   in meno di 10 secondi.
5. Nessun valore lascia il Mac senza una conferma esplicita — verificato leggendo il traffico
   di rete dell'estensione, non il codice.
6. `src/ai/` è l'unico punto del codice che conosce le API: `grep -rE 'anthropic|openai|googleapis|api\.x\.ai|api\.meta\.ai' src/` non trova nulla fuori di lì.
7. Tutti e cinque i provider producono lo **stesso record canonico** dallo stesso documento di
   prova — differenze di qualità sì, differenze di forma no.

## Evoluzione (non nel v0)

- **v1 — mappatura automatica**: bottone "riempi tutto" con anteprima. Punteggio deterministico
  (`autocomplete` → `name`/`id` → label) e **Jev di TypeSafe AI** (`choice` con confidence) solo
  sulle coppie ambigue. Sotto soglia non riempie: lascia la chip all'utente.
- **v2 — memoria per form**: firma del form → mappatura confermata in `chrome.storage.local`.
  Vale poco con form sempre nuovi, molto se emergesse un form ricorrente.
- **Fuori portata**: iframe cross-origin (campi carta), app native macOS (problema diverso,
  semmai un hotkey "incolla il prossimo slot" in Raycast).

## Open Questions

1. **Scorciatoia da tastiera** — quale? (`⌘⇧I` è occupata dal DevTools; serve qualcosa di libero)
2. **Peso del bundle** — cinque SDK ufficiali in un service worker MV3 pesano. Se lo spike
   misura un bundle fuori scala, il ripiego sono adattatori a `fetch` puro: con tre soli
   formati e una sola chiamata per provider, è poco codice. Da misurare, non da decidere ora.
3. **Modello** — per ogni provider, quale default? Da misurare su una scansione storta:
   spesso il modello economico basta, e su un'estrazione la differenza si vede subito.
4. ~~Il pannello sopravvive al cambio tab?~~ **Deciso il 2026-09-23: sì.** Lo stato delle chip
   vive nel **service worker**, non nel pannello: il pannello lo legge e lo rispecchia. Il
   documento sta su un tab, il form su un altro, le chip restano.
