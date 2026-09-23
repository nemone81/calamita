import { GoogleGenAI } from '@google/genai'
import { PROMPT, SCHEMA_ESTRAZIONE } from './schema.js'
import { inSlot, jsonDaTesto } from './comune.js'
import { MODELLO_DEFAULT } from './modelli.js'
import type { Provider } from './tipi.js'

/**
 * Google ha un dialetto tutto suo: `responseSchema` invece di `response_format`,
 * e uno schema che non accetta `additionalProperties`. Lo schema canonico resta
 * uno, qui si traduce.
 */
export function perGoogle(s: typeof SCHEMA_ESTRAZIONE): Record<string, unknown> {
  const via = (o: unknown): unknown => {
    if (Array.isArray(o)) return o.map(via)
    if (o && typeof o === 'object') {
      return Object.fromEntries(
        Object.entries(o)
          .filter(([k]) => k !== 'additionalProperties')
          .map(([k, v]) => [k, via(v)]),
      )
    }
    return o
  }
  return via(s) as Record<string, unknown>
}

export const gemini: Provider = {
  id: 'gemini',
  nome: 'Gemini',
  host: 'generativelanguage.googleapis.com',
  modelloDefault: MODELLO_DEFAULT.gemini,
  supportaImmagini: true,
  urlChiavi: 'https://aistudio.google.com/apikey',

  async estrai(ingresso, chiave, modello = MODELLO_DEFAULT.gemini) {
    const ai = new GoogleGenAI({ apiKey: chiave })

    const parti = ingresso.tipo === 'testo'
      ? [{ text: `${PROMPT}\n\n---\n${ingresso.testo}` }]
      : [{ inlineData: { mimeType: ingresso.mime, data: ingresso.base64 } }, { text: PROMPT }]

    const r = await ai.models.generateContent({
      model: modello,
      contents: [{ role: 'user', parts: parti }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: perGoogle(SCHEMA_ESTRAZIONE),
      },
    })

    return inSlot(jsonDaTesto(r.text ?? ''))
  },

  async elencaModelli(chiave) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chiave)}`)
    const d = await r.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
    return (d.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .sort()
  },
}
