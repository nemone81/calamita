import type { Slot, TipoSlot } from '../../shared/tipi.js'
import { TIPI_AMMESSI } from './schema.js'

let n = 0
const ammesso = new Set<string>(TIPI_AMMESSI)

/**
 * Dal JSON del modello alle chip. Il modello può sbagliare lo schema anche quando
 * glielo imponiamo: qui si scarta ciò che non è utilizzabile invece di lasciarlo
 * passare e scoprirlo al momento di riempire un campo.
 */
export function inSlot(grezzo: unknown): Slot[] {
  const valori = (grezzo as { valori?: unknown })?.valori
  if (!Array.isArray(valori)) return []

  return valori.flatMap((v): Slot[] => {
    const etichetta = typeof v?.etichetta === 'string' ? v.etichetta.trim() : ''
    const valore = typeof v?.valore === 'string' ? v.valore.trim() : ''
    if (!etichetta || !valore) return []

    const tipo: TipoSlot = ammesso.has(v?.tipo) ? v.tipo : 'testo'
    return [{
      id: `ai-${++n}`,
      tipo,
      autocomplete: null,
      etichetta,
      valore,
      origine: 'ai',
      // un'estrazione AI non è un checksum: resta rivedibile
      confidenza: 0.75,
    }]
  })
}

export class ErroreProvider extends Error {
  constructor(public provider: string, messaggio: string, public stato?: number) {
    super(`${provider}: ${messaggio}`)
  }
}

/** Il JSON può arrivare avvolto in un blocco markdown anche quando non dovrebbe. */
export function jsonDaTesto(testo: string): unknown {
  const pulito = testo.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try { return JSON.parse(pulito) } catch { return null }
}
