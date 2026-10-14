import type { AnswerResult, Question } from '../types'

export interface ParsedAnswer {
  questionId: string
  selected: string | null
}

/**
 * Parses raw model output into per-question A-E selections.
 * Tolerates extra text but never guesses: unrecognized lines are ignored,
 * missing questions become invalid, duplicates become invalid.
 */
export function parseModelResponse(raw: string, questionIds: string[]): ParsedAnswer[] {
  const result = new Map<string, string>()
  const duplicates = new Set<string>()
  const lineRe = /^([A-Za-z0-9_-]+)\s*[:.\s]\s*([A-Ea-e])\b.*$/

  for (const line of raw.split('\n')) {
    const m = lineRe.exec(line.trim())
    if (!m) continue
    const qid = m[1]
    const letter = m[2].toUpperCase()
    if (result.has(qid)) duplicates.add(qid)
    result.set(qid, letter)
  }

  return questionIds.map((qid) => {
    if (duplicates.has(qid)) return { questionId: qid, selected: null }
    const selected = result.get(qid) ?? null
    return { questionId: qid, selected }
  })
}

export function scoreAnswers(
  parsed: ParsedAnswer[],
  benchmark: Question[],
): AnswerResult[] {
  const byId = new Map(benchmark.map((q) => [q.id, q]))
  return parsed.map(({ questionId, selected }) => {
    const q = byId.get(questionId)
    const expected = q ? q.answer : ''
    if (selected === null || !q) {
      return { questionId, selected, expected, status: 'invalid' }
    }
    return {
      questionId,
      selected,
      expected,
      status: selected === expected ? 'correct' : 'wrong',
    }
  })
}
