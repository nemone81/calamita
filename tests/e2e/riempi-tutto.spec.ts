import { test, expect, type Page } from '@playwright/test'
import { iniettaAbbina, iniettaCampoAttivo, iniettaRiempi, iniettaScansiona, urlFixture } from './aiuto.js'
import type { Slot } from '../../src/shared/tipi.js'

declare global {
  interface Window {
    Scansiona: typeof import('../../src/content/scansiona.js')
    Abbina: typeof import('../../src/mappa/abbina.js')
  }
}

let n = 0
const chip = (etichetta: string, valore: string, tipo: Slot['tipo'] = 'testo',
              extra: Partial<Slot> = {}): Slot => ({
  id: `s${++n}`, tipo, autocomplete: null, etichetta, valore,
  origine: 'regex', confidenza: 0.8, ...extra,
})

/** Il giro vero: scansiona il DOM, abbina, riempie. */
async function riempiTutto(page: Page, slot: Slot[]) {
  await iniettaCampoAttivo(page)   // scansiona.ts usa descrivi()
  await iniettaScansiona(page)
  await iniettaAbbina(page)
  await iniettaRiempi(page)

  return page.evaluate((slot) => {
    const campi = window.Scansiona.scansiona()
    const scelte = window.Abbina.abbina(slot, campi)
    const elementi = window.Scansiona.elementiRiempibili()
    const fatti: string[] = []
    for (const a of scelte) {
      const s = slot.find((x) => x.id === a.slotId)!
      const e = elementi[a.indiceCampo]!
      if (window.Calamita.riempi(e, s.valore).ok) fatti.push(`${e.id}=${s.valore}`)
    }
    return { fatti, scelte: scelte.length, campi: campi.length }
  }, slot)
}

test('il gestionale senza appigli si compila da solo', async ({ page }) => {
  await page.goto(urlFixture('legacy.html'))

  const r = await riempiTutto(page, [
    chip('Nominativo', 'Mario Rossi'),
    chip('Codice fiscale', 'RSSMRA85T10A562S', 'codice-fiscale', { confidenza: 1 }),
    chip('Indirizzo', 'via Roma 5'),
    chip('CAP', '00184', 'postal-code'),
    chip('Telefono', '3331234567', 'tel'),
    chip('Email', 'mario@esempio.it', 'email'),
    chip('IBAN', 'IT60X0542811101000000123456', 'iban', { confidenza: 1 }),
  ])

  expect(r.campi).toBe(7)
  expect(r.scelte).toBe(7)

  await expect(page.locator('#txt1')).toHaveValue('Mario Rossi')
  await expect(page.locator('#txt2')).toHaveValue('RSSMRA85T10A562S')
  await expect(page.locator('#txt3')).toHaveValue('via Roma 5')
  await expect(page.locator('#txt4')).toHaveValue('00184')
  await expect(page.locator('#txt5')).toHaveValue('3331234567')
  await expect(page.locator('#txt6')).toHaveValue('mario@esempio.it')
  await expect(page.locator('#txt7')).toHaveValue('IT60X0542811101000000123456')
})

test('il form con autocomplete si compila da solo', async ({ page }) => {
  await page.goto(urlFixture('plain.html'))

  await riempiTutto(page, [
    chip('Nome', 'Mario', 'testo', { autocomplete: 'given-name' }),
    chip('Cognome', 'Rossi', 'testo', { autocomplete: 'family-name' }),
    chip('Email', 'mario@esempio.it', 'email', { autocomplete: 'email' }),
    chip('CAP', '00184', 'postal-code', { autocomplete: 'postal-code' }),
    chip('Città', 'Roma'),
  ])

  await expect(page.locator('#nome')).toHaveValue('Mario')
  await expect(page.locator('#cognome')).toHaveValue('Rossi')
  await expect(page.locator('#email')).toHaveValue('mario@esempio.it')
  await expect(page.locator('#cap')).toHaveValue('00184')
  await expect(page.locator('#citta')).toHaveValue('Roma')
})

test('React accetta anche il riempimento automatico', async ({ page }) => {
  await page.goto(urlFixture('react.html'))
  await page.waitForSelector('#nome')

  await riempiTutto(page, [
    chip('Nome', 'Mario Rossi'),
    chip('Email', 'mario@esempio.it', 'email'),
    chip('CAP', '00184', 'postal-code'),
  ])

  // di nuovo: la spia mostra lo stato di React, non il DOM
  await expect(page.locator('#spia')).toContainText('"nome": "Mario Rossi"')
  await expect(page.locator('#spia')).toContainText('"email": "mario@esempio.it"')
  await expect(page.locator('#spia')).toContainText('"cap": "00184"')
})

test('non tocca i campi per cui non ha un valore sensato', async ({ page }) => {
  await page.goto(urlFixture('legacy.html'))

  const r = await riempiTutto(page, [chip('Email', 'mario@esempio.it', 'email')])

  expect(r.scelte).toBe(1)
  await expect(page.locator('#txt6')).toHaveValue('mario@esempio.it')
  for (const id of ['txt1', 'txt2', 'txt3', 'txt4', 'txt5', 'txt7']) {
    await expect(page.locator(`#${id}`)).toHaveValue('')
  }
})

test('i campi nascosti non contano come campi', async ({ page }) => {
  await page.goto(urlFixture('plain.html'))
  await page.evaluate(() => { document.getElementById('cap')!.style.display = 'none' })

  await iniettaCampoAttivo(page)
  await iniettaScansiona(page)
  const campi = await page.evaluate(() => window.Scansiona.scansiona().map((c) => c.id))

  expect(campi).not.toContain('cap')
  expect(campi).toContain('email')
})
