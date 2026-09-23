import type { Slot } from '../../shared/tipi.js'

export type IdProvider = 'claude' | 'openai' | 'gemini' | 'grok' | 'muse'

/** Cosa mandiamo al modello: testo incollato oppure l'immagine di una scansione. */
export type Ingresso =
  | { tipo: 'testo'; testo: string }
  | { tipo: 'immagine'; base64: string; mime: string }

export type Provider = {
  id: IdProvider
  nome: string
  /** l'host che deve stare in `host_permissions`: serve anche a spiegarlo all'utente */
  host: string
  modelloDefault: string
  supportaImmagini: boolean
  /** dove l'utente va a prendersi la chiave */
  urlChiavi: string
  estrai(ingresso: Ingresso, chiave: string, modello?: string): Promise<Slot[]>
  /** elenca i modelli dell'account, dove l'API lo permette: meglio che indovinarli */
  elencaModelli?(chiave: string): Promise<string[]>
}
