# Piano tecnico — Incolla

> Fase 2 di `spec-driven-development`. Da rivedere prima di scrivere codice.
> Riferimento: `SPEC.md` · 2026-09-23

## Il principio che ordina tutto

**Il v0 utile non ha bisogno dell'AI.** Regex locali + chip + riempimento sono già lo strumento
che ti toglie il ciclo alt-tab. I provider sono un acceleratore che arriva dopo, su una base
che funziona. Quindi: prima un attrezzo usabile senza chiave e senza rete, poi il ramo AI.

L'unica eccezione all'ordine è lo spike di rete, che va per primo perché se fallisce cambia
la forma di tutto il ramo AI e non voglio scoprirlo dopo aver scritto gli adattatori.

## Fasi

```
F0  spike          ──→  F1  v0 senza AI  ──→  F2  ramo AI  ──→  F3  collaudo
    (mezza         │        (usabile)            (5 provider)      (documenti
     giornata)     │                                                e form veri)
                   └─ se la rete non passa, il ramo AI cambia forma: meglio ora
```

### F0 — Spike: due domande, nessun codice da tenere

Due incognite che invalidano il piano se rispondono male. Il codice dello spike è usa-e-getta.

- [x] **S1 — La chiamata a un'API esterna passa dal service worker?** ✅ **SÌ** (2026-09-23)
  - Ipotesi: sì, con `host_permissions` sugli host delle API la CORS non si applica come in
    una pagina web, e le guardie `dangerouslyAllowBrowser` degli SDK si disattivano.
  - Acceptance: una risposta vera da **un** provider, letta nel service worker.
  - Verify: la risposta compare nel log del service worker; la richiesta si vede in DevTools.
  - Se fallisce: il ramo AI ha bisogno di un proxy dopo tutto → torniamo sulla spec.

- [x] **S2 — Il side panel si apre come serve a noi?** ✅ **SÌ, da scorciatoia** (2026-09-23)
  - `chrome.sidePanel.open()` richiede un gesto dell'utente. Da capire se la scorciatoia da
    tastiera conta come gesto, o se serve per forza un click sull'icona.
  - Acceptance: il pannello si apre da scorciatoia con del testo selezionato nella pagina.
  - Verify: a mano, su tre siti diversi.
  - Se fallisce: cambia il gesto di ingresso (icona invece di scorciatoia), non l'architettura.

**Checkpoint superato il 2026-09-23.** Esiti misurati, non dedotti:

| Prova | Esito |
|---|---|
| Gemini `GET /models` | 200 |
| Gemini `POST :generateContent` (con preflight) | 200 |
| **controllo** — `example.com`, host non dichiarato e senza header CORS | **bloccata** ✓ |
| **Anthropic** senza chiave | **401** → risposta ricevuta, CORS passata |
| **OpenAI** senza chiave | **401** → risposta ricevuta, CORS passata |
| `chrome.sidePanel.open()` da `chrome.commands` | aperto ✓ |

Le ultime tre righe sono quelle che contano. Anthropic e OpenAI **bloccano** le chiamate dal
browser (è il motivo per cui esiste `dangerouslyAllowBrowser`): un 401 da lì prova che dal
service worker con `host_permissions` la richiesta va e torna. E il controllo bloccato prova
che a farle passare sono i permessi, non una CORS permissiva dell'altro capo.

> **Un controllo mal scelto non è un controllo.** Il primo tentativo usava `api.github.com`,
> che manda `Access-Control-Allow-Origin: *`: passava sempre, e avrebbe fatto dichiarare S1
> verde per il motivo sbagliato. Il controllo deve essere un host che *senza* permesso
> fallisce davvero.

**Conseguenza**: nessun proxy, per nessuno dei cinque provider. La spec regge com'è.

> **Trovato durante F0 (2026-09-23)** — Chrome 153 **ignora `--load-extension`** da riga di
> comando (misura anti-malware): un'estensione unpacked si carica solo a mano da
> `chrome://extensions`, o con un binario Chrome for Testing / Chromium di Playwright.
> Conseguenza su **T5**: i test e2e devono girare sul Chromium che Playwright si porta dietro,
> non sul Chrome di sistema. Da confermare quando si scrive T5 — se non reggesse, il
> riempimento si collauda a mano sulle tre fixture e la copertura e2e si ridimensiona.

### F1 — v0 senza AI ✅ **codice completo il 2026-09-23** (resta il collaudo sul campo)

Da qui in poi il codice si tiene. Due binari indipendenti, si incontrano in T7.

- [x] **T1 — Scheletro MV3** ✅ 2026-09-23 (Vite + @crxjs, manifest, side panel, `pnpm build` verde)

  - Acceptance: `pnpm dev`, l'estensione si carica, il pannello si apre.
  - Verify: `pnpm build` verde + caricamento a mano in Chrome.
  - Files: `manifest.config.ts`, `vite.config.ts`, `package.json`, `src/sidepanel/index.html`

- [x] **T2 — Le tre fixture** ✅ 2026-09-23 (`plain.html`, `react.html`, `legacy.html`)
  - Sono il banco di prova di tutto il riempimento: vengono prima di ciò che testano.
  - Acceptance: tre pagine servite in locale, ognuna col suo tipo di trappola.
  - Verify: aperte a mano, si compilano a mano.
  - Files: `tests/fixtures/*.html`

*Da qui T3-T4 e T5-T6 procedono in parallelo.*

- [x] **T3 — Segmentazione** ✅ 2026-09-23 (split righe/tab, parsing `Chiave: valore`)
  - Acceptance: da un blob misto escono coppie etichetta/valore plausibili.
  - Verify: `pnpm test` — casi con tab, con `:`, con righe sporche.
  - Files: `src/extract/segment.ts` + test

- [x] **T4 — Pattern e checksum** ✅ 2026-09-23 (email, telefono, CAP, data, importo, CF, IBAN, P.IVA)
  - Acceptance: ogni pattern ha positivi, negativi e **un falso amico**; CF/IBAN/P.IVA
    validano il checksum e rifiutano una cifra alterata.
  - Verify: `pnpm test`, copertura di `extract/` sopra l'80%.
  - Files: `src/extract/patterns.ts`, `src/extract/validate.ts` + test

- [x] **T5 — Riempimento robusto** ✅ 2026-09-23 (native setter + `input`/`change` con `bubbles`)
  - È il pezzo tecnicamente più insidioso del progetto: React è il caso che rompe
    l'assegnazione ingenua di `.value`.
  - Acceptance: riempie su tutte e tre le fixture, **verificato dopo il blur**.
  - Verify: `pnpm test:e2e`.
  - Files: `src/fill/riempi.ts`, `src/content/index.ts` + test e2e

- [x] **T6 — Campo attivo** ✅ 2026-09-23 (il content script sa qual è l'ultimo campo toccato)
  - Insidia: cliccare una chip nel pannello **non** deve far perdere il fuoco al campo.
  - Acceptance: clicco un campo, clicco una chip, il valore va in quel campo.
  - Verify: e2e sulle tre fixture.
  - Files: `src/content/campo-attivo.ts` + test

- [x] **T7 — Stato nel service worker** ✅ 2026-09-23 (le chip sopravvivono al cambio tab — deciso)
  - Acceptance: chip create su un tab, il pannello le mostra ancora dopo essere passati
    a un altro tab e tornati.
  - Verify: e2e con due tab.
  - Files: `src/background/stato.ts`, `src/shared/messaggi.ts`

- [x] **T8 — Il pannello** ✅ 2026-09-23 (lista chip, editing di etichetta e valore, click per riempire)
  - Acceptance: il giro completo funziona — seleziono testo, premo la scorciatoia, vedo le
    chip, clicco campo + chip, il valore entra.
  - Verify: a mano sulle tre fixture + e2e del giro completo.
  - Files: `src/sidepanel/*`

**Checkpoint F1 — e qui lo usi davvero.** Prima di aprire F2: compila **tre form veri**
incontrati per caso, con documenti veri. Se a questo punto non ti fa risparmiare tempo,
l'AI non lo salverà: meglio saperlo prima di scrivere cinque adattatori. Criterio di successo
#3 della spec (form da 8 campi in meno di 30 secondi) si misura **qui**, non alla fine.

### F2 — Ramo AI

- [ ] **T9 — Opzioni: provider e chiavi** (`chrome.storage.local`, una chiave per provider)
  - Acceptance: salvo una chiave, la rileggo, dopo il salvataggio si vede solo `sk-...••••`.
  - Verify: a mano + un test che la chiave non finisca mai in un log.
  - Files: `src/options/*`, `src/shared/chiavi.ts`

- [ ] **T10 — Interfaccia Provider + schema + prompt** (lo scheletro prima delle tre teste)
  - Acceptance: uno schema JSON del record canonico, un prompt di estrazione, condivisi.
  - Verify: `pnpm typecheck`.
  - Files: `src/ai/provider/tipi.ts`, `src/ai/provider/schema.ts`, `src/ai/estrai.ts`

- [ ] **T11 — Adattatore Anthropic** (Claude) — il primo, fa da modello agli altri due
- [ ] **T12 — Adattatore OpenAI** (OpenAI, Grok, Muse: base URL diversa, stesso codice)
- [ ] **T13 — Adattatore Google** (Gemini)
  - Acceptance (per ciascuno): dallo stesso documento di prova esce lo **stesso** record
    canonico. Differenze di qualità ammesse, differenze di forma no.
  - Verify: test di forma della richiesta in CI (endpoint, header, schema) + **una** chiamata
    vera a mano per provider, annotata. Le chiamate vere costano: non vanno in CI.
  - Files: `src/ai/provider/<nome>.ts` + test

- [ ] **T14 — Ingresso immagini e file** (drag nel pannello → provider multimodale)
  - Acceptance: una scansione produce un record canonico utilizzabile in meno di 10 secondi.
  - Verify: a mano, con una scansione vera storta — non un PDF pulito.
  - Files: `src/sidepanel/drop.ts`, `src/ai/estrai.ts`

- [ ] **T15 — L'avviso che nomina il destinatario**
  - Acceptance: prima di ogni chiamata il pannello mostra cosa esce **e verso quale provider**,
    e aspetta conferma.
  - Verify: leggendo il traffico di rete dell'estensione, non il codice (criterio #5).
  - Files: `src/sidepanel/conferma.ts`

- [ ] **T16 — Misura del bundle**
  - Acceptance: si sa quanto pesano cinque SDK in un service worker MV3.
  - Verify: `pnpm build` + dimensione del chunk del service worker.
  - Se fuori scala: si ripiega su adattatori a `fetch` puro (tre formati, poco codice).

**Checkpoint F2**: i cinque provider danno lo stesso record; nessun dato esce senza conferma.

### F3 — Collaudo reale

- [ ] **T17 — Skill `collaudo-reale`** sulle quattro classi di difetto che i test verdi non vedono.
  Qui i sospetti sono già noti: il documento storto, il form dentro un iframe, il campo che si
  resetta al blur, il provider che risponde con prosa invece che con JSON.
- [ ] **T18 — ADR** delle tre decisioni che meritano una traccia: niente OCR, tre adattatori e
  non cinque, stato nel service worker.
- [ ] **T19 — README** e `CLAUDE.md` del repo.

## Rischi

| Rischio | Quando lo scopro | Ripiego |
|---|---|---|
| La CORS blocca il service worker | **F0/S1**, prima di tutto | proxy sul VPS: cambia la spec, non il v0 |
| Il side panel non si apre da scorciatoia | **F0/S2** | si apre dall'icona: UX peggiore, architettura uguale |
| React rifiuta il valore riempito | **T5**, la fixture esiste da T2 | è il motivo per cui la fixture viene prima del codice |
| Cinque SDK pesano troppo | **T16** | adattatori a `fetch`: tre formati, poco codice |
| Le regex estraggono poco dai documenti veri | **checkpoint F1**, non alla fine | è esattamente il caso che il ramo AI copre |
| Lo strumento non serve davvero | **checkpoint F1** | ci si ferma lì avendo speso una fase, non quattro |

## Cosa non è in questo piano

Mappatura automatica (v1), memoria per form (v2), iframe cross-origin, app native macOS.
Stanno in `SPEC.md` § Evoluzione.
