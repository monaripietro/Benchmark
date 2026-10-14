import { describe, expect, it } from 'vitest'
import { buildExportJson } from '../export/exporters'
import { computeSummary } from '../scoring/metrics'
import type { Experiment, Question } from '../types'

const bench: Question[] = [
  { id: 'Q01', text: 't1', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'C' },
]

const exp: Experiment = {
  schemaVersion: '1.0',
  experimentId: 'uuid-1',
  createdAt: '2026-01-01T00:00:00Z',
  model: 'test/model',
  requestedRuns: 1,
  benchmark: bench,
  runs: [
    {
      runId: 1,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:01Z',
      rawResponse: 'Q01:C',
      answers: [{ questionId: 'Q01', selected: 'C', expected: 'C', status: 'correct' }],
      status: 'completed',
    },
  ],
  summary: null as unknown as Experiment['summary'],
}

describe('export JSON', () => {
  it('non include la API key e mantiene schema e chiave', () => {
    exp.summary = computeSummary(exp)
    const json = buildExportJson(exp)
    expect(json).not.toMatch(/sk-or-/i)
    expect(json).not.toMatch(/apiKey/i)
    const parsed = JSON.parse(json)
    expect(parsed.schemaVersion).toBe('1.0')
    expect(parsed.benchmark[0].answer).toBe('C')
    expect(parsed.summary.accuracy).toBe(100)
  })

  it('rifiuta export contenenti pattern di API key', () => {
    const dirty = { ...exp, note: 'sk-or-v1-abc123' } as unknown as Experiment
    expect(() => buildExportJson(dirty)).toThrow(/sicurezza/)
  })
})
