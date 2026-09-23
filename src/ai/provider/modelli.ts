import type { IdProvider } from './tipi.js'

/**
 * Gli id dei modelli stanno TUTTI qui, in un posto solo, perché cambiano in fretta:
 * Muse Spark è passata da 1.1 a 1.3 in due mesi.
 *
 * I default sono un punto di partenza, non un dogma: dove l'API espone un elenco
 * (`elencaModelli`) la pagina delle opzioni lo carica e l'utente sceglie. Per
 * un'estrazione il modello economico basta quasi sempre.
 */
export const MODELLO_DEFAULT: Record<IdProvider, string> = {
  // verificati
  claude: 'claude-opus-5',
  gemini: 'gemini-3.8-flash',
  // da confermare col primo uso reale: l'elenco dell'account è la fonte vera
  openai: 'gpt-5',
  grok: 'grok-4',
  muse: 'muse-spark-1.3',
}

/** Alternative più economiche, dove le conosciamo. Un'estrazione non è un tema di filosofia. */
export const MODELLO_ECONOMICO: Partial<Record<IdProvider, string>> = {
  claude: 'claude-sonnet-5',
  gemini: 'gemini-3.5-flash-lite',
}
