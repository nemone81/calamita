import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Page } from '@playwright/test'

const radice = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))

const cache = new Map<string, string>()

/**
 * Impacchetta un modulo del sorgente e lo inietta nella pagina sotto `globalName`.
 * I test provano così il codice vero, non una sua trascrizione.
 */
export async function inietta(page: Page, modulo: string, globalName: string): Promise<void> {
  let js = cache.get(modulo)
  if (!js) {
    const r = await build({
      entryPoints: [path.join(radice, modulo)],
      bundle: true, format: 'iife', globalName, write: false, target: 'chrome120',
    })
    js = r.outputFiles[0]!.text
    cache.set(modulo, js)
  }
  await page.addScriptTag({ content: js })
}

export const iniettaRiempi = (page: Page) => inietta(page, 'src/fill/riempi.ts', 'Incolla')
export const iniettaCampoAttivo = (page: Page) => inietta(page, 'src/content/campo-attivo.ts', 'CampoAttivo')
export const iniettaScansiona = (page: Page) => inietta(page, 'src/content/scansiona.ts', 'Scansiona')
export const iniettaAbbina = (page: Page) => inietta(page, 'src/mappa/abbina.ts', 'Abbina')

export const urlFixture = (nome: string) =>
  'file://' + path.join(radice, 'tests/fixtures', nome)
