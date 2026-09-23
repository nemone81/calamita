import type { Slot, TipoSlot } from '../shared/tipi.js'
import { CONCETTI, GENERICHE, PAROLE_PER_TIPO, normalizza } from './vocabolario.js'

/** Un campo del form, descritto dal content script. Niente riferimenti al DOM. */
export type Campo = {
  /** indice stabile nell'elenco dei campi della pagina */
  indice: number
  autocomplete: string | null
  name: string | null
  id: string | null
  /** l'etichetta leggibile, comunque il content script sia riuscito a trovarla */
  etichetta: string | null
  tipoInput: string
  maxLength: number
  /** per i <select>: i testi delle opzioni */
  opzioni: string[]
  giaPieno: boolean
}

export type Abbinamento = {
  slotId: string
  indiceCampo: number
  punteggio: number
  /** perché: si mostra all'utente, perché possa smentirlo */
  motivo: string
}

/** Sotto questo punteggio non si riempie: si lascia la chip all'utente. */
export const SOGLIA = 0.45

/**
 * Abbina chip e campi. Deterministico e puro: qui non si chiama nessun modello.
 *
 * Strategia: si calcolano tutte le coppie, si ordinano per punteggio e si assegna
 * dall'alto, saltando chip e campi già presi. È un greedy, non l'ottimo globale —
 * ma con dieci campi la differenza non si vede, e l'ordine è spiegabile a chi guarda,
 * che conta di più di mezzo punto di precisione.
 */
export function abbina(slot: Slot[], campi: Campo[]): Abbinamento[] {
  const coppie: Abbinamento[] = []

  for (const s of slot) {
    for (const c of campi) {
      const p = punteggia(s, c)
      if (p.punteggio >= SOGLIA) {
        coppie.push({ slotId: s.id, indiceCampo: c.indice, ...p })
      }
    }
  }

  coppie.sort((a, b) => b.punteggio - a.punteggio)

  const slotPresi = new Set<string>()
  const campiPresi = new Set<number>()
  const scelte: Abbinamento[] = []

  for (const c of coppie) {
    if (slotPresi.has(c.slotId) || campiPresi.has(c.indiceCampo)) continue
    slotPresi.add(c.slotId)
    campiPresi.add(c.indiceCampo)
    scelte.push(c)
  }

  return scelte.sort((a, b) => a.indiceCampo - b.indiceCampo)
}

function punteggia(s: Slot, c: Campo): { punteggio: number; motivo: string } {
  // 1. `autocomplete` è uno standard: quando c'è ed è quello giusto, non c'è partita
  if (s.autocomplete && c.autocomplete && s.autocomplete === c.autocomplete) {
    return { punteggio: 1, motivo: `autocomplete="${c.autocomplete}"` }
  }

  const testoCampo = normalizza([c.etichetta, c.name, c.id].filter(Boolean).join(' '))

  // 2. l'etichetta del campo nomina il tipo della chip
  if (s.tipo !== 'testo') {
    const parola = PAROLE_PER_TIPO[s.tipo].find((p) => contiene(testoCampo, p))
    if (parola) {
      // un checksum confermato rende l'abbinamento praticamente certo
      return { punteggio: s.confidenza === 1 ? 0.97 : 0.9, motivo: `il campo dice “${parola}”` }
    }
  }

  // 3. concetti senza tipo proprio: nome, cognome, indirizzo… Si confronta
  //    l'etichetta della chip con quella del campo passando per lo stesso concetto.
  const etichettaChip = normalizza(s.etichetta)
  for (const concetto of CONCETTI) {
    const nelCampo = concetto.parole.find((p) => contiene(testoCampo, p))
    const nellaChip = concetto.parole.find((p) => contiene(etichettaChip, p))
    if (nelCampo && nellaChip) {
      const viaAutocomplete = concetto.autocomplete && c.autocomplete === concetto.autocomplete
      // Il concetto da solo non basta quando due chip se lo contendono:
      // "Comune di nascita" e "Comune di residenza" parlano entrambe di città.
      // A distinguerle è ciò che resta dell'etichetta una volta tolto il concetto.
      const dist = discriminanti(etichettaChip, testoCampo, concetto.parole)
      const base = viaAutocomplete ? 0.95 : 0.85
      return {
        punteggio: Math.min(0.99, base + dist.comuni * 0.06 - dist.contrarie * 0.25),
        motivo: dist.parola
          ? `entrambi parlano di “${concetto.chiave}”, e di “${dist.parola}”`
          : `entrambi parlano di “${concetto.chiave}”`,
      }
    }
    // il campo dichiara il concetto via autocomplete e la chip lo nomina
    if (concetto.autocomplete && c.autocomplete === concetto.autocomplete && nellaChip) {
      return { punteggio: 0.92, motivo: `autocomplete="${c.autocomplete}"` }
    }
  }

  // 4. il tipo dell'input: <input type="email"> chiede un'email
  const perTipoInput: Partial<Record<string, TipoSlot>> = { email: 'email', tel: 'tel', url: 'url', date: 'data' }
  if (perTipoInput[c.tipoInput] === s.tipo) {
    return { punteggio: 0.8, motivo: `il campo è di tipo ${c.tipoInput}` }
  }

  // 5. le etichette si somigliano, senza passare per un concetto noto
  const somiglianza = sovrapposizione(etichettaChip, testoCampo)
  if (somiglianza >= 0.5) {
    return { punteggio: 0.5 + somiglianza * 0.3, motivo: `“${s.etichetta}” somiglia a “${c.etichetta ?? c.name}”` }
  }

  // 6. un <select> che ha esattamente quell'opzione
  if (c.opzioni.length && c.opzioni.some((o) => normalizza(o) === normalizza(s.valore))) {
    return { punteggio: 0.75, motivo: 'una delle opzioni è proprio questo valore' }
  }

  // 7. ultimo appiglio: maxlength che combacia con un tipo di lunghezza fissa
  const lunghezzeNote: Partial<Record<TipoSlot, number>> = { 'postal-code': 5, 'codice-fiscale': 16, 'partita-iva': 11 }
  const attesa = lunghezzeNote[s.tipo]
  if (attesa && c.maxLength === attesa && s.confidenza === 1) {
    return { punteggio: 0.6, motivo: `il campo accetta esattamente ${attesa} caratteri` }
  }

  return { punteggio: 0, motivo: '' }
}

/**
 * Le parole che restano una volta tolto il concetto condiviso. Sono quelle che
 * distinguono "Comune di nascita" da "Comune di residenza": senza guardarle, due
 * chip dello stesso concetto valgono uguale e l'assegnazione diventa un sorteggio.
 */
function discriminanti(chip: string, campo: string, delConcetto: string[]) {
  const togli = new Set(delConcetto.flatMap((p) => p.split(' ')))
  const utili = (s: string) => new Set(
    s.split(' ').filter((w) => w.length > 2 && !GENERICHE.has(w) && !togli.has(w)))

  const a = utili(chip)
  const b = utili(campo)
  let comuni = 0
  let parola: string | null = null
  for (const w of a) if (b.has(w)) { comuni++; parola ??= w }

  // parole presenti da una sola parte: indizio che le due etichette parlano
  // della stessa cosa ma di due esemplari diversi
  const contrarie = (comuni === 0 && a.size > 0 && b.size > 0) ? 1 : 0
  return { comuni, contrarie, parola }
}

/** Confronto per parole intere: "cap" non deve pescare "capienza". */
function contiene(testo: string, frase: string): boolean {
  return new RegExp(`(^|\\s)${frase.replace(/\s+/g, '\\s+')}($|\\s)`).test(testo)
}

/**
 * Quanto si somigliano due etichette. Le parole generiche non contano: due campi
 * che condividono solo "codice" non parlano della stessa cosa.
 */
function sovrapposizione(a: string, b: string): number {
  const utili = (s: string) =>
    new Set(s.split(' ').filter((w) => w.length > 2 && !GENERICHE.has(w)))

  const pa = utili(a)
  const pb = utili(b)
  if (!pa.size || !pb.size) return 0

  let comuni = 0
  for (const w of pa) if (pb.has(w)) comuni++
  return comuni / Math.min(pa.size, pb.size)
}
