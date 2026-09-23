import { test, expect } from '@playwright/test'
import { iniettaRiempi, urlFixture } from './aiuto.js'

declare global {
  interface Window { Incolla: typeof import('../../src/fill/riempi.js') }
}

const riempi = (page: import('@playwright/test').Page, sel: string, valore: string) =>
  page.evaluate(([s, v]) => window.Incolla.riempi(document.querySelector(s!), v!), [sel, valore])

test.describe('HTML puro', () => {
  test('riempie i campi e il DOM li mostra', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)

    const esito = await riempi(page, '#email', 'mario@esempio.it')
    expect(esito).toMatchObject({ ok: true, valoreScritto: 'mario@esempio.it' })
    await expect(page.locator('#email')).toHaveValue('mario@esempio.it')
  })

  test('rispetta maxlength e lo segnala', async ({ page }) => {
    await page.goto(urlFixture('legacy.html'))
    await iniettaRiempi(page)

    const esito = await riempi(page, '#txt4', '00184 Roma')   // il campo CAP accetta 5
    expect(esito).toMatchObject({ ok: true, valoreScritto: '00184', troncato: true })
    await expect(page.locator('#txt4')).toHaveValue('00184')
  })
})

test.describe('input controllati React — il caso che rompe .value', () => {
  test('React accetta il valore, non solo il DOM', async ({ page }) => {
    await page.goto(urlFixture('react.html'))
    await page.waitForSelector('#nome')
    await iniettaRiempi(page)

    await riempi(page, '#nome', 'Mario Rossi')
    await riempi(page, '#cap', '00184')

    // il DOM è la parte facile
    await expect(page.locator('#nome')).toHaveValue('Mario Rossi')

    // questo è il test vero: la spia mostra lo STATO di React
    await expect(page.locator('#spia')).toContainText('"nome": "Mario Rossi"')
    await expect(page.locator('#spia')).toContainText('"cap": "00184"')
  })

  test('il valore sopravvive a una ri-renderizzazione', async ({ page }) => {
    await page.goto(urlFixture('react.html'))
    await page.waitForSelector('#email')
    await iniettaRiempi(page)

    await riempi(page, '#email', 'mario@esempio.it')
    // forza React a ri-renderizzare toccando un altro campo
    await page.locator('#nome').fill('x')
    await expect(page.locator('#email')).toHaveValue('mario@esempio.it')
  })

  test("l'assegnazione ingenua di .value NON basta (dimostra perché il codice è così)", async ({ page }) => {
    await page.goto(urlFixture('react.html'))
    await page.waitForSelector('#nome')

    await page.evaluate(() => {
      const e = document.querySelector<HTMLInputElement>('#nome')!
      e.value = 'Ingenuo'
      e.dispatchEvent(new Event('input', { bubbles: true }))
    })

    // React non ha visto niente: la spia non si è mai aggiornata
    await expect(page.locator('#spia')).toHaveText('stato React: {}')

    // e alla prima ri-renderizzazione il valore sparisce: è esattamente il difetto
    // che il setter nativo evita
    await page.locator('#email').fill('x')
    await expect(page.locator('#nome')).toHaveValue('')
  })
})

test.describe('casi che devono fallire, non fallire in silenzio', () => {
  test('rifiuta un elemento che non è un campo', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)
    expect(await riempi(page, 'h1', 'x')).toMatchObject({ ok: false, motivo: 'elemento-non-riempibile' })
  })

  test('rifiuta un selettore che non trova nulla', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)
    expect(await riempi(page, '#inesistente', 'x')).toMatchObject({ ok: false })
  })

  test('rifiuta un campo in sola lettura', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)
    await page.evaluate(() => document.querySelector<HTMLInputElement>('#nome')!.readOnly = true)
    expect(await riempi(page, '#nome', 'x')).toMatchObject({ ok: false, motivo: 'campo-in-sola-lettura' })
  })
})

test.describe('campi numerici — rifiutano in silenzio ciò che non è un numero', () => {
  test('estrae il numero da un valore sporco', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)
    await page.evaluate(() => {
      const n = document.createElement('input')
      n.type = 'number'; n.id = 'quanti'
      document.getElementById('f')!.append(n)
    })

    const esito = await riempi(page, '#quanti', '629 (2026)')
    expect(esito).toMatchObject({ ok: true, valoreScritto: '629', troncato: true })
    await expect(page.locator('#quanti')).toHaveValue('629')
  })

  test('dichiara il fallimento se un numero non c\'è, invece di lasciare il campo vuoto', async ({ page }) => {
    await page.goto(urlFixture('plain.html'))
    await iniettaRiempi(page)
    await page.evaluate(() => {
      const n = document.createElement('input')
      n.type = 'number'; n.id = 'quanti'
      document.getElementById('f')!.append(n)
    })

    expect(await riempi(page, '#quanti', 'nessun numero qui'))
      .toMatchObject({ ok: false, motivo: 'il campo accetta solo numeri' })
  })
})
