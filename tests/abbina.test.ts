import { describe, it, expect } from 'vitest'
import { abbina, SOGLIA, type Campo } from '../src/mappa/abbina.js'
import type { Slot } from '../src/shared/tipi.js'

let n = 0
const chip = (etichetta: string, valore: string, tipo: Slot['tipo'] = 'testo',
              extra: Partial<Slot> = {}): Slot => ({
  id: `s${++n}`, tipo, autocomplete: null, etichetta, valore,
  origine: 'regex', confidenza: 0.8, ...extra,
})

const campo = (indice: number, e: Partial<Campo> = {}): Campo => ({
  indice, autocomplete: null, name: null, id: null, etichetta: null,
  tipoInput: 'text', maxLength: -1, opzioni: [], giaPieno: false, ...e,
})

const mappa = (a: ReturnType<typeof abbina>) =>
  Object.fromEntries(a.map((x) => [x.slotId, x.indiceCampo]))

describe('autocomplete vince su tutto', () => {
  it('abbina per token WHATWG', () => {
    const s = [chip('Email', 'mario@esempio.it', 'email', { autocomplete: 'email' })]
    const c = [campo(0, { autocomplete: 'tel' }), campo(1, { autocomplete: 'email' })]
    expect(abbina(s, c)[0]).toMatchObject({ indiceCampo: 1, punteggio: 1 })
  })
})

describe('il form legacy — nessun autocomplete, etichette nelle celle', () => {
  const campiLegacy = [
    campo(0, { name: 'txt1', etichetta: 'Nominativo' }),
    campo(1, { name: 'txt2', etichetta: 'Cod. Fisc.', maxLength: 16 }),
    campo(2, { name: 'txt3', etichetta: 'Indirizzo residenza' }),
    campo(3, { name: 'txt4', etichetta: 'C.A.P.', maxLength: 5 }),
    campo(4, { name: 'txt5', etichetta: 'Recapito telefonico' }),
    campo(5, { name: 'txt6', etichetta: 'Posta elettronica' }),
    campo(6, { name: 'txt7', etichetta: 'Coordinate bancarie' }),
  ]

  it('mette ogni valore al suo posto senza un solo appiglio nel markup', () => {
    const s = [
      chip('Nominativo', 'Mario Rossi'),
      chip('Codice fiscale', 'RSSMRA85T10A562S', 'codice-fiscale', { confidenza: 1 }),
      chip('Indirizzo', 'via Roma 5'),
      chip('CAP', '00184', 'postal-code'),
      chip('Telefono', '3331234567', 'tel'),
      chip('Email', 'mario@esempio.it', 'email'),
      chip('IBAN', 'IT60X0542811101000000123456', 'iban', { confidenza: 1 }),
    ]
    const m = mappa(abbina(s, campiLegacy))
    expect(Object.values(m)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('spiega ogni abbinamento con una ragione leggibile', () => {
    const s = [chip('CAP', '00184', 'postal-code')]
    const a = abbina(s, campiLegacy)
    expect(a[0]!.motivo).toContain('cap')
  })
})

describe('un campo e una chip si usano una volta sola', () => {
  it('non riempie due campi con la stessa chip', () => {
    const s = [chip('Email', 'mario@esempio.it', 'email')]
    const c = [campo(0, { etichetta: 'Email' }), campo(1, { etichetta: 'Email di conferma' })]
    expect(abbina(s, c)).toHaveLength(1)
  })

  it('non mette due chip nello stesso campo', () => {
    const s = [chip('Telefono', '3331111111', 'tel'), chip('Cellulare', '3332222222', 'tel')]
    const c = [campo(0, { etichetta: 'Telefono' })]
    expect(abbina(s, c)).toHaveLength(1)
  })
})

describe('quando non sa, non indovina', () => {
  it('lascia fuori ciò che non trova posto', () => {
    const s = [chip('Note del perito', 'nessun danno visibile')]
    const c = [campo(0, { etichetta: 'Codice cliente' })]
    expect(abbina(s, c)).toEqual([])
  })

  it('nessun abbinamento sotto la soglia entra nel risultato', () => {
    const s = [chip('Qualcosa', 'x'), chip('Altro', 'y')]
    const c = [campo(0, { etichetta: 'Zzz' }), campo(1, { etichetta: 'Www' })]
    expect(abbina(s, c).every((a) => a.punteggio >= SOGLIA)).toBe(true)
  })

  // il falso amico che rende necessario il confronto per parole intere
  it('"CAP" non finisce in un campo "Capienza"', () => {
    const s = [chip('CAP', '00184', 'postal-code')]
    const c = [campo(0, { etichetta: 'Capienza massima' })]
    expect(abbina(s, c)).toEqual([])
  })

  it('"Nome" non finisce in un campo "Cognome"', () => {
    const s = [chip('Nome', 'Mario')]
    const c = [campo(0, { etichetta: 'Cognome' })]
    expect(abbina(s, c)).toEqual([])
  })
})

describe('preferenze quando più di un campo potrebbe andare bene', () => {
  it('a parità di concetto vince il campo con autocomplete esplicito', () => {
    const s = [chip('Cognome', 'Rossi')]
    const c = [campo(0, { etichetta: 'Cognome' }), campo(1, { etichetta: 'Cognome', autocomplete: 'family-name' })]
    expect(abbina(s, c)[0]!.indiceCampo).toBe(1)
  })

  it('un valore col checksum confermato batte uno solo plausibile', () => {
    const s = [
      chip('Partita IVA', '00743110157', 'partita-iva', { confidenza: 1 }),
      chip('Numero', '01234567890', 'testo'),
    ]
    const c = [campo(0, { etichetta: 'Partita IVA', maxLength: 11 })]
    expect(abbina(s, c)[0]!.slotId).toBe(s[0]!.id)
  })
})

describe('select', () => {
  it('riconosce il campo che ha proprio quell\'opzione', () => {
    const s = [chip('Provincia di nascita', 'Roma')]
    const c = [campo(0, { etichetta: 'Scegli', opzioni: ['Milano', 'Roma', 'Torino'] })]
    expect(abbina(s, c)).toHaveLength(1)
  })
})

describe('il risultato è ordinato come il form', () => {
  it('restituisce gli abbinamenti nell\'ordine dei campi, non del punteggio', () => {
    const s = [chip('Email', 'a@b.it', 'email'), chip('CAP', '00184', 'postal-code')]
    const c = [campo(0, { etichetta: 'C.A.P.' }), campo(1, { etichetta: 'Email' })]
    expect(abbina(s, c).map((a) => a.indiceCampo)).toEqual([0, 1])
  })
})

describe('le parole generiche non bastano ad abbinare', () => {
  // trovato sul form vero: "Codice Fiscale" finiva in "Codice Agenzia"
  it('"Codice Fiscale" non finisce in "Codice Agenzia"', () => {
    const s = [chip('Codice Fiscale', '00885091009')]
    const c = [campo(0, { etichetta: 'Codice Agenzia' })]
    expect(abbina(s, c)).toEqual([])
  })

  it('"Email Referente Azienda" abbina comunque una PEC, perché "email" non è generica', () => {
    const s = [chip('PEC', 'x@y.it', 'email')]
    const c = [campo(0, { etichetta: 'Email Referente Azienda Interessata' })]
    expect(abbina(s, c)).toHaveLength(1)
  })

  it('due etichette che condividono solo parole generiche non si abbinano', () => {
    const s = [chip('Numero pratica', '12345')]
    const c = [campo(0, { etichetta: 'Numero polizza' })]
    expect(abbina(s, c)).toEqual([])
  })
})

describe('due chip dello stesso concetto si distinguono per il resto dell\'etichetta', () => {
  // senza questo, "Comune di nascita" e "Comune di residenza" valgono uguale
  // e l'assegnazione diventa un sorteggio
  it('nascita e residenza non si scambiano', () => {
    const s = [chip('Comune di nascita', 'Roma'), chip('Comune di residenza', 'Milano')]
    const c = [campo(0, { etichetta: 'Luogo di nascita' }), campo(1, { etichetta: 'Citta di residenza' })]
    const m = mappa(abbina(s, c))
    expect(m[s[0]!.id]).toBe(0)
    expect(m[s[1]!.id]).toBe(1)
  })

  it('sede legale e sede operativa non si scambiano', () => {
    const s = [chip('Sede legale', 'VIA PO 20'), chip('Sede operativa', 'VIA MILANO 3')]
    const c = [campo(0, { etichetta: 'Indirizzo sede operativa' }), campo(1, { etichetta: 'Indirizzo sede legale' })]
    const m = mappa(abbina(s, c))
    expect(m[s[0]!.id]).toBe(1)
    expect(m[s[1]!.id]).toBe(0)
  })

  it('la parola che distingue finisce nel motivo, perché l\'utente possa smentirlo', () => {
    const s = [chip('Comune di nascita', 'Roma')]
    const c = [campo(0, { etichetta: 'Luogo di nascita' })]
    expect(abbina(s, c)[0]!.motivo).toContain('nascita')
  })
})
