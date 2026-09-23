/**
 * Checksum, non forme. Un CF è "sedici caratteri giusti" solo se l'ultimo torna;
 * undici cifre non sono una partita IVA. È questo che separa un riconoscimento
 * affidabile da un falso positivo che riempie il campo sbagliato.
 */

const PARI: Record<string, number> = {}
for (let i = 0; i <= 9; i++) PARI[String(i)] = i
for (let i = 0; i < 26; i++) PARI[String.fromCharCode(65 + i)] = i

const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}

/** Carattere di controllo del codice fiscale, calcolato dai primi 15. */
export function cfCarattereControllo(primi15: string): string | null {
  const s = primi15.toUpperCase()
  if (s.length !== 15) return null
  let somma = 0
  for (let i = 0; i < 15; i++) {
    const c = s[i]!
    // posizione 1-indicizzata: i pari dell'indice sono i dispari della posizione
    const tabella = i % 2 === 0 ? DISPARI : PARI
    const v = tabella[c]
    if (v === undefined) return null
    somma += v
  }
  return String.fromCharCode(65 + (somma % 26))
}

export function cfValido(cf: string): boolean {
  const s = cf.toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z0-9]{16}$/.test(s)) return false
  return cfCarattereControllo(s.slice(0, 15)) === s[15]
}

/** IBAN: mod-97 sull'intera stringa riordinata. Vale per ogni paese, non solo IT. */
export function ibanValido(iban: string): boolean {
  const s = iban.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const riordinato = s.slice(4) + s.slice(0, 4)
  let resto = 0
  for (const c of riordinato) {
    const v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55)
    for (const cifra of v) resto = (resto * 10 + Number(cifra)) % 97
  }
  return resto === 1
}

/** Partita IVA italiana: 11 cifre, controllo di Luhn all'italiana. */
export function partitaIvaValida(piva: string): boolean {
  const s = piva.replace(/[\s.]/g, '')
  if (!/^\d{11}$/.test(s)) return false
  let somma = 0
  for (let i = 0; i < 10; i++) {
    const d = Number(s[i])
    if (i % 2 === 0) somma += d
    else {
      const doppio = d * 2
      somma += doppio > 9 ? doppio - 9 : doppio
    }
  }
  return (10 - (somma % 10)) % 10 === Number(s[10])
}
