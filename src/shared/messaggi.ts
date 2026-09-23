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
  | { tipo: 'chiedi-anteprima-ai' }
  | { tipo: 'estrai-con-ai'; ingresso: IngressoAI }
  // service worker → pagina
  | { tipo: 'riempi-campo-attivo'; valore: string }
  // service worker → pannello (broadcast)
  | { tipo: 'stato-cambiato'; stato: Stato }

/** Copia locale del tipo di `ai/provider/tipi.ts`: il contratto dei messaggi non importa da lì. */
export type IngressoAI =
  | { tipo: 'testo'; testo: string }
  | { tipo: 'immagine'; base64: string; mime: string }

/** Cosa il pannello mostra PRIMA di chiamare: a chi vanno i dati, e quali. */
export type AnteprimaAI = { provider: string; modello: string } | null

export type Stato = {
  slot: Slot[]
  /** cosa verrà riempito al prossimo clic su una chip; null se nessun campo è stato toccato */
  campoAttivo: string | null
  ultimoEsito: { ok: boolean; testo: string } | null
}

export const STATO_VUOTO: Stato = { slot: [], campoAttivo: null, ultimoEsito: null }
