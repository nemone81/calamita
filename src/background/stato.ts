import { STATO_VUOTO, type Stato } from '../shared/messaggi.js'
import type { Slot } from '../shared/tipi.js'

/**
 * Lo stato vive QUI, non nel pannello: il documento sta su un tab e il form su un
 * altro, e le chip devono sopravvivere al passaggio. Il pannello lo rispecchia.
 *
 * `storage.session` perché il service worker viene terminato e riavviato di
 * continuo: una variabile di modulo sparirebbe senza preavviso.
 */

const CHIAVE = 'stato'

export async function leggi(): Promise<Stato> {
  const d = await chrome.storage.session.get(CHIAVE)
  return (d[CHIAVE] as Stato | undefined) ?? STATO_VUOTO
}

async function scrivi(s: Stato): Promise<Stato> {
  await chrome.storage.session.set({ [CHIAVE]: s })
  // il pannello può non essere aperto: un errore qui è normale, non un guasto
  chrome.runtime.sendMessage({ tipo: 'stato-cambiato', stato: s }).catch(() => {})
  return s
}

export const aggiungiSlot = async (nuovi: Slot[]): Promise<Stato> => {
  const s = await leggi()
  // niente doppioni: lo stesso valore incollato due volte è una chip sola
  const visti = new Set(s.slot.map((x) => `${x.tipo}\u0000${x.valore}`))
  const daAggiungere = nuovi.filter((x) => !visti.has(`${x.tipo}\u0000${x.valore}`))
  return scrivi({ ...s, slot: [...s.slot, ...daAggiungere] })
}

export const modificaSlot = async (
  id: string, campi: { etichetta?: string; valore?: string },
): Promise<Stato> => {
  const s = await leggi()
  return scrivi({
    ...s,
    slot: s.slot.map((x) => x.id === id
      // una correzione a mano è la verità: confidenza al massimo, origine dichiarata
      ? { ...x, ...campi, origine: 'manuale' as const, confidenza: 1 }
      : x),
  })
}

export const eliminaSlot = async (id: string): Promise<Stato> => {
  const s = await leggi()
  return scrivi({ ...s, slot: s.slot.filter((x) => x.id !== id) })
}

export const svuota = (): Promise<Stato> => scrivi(STATO_VUOTO)

export const impostaCampoAttivo = async (
  descrizione: string | null, frameId: number | null,
): Promise<Stato> => {
  const s = await leggi()
  if (s.campoAttivo === descrizione && s.frameCampoAttivo === frameId) return s
  return scrivi({ ...s, campoAttivo: descrizione, frameCampoAttivo: frameId })
}

export const impostaEsito = async (ok: boolean, testo: string): Promise<Stato> => {
  const s = await leggi()
  return scrivi({ ...s, ultimoEsito: { ok, testo } })
}
