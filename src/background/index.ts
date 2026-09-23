import { abbina } from '../mappa/abbina.js'
import { segmenta } from '../extract/segment.js'
import { tipizza } from '../extract/tipizza.js'
import type { Messaggio } from '../shared/messaggi.js'
import * as stato from './stato.js'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

/**
 * Chrome inietta i content script solo nelle pagine caricate DOPO l'installazione.
 * Sui tab già aperti non c'è nessuno che ascolta, e durante lo sviluppo — dove
 * l'estensione si ricarica di continuo — è la regola, non l'eccezione.
 * Quindi al primo avvio li si mette a mano nei tab che esistono già.
 */
async function iniettaNeiTabGiaAperti(): Promise<void> {
  const script = chrome.runtime.getManifest().content_scripts?.[0]
  const files = script?.js
  if (!files?.length) return

  for (const tab of await chrome.tabs.query({})) {
    // chrome://, il Web Store e le pagine dell'estensione stessa sono off limits
    if (!tab.id || !tab.url?.startsWith('http')) continue
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files })
    } catch {
      // già presente, oppure pagina non iniettabile: in entrambi i casi non è un guasto
    }
  }
}

chrome.runtime.onInstalled.addListener(iniettaNeiTabGiaAperti)
chrome.runtime.onStartup.addListener(iniettaNeiTabGiaAperti)

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

    case 'proponi-abbinamenti':
      proponi().then(rispondi); return true

    case 'applica-abbinamenti':
      applica(msg.riempimenti).then(rispondi); return true

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
    // ultimo tentativo: forse il content script non c'è (tab aperto prima
    // dell'installazione). Lo si mette e si riprova una volta sola.
    try {
      const files = chrome.runtime.getManifest().content_scripts?.[0]?.js
      if (!files?.length) throw new Error('niente content script nel manifest')
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files })
      const esito = await chrome.tabs.sendMessage(tab.id, {
        tipo: 'riempi-campo-attivo', valore: slot.valore,
      })
      return esito?.ok
        ? stato.impostaEsito(true, `${slot.etichetta} → ${esito.dove}`)
        : stato.impostaEsito(false, esito?.motivo ?? 'clicca prima un campo del form')
    } catch {
      return stato.impostaEsito(false, 'questa pagina non è raggiungibile: ricaricala')
    }
  }
}


// ---------- abbinamento automatico ----------

/** Chiede i campi alla pagina, li abbina alle chip e restituisce una PROPOSTA. */
async function proponi() {
  const s = await stato.leggi()
  if (!s.slot.length) return { righe: [], avanzate: [] }

  const tab = await tabAttivo()
  if (!tab?.id) return { righe: [], avanzate: [] }

  let campi
  try {
    const r = await parlaAllaPagina(tab.id, { tipo: 'scansiona-campi' })
    campi = r?.campi ?? []
  } catch {
    await stato.impostaEsito(false, 'questa pagina non è raggiungibile: ricaricala')
    return { righe: [], avanzate: [] }
  }

  const scelte = abbina(s.slot, campi)
  const abbinati = new Set(scelte.map((a) => a.slotId))

  return {
    righe: scelte.flatMap((a) => {
      const slot = s.slot.find((x) => x.id === a.slotId)
      const campo = campi.find((c: { indice: number }) => c.indice === a.indiceCampo)
      if (!slot || !campo) return []
      return [{
        slotId: slot.id, etichetta: slot.etichetta, valore: slot.valore,
        indice: a.indiceCampo, campo: campo.etichetta ?? campo.name ?? `campo ${a.indiceCampo + 1}`,
        motivo: a.motivo, punteggio: a.punteggio,
      }]
    }),
    avanzate: s.slot.filter((x) => !abbinati.has(x.id))
      .map((x) => ({ slotId: x.id, etichetta: x.etichetta })),
  }
}

async function applica(riempimenti: { indice: number; valore: string }[]) {
  const tab = await tabAttivo()
  if (!tab?.id) return stato.impostaEsito(false, 'nessuna scheda attiva')

  try {
    const r = await parlaAllaPagina(tab.id, { tipo: 'riempi-molti', riempimenti })
    const fatti = r?.fatti?.length ?? 0
    const falliti = r?.falliti?.length ?? 0
    return stato.impostaEsito(
      fatti > 0,
      falliti ? `${fatti} campi riempiti, ${falliti} no` : `${fatti} campi riempiti`,
    )
  } catch {
    return stato.impostaEsito(false, 'questa pagina non è raggiungibile: ricaricala')
  }
}

const tabAttivo = async () =>
  (await chrome.tabs.query({ active: true, currentWindow: true }))[0]

/**
 * Parla col content script, mettendocelo se non c'è. Succede su ogni tab aperto
 * prima dell'installazione — cioè quasi sempre, durante lo sviluppo.
 */
async function parlaAllaPagina(tabId: number, msg: unknown): Promise<any> {
  try {
    return await chrome.tabs.sendMessage(tabId, msg)
  } catch {
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js
    if (!files?.length) throw new Error('niente content script nel manifest')
    await chrome.scripting.executeScript({ target: { tabId }, files })
    return await chrome.tabs.sendMessage(tabId, msg)
  }
}
