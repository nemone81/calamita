import { MODELLO_DEFAULT } from './modelli.js'
import type { IdProvider } from './tipi.js'

/**
 * Solo i metadati: nome, host, dove si prende la chiave. **Nessun import di SDK**,
 * perché questo file lo leggono la pagina delle opzioni e il pannello, che non
 * devono trascinarsi dietro un megabyte di librerie per mostrare cinque nomi.
 */
export type SchedaProvider = {
  id: IdProvider
  nome: string
  host: string
  urlChiavi: string
  modelloDefault: string
  supportaImmagini: boolean
  elencabile: boolean
}

export const REGISTRO: SchedaProvider[] = [
  { id: 'claude', nome: 'Claude', host: 'api.anthropic.com',
    urlChiavi: 'https://console.anthropic.com/settings/keys',
    modelloDefault: MODELLO_DEFAULT.claude, supportaImmagini: true, elencabile: true },
  { id: 'openai', nome: 'OpenAI', host: 'api.openai.com',
    urlChiavi: 'https://platform.openai.com/api-keys',
    modelloDefault: MODELLO_DEFAULT.openai, supportaImmagini: true, elencabile: true },
  { id: 'gemini', nome: 'Gemini', host: 'generativelanguage.googleapis.com',
    urlChiavi: 'https://aistudio.google.com/apikey',
    modelloDefault: MODELLO_DEFAULT.gemini, supportaImmagini: true, elencabile: true },
  { id: 'grok', nome: 'Grok', host: 'api.x.ai',
    urlChiavi: 'https://console.x.ai',
    modelloDefault: MODELLO_DEFAULT.grok, supportaImmagini: true, elencabile: true },
  { id: 'muse', nome: 'Muse', host: 'api.meta.ai',
    urlChiavi: 'https://developers.meta.ai',
    modelloDefault: MODELLO_DEFAULT.muse, supportaImmagini: true, elencabile: true },
]

export const scheda = (id: IdProvider): SchedaProvider =>
  REGISTRO.find((s) => s.id === id)!
