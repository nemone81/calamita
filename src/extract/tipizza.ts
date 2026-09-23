import { PATTERNS } from './patterns.js'
import type { Slot, Frammento } from '../shared/tipi.js'

let contatore = 0
const nuovoId = () => `slot-${++contatore}`

/** Solo per i test: rende gli id prevedibili. */
export function azzeraContatore() { contatore = 0 }

/**
 * Assegna un tipo a un valore. Il primo pattern che valida col checksum vince:
 * un CF valido batte sempre un "testo", e undici cifre che non passano il
 * controllo della P.IVA non diventano una P.IVA.
 */
export function tipizza(f: Frammento): Slot {
  let migliore: { p: (typeof PATTERNS)[number]; valore: string; conf: number } | null = null

  for (const p of PATTERNS) {
    p.re.lastIndex = 0
    const m = f.valore.match(p.re)
    if (!m) continue
    // il valore deve essere sostanzialmente TUTTO il frammento, non un pezzetto
    const intero = m.find((x) => x.trim().length >= f.valore.trim().length - 2)
    if (!intero) continue

    const grezzo = intero.trim()
    const valore = p.normalizza ? p.normalizza(grezzo) : grezzo
    const conf = p.valida ? (p.valida(valore) ? 1 : 0) : p.confidenzaSenzaChecksum
    if (conf === 0) continue
    if (!migliore || conf > migliore.conf) migliore = { p, valore, conf }
  }

  if (!migliore) {
    return {
      id: nuovoId(), tipo: 'testo', autocomplete: null,
      etichetta: f.etichetta ?? 'Testo', valore: f.valore.trim(),
      origine: f.etichetta ? 'kv' : 'regex', confidenza: f.etichetta ? 0.6 : 0.2,
    }
  }

  return {
    id: nuovoId(),
    tipo: migliore.p.tipo,
    autocomplete: migliore.p.autocomplete,
    // un'etichetta scritta nel documento sa più di noi: vince sul nome del pattern
    etichetta: f.etichetta ?? migliore.p.etichetta,
    valore: migliore.valore,
    origine: f.etichetta ? 'kv' : 'regex',
    // un'etichetta esplicita alza la fiducia su un tipo dalla forma debole (CAP, P.IVA)
    confidenza: f.etichetta ? Math.min(1, migliore.conf + 0.3) : migliore.conf,
  }
}
