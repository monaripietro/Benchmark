import { describe, expect, it } from 'vitest'
import { computeSummary } from '../scoring/metrics'
import type { Experiment, Question, RunResult } from '../types'

const bench: Question[] = [
  { id: 'Q01', text: 't1', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'C' },
  { id: 'Q02', text: 't2', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'A' },
]

function run(overrides: Partial<RunResult>, runId: number): RunResult {
  return {
    runId,
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T00:00:01Z',
    rawResponse: '',
    answers: [
      { questionId: 'Q01', selected: 'C', expected: 'C', status: 'correct' },
      { questionId: 'Q02', selected: 'B', expected: 'A', status: 'wrong' },
    ],
    status: 'completed',
    ...overrides,
  }
}

describe('aggregazione metriche', () => {
  it('calcola KPI complessivi, per domanda e per run', () => {
    const exp: Pick<Experiment, 'requestedRuns' | 'runs' | 'benchmark'> = {
      requestedRuns: 3,
      benchmark: bench,
      runs: [
        run({}, 1),
        run(
          {
            answers: [
              { questionId: 'Q01', selected: 'A', expected: 'C', status: 'wrong' },
              { questionId: 'Q02', selected: null, expected: 'A', status: 'invalid' },
            ],
          },
          2,
        ),
        run({ status: 'api_error', answers: [], errorMessage: 'HTTP 500' }, 3),
      ],
    }
    const s = computeSummary(exp)
    expect(s.requestedRuns).toBe(3)
    expect(s.completedRuns).toBe(2)
    expect(s.failedRuns).toBe(1)
    expect(s.cancelledRuns).toBe(0)
    expect(s.correct).toBe(1)
    expect(s.wrong).toBe(2)
    expect(s.invalid).toBe(1)
    expect(s.evaluatedAnswers).toBe(3)
    expect(s.accuracy).toBeCloseTo(33.33, 1)
    expect(s.perQuestion[0].correct).toBe(1)
    expect(s.perQuestion[0].wrong).toBe(1)
    expect(s.perQuestion[1].invalid).toBe(1)
    expect(s.perQuestion[0].distribution.A).toBe(1)
    expect(s.perQuestion[0].distribution.C).toBe(1)
    expect(s.perRun[0].correct).toBe(1)
    expect(s.perRun[2].status).toBe('api_error')
  })

  it('non conteggia run con errore API nel punteggio', () => {
    const s = computeSummary({
      requestedRuns: 2,
      benchmark: bench,
      runs: [
        run({}, 1),
        run({ status: 'api_error', answers: [], errorMessage: 'net' }, 2),
      ],
    })
    expect(s.correct).toBe(1)
    expect(s.wrong).toBe(1)
    expect(s.failedRuns).toBe(1)
    expect(s.accuracy).toBeCloseTo(50, 1)
  })
})
