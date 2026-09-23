import { descrivi } from './campo-attivo.js'
import type { Campo } from '../mappa/abbina.js'

const NON_TESTUALI = new Set([
  'checkbox', 'radio', 'file', 'submit', 'reset', 'button', 'image', 'hidden', 'range', 'color',
])

/**
 * I campi riempibili della pagina, descritti senza riferimenti al DOM così che
 * l'abbinamento possa avvenire altrove ed essere testato senza un browser.
 *
 * L'ordine dell'array è l'indice: è il solo legame fra descrizione ed elemento,
 * e regge finché la pagina non cambia sotto i piedi — motivo per cui si riscansiona
 * subito prima di riempire, invece di fidarsi di una scansione vecchia.
 */
export function elementiRiempibili(): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] {
  const tutti = document.querySelectorAll<HTMLElement>('input, textarea, select')
  return Array.from(tutti).filter((e): e is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
    if (e instanceof HTMLSelectElement || e instanceof HTMLTextAreaElement) return visibile(e)
    if (!(e instanceof HTMLInputElement)) return false
    return !NON_TESTUALI.has(e.type) && !e.disabled && !e.readOnly && visibile(e)
  })
}

export function scansiona(): Campo[] {
  return elementiRiempibili().map((e, indice) => ({
    indice,
    autocomplete: e.getAttribute('autocomplete'),
    name: e.getAttribute('name'),
    id: e.id || null,
    etichetta: descrivi(e),
    tipoInput: e instanceof HTMLInputElement ? e.type : e.tagName.toLowerCase(),
    maxLength: 'maxLength' in e ? e.maxLength : -1,
    opzioni: e instanceof HTMLSelectElement
      ? Array.from(e.options).map((o) => o.textContent ?? '').filter(Boolean)
      : [],
    giaPieno: 'value' in e ? Boolean(e.value.trim()) : false,
  }))
}

/** Un campo nascosto non è un campo: riempirlo non si vedrebbe e non si potrebbe correggere. */
function visibile(e: HTMLElement): boolean {
  if (!e.isConnected) return false
  const r = e.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return false
  const st = getComputedStyle(e)
  return st.visibility !== 'hidden' && st.display !== 'none'
}
