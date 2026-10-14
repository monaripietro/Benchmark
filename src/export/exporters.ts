import type { Experiment } from '../types'

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCsv(experiment: Experiment) {
  const header =
    'experiment_id,timestamp,model,run_id,question_id,selected_answer,expected_answer,status'
  const rows: string[] = []
  for (const run of experiment.runs) {
    if (run.answers.length === 0 && run.status !== 'completed') {
      rows.push(
        [experiment.experimentId, run.startedAt, experiment.model, run.runId, '-', '-', '-', run.status]
          .map(csvEscape)
          .join(','),
      )
      continue
    }
    for (const a of run.answers) {
      rows.push(
        [
          experiment.experimentId,
          run.startedAt,
          experiment.model,
          run.runId,
          a.questionId,
          a.selected ?? '',
          a.expected,
          a.status,
        ]
          .map(csvEscape)
          .join(','),
      )
    }
  }
  download(`${experiment.experimentId}.csv`, [header, ...rows].join('\n'), 'text/csv')
}

function csvEscape(v: string | number): string {
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildExportJson(experiment: Experiment): string {
  const safe = JSON.stringify(experiment, (key, value) => {
    if (/key|authorization|token/i.test(key) && typeof value === 'string') return undefined
    return value
  }, 2)
  if (/sk-or-/i.test(safe)) {
    throw new Error('Controllo di sicurezza: possibile API key nell export, annullato.')
  }
  return safe
}

export function exportJson(experiment: Experiment) {
  download(`${experiment.experimentId}.json`, buildExportJson(experiment), 'application/json')
}
