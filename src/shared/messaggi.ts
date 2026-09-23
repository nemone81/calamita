import type { Slot } from './tipi.js'

/**
 * L'unico contratto fra pannello, service worker e pagina.
 * Tutti i messaggi passano da qui: un `switch` su `tipo` altrove è un errore.
 */
export type Messaggio =
  // pagina → service worker
  | { tipo: 'testo-selezionato'; testo: string }
  | { tipo: 'campo-attivo-cambiato'; descrizione: string | null }
  // pannello → service worker
  | { tipo: 'leggi-stato' }
  | { tipo: 'aggiungi-testo'; testo: string }
  | { tipo: 'riempi-con'; slotId: string }
  | { tipo: 'modifica-slot'; slotId: string; etichetta?: string; valore?: string }
  | { tipo: 'elimina-slot'; slotId: string }
  | { tipo: 'svuota' }
  // service worker → pagina
  | { tipo: 'riempi-campo-attivo'; valore: string }
  // service worker → pannello (broadcast)
  | { tipo: 'stato-cambiato'; stato: Stato }

export type Stato = {
  slot: Slot[]
  /** cosa verrà riempito al prossimo clic su una chip; null se nessun campo è stato toccato */
  campoAttivo: string | null
  ultimoEsito: { ok: boolean; testo: string } | null
}

export const STATO_VUOTO: Stato = { slot: [], campoAttivo: null, ultimoEsito: null }
