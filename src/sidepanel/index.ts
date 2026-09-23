import { STATO_VUOTO, type Messaggio, type Stato } from '../shared/messaggi.js'
import type { Slot } from '../shared/tipi.js'

const el = {
  incollaQui: document.getElementById('incollaQui') as HTMLTextAreaElement,
  chip: document.getElementById('chip') as HTMLUListElement,
  campo: document.getElementById('campo') as HTMLParagraphElement,
  esito: document.getElementById('esito') as HTMLParagraphElement,
  vuoto: document.getElementById('vuoto') as HTMLParagraphElement,
  svuota: document.getElementById('svuota') as HTMLButtonElement,
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
  e.preventDefault()
  manda({ tipo: 'aggiungi-testo', testo }).then((s) => { stato = s; disegna() })
})

el.svuota.addEventListener('click', async () => { stato = await manda({ tipo: 'svuota' }); disegna() })

// il service worker avvisa quando lo stato cambia da altrove (scorciatoia, altro tab)
chrome.runtime.onMessage.addListener((m: Messaggio) => {
  if (m.tipo === 'stato-cambiato') { stato = m.stato; disegna() }
})

manda({ tipo: 'leggi-stato' }).then((s) => { stato = s; disegna() })

const fuga = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
