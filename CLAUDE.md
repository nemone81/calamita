# Incolla

Estensione Chrome MV3 che spezza i dati di un documento in **chip** cliccabili per compilare
form web senza il ciclo alt-tab → copia → alt-tab → incolla.

- Spec: `docs/SPEC.md` · Piano: `docs/PLAN.md` (copie anche in `~/Dropbox/Claude/tooling/chrome-extensions/incolla/`)
- Comandi: `pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm dev`

## Cose da sapere prima di toccare il codice

- **Il v0 non usa l'AI.** Regex locali + chip + riempimento. I 5 provider arrivano in F2, dopo
  un checkpoint che decide se lo strumento serve davvero.
- **`src/extract/` è puro**: niente `chrome.*` lì dentro, così i test girano senza browser.
- **I checksum non sono un vezzo**: undici cifre non sono una partita IVA e sedici caratteri
  non sono un codice fiscale. È ciò che separa un riconoscimento affidabile da un falso
  positivo che riempie il campo sbagliato.
- **Il riempimento passa dal native setter**, non da `.value`: gli input controllati React
  rifiutano l'assegnazione diretta. `tests/fixtures/react.html` esiste per dimostrarlo e ha
  una spia che mostra lo stato di React, non il DOM.
- **Chrome 153 ignora `--load-extension`**: l'estensione si carica a mano da
  `chrome://extensions`, i test e2e girano sul Chromium di Playwright.
- **La rete aziendale SARA rompe `pnpm install`** (ispezione TLS). Build e installazioni
  vogliono l'hotspot.
