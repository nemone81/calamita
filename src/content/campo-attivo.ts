/**
 * Quale campo riempirà la prossima chip.
 *
 * `document.activeElement` non basta: cliccando una chip nel pannello il fuoco
 * lascia la pagina, e al momento del riempimento activeElement è già il `<body>`.
 * Si tiene quindi memoria dell'**ultimo** campo che ha ricevuto il fuoco, e la si
 * mostra con un contorno perché l'utente sappia dove sta per finire il valore.
 */

const TIPI_NON_TESTUALI = new Set([
  'checkbox', 'radio', 'file', 'submit', 'reset', 'button', 'image', 'hidden', 'range', 'color',
])

const CLASSE = 'incolla-campo-attivo'
let ultimo: HTMLElement | null = null

export function avviaTracciamento(alCambio: (descrizione: string | null) => void): void {
  iniettaStile()

  document.addEventListener('focusin', (e) => {
    const t = e.target
    if (!(t instanceof HTMLElement) || !riempibile(t)) return
    if (t === ultimo) return
    ultimo?.classList.remove(CLASSE)
    ultimo = t
    t.classList.add(CLASSE)
    alCambio(descrivi(t))
  }, true)

  // se il campo sparisce dal DOM (navigazione SPA, modale chiusa) smettiamo di puntarlo
  new MutationObserver(() => {
    if (ultimo && !ultimo.isConnected) { ultimo = null; alCambio(null) }
  }).observe(document.documentElement, { childList: true, subtree: true })
}

export const campoAttivo = (): HTMLElement | null =>
  ultimo?.isConnected ? ultimo : null

/** Un nome leggibile, per dire all'utente dove sta per andare il valore. */
export function descrivi(e: HTMLElement): string {
  const perLabel = e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)?.textContent
  const aria = e.getAttribute('aria-label')
  const segnaposto = (e as HTMLInputElement).placeholder
  const dentroLabel = e.closest('label')?.textContent
  // i gestionali mettono l'etichetta nella cella di fianco, senza <label for>
  const cellaAccanto = e.closest('td')?.previousElementSibling?.textContent

  const grezzo = perLabel || aria || segnaposto || dentroLabel || cellaAccanto
    || e.getAttribute('name') || e.id || e.tagName.toLowerCase()
  return grezzo.trim().replace(/\s+/g, ' ').slice(0, 40)
}

function riempibile(e: HTMLElement): boolean {
  if (e instanceof HTMLTextAreaElement || e instanceof HTMLSelectElement) return true
  if (e instanceof HTMLInputElement) return !TIPI_NON_TESTUALI.has(e.type)
  return e.isContentEditable
}

function iniettaStile(): void {
  if (document.getElementById('incolla-stile')) return
  const s = document.createElement('style')
  s.id = 'incolla-stile'
  s.textContent = `.${CLASSE}{outline:2px solid #2563eb!important;outline-offset:1px!important}`
  document.documentElement.appendChild(s)
}
