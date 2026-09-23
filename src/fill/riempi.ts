/**
 * Riempimento di un campo altrui.
 *
 * `elemento.value = x` aggiorna il DOM ma non lo stato di React: il campo sembra
 * pieno finché il componente non si ri-renderizza, poi torna vuoto. React ascolta
 * l'evento `input` e legge il valore tramite il setter nativo del prototipo, che
 * la sua patch sull'istanza ha sostituito. Bisogna quindi chiamare **il setter del
 * prototipo** e poi emettere gli eventi a mano.
 *
 * Vale anche per Vue e per chiunque altro sovrascriva la proprietà sull'istanza.
 */

export type EsitoRiempimento =
  | { ok: true; valoreScritto: string; troncato: boolean }
  | { ok: false; motivo: MotivoFallimento }

export type MotivoFallimento =
  | 'elemento-non-riempibile'
  | 'campo-in-sola-lettura'
  | 'campo-disabilitato'
  | 'nessuna-opzione-corrispondente'
  | 'il campo accetta solo numeri'

type Riempibile = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

const TIPI_NON_TESTUALI = new Set([
  'checkbox', 'radio', 'file', 'submit', 'reset', 'button', 'image', 'hidden', 'range', 'color',
])

export function riempi(elemento: Element | null, valore: string): EsitoRiempimento {
  if (!elemento || !riempibile(elemento)) return { ok: false, motivo: 'elemento-non-riempibile' }
  if (elemento.disabled) return { ok: false, motivo: 'campo-disabilitato' }
  if ('readOnly' in elemento && elemento.readOnly) return { ok: false, motivo: 'campo-in-sola-lettura' }

  if (elemento instanceof HTMLSelectElement) return riempiSelect(elemento, valore)

  // Un <input type="number"> scarta in SILENZIO ciò che non è un numero: il campo
  // resta vuoto e nessuno protesta. "629 (2026)" diventa 629; se non c'è proprio
  // un numero, si dichiara il fallimento invece di fingere che sia andata bene.
  if (elemento instanceof HTMLInputElement && elemento.type === 'number') {
    const numero = valore.replace(/\./g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]
    if (!numero) return { ok: false, motivo: 'il campo accetta solo numeri' }
    scriviColSetterNativo(elemento, numero)
    emettiEventi(elemento)
    return { ok: true, valoreScritto: numero, troncato: numero !== valore.trim() }
  }

  // un `maxlength` è un'informazione, non un ostacolo: il campo CAP che accetta 5
  // caratteri sta dicendo che vuole un CAP
  const max = elemento.maxLength
  const troncato = max > 0 && valore.length > max
  const valoreScritto = troncato ? valore.slice(0, max) : valore

  scriviColSetterNativo(elemento, valoreScritto)
  emettiEventi(elemento)

  return { ok: true, valoreScritto, troncato }
}

/** Anche i `contenteditable` capitano, e non hanno `value`. */
export function riempiContenteditable(elemento: HTMLElement, valore: string): EsitoRiempimento {
  if (!elemento.isContentEditable) return { ok: false, motivo: 'elemento-non-riempibile' }
  elemento.textContent = valore
  emettiEventi(elemento)
  return { ok: true, valoreScritto: valore, troncato: false }
}

function riempibile(e: Element): e is Riempibile {
  if (e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement) return true
  if (e instanceof HTMLInputElement) return !TIPI_NON_TESTUALI.has(e.type)
  return false
}

function scriviColSetterNativo(e: HTMLInputElement | HTMLTextAreaElement, valore: string): void {
  const proto = e instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(e, valore)
  else e.value = valore   // ripiego: meglio un DOM aggiornato che niente
}

function emettiEventi(e: HTMLElement): void {
  e.dispatchEvent(new Event('input', { bubbles: true }))
  e.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Su un `<select>` il valore incollato non è quasi mai il `value` dell'opzione:
 * è il suo testo ("Roma", non "RM"). Si prova l'uno e poi l'altro.
 */
function riempiSelect(e: HTMLSelectElement, valore: string): EsitoRiempimento {
  const norm = (s: string) => s.trim().toLowerCase()
  const cercato = norm(valore)

  const opzione =
    Array.from(e.options).find((o) => norm(o.value) === cercato) ??
    Array.from(e.options).find((o) => norm(o.textContent ?? '') === cercato) ??
    Array.from(e.options).find((o) => norm(o.textContent ?? '').startsWith(cercato))

  if (!opzione) return { ok: false, motivo: 'nessuna-opzione-corrispondente' }

  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  if (setter) setter.call(e, opzione.value)
  else e.value = opzione.value
  emettiEventi(e)

  return { ok: true, valoreScritto: opzione.value, troncato: false }
}
