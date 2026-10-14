export interface Question {
  id: string
  text: string
  options: { A: string; B: string; C: string; D: string; E: string }
  answer: string
}

export type AnswerStatus = 'correct' | 'wrong' | 'invalid'

export interface AnswerResult {
  questionId: string
  selected: string | null
  expected: string
  status: AnswerStatus
}

export type RunStatus = 'completed' | 'api_error' | 'cancelled'

export interface RunResult {
  runId: number
  startedAt: string
  completedAt: string | null
  rawResponse: string
  answers: AnswerResult[]
  status: RunStatus
  errorMessage?: string
}

export interface QuestionMetrics {
  questionId: string
  correct: number
  wrong: number
  invalid: number
  correctPct: number
  distribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
}

export interface RunMetrics {
  runId: number
  correct: number
  wrong: number
  invalid: number
  correctPct: number
  status: RunStatus
}

export interface Summary {
  requestedRuns: number
  completedRuns: number
  failedRuns: number
  cancelledRuns: number
  evaluatedAnswers: number
  correct: number
  wrong: number
  invalid: number
  correctPct: number
  wrongPct: number
  invalidPct: number
  accuracy: number
  perQuestion: QuestionMetrics[]
  perRun: RunMetrics[]
}

export interface Experiment {
  schemaVersion: '1.0'
  experimentId: string
  createdAt: string
  model: string
  requestedRuns: number
  benchmark: Question[]
  runs: RunResult[]
  summary: Summary
}
