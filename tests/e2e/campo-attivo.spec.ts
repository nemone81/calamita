import { test, expect, type Page } from '@playwright/test'
import { iniettaCampoAttivo, iniettaRiempi, urlFixture } from './aiuto.js'

declare global {
  interface Window {
    CampoAttivo: typeof import('../../src/content/campo-attivo.js')
    Incolla: typeof import('../../src/fill/riempi.js')
    cambi: (string | null)[]
  }
}

async function avvia(page: Page, fixture: string) {
  await page.goto(urlFixture(fixture))
  await iniettaCampoAttivo(page)
  await page.evaluate(() => {
    window.cambi = []
    window.CampoAttivo.avviaTracciamento((d) => window.cambi.push(d))
  })
}

test.describe('descrivi — dare un nome al campo', () => {
  test('usa la <label for> quando c\'è', async ({ page }) => {
    await avvia(page, 'plain.html')
    await page.locator('#cap').focus()
    expect(await page.evaluate(() => window.cambi)).toEqual(['CAP'])
  })

  // il caso che conta: nei gestionali l'etichetta sta nella cella di fianco
  test("pesca l'etichetta dalla cella accanto quando non c'è <label for>", async ({ page }) => {
    await avvia(page, 'legacy.html')
    await page.locator('#txt2').focus()
    expect(await page.evaluate(() => window.cambi)).toEqual(['Cod. Fisc.'])

    await page.locator('#txt7').focus()
    expect(await page.evaluate(() => window.cambi)).toEqual(['Cod. Fisc.', 'Coordinate bancarie'])
  })
})

test.describe('memoria del campo', () => {
  // il motivo per cui la classe esiste: cliccare una chip toglie il fuoco alla pagina
  test('ricorda il campo dopo che il fuoco ha lasciato la pagina', async ({ page }) => {
    await avvia(page, 'plain.html')
    await page.locator('#email').focus()

    // simula il fuoco che se ne va, come quando si clicca nel pannello laterale
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY')

    // activeElement è il body, ma noi sappiamo ancora dove scrivere
    expect(await page.evaluate(() => window.CampoAttivo.campoAttivo()?.id)).toBe('email')
  })

  test('il campo tracciato è evidenziato', async ({ page }) => {
    await avvia(page, 'plain.html')
    await page.locator('#nome').focus()
    await expect(page.locator('#nome')).toHaveClass(/incolla-campo-attivo/)

    await page.locator('#email').focus()
    await expect(page.locator('#nome')).not.toHaveClass(/incolla-campo-attivo/)
    await expect(page.locator('#email')).toHaveClass(/incolla-campo-attivo/)
  })

  test('dimentica un campo tolto dal DOM', async ({ page }) => {
    await avvia(page, 'plain.html')
    await page.locator('#nome').focus()
    await page.evaluate(() => document.getElementById('nome')!.remove())
    await expect.poll(() => page.evaluate(() => window.CampoAttivo.campoAttivo())).toBeNull()
    expect(await page.evaluate(() => window.cambi.at(-1))).toBeNull()
  })

  test('ignora i campi non riempibili', async ({ page }) => {
    await avvia(page, 'plain.html')
    await page.evaluate(() => {
      const b = document.createElement('input')
      b.type = 'checkbox'; b.id = 'spunta'
      document.getElementById('f')!.append(b)
    })
    await page.locator('#spunta').focus()
    expect(await page.evaluate(() => window.cambi)).toEqual([])
  })
})

test('il giro completo: traccia un campo e ci scrive dentro', async ({ page }) => {
  await avvia(page, 'legacy.html')
  await iniettaRiempi(page)

  await page.locator('#txt2').focus()
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())

  const ok = await page.evaluate(() =>
    window.Incolla.riempi(window.CampoAttivo.campoAttivo(), 'RSSMRA85T10A562S').ok)

  expect(ok).toBe(true)
  await expect(page.locator('#txt2')).toHaveValue('RSSMRA85T10A562S')
})
