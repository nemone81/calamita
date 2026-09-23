/**
 * Collaudo su una pagina vera, con l'estensione davvero caricata.
 *
 *   pnpm collaudo <url> [file-con-i-dati]
 *
 * Non è un test di CI: tocca la rete e un sito di terzi, che possono cambiare
 * sotto i piedi. È lo strumento per il collaudo reale — quello che i test verdi
 * non vedono: il form dentro un iframe, il campo numerico che rifiuta in
 * silenzio, l'etichetta che esiste solo come placeholder.
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('uso: pnpm collaudo <url> [file-con-i-dati]')
  process.exit(1)
}

const DATI_ESEMPIO = `Rag. Sociale: SARA ASSICURAZIONI S.P.A.
Partita IVA: 00885091009 - Codice Fiscale: 00885091009
Indirizzo: VIA PO 20 - 00198 - ROMA (RM)
PEC: saraassicurazioni@sara.telecompost.it
Dipendenti : 629 (2026)`

const testo = process.argv[3] ? readFileSync(process.argv[3], 'utf8') : DATI_ESEMPIO
const EXT = path.resolve('dist')
const profilo = path.join(process.env.TMPDIR ?? '/tmp', 'incolla-collaudo-' + Date.now())

const ctx = await chromium.launchPersistentContext(profilo, {
  channel: 'chromium',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
})

const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker', { timeout: 15000 })
sw.on('pageerror', (e) => console.log('  [errore nel service worker]', String(e).slice(0, 200)))
const id = new URL(sw.url()).host

const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })

// quali frame hanno campi: la domanda che smaschera i form dentro un iframe
const frames = await sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const out = []
  for (const f of await chrome.webNavigation.getAllFrames({ tabId: tab.id })) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { tipo: 'scansiona-campi' }, { frameId: f.frameId })
      if (r?.campi?.length) out.push({ frameId: f.frameId, url: (f.url ?? '').slice(0, 60), campi: r.campi.length })
    } catch { /* frame senza content script */ }
  }
  return out
})
console.log('FRAME CON CAMPI');
for (const f of frames) console.log(`  frame ${f.frameId}: ${f.campi} campi · ${f.url}`)
if (!frames.length) console.log('  nessuno — l’estensione non vede campi in questa pagina')

// il side panel vero non è una scheda: la scheda attiva deve restare la pagina
const pannello = await ctx.newPage()
await pannello.goto(`chrome-extension://${id}/src/sidepanel/index.html`)
await page.bringToFront()

const r = await pannello.evaluate(async (testo) => {
  await chrome.runtime.sendMessage({ tipo: 'svuota' })
  const s = await chrome.runtime.sendMessage({ tipo: 'aggiungi-testo', testo })
  const p = await chrome.runtime.sendMessage({ tipo: 'proponi-abbinamenti' })
  const riempimenti = p.righe.map((x) => ({ indice: x.indice, frameId: x.frameId, valore: x.valore }))
  const fine = await chrome.runtime.sendMessage({ tipo: 'applica-abbinamenti', riempimenti })
  return { chip: s.slot, righe: p.righe, avanzate: p.avanzate, esito: fine.ultimoEsito }
}, testo)

console.log(`\nCHIP (${r.chip.length})`)
for (const c of r.chip) console.log(`  ${(c.etichetta + ':').padEnd(20)} ${c.valore.slice(0, 44)} [${c.tipo}]`)

console.log(`\nABBINAMENTI (${r.righe.length})`)
for (const x of r.righe) {
  console.log(`  ${x.campo.slice(0, 40).padEnd(42)} ← ${x.valore.slice(0, 28).padEnd(30)} ${x.punteggio.toFixed(2)} ${x.motivo}`)
}
if (r.avanzate.length) console.log('  senza campo:', r.avanzate.map((a) => a.etichetta).join(', '))

console.log('\nESITO:', r.esito?.testo)

// la prova che conta: cosa c'è DAVVERO nei campi, non cosa dice l'esito
console.log('\nVALORI NELLA PAGINA')
const finali = await page.evaluate(() =>
  [...document.querySelectorAll('input, textarea, select')]
    .filter((e) => 'value' in e && e.value)
    .map((e) => ({ nome: e.getAttribute('name') || e.id || e.type, valore: e.value })))
for (const f of finali) console.log(`  ${String(f.nome).slice(0, 44).padEnd(46)} = ${JSON.stringify(f.valore.slice(0, 40))}`)
if (!finali.length) console.log('  (nessun campo risulta compilato)')

await ctx.close()
