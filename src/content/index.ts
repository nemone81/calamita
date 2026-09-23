import { riempi, riempiContenteditable } from '../fill/riempi.js'
import { avviaTracciamento, campoAttivo, descrivi } from './campo-attivo.js'
import type { Messaggio } from '../shared/messaggi.js'

avviaTracciamento((descrizione) => {
  chrome.runtime.sendMessage({ tipo: 'campo-attivo-cambiato', descrizione }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: Messaggio, _m, rispondi) => {
  if (msg.tipo !== 'riempi-campo-attivo') return false

  const campo = campoAttivo()
  if (!campo) { rispondi({ ok: false, motivo: 'clicca prima un campo del form' }); return false }

  const esito = campo.isContentEditable
    ? riempiContenteditable(campo, msg.valore)
    : riempi(campo, msg.valore)

  if (!esito.ok) { rispondi({ ok: false, motivo: leggibile(esito.motivo) }); return false }

  // il fuoco torna al campo: così si può proseguire con Tab senza toccare il mouse
  campo.focus()
  rispondi({ ok: true, dove: descrivi(campo), troncato: esito.troncato })
  return false
})

function leggibile(m: string): string {
  return {
    'elemento-non-riempibile': 'quel campo non si può riempire',
    'campo-in-sola-lettura': 'campo in sola lettura',
    'campo-disabilitato': 'campo disabilitato',
    'nessuna-opzione-corrispondente': "nessuna opzione corrisponde a quel valore",
  }[m] ?? m
}
