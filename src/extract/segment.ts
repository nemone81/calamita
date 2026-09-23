import type { Frammento } from '../shared/tipi.js'
import { PATTERNS } from './patterns.js'

/**
 * Spezza un blob incollato in frammenti. Due strade, in ordine di valore:
 *
 * 1. `Chiave: valore` — moltissimi documenti sono già etichettati, e un'etichetta
 *    scritta da un umano vale più di qualunque regex nostra.
 * 2. split su righe/tab/`;` — il ripiego quando non c'è struttura.
 */

/** Una chiave è poche parole, non una frase: "Il cliente ha dichiarato quanto segue:" non lo è. */
const RE_KV = /^\s*([\p{L}][\p{L}\s.'/()-]{0,38}?)\s*:\s*(.+?)\s*$/u
const MAX_PAROLE_CHIAVE = 4

export function segmenta(testo: string): Frammento[] {
  const frammenti: Frammento[] = []

  for (const riga of testo.split(/\r?\n/)) {
    if (!riga.trim()) continue

    const kv = riga.match(RE_KV)
    if (kv && kv[2]!.trim() && chiavePlausibile(kv[1]!)) {
      frammenti.push({ etichetta: pulisciEtichetta(kv[1]!), valore: kv[2]!.trim() })
      continue
    }

    const celle = riga.split(/\t/).map((c) => c.trim()).filter(Boolean)

    // Due celle separate da tab sono ambigue per forma: `Mario⇥Rossi` e
    // `Email⇥mario@esempio.it` hanno la stessa struttura. A distinguerle è il
    // contenuto: se la cella destra è un valore riconoscibile e la sinistra no,
    // la sinistra è un'etichetta. Altrimenti sono due valori affiancati.
    if (celle.length === 2 && chiavePlausibile(celle[0]!) &&
        !sembraValoreTipizzato(celle[0]!) && sembraValoreTipizzato(celle[1]!)) {
      frammenti.push({ etichetta: pulisciEtichetta(celle[0]!), valore: celle[1]! })
      continue
    }

    for (const cella of celle) {
      for (const p of cella.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean)) {
        frammenti.push({ etichetta: null, valore: p })
      }
    }
  }

  return frammenti
}

function chiavePlausibile(k: string): boolean {
  const parole = k.trim().split(/\s+/)
  return parole.length <= MAX_PAROLE_CHIAVE && k.trim().length <= 38
}

/** Il valore corrisponde per intero a un pattern noto? (usato solo per disambiguare) */
function sembraValoreTipizzato(v: string): boolean {
  const t = v.trim()
  return PATTERNS.some((p) => {
    p.re.lastIndex = 0
    const m = t.match(p.re)
    if (!m) return false
    const intero = m.some((x) => x.trim().length >= t.length - 2)
    if (!intero) return false
    const valore = p.normalizza ? p.normalizza(t) : t
    return p.valida ? p.valida(valore) : p.confidenzaSenzaChecksum >= 0.7
  })
}

function pulisciEtichetta(e: string): string {
  const t = e.trim().replace(/\s+/g, ' ').replace(/[*]/g, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
