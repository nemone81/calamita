import { REGISTRO, type SchedaProvider } from '../ai/provider/registro.js'
import {
  chiaveDi, impostaProviderAttivo, mascherata, modelloDi,
  providerAttivo, salvaChiave, salvaModello,
} from '../shared/chiavi.js'

const contenitore = document.getElementById('provider') as HTMLDivElement
const salvato = document.getElementById('salvato') as HTMLParagraphElement

let attivo = await providerAttivo()

function segnala() {
  salvato.hidden = false
  setTimeout(() => { salvato.hidden = true }, 1600)
}

async function pannelloProvider(p: SchedaProvider): Promise<HTMLFieldSetElement> {
  const fs = document.createElement('fieldset')
  const chiave = await chiaveDi(p.id)
  const modello = (await modelloDi(p.id)) ?? p.modelloDefault
  fs.dataset.attivo = attivo === p.id ? 'si' : 'no'

  const legend = document.createElement('legend')
  const usa = document.createElement('input')
  usa.type = 'radio'; usa.name = 'attivo'; usa.checked = attivo === p.id
  usa.addEventListener('change', async () => {
    await impostaProviderAttivo(p.id); attivo = p.id; segnala(); await disegna()
  })
  legend.append(usa, document.createTextNode(p.nome))
  const host = document.createElement('span')
  host.className = 'host'; host.textContent = p.host
  legend.append(host)

  // --- chiave ---
  const rigaChiave = document.createElement('div')
  rigaChiave.className = 'riga'
  const lab = document.createElement('label'); lab.textContent = 'Chiave API'
  const campo = document.createElement('input')
  campo.type = 'password'
  campo.placeholder = chiave ? mascherata(chiave) : 'incolla qui la tua chiave'
  const btnSalva = document.createElement('button')
  btnSalva.textContent = 'Salva'; btnSalva.className = 'primario'
  btnSalva.addEventListener('click', async () => {
    if (!campo.value.trim()) return
    await salvaChiave(p.id, campo.value)
    campo.value = ''; segnala(); await disegna()
  })
  const dove = document.createElement('a')
  dove.href = p.urlChiavi; dove.target = '_blank'; dove.rel = 'noreferrer'
  dove.textContent = 'dove prenderla'; dove.style.fontSize = '12px'
  rigaChiave.append(lab, campo, btnSalva, dove)

  // --- modello ---
  const rigaModello = document.createElement('div')
  rigaModello.className = 'riga'
  const labM = document.createElement('label'); labM.textContent = 'Modello'
  const campoM = document.createElement('input')
  campoM.value = modello
  campoM.addEventListener('change', async () => { await salvaModello(p.id, campoM.value); segnala() })

  const stato = document.createElement('p'); stato.className = 'stato'

  // gli id dei modelli cambiano in fretta: meglio chiederli all'account che indovinarli
  const btnElenco = document.createElement('button')
  btnElenco.textContent = 'Carica i modelli'
  btnElenco.disabled = !chiave || !p.elencabile
  btnElenco.addEventListener('click', async () => {
    const k = await chiaveDi(p.id)
    if (!k) return
    stato.textContent = 'chiedo l’elenco…'
    try {
      // l'SDK entra in scena solo qui, non all'apertura della pagina
      const { PROVIDER } = await import('../ai/estrai.js')
      const modelli = await PROVIDER[p.id].elencaModelli!(k)
      const sel = document.createElement('select')
      sel.append(...modelli.map((m) => new Option(m, m, false, m === campoM.value)))
      sel.addEventListener('change', async () => {
        campoM.value = sel.value; await salvaModello(p.id, sel.value); segnala()
      })
      campoM.replaceWith(sel)
      stato.textContent = `${modelli.length} modelli disponibili su questo account.`
    } catch (e) {
      stato.textContent = 'non riesco a leggere l’elenco: ' +
        (e instanceof Error ? e.message.slice(0, 90) : 'errore')
    }
  })
  rigaModello.append(labM, campoM, btnElenco)

  if (!chiave) stato.textContent = 'Nessuna chiave: questo provider non è utilizzabile.'
  else if (!p.supportaImmagini) stato.textContent = 'Chiave presente. Non legge immagini.'
  else stato.textContent = 'Chiave presente. Legge testo e immagini.'

  fs.append(legend, rigaChiave, rigaModello, stato)
  return fs
}

async function disegna() {
  contenitore.replaceChildren(...await Promise.all(REGISTRO.map(pannelloProvider)))
}

await disegna()
