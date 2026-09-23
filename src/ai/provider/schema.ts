/**
 * Lo schema del record canonico è UNO. Ogni adattatore lo traduce nel dialetto del
 * suo provider — `output_config.format` su Anthropic, `response_format` su OpenAI,
 * `responseSchema` su Google — ma la forma che torna è sempre questa.
 */

export const TIPI_AMMESSI = [
  'email', 'tel', 'postal-code', 'url',
  'codice-fiscale', 'iban', 'partita-iva',
  'data', 'importo', 'testo',
] as const

export const SCHEMA_ESTRAZIONE = {
  type: 'object',
  additionalProperties: false,
  required: ['valori'],
  properties: {
    valori: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['etichetta', 'valore', 'tipo'],
        properties: {
          etichetta: { type: 'string', description: 'Nome del dato in italiano, es. "Codice fiscale"' },
          valore: { type: 'string', description: 'Il valore, ripulito da etichette e punteggiatura di contorno' },
          tipo: { type: 'string', enum: TIPI_AMMESSI },
        },
      },
    },
  },
} as const

export const PROMPT = `Estrai da questo documento i dati che servirebbero a compilare un modulo.

Regole:
- Un valore per voce, già pulito: "00184", non "CAP: 00184".
- Usa l'etichetta che il documento stesso dà al dato, se c'è; altrimenti scegline una in italiano.
- Separa ciò che sta in campi distinti di un modulo: nome e cognome sono due voci, non una.
- Non inventare e non dedurre: se un dato non c'è, non metterlo.
- Non includere testo discorsivo, intestazioni, note legali o numeri di pagina.
- Scegli il tipo più specifico che si applica; usa "testo" quando nessun altro calza.`
