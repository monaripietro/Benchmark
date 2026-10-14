import type { Question } from '../types'

export function buildQuestionnaireText(questions: Question[]): string {
  return questions
    .map((q) => {
      const opts = (Object.keys(q.options) as ('A' | 'B' | 'C' | 'D' | 'E')[])
        .map((k) => `${k}: ${q.options[k]}`)
        .join('\n')
      return `[QUESTION]\nID: ${q.id}\nTEXT: ${q.text}\n${opts}`
    })
    .join('\n\n')
}

export function buildRunPrompt(questions: Question[]): string {
  return `Rispondi al seguente questionario.
Per ogni domanda indica esclusivamente ID e lettera della risposta scelta.
Usa esattamente il formato:
Q01:A
Q02:C
Q03:E

Non aggiungere spiegazioni, commenti o altro testo.

QUESTIONARIO
${buildQuestionnaireText(questions)}`
}
