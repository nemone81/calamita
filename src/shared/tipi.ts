/** Il record canonico: l'unico contratto fra estrazione e riempimento. */
export type Slot = {
  id: string
  /** tipo canonico; coincide col token `autocomplete` WHATWG dove ne esiste uno */
  tipo: TipoSlot
  /** token WHATWG, quando c'è: è ciò che farà ereditare al v1 la mappatura deterministica */
  autocomplete: string | null
  /** etichetta mostrata sulla chip */
  etichetta: string
  valore: string
  origine: 'regex' | 'kv' | 'ai' | 'manuale'
  /** 0-1. Vale 1 solo quando un checksum ha confermato il valore. */
  confidenza: number
}

export type TipoSlot =
  | 'email' | 'tel' | 'postal-code' | 'url'
  | 'codice-fiscale' | 'iban' | 'partita-iva'
  | 'data' | 'importo'
  | 'testo'

/** Un frammento grezzo prima di essere tipizzato. */
export type Frammento = {
  /** l'etichetta trovata accanto al valore, se il documento la dava ("CAP: 00184") */
  etichetta: string | null
  valore: string
}
