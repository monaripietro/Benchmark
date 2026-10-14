import { describe, expect, it } from 'vitest'
import { parseModelResponse, scoreAnswers } from '../parser/responseParser'
import type { Question } from '../types'

const bench: Question[] = [
  {
    id: 'Q01',
    text: 't1',
    options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
    answer: 'C',
  },
  {
    id: 'Q02',
    text: 't2',
    options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
    answer: 'A',
  },
]
const ids = bench.map((q) => q.id)

describe('parser output modello', () => {
  it('parsa output valido', () => {
    const r = parseModelResponse('Q01:C\nQ02:A', ids)
    expect(r).toEqual([
      { questionId: 'Q01', selected: 'C' },
      { questionId: 'Q02', selected: 'A' },
    ])
  })

  it('tolera testo extra', () => {
    const r = parseModelResponse('Ecco le risposte:\nQ01:C\nQ02:A\nGrazie!', ids)
    expect(r[0].selected).toBe('C')
    expect(r[1].selected).toBe('A')
  })

  it('registra risposta mancante come null', () => {
    const r = parseModelResponse('Q01:C', ids)
    expect(r[1]).toEqual({ questionId: 'Q02', selected: null })
  })

  it('registra risposta duplicata come null', () => {
    const r = parseModelResponse('Q01:C\nQ01:A\nQ02:A', ids)
    expect(r[0]).toEqual({ questionId: 'Q01', selected: null })
    expect(r[1].selected).toBe('A')
  })
})

describe('scoring', () => {
  it('classifica correct/wrong/invalid', () => {
    const cases = scoreAnswers(
      [
        { questionId: 'Q01', selected: 'C' },
        { questionId: 'Q02', selected: 'B' },
        { questionId: 'Q01', selected: null },
      ],
      bench,
    )
    expect(cases[0].status).toBe('correct')
    expect(cases[1].status).toBe('wrong')
    expect(cases[2].status).toBe('invalid')
  })

  it('non corregge o indovina le risposte invalid', () => {
    const cases = scoreAnswers([{ questionId: 'Q01', selected: null }], bench)
    expect(cases[0]).toEqual({ questionId: 'Q01', selected: null, expected: 'C', status: 'invalid' })
  })
})
