import { describe, it, expect } from 'vitest'
import { cfValido, ibanValido, partitaIvaValida, cfCarattereControllo } from '../src/extract/validate.js'

describe('codice fiscale', () => {
  it('accetta codici validi', () => {
    expect(cfValido('RSSMRA85T10A562S')).toBe(true)
    expect(cfValido('MRARSS90A41H501Z')).toBe(true)
  })

  it('accetta minuscole e spazi', () => {
    expect(cfValido(' rssmra85t10a562s ')).toBe(true)
  })

  // il punto di tutto: una cifra alterata deve cadere
  it('rifiuta un codice con una cifra cambiata', () => {
    expect(cfValido('RSSMRA85T10A562A')).toBe(false)   // carattere di controllo sbagliato
    expect(cfValido('RSSMRA85T11A562S')).toBe(false)   // giorno cambiato, controllo non torna
  })

  it('rifiuta ciò che ha la forma giusta ma è inventato', () => {
    expect(cfValido('ABCDEF12G34H567I')).toBe(false)
  })

  it('calcola il carattere di controllo', () => {
    expect(cfCarattereControllo('RSSMRA85T10A562')).toBe('S')
    expect(cfCarattereControllo('troppo corto')).toBeNull()
  })
})

describe('IBAN', () => {
  it('accetta IBAN validi, anche non italiani', () => {
    expect(ibanValido('IT60X0542811101000000123456')).toBe(true)
    expect(ibanValido('DE89370400440532013000')).toBe(true)
  })

  it('accetta la forma scritta a gruppi', () => {
    expect(ibanValido('IT60 X054 2811 1010 0000 0123 456')).toBe(true)
  })

  it('rifiuta un IBAN con una cifra cambiata', () => {
    expect(ibanValido('IT60X0542811101000000123457')).toBe(false)
  })

  it('rifiuta le cifre di controllo sbagliate', () => {
    expect(ibanValido('IT61X0542811101000000123456')).toBe(false)
  })
})

describe('partita IVA', () => {
  it('accetta partite IVA valide', () => {
    expect(partitaIvaValida('00743110157')).toBe(true)
    expect(partitaIvaValida('12345678903')).toBe(true)
  })

  it('tollera punti e spazi', () => {
    expect(partitaIvaValida('007 431 101 57')).toBe(true)
  })

  // falso amico: il motivo per cui il checksum esiste
  it('rifiuta undici cifre qualsiasi', () => {
    expect(partitaIvaValida('01234567890')).toBe(false)
    expect(partitaIvaValida('12345678901')).toBe(false)
    expect(partitaIvaValida('00000000001')).toBe(false)
  })

  it('rifiuta lunghezze sbagliate', () => {
    expect(partitaIvaValida('0074311015')).toBe(false)
    expect(partitaIvaValida('007431101570')).toBe(false)
  })
})
