import { useRef, useState } from 'react'
import { parseBenchmark, type ParseResult } from './parser/benchmarkParser'
import type { Experiment, Question } from './types'
import { computeSummary } from './scoring/metrics'
import { startExperiment, type RunnerHandle } from './runner/runner'
import { exportCsv, exportJson } from './export/exporters'
import { BarChart, DonutChart, DistributionChart } from './components/Charts'
import { KpiCards, QuestionTable, RunMatrix, ErrorsTable } from './components/Tables'
import { buildRunPrompt } from './runner/prompt'

const DEMO_URL = `${import.meta.env.BASE_URL}demo-benchmark.txt`

type Phase = 'config' | 'running' | 'done'

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [requestedRuns, setRequestedRuns] = useState(10)
  const [questionnaireText, setQuestionnaireText] = useState('')
  const [parse, setParse] = useState<ParseResult | null>(null)
  const [phase, setPhase] = useState<Phase>('config')
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [progress, setProgress] = useState({ completed: 0, failed: 0, cancelled: 0 })
  const [currentRun, setCurrentRun] = useState(0)
  const runnerRef = useRef<RunnerHandle | null>(null)

  const loadDemo = async () => {
    const res = await fetch(DEMO_URL)
    const text = await res.text()
    setQuestionnaireText(text)
    setParse(parseBenchmark(text))
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setQuestionnaireText(text)
    setParse(parseBenchmark(text))
  }

  const start = () => {
    if (!parse?.ok || !apiKey || !model || requestedRuns < 1) return
    setPhase('running')
    setExperiment(null)
    setProgress({ completed: 0, failed: 0, cancelled: 0 })
    const runner = startExperiment({
      apiKey,
      model,
      requestedRuns,
      benchmark: parse.questions,
      callbacks: {
        onRunStart: (id) => setCurrentRun(id),
        onProgress: (completed, failed, cancelled) => setProgress({ completed, failed, cancelled }),
      },
    })
    runnerRef.current = runner
    runner.promise.then((exp) => {
      const full: Experiment = { ...exp, summary: computeSummary(exp) }
      setExperiment(full)
      setPhase('done')
    })
  }

  const cancel = () => {
    runnerRef.current?.cancel()
  }

  const reset = () => {
    setPhase('config')
    setExperiment(null)
    setProgress({ completed: 0, failed: 0, cancelled: 0 })
    setCurrentRun(0)
  }

  const canStart = parse?.ok === true && apiKey.trim() !== '' && model.trim() !== '' && requestedRuns >= 1

  return (
    <div className="app">
      <header>
        <h1>LLM Benchmark Runner</h1>
        <p className="tagline">Evaluation harness per benchmark MCQ su modelli LLM via OpenRouter</p>
      </header>

      <main>
        <section aria-labelledby="sec-config" className="card">
          <h2 id="sec-config">1. Configurazione</h2>
          <div className="field">
            <label htmlFor="apikey">API key OpenRouter (BYOK)</label>
            <div className="key-row">
              <input
                id="apikey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder="sk-or-..."
              />
              <button type="button" onClick={() => setShowKey(!showKey)} aria-pressed={showKey}>
                {showKey ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
            <p className="note warning">
              La chiave resta solo in memoria runtime, non viene salvata, loggata o esportata, ed e
              cancellata al reload della pagina. Modello BYOK appropriato per un prototipo didattico:
              per uso produttivo le credenziali vanno gestite server-side.
            </p>
          </div>
          <div className="field">
            <label htmlFor="model">Modello OpenRouter</label>
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="es. openai/gpt-4o-mini"
            />
          </div>
          <div className="field">
            <label htmlFor="runs">Numero di somministrazioni indipendenti</label>
            <input
              id="runs"
              type="number"
              min={1}
              max={50}
              value={requestedRuns}
              onChange={(e) => setRequestedRuns(Number(e.target.value))}
            />
          </div>
        </section>

        <section aria-labelledby="sec-quiz" className="card">
          <h2 id="sec-quiz">2. Questionario</h2>
          <div className="field">
            <label htmlFor="quiz-text">Incolla il questionario (formato [QUESTION])</label>
            <textarea
              id="quiz-text"
              rows={8}
              value={questionnaireText}
              onChange={(e) => {
                setQuestionnaireText(e.target.value)
                setParse(parseBenchmark(e.target.value))
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="quiz-file">Oppure carica un file .txt</label>
            <input id="quiz-file" type="file" accept=".txt" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
          <button type="button" onClick={loadDemo}>
            Carica benchmark DEMO (sintetico, non validato scientificamente)
          </button>
        </section>

        <section aria-labelledby="sec-preview" className="card">
          <h2 id="sec-preview">3. Anteprima e validazione</h2>
          {parse === null && <p>Incolla o carica un questionario per vederne l'anteprima.</p>}
          {parse && !parse.ok && (
            <div className="errors" role="alert">
              <strong>Questionario non valido, il benchmark non puo essere avviato:</strong>
              <ul>
                {parse.errors.map((e, i) => (
                  <li key={i}>
                    <b>{e.questionRef}</b>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parse && parse.ok && (
            <>
              <p role="status">
                Questionario valido: {parse.questions.length} domande, 5 opzioni A-E, chiave definita.
              </p>
              <table className="data-table">
                <caption>Anteprima domande e chiave</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Domanda</th>
                    <th scope="col">Risposta corretta</th>
                  </tr>
                </thead>
                <tbody>
                  {parse.questions.map((q: Question) => (
                    <tr key={q.id}>
                      <th scope="row">{q.id}</th>
                      <td>{q.text}</td>
                      <td>{q.answer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Riepilogo configurazione</h3>
              <ul>
                <li>Modello: {model || '(non impostato)'}</li>
                <li>Somministrazioni: {requestedRuns}</li>
                <li>Domande: {parse.questions.length}</li>
                <li>Prompt standardizzato con {parse.questions.length} quesiti, senza chiave.</li>
              </ul>
              <details>
                <summary>Mostra prompt che sara inviato al modello</summary>
                <pre className="prompt-preview">{buildRunPrompt(parse.questions)}</pre>
              </details>
            </>
          )}
        </section>

        <section aria-labelledby="sec-run" className="card">
          <h2 id="sec-run">4. Esecuzione</h2>
          {phase === 'config' && (
            <p>
              <button type="button" className="primary" onClick={start} disabled={!canStart}>
                Avvia benchmark
              </button>
              {!canStart && <span className="hint"> Configura chiave, modello e questionario valido.</span>}
            </p>
          )}
          {phase === 'running' && (
            <div>
              <p role="status" aria-live="polite">
                Run {currentRun}/{requestedRuns} in corso — completati: {progress.completed}, falliti:{' '}
                {progress.failed}, cancellati: {progress.cancelled}
              </p>
              <progress max={requestedRuns} value={progress.completed + progress.failed + progress.cancelled} />
              <p>
                <button type="button" className="danger" onClick={cancel}>
                  Cancella esperimento
                </button>
              </p>
            </div>
          )}
          {phase === 'done' && (
            <p>
              Esperimento completato.{' '}
              <button type="button" onClick={reset}>
                Nuovo esperimento
              </button>{' '}
              (esporta i risultati prima di proseguire: al nuovo avvio il risultato non esportato verra perso)
            </p>
          )}
        </section>

        {experiment && phase === 'done' && (
          <section aria-labelledby="sec-results" className="card">
            <h2 id="sec-results">5. Risultati ed export</h2>
            <p className="note">
              Accuratezza = corrette / (corrette + errate). Le risposte invalide sono mostrate
              separatamente e non entrano nell'accuratezza. Gli errori API non sono conteggiati come
              risposte sbagliate.
            </p>
            <KpiCards summary={experiment.summary} />
            <div className="charts-grid">
              <BarChart
                title="Accuratezza per domanda"
                data={experiment.summary.perQuestion.map((q) => ({ label: q.questionId, value: q.correctPct }))}
              />
              <BarChart
                title="Accuratezza per run"
                data={experiment.summary.perRun
                  .filter((r) => r.status === 'completed')
                  .map((r) => ({ label: `Run ${r.runId}`, value: r.correctPct }))}
              />
              <DonutChart
                title="Corrette vs Errate vs Invalide"
                segments={[
                  { label: 'Corrette', value: experiment.summary.correct, color: '#16a34a', pattern: '[OK]' },
                  { label: 'Errate', value: experiment.summary.wrong, color: '#dc2626', pattern: '[X]' },
                  { label: 'Invalide', value: experiment.summary.invalid, color: '#9ca3af', pattern: '[?]' },
                ]}
              />
              <DistributionChart rows={experiment.summary.perQuestion} />
            </div>
            <QuestionTable summary={experiment.summary} />
            <RunMatrix experiment={experiment} />
            <ErrorsTable experiment={experiment} />
            <h3>Export</h3>
            <p>
              <button type="button" onClick={() => exportCsv(experiment)}>
                Esporta CSV
              </button>{' '}
              <button type="button" onClick={() => exportJson(experiment)}>
                Esporta JSON
              </button>{' '}
              <span className="hint">Gli export non contengono la API key.</span>
            </p>
          </section>
        )}
      </main>

      <footer>
        <p>LLM Benchmark Runner — prototipo didattico client-side. API OpenAI-compatible via OpenRouter.</p>
      </footer>
    </div>
  )
}
