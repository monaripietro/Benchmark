import type { Experiment, Summary } from '../types'

interface Props {
  summary: Summary
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

export function KpiCards({ summary }: Props) {
  return (
    <div className="kpi-grid">
      <KpiCard
        label="Accuratezza complessiva"
        value={`${summary.accuracy.toFixed(1)}%`}
        sub={`${summary.correct}/${summary.evaluatedAnswers} risposte valutabili`}
      />
      <KpiCard label="Corrette" value={String(summary.correct)} sub={`${summary.correctPct.toFixed(1)}%`} />
      <KpiCard label="Errate" value={String(summary.wrong)} sub={`${summary.wrongPct.toFixed(1)}%`} />
      <KpiCard label="Invalide" value={String(summary.invalid)} sub={`${summary.invalidPct.toFixed(1)}%`} />
      <KpiCard
        label="Run completati/richiesti"
        value={`${summary.completedRuns}/${summary.requestedRuns}`}
        sub={`${summary.failedRuns} falliti, ${summary.cancelledRuns} cancellati`}
      />
    </div>
  )
}

export function QuestionTable({ summary }: Props) {
  return (
    <table className="data-table">
      <caption>Riepilogo per domanda</caption>
      <thead>
        <tr>
          <th scope="col">Domanda</th>
          <th scope="col">Corrette</th>
          <th scope="col">Errate</th>
          <th scope="col">Invalide</th>
          <th scope="col">% corrette</th>
        </tr>
      </thead>
      <tbody>
        {summary.perQuestion.map((q) => (
          <tr key={q.questionId}>
            <th scope="row">{q.questionId}</th>
            <td>{q.correct}</td>
            <td>{q.wrong}</td>
            <td>{q.invalid}</td>
            <td>{q.correctPct.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function RunMatrix({ experiment }: { experiment: Experiment }) {
  return (
    <table className="data-table matrix">
      <caption>Matrice run x domanda (risposta scelta e stato)</caption>
      <thead>
        <tr>
          <th scope="col">Run</th>
          {experiment.benchmark.map((q) => (
            <th scope="col" key={q.id}>
              {q.id}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {experiment.runs.map((run) => (
          <tr key={run.runId}>
            <th scope="row">{run.runId}</th>
            {run.status !== 'completed' ? (
              <td colSpan={experiment.benchmark.length} className={`status-${run.status}`}>
                {run.status === 'api_error' ? `Errore API: ${run.errorMessage}` : 'Cancellato'}
              </td>
            ) : (
              run.answers.map((a) => (
                <td key={a.questionId} className={`status-${a.status}`} title={a.status}>
                  <span className="pattern-tag">
                    {a.status === 'correct' ? '[OK]' : a.status === 'wrong' ? '[X]' : '[?]'}
                  </span>{' '}
                  {a.selected ?? '-'}
                </td>
              ))
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ErrorsTable({ experiment }: { experiment: Experiment }) {
  const errors = experiment.runs.filter((r) => r.status !== 'completed')
  return (
    <table className="data-table">
      <caption>Errori API e run cancellati</caption>
      {errors.length === 0 ? (
        <tbody>
          <tr>
            <td>Nessun errore.</td>
          </tr>
        </tbody>
      ) : (
        <>
          <thead>
            <tr>
              <th scope="col">Run</th>
              <th scope="col">Stato</th>
              <th scope="col">Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((r) => (
              <tr key={r.runId}>
                <th scope="row">{r.runId}</th>
                <td>{r.status}</td>
                <td>{r.errorMessage ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </table>
  )
}
