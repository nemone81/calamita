import type { IdProvider } from '../ai/provider/tipi.js'

/**
 * Le chiavi sono dell'utente e restano nel suo browser. Si legge solo quella del
 * provider attivo: non c'è motivo perché il codice veda le altre.
 */

const CHIAVI = 'chiavi'
const ATTIVO = 'providerAttivo'
const MODELLI = 'modelliScelti'

type Chiavi = Partial<Record<IdProvider, string>>

export async function chiaveDi(id: IdProvider): Promise<string | null> {
  const d = await chrome.storage.local.get(CHIAVI)
  return (d[CHIAVI] as Chiavi | undefined)?.[id] ?? null
}

export async function salvaChiave(id: IdProvider, chiave: string): Promise<void> {
  const d = await chrome.storage.local.get(CHIAVI)
  const c = (d[CHIAVI] as Chiavi | undefined) ?? {}
  if (chiave.trim()) c[id] = chiave.trim()
  else delete c[id]
  await chrome.storage.local.set({ [CHIAVI]: c })
}

/** Quali provider hanno una chiave — senza restituire le chiavi. */
export async function provinciConfigurati(): Promise<IdProvider[]> {
  const d = await chrome.storage.local.get(CHIAVI)
  return Object.keys((d[CHIAVI] as Chiavi | undefined) ?? {}) as IdProvider[]
}

export async function providerAttivo(): Promise<IdProvider | null> {
  const d = await chrome.storage.local.get(ATTIVO)
  return (d[ATTIVO] as IdProvider | undefined) ?? null
}

export const impostaProviderAttivo = (id: IdProvider) =>
  chrome.storage.local.set({ [ATTIVO]: id })

export async function modelloDi(id: IdProvider): Promise<string | null> {
  const d = await chrome.storage.local.get(MODELLI)
  return (d[MODELLI] as Partial<Record<IdProvider, string>> | undefined)?.[id] ?? null
}

export async function salvaModello(id: IdProvider, modello: string): Promise<void> {
  const d = await chrome.storage.local.get(MODELLI)
  const m = (d[MODELLI] as Partial<Record<IdProvider, string>> | undefined) ?? {}
  if (modello.trim()) m[id] = modello.trim()
  else delete m[id]
  await chrome.storage.local.set({ [MODELLI]: m })
}

/** Per mostrare una chiave senza mostrarla. */
export const mascherata = (c: string) =>
  c.length <= 8 ? '••••' : `${c.slice(0, 4)}…${'•'.repeat(6)}${c.slice(-2)}`
