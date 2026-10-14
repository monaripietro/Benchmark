import type { Experiment, Question, RunResult } from '../types'
import { chatCompletion, ApiError } from '../api/openrouter'
import { parseModelResponse, scoreAnswers } from '../parser/responseParser'
import { buildRunPrompt } from './prompt'

export interface RunnerCallbacks {
  onRunStart?: (runId: number) => void
  onRunComplete?: (run: RunResult) => void
  onProgress?: (completed: number, failed: number, cancelled: number) => void
}

export interface RunnerHandle {
  cancel: () => void
  promise: Promise<Experiment>
}

export function startExperiment(params: {
  apiKey: string
  model: string
  requestedRuns: number
  benchmark: Question[]
  callbacks?: RunnerCallbacks
}): RunnerHandle {
  const { apiKey, model, requestedRuns, benchmark, callbacks = {} } = params
  const controller = new AbortController()
  const questionIds = benchmark.map((q) => q.id)
  const runs: RunResult[] = []
  let cancelled = false
  let failed = 0
  let completed = 0
  let cancelledCount = 0

  const promise = (async (): Promise<Experiment> => {
    for (let runId = 1; runId <= requestedRuns; runId++) {
      if (cancelled) break
      const startedAt = new Date().toISOString()
      callbacks.onRunStart?.(runId)
      try {
        const raw = await chatCompletion({
          apiKey,
          model,
          messages: [{ role: 'user', content: buildRunPrompt(benchmark) }],
          signal: controller.signal,
        })
        const parsed = parseModelResponse(raw, questionIds)
        const answers = scoreAnswers(parsed, benchmark)
        const run: RunResult = {
          runId,
          startedAt,
          completedAt: new Date().toISOString(),
          rawResponse: raw,
          answers,
          status: 'completed',
        }
        runs.push(run)
        completed++
        callbacks.onRunComplete?.(run)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          cancelledCount++
          runs.push({
            runId,
            startedAt,
            completedAt: null,
            rawResponse: '',
            answers: [],
            status: 'cancelled',
          })
        } else {
          failed++
          const msg = err instanceof ApiError ? err.message : (err as Error).message
          runs.push({
            runId,
            startedAt,
            completedAt: null,
            rawResponse: '',
            answers: [],
            status: 'api_error',
            errorMessage: msg,
          })
        }
        callbacks.onRunComplete?.(runs[runs.length - 1])
      }
      callbacks.onProgress?.(completed, failed, cancelledCount)
    }

    if (cancelled) {
      for (let runId = runs.length + 1; runId <= requestedRuns; runId++) {
        runs.push({
          runId,
          startedAt: new Date().toISOString(),
          completedAt: null,
          rawResponse: '',
          answers: [],
          status: 'cancelled',
        })
      }
      cancelledCount = requestedRuns - completed - failed
      callbacks.onProgress?.(completed, failed, cancelledCount)
    }

    return {
      schemaVersion: '1.0',
      experimentId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      model,
      requestedRuns,
      benchmark,
      runs,
      summary: null as unknown as Experiment['summary'],
    }
  })()

  return {
    cancel: () => {
      cancelled = true
      controller.abort()
    },
    promise,
  }
}
