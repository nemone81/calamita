import { STATO_VUOTO, type AnteprimaAI, type IngressoAI, type Messaggio, type Proposta, type Stato } from '../shared/messaggi.js'
import type { Slot } from '../shared/tipi.js'

const el = {
  incollaQui: document.getElementById('incollaQui') as HTMLTextAreaElement,
  chip: document.getElementById('chip') as HTMLUListElement,
  campo: document.getElementById('campo') as HTMLParagraphElement,
  esito: document.getElementById('esito') as HTMLParagraphElement,
  vuoto: document.getElementById('vuoto') as HTMLParagraphElement,
  svuota: document.getElementById('svuota') as HTMLButtonElement,
  conAI: document.getElementById('conAI') as HTMLButtonElement,
  opzioni: document.getElementById('opzioni') as HTMLButtonElement,
  conferma: document.getElementById('conferma') as HTMLDivElement,
  cosa: document.getElementById('cosa') as HTMLElement,
  chi: document.getElementById('chi') as HTMLElement,
  assaggio: document.getElementById('assaggio') as HTMLPreElement,
  vai: document.getElementById('vai') as HTMLButtonElement,
  annulla: document.getElementById('annulla') as HTMLButtonElement,
  zona: document.getElementById('zona') as HTMLDivElement,
  riempiTutto: document.getElementById('riempiTutto') as HTMLButtonElement,
  proposta: document.getElementById('proposta') as HTMLDivElement,
  quanti: document.getElementById('quanti') as HTMLElement,
  righe: document.getElementById('righe') as HTMLUListElement,
  avanzate: document.getElementById('avanzate') as HTMLParagraphElement,
  applica: document.getElementById('applica') as HTMLButtonElement,
  scarta: document.getElementById('scarta') as HTMLButtonElement,
}

let stato: Stato = STATO_VUOTO

const manda = (m: Messaggio) => chrome.runtime.sendMessage(m) as Promise<Stato>

/** Sotto questa soglia la chip si mostra tratteggiata: il valore è un'ipotesi, non un dato. */
const SOGLIA_INCERTEZZA = 0.6

function disegna() {
  el.vuoto.hidden = stato.slot.length > 0
  el.chip.replaceChildren(...stato.slot.map(riga))

  el.campo.innerHTML = stato.campoAttivo
    ? `Il prossimo valore va in <b>${fuga(stato.campoAttivo)}</b>`
    : 'Clicca un campo del form, poi una chip.'

  if (stato.ultimoEsito) {
    el.esito.hidden = false
    el.esito.textContent = stato.ultimoEsito.testo
    el.esito.className = 'esito ' + (stato.ultimoEsito.ok ? 'ok' : 'ko')
  } else {
    el.esito.hidden = true
  }
}

function riga(s: Slot): HTMLLIElement {
  const li = document.createElement('li')
  if (s.confidenza < SOGLIA_INCERTEZZA) li.classList.add('incerta')

  const met = document.createElement('div')
  met.className = 'met'

  const et = document.createElement('span')
  et.className = 'et'
  et.textContent = s.etichetta
  et.contentEditable = 'true'
  et.addEventListener('blur', () => aggiorna(s, { etichetta: et.textContent ?? '' }))

  const va = document.createElement('span')
  va.className = 'va'
  va.textContent = s.valore
  va.title = s.valore
  va.contentEditable = 'true'
  va.addEventListener('blur', () => aggiorna(s, { valore: va.textContent ?? '' }))

  // Invio conferma la correzione invece di andare a capo dentro la chip
  for (const campo of [et, va]) {
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() }
    })
  }

  met.append(et, va)

  const usa = document.createElement('button')
  usa.className = 'usa'
  usa.textContent = 'Usa'
  usa.addEventListener('click', async () => { stato = await manda({ tipo: 'riempi-con', slotId: s.id }); disegna() })

  const via = document.createElement('button')
  via.className = 'via'
  via.textContent = '×'
  via.title = 'Togli questa chip'
  via.addEventListener('click', async () => { stato = await manda({ tipo: 'elimina-slot', slotId: s.id }); disegna() })

  li.append(met, usa, via)
  return li
}

async function aggiorna(s: Slot, campi: { etichetta?: string; valore?: string }) {
  const et = campi.etichetta?.trim()
  const va = campi.valore?.trim()
  if ((et ?? s.etichetta) === s.etichetta && (va ?? s.valore) === s.valore) return
  stato = await manda({ tipo: 'modifica-slot', slotId: s.id, etichetta: et, valore: va })
  disegna()
}

el.incollaQui.addEventListener('paste', (e) => {
  const testo = e.clipboardData?.getData('text') ?? ''
  if (!testo.trim()) return
  // NON si chiama preventDefault: il testo deve restare nella textarea, perché
  // «Estrai con AI» legge da lì. Prima era il contrario e quel bottone non aveva
  // mai niente da mandare.
  manda({ tipo: 'aggiungi-testo', testo }).then((s) => { stato = s; disegna() })
})

el.svuota.addEventListener('click', async () => { stato = await manda({ tipo: 'svuota' }); disegna() })

// il service worker avvisa quando lo stato cambia da altrove (scorciatoia, altro tab)
chrome.runtime.onMessage.addListener((m: Messaggio) => {
  if (m.tipo === 'stato-cambiato') { stato = m.stato; disegna() }
})

manda({ tipo: 'leggi-stato' }).then((s) => { stato = s; disegna() })

// ---------- riempimento automatico, sempre preceduto da un'anteprima ----------

/** Sotto questa soglia la riga si segnala in arancione: l'abbinamento è un'ipotesi. */
const SOGLIA_DUBBIA = 0.8

let proposta: Proposta | null = null
const escluse = new Set<string>()

el.riempiTutto.addEventListener('click', async () => {
  el.riempiTutto.disabled = true
  proposta = await (chrome.runtime.sendMessage({ tipo: 'proponi-abbinamenti' }) as Promise<Proposta>)
  el.riempiTutto.disabled = false
  escluse.clear()

  if (!proposta?.righe.length) {
    stato = { ...stato, ultimoEsito: { ok: false, testo:
      stato.slot.length ? 'nessun campo abbinabile in questa pagina' : 'prima servono delle chip' } }
    disegna()
    return
  }
  disegnaProposta()
})

function disegnaProposta() {
  if (!proposta) return
  const attive = proposta.righe.filter((r) => !escluse.has(r.slotId))
  el.quanti.textContent = attive.length === 1
    ? 'Un campo da riempire:'
    : `${attive.length} campi da riempire:`

  el.righe.replaceChildren(...proposta.righe.map((r) => {
    const li = document.createElement('li')
    if (escluse.has(r.slotId)) li.classList.add('fuori')
    if (r.punteggio < SOGLIA_DUBBIA) li.classList.add('dubbia')

    const val = document.createElement('span')
    val.className = 'val'; val.textContent = r.valore; val.title = `${r.etichetta}: ${r.valore}`

    const fr = document.createElement('span'); fr.className = 'freccia'; fr.textContent = '→'

    const dest = document.createElement('span')
    dest.className = 'dest'; dest.textContent = r.campo

    const perche = document.createElement('span')
    perche.className = 'perche'; perche.textContent = r.motivo; perche.title = r.motivo

    const tolgi = document.createElement('button')
    tolgi.className = 'tolgi'; tolgi.textContent = escluse.has(r.slotId) ? '+' : '×'
    tolgi.title = escluse.has(r.slotId) ? 'rimetti' : 'togli questa riga'
    tolgi.addEventListener('click', () => {
      escluse.has(r.slotId) ? escluse.delete(r.slotId) : escluse.add(r.slotId)
      disegnaProposta()
    })

    li.append(val, fr, dest, perche, tolgi)
    return li
  }))

  // le chip senza un campo restano da piazzare a mano: meglio dirlo che tacerlo
  el.avanzate.hidden = !proposta.avanzate.length
  el.avanzate.textContent = proposta.avanzate.length
    ? `Senza un campo: ${proposta.avanzate.map((a) => a.etichetta).join(', ')}. Restano da mettere a mano.`
    : ''

  el.applica.disabled = attive.length === 0
  el.proposta.hidden = false
}

el.applica.addEventListener('click', async () => {
  if (!proposta) return
  const riempimenti = proposta.righe
    .filter((r) => !escluse.has(r.slotId))
    .map((r) => ({ indice: r.indice, valore: r.valore }))
  el.proposta.hidden = true
  proposta = null
  stato = await manda({ tipo: 'applica-abbinamenti', riempimenti })
  disegna()
})

el.scarta.addEventListener('click', () => { proposta = null; el.proposta.hidden = true })

// ---------- T14 + T15: estrazione con AI, sempre preceduta da una conferma ----------

let inAttesa: IngressoAI | null = null

/**
 * Non si chiama il modello di nascosto. Si dice cosa esce e VERSO CHI, si mostra
 * un assaggio di ciò che parte, e si aspetta un clic.
 */
async function chiediConferma(ingresso: IngressoAI) {
  const a = await (chrome.runtime.sendMessage({ tipo: 'chiedi-anteprima-ai' }) as Promise<AnteprimaAI>)
  if (!a) {
    stato = { ...stato, ultimoEsito: { ok: false, testo: 'scegli un provider nelle opzioni' } }
    disegna()
    return
  }

  inAttesa = ingresso
  el.cosa.textContent = ingresso.tipo === 'testo'
    ? `${ingresso.testo.length} caratteri di testo`
    : `un'immagine (${Math.round(ingresso.base64.length * 0.75 / 1024)} KB)`
  el.chi.textContent = `${a.provider} · ${a.modello}`
  el.assaggio.textContent = ingresso.tipo === 'testo'
    ? ingresso.testo.slice(0, 400) + (ingresso.testo.length > 400 ? '\n…' : '')
    : '(il contenuto dell\u2019immagine)'
  el.conferma.hidden = false
}

el.vai.addEventListener('click', async () => {
  if (!inAttesa) return
  const ingresso = inAttesa
  inAttesa = null
  el.conferma.hidden = true
  el.vai.disabled = true
  stato = { ...stato, ultimoEsito: { ok: true, testo: 'estrazione in corso…' } }
  disegna()
  stato = await manda({ tipo: 'estrai-con-ai', ingresso })
  el.vai.disabled = false
  disegna()
})

el.annulla.addEventListener('click', () => { inAttesa = null; el.conferma.hidden = true })

el.conAI.addEventListener('click', () => {
  const testo = el.incollaQui.value.trim()
  if (!testo) {
    stato = { ...stato, ultimoEsito: { ok: false, testo: 'incolla prima del testo qui sopra' } }
    disegna()
    return
  }
  chiediConferma({ tipo: 'testo', testo })
})

el.opzioni.addEventListener('click', () => chrome.runtime.openOptionsPage())

// trascinamento di un'immagine o di un PDF: la scansione entra da qui
for (const evento of ['dragenter', 'dragover'] as const) {
  el.zona.addEventListener(evento, (e) => { e.preventDefault(); el.zona.classList.add('sopra') })
}
for (const evento of ['dragleave', 'drop'] as const) {
  el.zona.addEventListener(evento, () => el.zona.classList.remove('sopra'))
}
el.zona.addEventListener('drop', async (e) => {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!/^image\/|^application\/pdf$/.test(file.type)) {
    stato = { ...stato, ultimoEsito: { ok: false, testo: 'solo immagini o PDF' } }
    disegna()
    return
  }
  chiediConferma({ tipo: 'immagine', base64: await inBase64(file), mime: file.type })
})

const inBase64 = (f: File) => new Promise<string>((risolvi, rifiuta) => {
  const r = new FileReader()
  r.onload = () => risolvi(String(r.result).split(',')[1] ?? '')
  r.onerror = () => rifiuta(r.error)
  r.readAsDataURL(f)
})

const fuga = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
