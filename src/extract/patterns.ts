import type { TipoSlot } from '../shared/tipi.js'
import { cfValido, ibanValido, partitaIvaValida } from './validate.js'

export type Pattern = {
  tipo: TipoSlot
  etichetta: string
  /** token WHATWG corrispondente, dove esiste */
  autocomplete: string | null
  re: RegExp
  /** verifica oltre la forma: dove c'è un checksum, è qui che si usa */
  valida?: (v: string) => boolean
  /** normalizza prima di mostrare e riempire */
  normalizza?: (v: string) => string
  /**
   * Quanto fidarsi quando `valida` non esiste. Con un checksum la confidenza è 1:
   * la forma da sola non basta mai a dire "sono undici cifre, quindi P.IVA".
   */
  confidenzaSenzaChecksum: number
}

const soloCifre = (v: string) => v.replace(/[\s./-]/g, '')

export const PATTERNS: Pattern[] = [
  {
    tipo: 'email',
    etichetta: 'Email',
    autocomplete: 'email',
    re: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
    confidenzaSenzaChecksum: 0.95,
  },
  {
    tipo: 'iban',
    etichetta: 'IBAN',
    autocomplete: null,
    re: /\b[A-Za-z]{2}\d{2}[\s]?(?:[A-Za-z0-9][\s]?){10,30}\b/g,
    valida: ibanValido,
    normalizza: (v) => v.replace(/\s/g, '').toUpperCase(),
    confidenzaSenzaChecksum: 0.3,
  },
  {
    tipo: 'codice-fiscale',
    etichetta: 'Codice fiscale',
    autocomplete: null,
    re: /\b[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]\b/g,
    valida: cfValido,
    normalizza: (v) => v.toUpperCase(),
    confidenzaSenzaChecksum: 0.5,
  },
  {
    tipo: 'partita-iva',
    etichetta: 'Partita IVA',
    autocomplete: null,
    // 11 cifre isolate: la forma è debolissima, il checksum fa tutto il lavoro
    re: /\b\d{11}\b/g,
    valida: partitaIvaValida,
    confidenzaSenzaChecksum: 0.15,
  },
  {
    tipo: 'postal-code',
    etichetta: 'CAP',
    autocomplete: 'postal-code',
    // 5 cifre: forma comunissima, quindi confidenza bassa senza un'etichetta accanto
    re: /\b\d{5}\b/g,
    confidenzaSenzaChecksum: 0.35,
  },
  {
    tipo: 'tel',
    etichetta: 'Telefono',
    autocomplete: 'tel',
    re: /(?:\+39[\s.]?)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4}\b|(?:\+39[\s.]?)?\b0\d{1,3}[\s.-]?\d{5,8}\b/g,
    normalizza: (v) => v.replace(/[\s.-]/g, ''),
    confidenzaSenzaChecksum: 0.7,
  },
  {
    tipo: 'data',
    etichetta: 'Data',
    autocomplete: null,
    re: /\b(?:0?[1-9]|[12]\d|3[01])[/.-](?:0?[1-9]|1[0-2])[/.-](?:\d{4}|\d{2})\b/g,
    confidenzaSenzaChecksum: 0.8,
  },
  {
    tipo: 'importo',
    etichetta: 'Importo',
    autocomplete: null,
    re: /(?:€\s?)\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\b\d{1,3}(?:\.\d{3})*,\d{2}\s?(?:€|EUR)\b/g,
    confidenzaSenzaChecksum: 0.85,
  },
  {
    tipo: 'url',
    etichetta: 'Sito',
    autocomplete: 'url',
    re: /\bhttps?:\/\/[^\s<>"']+/g,
    confidenzaSenzaChecksum: 0.95,
  },
]

export { soloCifre }
