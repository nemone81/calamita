import { segmenta } from '../extract/segment.js'
import { tipizza } from '../extract/tipizza.js'
import type { Messaggio } from '../shared/messaggi.js'
import * as stato from './stato.js'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

/** Testo grezzo → chip. È il giro che rende utile tutto il resto. */
async function assorbi(testo: string) {
  const slot = segmenta(testo).map(tipizza).filter((s) => s.valore.trim())
  return stato.aggiungiSlot(slot)
}

chrome.commands.onCommand.addListener(async (comando, tab) => {
  if (comando !== 'apri-con-selezione' || !tab?.id) return

  // il pannello va aperto DENTRO il gestore del comando: più tardi Chrome non lo
  // considera più un gesto dell'utente e rifiuta
  const apertura = chrome.sidePanel.open({ windowId: tab.windowId })

  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? '',
    })
    const testo = (r?.result as string | undefined)?.trim()
    if (testo) await assorbi(testo)
  } catch {
    // pagine su cui non possiamo iniettare (chrome://, store): il pannello si apre
    // comunque e l'utente può incollare a mano
  }
  await apertura.catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: Messaggio, mittente, rispondi) => {
  switch (msg.tipo) {
    case 'leggi-stato':
      stato.leggi().then(rispondi); return true

    case 'aggiungi-testo':
      assorbi(msg.testo).then(rispondi); return true

    case 'testo-selezionato':
      assorbi(msg.testo).then(rispondi); return true

    case 'campo-attivo-cambiato':
      stato.impostaCampoAttivo(msg.descrizione).then(rispondi); return true

    case 'modifica-slot':
      stato.modificaSlot(msg.slotId, { etichetta: msg.etichetta, valore: msg.valore }).then(rispondi)
      return true

    case 'elimina-slot':
      stato.eliminaSlot(msg.slotId).then(rispondi); return true

    case 'svuota':
      stato.svuota().then(rispondi); return true

    // Gli SDK dei provider pesano ~950 KB: si caricano SOLO qui, alla prima
    // estrazione vera. Un service worker MV3 viene riavviato di continuo, e il
    // giro senza AI — che è il v0 — non deve pagarne il parsing.
    case 'chiedi-anteprima-ai':
      import('../ai/estrai.js')
        .then((m) => m.anteprima())
        .then((a) => rispondi(a ? { provider: a.provider.nome, modello: a.modello } : null))
      return true

    case 'estrai-con-ai':
      import('../ai/estrai.js').then((m) => m.estraiConAI(msg.ingresso)).then(async (e) => {
        if (!e.ok) return rispondi(await stato.impostaEsito(false, e.errore))
        await stato.aggiungiSlot(e.slot)
        rispondi(await stato.impostaEsito(true, `${e.slot.length} valori da ${e.provider}`))
      })
      return true

    case 'riempi-con':
      riempiNelTabAttivo(msg.slotId).then(rispondi); return true

    default:
      return false
  }
})

async function riempiNelTabAttivo(slotId: string) {
  const s = await stato.leggi()
  const slot = s.slot.find((x) => x.id === slotId)
  if (!slot) return stato.impostaEsito(false, 'chip non trovata')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return stato.impostaEsito(false, 'nessuna scheda attiva')

  try {
    const esito = await chrome.tabs.sendMessage(tab.id, {
      tipo: 'riempi-campo-attivo', valore: slot.valore,
    })
    return esito?.ok
      ? stato.impostaEsito(true, `${slot.etichetta} → ${esito.dove}`)
      : stato.impostaEsito(false, esito?.motivo ?? 'nessun campo selezionato')
  } catch {
    return stato.impostaEsito(false, 'la pagina non risponde: ricaricala')
  }
}
