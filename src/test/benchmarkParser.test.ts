import { describe, expect, it } from 'vitest'
import { parseBenchmark } from '../parser/benchmarkParser'

const valid = `[QUESTION]
ID: Q01
TEXT: Testo della domanda
A: Prima alternativa
B: Seconda alternativa
C: Terza alternativa
D: Quarta alternativa
E: Quinta alternativa
ANSWER: C

[QUESTION]
ID: Q02
TEXT: Altro testo
A: a
B: b
C: c
D: d
E: e
ANSWER: A`

describe('parser questionario', () => {
  it('parsa un questionario valido', () => {
    const res = parseBenchmark(valid)
    expect(res.ok).toBe(true)
    expect(res.errors).toHaveLength(0)
    expect(res.questions).toHaveLength(2)
    expect(res.questions[0]).toEqual({
      id: 'Q01',
      text: 'Testo della domanda',
      options: {
        A: 'Prima alternativa',
        B: 'Seconda alternativa',
        C: 'Terza alternativa',
        D: 'Quarta alternativa',
        E: 'Quinta alternativa',
      },
      answer: 'C',
    })
  })

  it('rileva ID duplicati', () => {
    const dup = valid.replace('ID: Q02', 'ID: Q01')
    const res = parseBenchmark(dup)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.message === 'ID duplicato')).toBe(true)
  })

  it('rileva opzione mancante', () => {
    const missing = valid.replace('D: Quarta alternativa\n', '')
    const res = parseBenchmark(missing)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.message === 'Opzione D mancante')).toBe(true)
  })

  it('rileva ANSWER non valido', () => {
    const bad = valid.replace('ANSWER: C', 'ANSWER: G')
    const res = parseBenchmark(bad)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.message.includes('ANSWER non valido'))).toBe(true)
  })

  it('rileva domanda incompleta (TEXT mancante)', () => {
    const inc = valid.replace('TEXT: Testo della domanda', '')
    const res = parseBenchmark(inc)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.message.includes('TEXT mancante'))).toBe(true)
  })

  it('rileva righe non riconosciute', () => {
    const bad = valid + '\nFOO: bar'
    const res = parseBenchmark(bad)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.message.includes('Righe non riconosciute'))).toBe(true)
  })

  it('rifiuta input vuoto e senza [QUESTION]', () => {
    expect(parseBenchmark('').ok).toBe(false)
    expect(parseBenchmark('solo testo senza blocchi').ok).toBe(false)
  })
})
