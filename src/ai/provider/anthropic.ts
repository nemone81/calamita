import Anthropic from '@anthropic-ai/sdk'
import { PROMPT, SCHEMA_ESTRAZIONE } from './schema.js'
import { ErroreProvider, inSlot, jsonDaTesto } from './comune.js'
import { MODELLO_DEFAULT } from './modelli.js'
import type { Provider } from './tipi.js'

export const claude: Provider = {
  id: 'claude',
  nome: 'Claude',
  host: 'api.anthropic.com',
  modelloDefault: MODELLO_DEFAULT.claude,
  supportaImmagini: true,
  urlChiavi: 'https://console.anthropic.com/settings/keys',

  async estrai(ingresso, chiave, modello = MODELLO_DEFAULT.claude) {
    // consentito qui perché la chiave è dell'utente e non lascia il suo browser
    const client = new Anthropic({ apiKey: chiave, dangerouslyAllowBrowser: true })

    const contenuto: Anthropic.ContentBlockParam[] = ingresso.tipo === 'testo'
      ? [{ type: 'text', text: `${PROMPT}\n\n---\n${ingresso.testo}` }]
      : [
          { type: 'image', source: { type: 'base64', media_type: ingresso.mime as 'image/png', data: ingresso.base64 } },
          { type: 'text', text: PROMPT },
        ]

    const r = await client.messages.create({
      model: modello,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: SCHEMA_ESTRAZIONE } },
      messages: [{ role: 'user', content: contenuto }],
    })

    if (r.stop_reason === 'refusal') throw new ErroreProvider('Claude', 'richiesta rifiutata')

    const testo = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    return inSlot(jsonDaTesto(testo))
  },

  async elencaModelli(chiave) {
    const client = new Anthropic({ apiKey: chiave, dangerouslyAllowBrowser: true })
    const r = await client.models.list({ limit: 50 })
    return r.data.map((m) => m.id)
  },
}
