# Incolla

Estensione Chrome che spezza i dati di un documento in **chip** cliccabili e li mette nei
campi di un form, senza il ciclo alt-tab → copia → alt-tab → incolla ripetuto per ogni campo.

## Come si usa

1. Seleziona il testo nel documento e premi **⌘⇧Y** (o incolla nel pannello laterale).
2. Il pannello mostra i valori riconosciuti come chip, con l'etichetta indovinata.
   Sono modificabili: clicca su etichetta o valore e correggi.
3. Clicca un campo del form — si contorna di blu — poi clicca **Usa** sulla chip.

Per una scansione o una foto, trascinala nel pannello e premi **Estrai con AI**.

## Cosa fa senza chiedere niente a nessuno

Riconosce in locale, senza rete: email, telefoni, CAP, date, importi, URL, **IBAN,
codici fiscali e partite IVA**. Gli ultimi tre sono validati col **checksum**, non solo
per forma: undici cifre qualsiasi non diventano una partita IVA.

## Estrazione con AI (facoltativa)

Serve per i documenti in prosa e per le scansioni, dove le regex non hanno appigli.
Cinque provider a scelta — Claude, OpenAI, Gemini, Grok, Muse — con **la tua chiave**,
che resta in questo browser. Non c'è un server nostro perché non ce n'è bisogno.

Prima di ogni chiamata il pannello mostra **cosa sta per uscire e verso chi**, e aspetta
un clic. Con cinque destinazioni possibili, sapere quale è parte del consenso.

Chiavi e modelli si impostano nelle opzioni dell'estensione. Il pulsante «Carica i modelli»
chiede l'elenco al tuo account invece di fidarsi di id scritti a memoria.

## Installazione

```bash
pnpm install
pnpm build
```

Poi `chrome://extensions` → Modalità sviluppatore → **Carica estensione non pacchettizzata**
→ scegli `dist/`.

> Chrome 153 ignora `--load-extension` da riga di comando: il caricamento è manuale.

## Sviluppo

```bash
pnpm dev         # build in watch
pnpm test        # 46 test unitari
pnpm test:e2e    # 15 test su Chromium (Playwright)
pnpm typecheck
```

`src/extract/` è puro — niente `chrome.*` — così i test girano senza browser.
`src/ai/` è l'**unico** punto che conosce le API dei provider, ed è un criterio verificabile:

```bash
grep -rlE 'anthropic|openai|googleapis|api\.x\.ai|api\.meta\.ai' src/ | grep -v '^src/ai/'
# non deve stampare niente
```

## Documentazione

- `docs/SPEC.md` — obiettivo, confini, criteri di successo
- `docs/PLAN.md` — fasi e task, con gli esiti misurati
- `docs/adr/` — le quattro decisioni che meritavano una traccia

## Limiti noti

- **Niente mappatura automatica**: sei tu a dire quale chip va in quale campo. Con form
  sempre diversi, indovinare sbaglierebbe spesso e il ripiego manuale servirebbe comunque.
  È il v1 (vedi `docs/SPEC.md` § Evoluzione).
- **iframe cross-origin** (i campi delle carte di credito) sono irraggiungibili.
- **App native macOS**: fuori portata, è un problema diverso.

## Collaudo su una pagina vera

```bash
pnpm build
pnpm collaudo https://esempio.it/modulo [dati.txt]
```

Carica l'estensione vera in un Chromium, apre la pagina, incolla i dati e riempie —
poi stampa **cosa c'è davvero nei campi**, non cosa dice l'esito. Mostra anche in quale
frame stanno i campi, che è ciò che smaschera i form dentro un iframe.

Non è un test di CI: tocca la rete e un sito di terzi. È lo strumento per i difetti che
una suite verde non vede.
