import { describe, it, expect } from 'vitest'
import { segmenta } from '../src/extract/segment.js'

describe('segmenta', () => {
  it('riconosce le coppie Chiave: valore', () => {
    const f = segmenta('Nome: Mario Rossi\nCAP: 00184')
    expect(f).toEqual([
      { etichetta: 'Nome', valore: 'Mario Rossi' },
      { etichetta: 'CAP', valore: '00184' },
    ])
  })

  it('accetta il tab come separatore chiave/valore', () => {
    expect(segmenta('Email\tmario@esempio.it')[0])
      .toEqual({ etichetta: 'Email', valore: 'mario@esempio.it' })
  })

  it('spezza le righe senza chiave su tab e punto e virgola', () => {
    const f = segmenta('Mario\tRossi\nvia Roma 5; 00184; Roma')
    expect(f.map((x) => x.valore)).toEqual(['Mario', 'Rossi', 'via Roma 5', '00184', 'Roma'])
    expect(f.every((x) => x.etichetta === null)).toBe(true)
  })

  it('ignora le righe vuote e gli spazi di troppo', () => {
    expect(segmenta('\n\n  Citta :   Roma  \n\n')[0])
      .toEqual({ etichetta: 'Citta', valore: 'Roma' })
  })

  // falso amico: una frase con i due punti NON è una coppia chiave/valore
  it('non scambia una frase per una coppia chiave/valore', () => {
    const f = segmenta('Il cliente ha dichiarato quanto segue: nessun sinistro negli ultimi anni')
    expect(f[0]!.etichetta).toBeNull()
  })

  // falso amico: un orario ha i due punti ma la chiave sarebbe una cifra
  it('non spezza un orario sulla sua sola presenza di due punti', () => {
    const f = segmenta('14:30')
    expect(f[0]).toEqual({ etichetta: null, valore: '14:30' })
  })

  it('tiene il valore intero anche se contiene due punti', () => {
    expect(segmenta('Sito: https://esempio.it/pagina')[0])
      .toEqual({ etichetta: 'Sito', valore: 'https://esempio.it/pagina' })
  })
})
