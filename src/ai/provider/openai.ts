import OpenAI from 'openai'
import { PROMPT, SCHEMA_ESTRAZIONE } from './schema.js'
import { ErroreProvider, inSlot, jsonDaTesto } from './comune.js'
import { MODELLO_DEFAULT } from './modelli.js'
import type { IdProvider, Provider } from './tipi.js'

/**
 * Un adattatore per tre provider. Grok (xAI) e Muse (Meta) parlano il protocollo
 * OpenAI: cambia la base URL, non il codice. Muse accetta anche il formato
 * Anthropic — usiamo questo perché è già qui.
 */
function fabbrica(
  id: IdProvider, nome: string, baseURL: string, host: string,
  urlChiavi: string, supportaImmagini = true,
): Provider {
  const client = (chiave: string) =>
    new OpenAI({ apiKey: chiave, baseURL, dangerouslyAllowBrowser: true })

  return {
    id, nome, host, urlChiavi, supportaImmagini,
    modelloDefault: MODELLO_DEFAULT[id],

    async estrai(ingresso, chiave, modello = MODELLO_DEFAULT[id]) {
      const contenuto: OpenAI.Chat.ChatCompletionContentPart[] = ingresso.tipo === 'testo'
        ? [{ type: 'text', text: `${PROMPT}\n\n---\n${ingresso.testo}` }]
        : [
            { type: 'image_url', image_url: { url: `data:${ingresso.mime};base64,${ingresso.base64}` } },
            { type: 'text', text: PROMPT },
          ]

      const r = await client(chiave).chat.completions.create({
        model: modello,
        messages: [{ role: 'user', content: contenuto }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'estrazione', strict: true, schema: SCHEMA_ESTRAZIONE },
        },
      })

      const scelta = r.choices[0]
      if (scelta?.finish_reason === 'length') throw new ErroreProvider(nome, 'risposta troncata')

      return inSlot(jsonDaTesto(scelta?.message?.content ?? ''))
    },

    async elencaModelli(chiave) {
      const r = await client(chiave).models.list()
      return r.data.map((m) => m.id).sort()
    },
  }
}

export const openai = fabbrica(
  'openai', 'OpenAI', 'https://api.openai.com/v1', 'api.openai.com',
  'https://platform.openai.com/api-keys')

export const grok = fabbrica(
  'grok', 'Grok', 'https://api.x.ai/v1', 'api.x.ai',
  'https://console.x.ai')

export const muse = fabbrica(
  'muse', 'Muse', 'https://api.meta.ai/v1', 'api.meta.ai',
  'https://developers.meta.ai')
