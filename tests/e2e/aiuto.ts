import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Page } from '@playwright/test'

const radice = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))

let cache: string | null = null

/**
 * Impacchetta `src/fill/riempi.ts` e lo inietta nella pagina come `window.Incolla`.
 * Così i test provano il codice vero, non una sua trascrizione.
 */
export async function iniettaRiempi(page: Page): Promise<void> {
  if (!cache) {
    const r = await build({
      entryPoints: [path.join(radice, 'src/fill/riempi.ts')],
      bundle: true, format: 'iife', globalName: 'Incolla', write: false, target: 'chrome120',
    })
    cache = r.outputFiles[0]!.text
  }
  await page.addScriptTag({ content: cache })
}

export const urlFixture = (nome: string) =>
  'file://' + path.join(radice, 'tests/fixtures', nome)
