import { describe, it, expect, beforeEach } from 'vitest'
import { tipizza, azzeraContatore } from '../src/extract/tipizza.js'

beforeEach(azzeraContatore)

const t = (valore: string, etichetta: string | null = null) => tipizza({ etichetta, valore })

describe('tipizza', () => {
  it('riconosce email, telefono e sito', () => {
    expect(t('mario@esempio.it').tipo).toBe('email')
    expect(t('+39 333 1234567').tipo).toBe('tel')
    expect(t('https://esempio.it').tipo).toBe('url')
  })

  it('dà confidenza 1 solo quando un checksum conferma', () => {
    const cf = t('RSSMRA85T10A562S')
    expect(cf.tipo).toBe('codice-fiscale')
    expect(cf.confidenza).toBe(1)

    const cap = t('00184')
    expect(cap.tipo).toBe('postal-code')
    expect(cap.confidenza).toBeLessThan(1)   // cinque cifre non provano nulla
  })

  it('normalizza IBAN e codice fiscale', () => {
    expect(t('it60 x054 2811 1010 0000 0123 456').valore).toBe('IT60X0542811101000000123456')
    expect(t('rssmra85t10a562s').valore).toBe('RSSMRA85T10A562S')
  })

  // il caso che giustifica i checksum: due valori con la stessa forma, esiti diversi
  it('non fa passare per partita IVA undici cifre qualsiasi', () => {
    expect(t('00743110157').tipo).toBe('partita-iva')
    expect(t('01234567890').tipo).not.toBe('partita-iva')
  })

  it('un codice fiscale storpiato non diventa un codice fiscale', () => {
    expect(t('RSSMRA85T10A562A').tipo).toBe('testo')
  })

  it("l'etichetta del documento vince sul nome del pattern", () => {
    const s = t('00184', 'Codice avviamento postale')
    expect(s.etichetta).toBe('Codice avviamento postale')
    expect(s.tipo).toBe('postal-code')
    expect(s.origine).toBe('kv')
  })

  it("un'etichetta esplicita alza la confidenza di un tipo dalla forma debole", () => {
    expect(t('00184', 'CAP').confidenza).toBeGreaterThan(t('00184').confidenza)
  })

  it('ciò che non riconosce resta testo, non viene forzato', () => {
    const s = t('via Giuseppe Garibaldi 12')
    expect(s.tipo).toBe('testo')
    expect(s.valore).toBe('via Giuseppe Garibaldi 12')
  })

  it('non tipizza su una sottostringa: il valore deve essere tutto il frammento', () => {
    // "Fattura 00184 del 2026" contiene cinque cifre ma non È un CAP
    expect(t('Fattura 00184 del 2026').tipo).toBe('testo')
  })
})
