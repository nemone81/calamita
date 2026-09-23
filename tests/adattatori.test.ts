import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { inSlot, jsonDaTesto } from '../src/ai/provider/comune.js'
import { perGoogle } from '../src/ai/provider/google.js'
import { SCHEMA_ESTRAZIONE } from '../src/ai/provider/schema.js'

describe('inSlot — il modello può sbagliare anche con lo schema imposto', () => {
  it('converte una risposta ben formata', () => {
    const s = inSlot({ valori: [{ etichetta: 'CAP', valore: '00184', tipo: 'postal-code' }] })
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ etichetta: 'CAP', valore: '00184', tipo: 'postal-code', origine: 'ai' })
  })

  it('non dà mai confidenza 1 a un valore estratto dall\'AI', () => {
    const s = inSlot({ valori: [{ etichetta: 'IBAN', valore: 'IT60X054', tipo: 'iban' }] })
    expect(s[0]!.confidenza).toBeLessThan(1)
  })

  it('scarta le voci senza etichetta o senza valore invece di lasciarle passare', () => {
    const s = inSlot({ valori: [
      { etichetta: '', valore: 'x', tipo: 'testo' },
      { etichetta: 'Vuoto', valore: '   ', tipo: 'testo' },
      { etichetta: 'Buono', valore: 'ok', tipo: 'testo' },
    ] })
    expect(s.map((x) => x.etichetta)).toEqual(['Buono'])
  })

  it('degrada a "testo" un tipo che non conosce, invece di propagarlo', () => {
    expect(inSlot({ valori: [{ etichetta: 'X', valore: 'y', tipo: 'inventato' }] })[0]!.tipo).toBe('testo')
  })

  it('regge una risposta completamente sbagliata', () => {
    expect(inSlot(null)).toEqual([])
    expect(inSlot({})).toEqual([])
    expect(inSlot({ valori: 'non un array' })).toEqual([])
    expect(inSlot({ valori: [null, 42, 'testo'] })).toEqual([])
  })
})

describe('jsonDaTesto', () => {
  it('legge il JSON nudo', () => {
    expect(jsonDaTesto('{"a":1}')).toEqual({ a: 1 })
  })

  // capita anche quando si impone lo schema
  it('toglie il blocco markdown che il modello a volte aggiunge', () => {
    expect(jsonDaTesto('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(jsonDaTesto('```\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('torna null invece di lanciare su testo non JSON', () => {
    expect(jsonDaTesto('mi dispiace, non posso')).toBeNull()
  })
})

describe('perGoogle — lo schema canonico tradotto nel dialetto Google', () => {
  it('toglie additionalProperties a ogni livello', () => {
    const g = JSON.stringify(perGoogle(SCHEMA_ESTRAZIONE))
    expect(g).not.toContain('additionalProperties')
  })

  it('conserva tutto il resto', () => {
    const g = perGoogle(SCHEMA_ESTRAZIONE) as any
    expect(g.properties.valori.items.required).toEqual(['etichetta', 'valore', 'tipo'])
    expect(g.properties.valori.items.properties.tipo.enum).toContain('codice-fiscale')
  })

  it('non modifica lo schema originale', () => {
    const prima = JSON.stringify(SCHEMA_ESTRAZIONE)
    perGoogle(SCHEMA_ESTRAZIONE)
    expect(JSON.stringify(SCHEMA_ESTRAZIONE)).toBe(prima)
  })
})

// ---- forma della richiesta: si controlla cosa parte, senza spendere denaro ----

type Chiamata = { url: string; corpo: any; headers: Record<string, string> }

function stubFetch(risposta: unknown): { chiamate: Chiamata[] } {
  const chiamate: Chiamata[] = []
  vi.stubGlobal('fetch', async (input: any, init: any) => {
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v })
    chiamate.push({
      url: typeof input === 'string' ? input : input.url,
      corpo: init?.body ? JSON.parse(String(init.body)) : null,
      headers,
    })
    return new Response(JSON.stringify(risposta), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  })
  return { chiamate }
}

afterEach(() => vi.unstubAllGlobals())

const VALORI = { valori: [{ etichetta: 'CAP', valore: '00184', tipo: 'postal-code' }] }

describe('adattatore Anthropic', () => {
  it('manda lo schema nel dialetto Anthropic, al modello giusto', async () => {
    const { chiamate } = stubFetch({
      id: 'x', type: 'message', role: 'assistant', model: 'claude-opus-5',
      content: [{ type: 'text', text: JSON.stringify(VALORI) }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    })
    const { claude } = await import('../src/ai/provider/anthropic.js')
    const slot = await claude.estrai({ tipo: 'testo', testo: 'CAP 00184' }, 'chiave-finta')

    expect(chiamate[0]!.url).toContain('api.anthropic.com')
    expect(chiamate[0]!.corpo.output_config.format).toMatchObject({ type: 'json_schema' })
    expect(chiamate[0]!.corpo.model).toBe('claude-opus-5')
    expect(slot[0]).toMatchObject({ etichetta: 'CAP', valore: '00184' })
  })

  it("manda l'immagine come blocco base64, non come testo", async () => {
    const { chiamate } = stubFetch({
      id: 'x', type: 'message', role: 'assistant', model: 'claude-opus-5',
      content: [{ type: 'text', text: JSON.stringify(VALORI) }],
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    })
    const { claude } = await import('../src/ai/provider/anthropic.js')
    await claude.estrai({ tipo: 'immagine', base64: 'AAAA', mime: 'image/png' }, 'chiave-finta')

    const blocchi = chiamate[0]!.corpo.messages[0].content
    expect(blocchi[0]).toMatchObject({ type: 'image', source: { type: 'base64', data: 'AAAA' } })
  })
})

describe('adattatore OpenAI — tre provider, una sola forma', () => {
  const risposta = {
    id: 'x', object: 'chat.completion', created: 0, model: 'm',
    choices: [{ index: 0, finish_reason: 'stop',
      message: { role: 'assistant', content: JSON.stringify(VALORI) } }],
  }

  it.each([
    ['openai', 'api.openai.com'],
    ['grok', 'api.x.ai'],
    ['muse', 'api.meta.ai'],
  ] as const)('%s parla col proprio host', async (id, host) => {
    const { chiamate } = stubFetch(risposta)
    const mod = await import('../src/ai/provider/openai.js')
    await mod[id].estrai({ tipo: 'testo', testo: 'CAP 00184' }, 'chiave-finta')

    expect(chiamate[0]!.url).toContain(host)
    expect(chiamate[0]!.corpo.response_format.json_schema.strict).toBe(true)
  })

  it('la chiave finisce nell\'header, mai nell\'URL', async () => {
    const { chiamate } = stubFetch(risposta)
    const { openai } = await import('../src/ai/provider/openai.js')
    await openai.estrai({ tipo: 'testo', testo: 'x' }, 'sk-segretissima')

    expect(chiamate[0]!.url).not.toContain('sk-segretissima')
    expect(chiamate[0]!.headers['authorization']).toContain('sk-segretissima')
  })
})
