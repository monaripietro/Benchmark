import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { startExperiment } from '../runner/runner'
import type { Question } from '../types'

const bench: Question[] = [
  { id: 'Q01', text: 't1', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'C' },
  { id: 'Q02', text: 't2', options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, answer: 'A' },
]

const VALID_REPLY = 'Q01:C\nQ02:A'

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: '',
    json: async () => body,
  })
}

describe('runner con mock API', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => 'test-uuid' })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('esegue run indipendenti e fa scoring', async () => {
    const fetchMock = mockFetchOnce({
      choices: [{ message: { content: VALID_REPLY } }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const handle = startExperiment({
      apiKey: 'sk-or-test-123',
      model: 'test/model',
      requestedRuns: 2,
      benchmark: bench,
    })
    const exp = await handle.promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(exp.runs).toHaveLength(2)
    expect(exp.runs.every((r) => r.status === 'completed')).toBe(true)
    expect(exp.runs[0].answers[0].status).toBe('correct')
    expect(exp.schemaVersion).toBe('1.0')
    expect(exp.experimentId).toBe('test-uuid')
  })

  it('distingue errori API e non li conteggia come wrong', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid key' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const exp = await startExperiment({
      apiKey: 'bad',
      model: 'm',
      requestedRuns: 1,
      benchmark: bench,
    }).promise
    expect(exp.runs[0].status).toBe('api_error')
    expect(exp.runs[0].answers).toHaveLength(0)
  })

  it('registra risposta non parsabile come invalid', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ choices: [{ message: { content: 'non capisco la domanda' } }] }))
    const exp = await startExperiment({
      apiKey: 'k',
      model: 'm',
      requestedRuns: 1,
      benchmark: bench,
    }).promise
    expect(exp.runs[0].answers.every((a) => a.status === 'invalid')).toBe(true)
  })

  it('conserva la raw response', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ choices: [{ message: { content: VALID_REPLY } }] }))
    const exp = await startExperiment({
      apiKey: 'k',
      model: 'm',
      requestedRuns: 1,
      benchmark: bench,
    }).promise
    expect(exp.runs[0].rawResponse).toBe(VALID_REPLY)
  })

  it('cancellazione segna i run rimanenti come cancelled', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res
          }),
      )
      .mockImplementationOnce(mockFetchOnce({ choices: [{ message: { content: VALID_REPLY } }] }) as never)
    vi.stubGlobal('fetch', fetchMock)
    const handle = startExperiment({
      apiKey: 'k',
      model: 'm',
      requestedRuns: 2,
      benchmark: bench,
    })
    await new Promise((r) => setTimeout(r, 10))
    handle.cancel()
    resolveFirst({ ok: true, status: 200, statusText: '', json: async () => ({ choices: [{ message: { content: VALID_REPLY } }] }) })
    const exp = await handle.promise
    expect(exp.runs.filter((r) => r.status === 'cancelled').length).toBeGreaterThanOrEqual(1)
  })
})
