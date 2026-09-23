import { claude } from './provider/anthropic.js'
import { gemini } from './provider/google.js'
import { grok, muse, openai } from './provider/openai.js'
import type { IdProvider, Ingresso, Provider } from './provider/tipi.js'
import { chiaveDi, modelloDi, providerAttivo } from '../shared/chiavi.js'
import type { Slot } from '../shared/tipi.js'

/**
 * L'unico punto del programma che parla con un'API di intelligenza artificiale.
 * `grep -rE 'anthropic|openai|googleapis|api\.x\.ai|api\.meta\.ai' src/` deve
 * trovare solo `src/ai/`: è un criterio di successo della spec, non un vezzo.
 */

export const PROVIDER: Record<IdProvider, Provider> = {
  claude, openai, gemini, grok, muse,
}

export const ELENCO = Object.values(PROVIDER)

export type EsitoEstrazione =
  | { ok: true; slot: Slot[]; provider: string }
  | { ok: false; errore: string }

/** Cosa sta per uscire e verso chi: il pannello lo mostra PRIMA di chiamare. */
export async function anteprima(): Promise<{ provider: Provider; modello: string } | null> {
  const id = await providerAttivo()
  if (!id) return null
  const provider = PROVIDER[id]
  return { provider, modello: (await modelloDi(id)) ?? provider.modelloDefault }
}

export async function estraiConAI(ingresso: Ingresso): Promise<EsitoEstrazione> {
  const scelta = await anteprima()
  if (!scelta) return { ok: false, errore: 'nessun provider scelto: aprine le opzioni' }

  const { provider, modello } = scelta
  if (ingresso.tipo === 'immagine' && !provider.supportaImmagini) {
    return { ok: false, errore: `${provider.nome} non legge immagini` }
  }

  const chiave = await chiaveDi(provider.id)
  if (!chiave) return { ok: false, errore: `manca la chiave di ${provider.nome}` }

  try {
    const slot = await provider.estrai(ingresso, chiave, modello)
    return slot.length
      ? { ok: true, slot, provider: provider.nome }
      : { ok: false, errore: `${provider.nome} non ha trovato dati utilizzabili` }
  } catch (e) {
    return { ok: false, errore: messaggioUtile(provider.nome, e) }
  }
}

function messaggioUtile(nome: string, e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/401|403|api[_ ]?key|unauthor/i.test(m)) return `${nome}: chiave rifiutata`
  if (/429|rate.?limit|quota/i.test(m)) return `${nome}: troppe richieste, riprova fra poco`
  if (/404|model/i.test(m)) return `${nome}: modello non trovato — controlla le opzioni`
  if (/fetch|network|Failed to fetch/i.test(m)) return `${nome}: rete non raggiungibile`
  return `${nome}: ${m.slice(0, 120)}`
}
