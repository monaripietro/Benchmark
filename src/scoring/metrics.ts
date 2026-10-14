import type { Experiment, QuestionMetrics, RunMetrics, Summary } from '../types'

const pct = (n: number, d: number) => (d === 0 ? 0 : (n / d) * 100)

export function computeSummary(experiment: Pick<Experiment, 'requestedRuns' | 'runs' | 'benchmark'>): Summary {
  const { requestedRuns, runs, benchmark } = experiment
  const completed = runs.filter((r) => r.status === 'completed')
  const failed = runs.filter((r) => r.status === 'api_error')
  const cancelled = runs.filter((r) => r.status === 'cancelled')

  let correct = 0
  let wrong = 0
  let invalid = 0
  for (const run of completed) {
    for (const a of run.answers) {
      if (a.status === 'correct') correct++
      else if (a.status === 'wrong') wrong++
      else invalid++
    }
  }
  const evaluated = correct + wrong

  const perQuestion: QuestionMetrics[] = benchmark.map((q) => {
    const m: QuestionMetrics = {
      questionId: q.id,
      correct: 0,
      wrong: 0,
      invalid: 0,
      correctPct: 0,
      distribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    }
    for (const run of completed) {
      const a = run.answers.find((x) => x.questionId === q.id)
      if (!a) continue
      if (a.status === 'correct') m.correct++
      else if (a.status === 'wrong') m.wrong++
      else m.invalid++
      if (a.selected) m.distribution[a.selected as 'A']++
    }
    m.correctPct = pct(m.correct, m.correct + m.wrong)
    return m
  })

  const perRun: RunMetrics[] = runs.map((r) => {
    const c = r.answers.filter((a) => a.status === 'correct').length
    const w = r.answers.filter((a) => a.status === 'wrong').length
    const i = r.answers.filter((a) => a.status === 'invalid').length
    return { runId: r.runId, correct: c, wrong: w, invalid: i, correctPct: pct(c, c + w), status: r.status }
  })

  return {
    requestedRuns,
    completedRuns: completed.length,
    failedRuns: failed.length,
    cancelledRuns: cancelled.length,
    evaluatedAnswers: evaluated,
    correct,
    wrong,
    invalid,
    correctPct: pct(correct, evaluated),
    wrongPct: pct(wrong, evaluated),
    invalidPct: pct(invalid, correct + wrong + invalid),
    accuracy: pct(correct, evaluated),
    perQuestion,
    perRun,
  }
}
