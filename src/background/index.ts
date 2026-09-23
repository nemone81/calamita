import { abbina, type Campo } from '../mappa/abbina.js'
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
      // `mittente.frameId` è l'unico modo di sapere DOVE sta il campo: senza,
      // il riempimento va a tutti i frame e risponde il primo, che su una pagina
      // con reCAPTCHA è un iframe senza campi
      stato.impostaCampoAttivo(msg.descrizione, mittente.frameId ?? 0).then(rispondi)
      return true

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
    const esito = await chrome.tabs.sendMessage(
      tab.id,
      { tipo: 'riempi-campo-attivo', valore: slot.valore },
      { frameId: s.frameCampoAttivo ?? 0 },
    )
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
      const esito = await chrome.tabs.sendMessage(
        tab.id,
        { tipo: 'riempi-campo-attivo', valore: slot.valore },
        { frameId: s.frameCampoAttivo ?? 0 },
      )
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

  const campi = await scansionaOgniFrame(tab.id)
  if (campi === null) {
    await stato.impostaEsito(false, 'questa pagina non è raggiungibile: ricaricala')
    return { righe: [], avanzate: [] }
  }
  if (!campi.length) {
    await stato.impostaEsito(false, 'nessun campo di testo trovato in questa pagina')
    return { righe: [], avanzate: [] }
  }

  const scelte = abbina(s.slot, campi)
  if (!scelte.length) {
    // distinguere i due casi conta: "non ho trovato campi" e "non so dove mettere
    // queste chip" si risolvono in modi opposti
    await stato.impostaEsito(false,
      `${campi.length} campi trovati, ma nessuno abbinabile a queste chip`)
  }
  const abbinati = new Set(scelte.map((a) => a.slotId))

  return {
    righe: scelte.flatMap((a) => {
      const slot = s.slot.find((x) => x.id === a.slotId)
      const campo = campi.find((c) => c.indice === a.indiceCampo)
      if (!slot || !campo) return []
      return [{
        slotId: slot.id, etichetta: slot.etichetta, valore: slot.valore,
        indice: campo.indiceLocale, frameId: campo.frameId,
        campo: campo.etichetta ?? campo.name ?? `campo ${a.indiceCampo + 1}`,
        motivo: a.motivo, punteggio: a.punteggio,
      }]
    }),
    avanzate: s.slot.filter((x) => !abbinati.has(x.id))
      .map((x) => ({ slotId: x.id, etichetta: x.etichetta })),
  }
}

async function applica(riempimenti: { indice: number; frameId: number; valore: string }[]) {
  const tab = await tabAttivo()
  if (!tab?.id) return stato.impostaEsito(false, 'nessuna scheda attiva')

  // ogni frame riempie i propri campi: gli indici valgono solo dentro un frame
  const perFrame = new Map<number, { indice: number; valore: string }[]>()
  for (const r of riempimenti) {
    const lista = perFrame.get(r.frameId) ?? []
    lista.push({ indice: r.indice, valore: r.valore })
    perFrame.set(r.frameId, lista)
  }

  let fatti = 0, falliti = 0
  for (const [frameId, lista] of perFrame) {
    try {
      const r = await chrome.tabs.sendMessage(
        tab.id, { tipo: 'riempi-molti', riempimenti: lista }, { frameId })
      fatti += r?.fatti?.length ?? 0
      falliti += r?.falliti?.length ?? 0
    } catch {
      falliti += lista.length
    }
  }

  if (!riempimenti.length) return stato.impostaEsito(false, 'nessuna riga da riempire')
  if (!fatti) return stato.impostaEsito(false, 'questa pagina non è raggiungibile: ricaricala')
  return stato.impostaEsito(true,
    falliti ? `${fatti} campi riempiti, ${falliti} no` : `${fatti} campi riempiti`)
}

/**
 * Un form sta spesso dentro un iframe, e gli indici dei campi valgono solo dentro
 * il frame che li ha prodotti: vanno tenuti insieme al frame di provenienza.
 * Si rinumerano globalmente per l'abbinamento e si riconvertono al riempimento.
 */
async function scansionaOgniFrame(tabId: number): Promise<(Campo & { frameId: number; indiceLocale: number })[] | null> {
  let frames: chrome.webNavigation.GetAllFrameResultDetails[] | null = null
  try {
    frames = await chrome.webNavigation.getAllFrames({ tabId })
  } catch { /* niente permesso o pagina speciale: si prova col solo frame principale */ }

  // se webNavigation non risponde o filtra via tutto, resta il frame principale:
  // una lista vuota farebbe saltare il ciclo e sembrare la pagina irraggiungibile
  const trovati = frames?.filter((f) => f.url?.startsWith('http')).map((f) => f.frameId) ?? []
  const ids = trovati.length ? trovati : [0]
  const tutti: (Campo & { frameId: number; indiceLocale: number })[] = []
  let raggiunto = false

  for (const frameId of ids) {
    let campi: Campo[]
    try {
      const r = await chrome.tabs.sendMessage(tabId, { tipo: 'scansiona-campi' }, { frameId })
      campi = r?.campi ?? []
    } catch {
      // frame senza content script: lo si mette e si riprova, una volta sola
      try {
        const files = chrome.runtime.getManifest().content_scripts?.[0]?.js
        if (!files?.length) continue
        await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files })
        const r = await chrome.tabs.sendMessage(tabId, { tipo: 'scansiona-campi' }, { frameId })
        campi = r?.campi ?? []
      } catch { continue }
    }
    raggiunto = true
    for (const c of campi) {
      tutti.push({ ...c, frameId, indiceLocale: c.indice, indice: tutti.length })
    }
  }

  return raggiunto ? tutti : null
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
