import { build } from 'esbuild'
const r = await build({ entryPoints: ['src/mappa/abbina.ts'], bundle: true, format: 'esm', write: false, target: 'node20' })
const { abbina } = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'))

let n = 0
const chip = (etichetta, valore, tipo = 'testo', conf = 0.8) =>
  ({ id: `s${++n}`, tipo, autocomplete: null, etichetta, valore, origine: 'regex', confidenza: conf })
const campi = (...et) => et.map((etichetta, indice) =>
  ({ indice, autocomplete: null, name: null, id: null, etichetta, tipoInput: 'text', maxLength: -1, opzioni: [], giaPieno: false }))

// casi realistici. `atteso` = indice del campo giusto, null = deve restare non abbinata
const CASI = [
  { nome: 'Edenred / Sara (reale)',
    chip: [chip('Rag. Sociale','SARA ASSICURAZIONI S.P.A.'), chip('Partita IVA','00885091009','partita-iva',1),
           chip('Indirizzo','VIA PO 20 - 00198 - ROMA (RM)'), chip('PEC','sara@pec.it','email'), chip('Dipendenti','629')],
    campi: campi('Ragione sociale azienda interessata','Partita IVA','Indirizzo sede operativa (Via, N.,Comune, Provincia, Cap)',
                 'Contatto Referente Azienda interessata (nome, cognome)','Telefono Referente Azienda Interessata',
                 'Email Referente Azienda Interessata','Numero Dipendenti'),
    atteso: [0,1,2,5,6] },

  { nome: 'Anagrafica semplice',
    chip: [chip('Nome','Mario'), chip('Cognome','Rossi'), chip('Email','m@r.it','email'),
           chip('Telefono','3331234567','tel'), chip('CAP','00184','postal-code')],
    campi: campi('Nome','Cognome','Email','Telefono','CAP'),
    atteso: [0,1,2,3,4] },

  // --- da qui in poi i casi che mettono in crisi le parole chiave ---
  { nome: 'AMBIGUO: due recapiti telefonici',
    chip: [chip('Cellulare','3331234567','tel'), chip('Telefono fisso','0612345678','tel')],
    campi: campi('Telefono cellulare','Telefono abitazione'),
    atteso: [0,1] },

  { nome: 'AMBIGUO: due indirizzi',
    chip: [chip('Sede legale','VIA PO 20, ROMA'), chip('Sede operativa','VIA MILANO 3, TORINO')],
    campi: campi('Indirizzo sede legale','Indirizzo sede operativa'),
    atteso: [0,1] },

  { nome: 'AMBIGUO: due date',
    chip: [chip('Data di nascita','10/12/1985','data'), chip('Data di scadenza','31/12/2027','data')],
    campi: campi('Nato il','Valida fino al'),
    atteso: [0,1] },

  { nome: 'AMBIGUO: due email',
    chip: [chip('PEC','a@pec.it','email'), chip('Email ordinaria','b@mail.it','email')],
    campi: campi('Indirizzo PEC','Email di contatto'),
    atteso: [0,1] },

  { nome: 'AMBIGUO: due comuni',
    chip: [chip('Comune di nascita','Roma'), chip('Comune di residenza','Milano')],
    campi: campi('Luogo di nascita','Citta di residenza'),
    atteso: [0,1] },

  { nome: 'SINONIMI non nel vocabolario',
    chip: [chip('Denominazione','ACME SRL'), chip('Recapito','3331234567','tel'), chip('Domicilio fiscale','VIA PO 20')],
    campi: campi('Intestatario','Numero di telefono','Residenza fiscale'),
    atteso: [0,1,2] },

  { nome: 'RUMORE: chip che non devono entrare',
    chip: [chip('Note','nessun sinistro negli ultimi 5 anni'), chip('Protocollo','2026/00184'), chip('Email','m@r.it','email')],
    campi: campi('Email','Codice cliente'),
    atteso: [null,null,0] },
]

let giusti = 0, sbagliati = 0, mancati = 0, totale = 0
for (const c of CASI) {
  const res = abbina(c.chip, c.campi)
  const dove = Object.fromEntries(res.map(a => [a.slotId, a.indiceCampo]))
  const righe = []
  c.chip.forEach((s, i) => {
    totale++
    const ott = dove[s.id] ?? null, att = c.atteso[i]
    if (ott === att) { giusti++; righe.push(`  ok    ${s.etichetta}`) }
    else if (ott === null) { mancati++; righe.push(`  MANCA ${s.etichetta}  (doveva andare in "${c.campi[att].etichetta}")`) }
    else { sbagliati++; righe.push(`  SBAGL ${s.etichetta} → "${c.campi[ott].etichetta}" (atteso ${att === null ? 'nessuno' : '"'+c.campi[att].etichetta+'"'})`) }
  })
  const ko = righe.filter(r => !r.startsWith('  ok'))
  console.log(`\n${c.nome}${ko.length ? '' : '   tutto ok'}`)
  for (const r of ko) console.log(r)
}
console.log(`\n=== TOTALE ${totale} chip: ${giusti} giuste, ${sbagliati} sbagliate, ${mancati} mancate ===`)
console.log(`residuo su cui Jev potrebbe agire: ${sbagliati + mancati}/${totale} (${Math.round((sbagliati+mancati)/totale*100)}%)`)
