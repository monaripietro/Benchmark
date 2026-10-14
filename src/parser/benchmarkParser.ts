import type { Question } from '../types'

export interface ParseError {
  questionRef: string
  message: string
}

export interface ParseResult {
  ok: boolean
  questions: Question[]
  errors: ParseError[]
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const
const LINE_RE = /^(ID|TEXT|[A-E]|ANSWER)\s*:\s*(.*)$/i

function parseBlock(block: string, index: number): { question?: Question; errors: ParseError[] } {
  const errors: ParseError[] = []
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const ref = `Domanda #${index}`
  let id = ''
  let text = ''
  let answer = ''
  const options: Partial<Record<string, string>> = {}
  const unknown: string[] = []

  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (!m) {
      unknown.push(line)
      continue
    }
    const key = m[1].toUpperCase()
    const value = m[2].trim()
    if (key === 'ID') id = value
    else if (key === 'TEXT') text = value
    else if (key === 'ANSWER') answer = value.toUpperCase()
    else options[key] = value
  }

  if (unknown.length > 0) {
    errors.push({ questionRef: id || ref, message: `Righe non riconosciute: ${unknown.join(' | ')}` })
  }
  if (!id) errors.push({ questionRef: ref, message: 'ID mancante' })
  if (!text) errors.push({ questionRef: id || ref, message: 'TEXT mancante o vuoto' })
  for (const k of OPTION_KEYS) {
    if (!(k in options)) errors.push({ questionRef: id || ref, message: `Opzione ${k} mancante` })
    else if (!options[k]) errors.push({ questionRef: id || ref, message: `Opzione ${k} vuota` })
  }
  if (!answer) errors.push({ questionRef: id || ref, message: 'ANSWER mancante' })
  else if (!OPTION_KEYS.includes(answer as (typeof OPTION_KEYS)[number]))
    errors.push({ questionRef: id || ref, message: `ANSWER non valido: "${answer}" (deve essere A-E)` })

  if (errors.length > 0) return { errors }

  return {
    question: {
      id,
      text,
      options: options as Question['options'],
      answer,
    },
    errors,
  }
}

export function parseBenchmark(input: string): ParseResult {
  const errors: ParseError[] = []
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, questions: [], errors: [{ questionRef: '-', message: 'Nessun contenuto fornito' }] }
  }

  const blocks = trimmed
    .split(/\[QUESTION\]/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)

  if (blocks.length === 0) {
    return { ok: false, questions: [], errors: [{ questionRef: '-', message: 'Nessun blocco [QUESTION] trovato' }] }
  }

  const questions: Question[] = []
  blocks.forEach((block, i) => {
    const res = parseBlock(block, i + 1)
    if (res.question) questions.push(res.question)
    errors.push(...res.errors)
  })

  const ids = questions.map((q) => q.id)
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) errors.push({ questionRef: id, message: 'ID duplicato' })
    seen.add(id)
  }

  if (questions.length === 0 && errors.length === 0) {
    errors.push({ questionRef: '-', message: 'Nessuna domanda valida trovata' })
  }

  return { ok: errors.length === 0 && questions.length > 0, questions, errors }
}
