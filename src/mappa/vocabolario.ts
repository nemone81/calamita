import type { TipoSlot } from '../shared/tipi.js'

/**
 * Come si chiamano le cose nei form italiani. Serve a legare l'etichetta di un
 * campo ("Recapito telefonico") a un tipo ("tel") quando il markup non dice nulla.
 *
 * Le parole sono normalizzate: minuscole, senza accenti, senza punteggiatura.
 */
export const PAROLE_PER_TIPO: Record<TipoSlot, string[]> = {
  email: ['email', 'e mail', 'mail', 'posta elettronica', 'indirizzo email', 'pec', 'e-mail'],
  tel: ['telefono', 'tel', 'cellulare', 'cell', 'mobile', 'recapito', 'recapito telefonico', 'phone'],
  'postal-code': ['cap', 'codice avviamento postale', 'codice postale', 'zip', 'postal code'],
  url: ['sito', 'sito web', 'url', 'pagina web', 'website'],
  'codice-fiscale': ['codice fiscale', 'cod fisc', 'cf', 'c f', 'fiscal code'],
  iban: ['iban', 'coordinate bancarie', 'coordinate', 'conto corrente', 'codice iban'],
  'partita-iva': ['partita iva', 'p iva', 'piva', 'vat', 'vat europeo', 'partita i v a'],
  data: ['data', 'data di nascita', 'nato il', 'nata il', 'scadenza', 'del', 'date'],
  importo: ['importo', 'totale', 'prezzo', 'costo', 'somma', 'ammontare', 'euro'],
  testo: [],
}

/**
 * Concetti che non hanno un tipo proprio ma sono i più comuni nei form.
 * Legano l'ETICHETTA della chip a quella del campo, che è ciò che resta quando
 * il tipo non aiuta: nome, cognome e via sono tutti "testo".
 */
export const CONCETTI: { chiave: string; parole: string[]; autocomplete: string | null }[] = [
  { chiave: 'nome', parole: ['nome', 'first name', 'given name'], autocomplete: 'given-name' },
  { chiave: 'cognome', parole: ['cognome', 'last name', 'family name', 'surname'], autocomplete: 'family-name' },
  { chiave: 'nominativo', parole: ['nominativo', 'nome e cognome', 'intestatario', 'full name',
      'denominazione', 'ragione sociale', 'rag sociale', 'societa', 'azienda', 'company'], autocomplete: 'name' },
  { chiave: 'indirizzo', parole: ['indirizzo', 'via', 'residenza', 'domicilio', 'street', 'address', 'indirizzo residenza'], autocomplete: 'street-address' },
  { chiave: 'citta', parole: ['citta', 'comune', 'localita', 'city', 'town'], autocomplete: 'address-level2' },
  { chiave: 'provincia', parole: ['provincia', 'prov', 'state', 'region'], autocomplete: 'address-level1' },
  { chiave: 'nazione', parole: ['nazione', 'paese', 'stato', 'country'], autocomplete: 'country-name' },
  { chiave: 'civico', parole: ['civico', 'numero civico', 'n civico'], autocomplete: null },
  { chiave: 'dipendenti', parole: ['dipendenti', 'numero dipendenti', 'addetti', 'employees'], autocomplete: null },
  { chiave: 'rea', parole: ['rea', 'numero rea', 'iscrizione rea'], autocomplete: null },
  { chiave: 'referente', parole: ['referente', 'contatto', 'contatto referente'], autocomplete: null },
]

/**
 * Parole troppo comuni nei form per significare qualcosa da sole. Senza questa
 * lista "Codice Fiscale" abbina "Codice Agenzia" sulla sola parola "codice",
 * e un valore finisce nel campo sbagliato.
 */
export const GENERICHE = new Set([
  'codice', 'numero', 'dati', 'dato', 'campo', 'inserisci', 'indica', 'inserire',
  'riferimento', 'tipo', 'altro', 'altra', 'della', 'delle', 'nella', 'interessata',
  'interessato', 'azienda', 'agenzia', 'referente', 'obbligatorio',
])

export function normalizza(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // via gli accenti
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // I gestionali scrivono le sigle col punto: "C.A.P.", "C.F.", "P.IVA".
  // Tolta la punteggiatura restano lettere sparse ("c a p"), che non combaciano
  // con niente. Si ricompongono le sequenze di lettere singole.
  return base.replace(/\b(?:[a-z] ){1,}[a-z]\b/g, (m) => m.replace(/ /g, ''))
}
