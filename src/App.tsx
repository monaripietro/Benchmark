import { useRef, useState } from 'react'
import { parseBenchmark, type ParseResult } from './parser/benchmarkParser'
import type { Experiment, Question, RunResult } from './types'
import { computeSummary } from './scoring/metrics'
import { startExperiment, type RunnerHandle } from './runner/runner'
import { exportCsv, exportJson } from './export/exporters'
import { BarChart, DonutChart, DistributionChart } from './components/Charts'
import { KpiCards, QuestionTable, RunMatrix, ErrorsTable } from './components/Tables'
import { buildRunPrompt } from './runner/prompt'

const DEMO_URL = `${import.meta.env.BASE_URL}demo-benchmark.txt`

export const FORMATTING_PROMPT = `Converti il questionario seguente nel formato richiesto.

Per ogni domanda usa ESATTAMENTE:

[QUESTION]
ID: Q01
TEXT: testo domanda
A: risposta
B: risposta
C: risposta
D: risposta
E: risposta
ANSWER: lettera corretta

Non modificare domande, risposte o chiave.
Non correggere il contenuto.
Non aggiungere nuove domande.
Segnala separatamente eventuali errori, incongruenze o ambiguita.
Restituisci prima il testo formattato e poi l'elenco delle anomalie rilevate.`

type Phase = 'config' | 'running' | 'done'

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [requestedRuns, setRequestedRuns] = useState(10)
  const [questionnaireText, setQuestionnaireText] = useState('')
  const [parse, setParse] = useState<ParseResult | null>(null)
  const [phase, setPhase] = useState<Phase>('config')
  const [liveRuns, setLiveRuns] = useState<RunResult[]>([])
  const [liveBenchmark, setLiveBenchmark] = useState<Question[]>([])
  const [finalExperiment, setFinalExperiment] = useState<Experiment | null>(null)
  const [progress, setProgress] = useState({ completed: 0, failed: 0, cancelled: 0 })
  const [currentRun, setCurrentRun] = useState(0)
  const [apiLog, setApiLog] = useState<{ time: string; run: number; level: 'info' | 'error' | 'ok'; message: string }[]>([])
  const [copied, setCopied] = useState(false)
  const runnerRef = useRef<RunnerHandle | null>(null)

  const loadDemo = async () => {
    const res = await fetch(DEMO_URL)
    const text = await res.text()
    setQuestionnaireText(text)
    setParse(parseBenchmark(text))
  }

  const copyFormattingPrompt = async () => {
    await navigator.clipboard.writeText(FORMATTING_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const applyText = (text: string) => {
    setQuestionnaireText(text)
    setParse(parseBenchmark(text))
  }

  const log = (run: number, level: 'info' | 'error' | 'ok', message: string) => {
    setApiLog((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString('it-IT'), run, level, message },
    ])
  }

  const start = () => {
    if (!parse?.ok || !apiKey || !model || requestedRuns < 1) return
    setPhase('running')
    setFinalExperiment(null)
    setLiveRuns([])
    setLiveBenchmark(parse.questions)
    setApiLog([])
    setProgress({ completed: 0, failed: 0, cancelled: 0 })
    const runner = startExperiment({
      apiKey,
      model,
      requestedRuns,
      benchmark: parse.questions,
      callbacks: {
        onRunStart: (id) => {
          setCurrentRun(id)
          log(id, 'info', `Chiamata API a OpenRouter avviata (modello: ${model})`)
        },
        onRunComplete: (run) => {
          setLiveRuns((prev) => [...prev.filter((r) => r.runId !== run.runId), run])
          if (run.status === 'completed') {
            const c = run.answers.filter((a) => a.status === 'correct').length
            const w = run.answers.filter((a) => a.status === 'wrong').length
            const i = run.answers.filter((a) => a.status === 'invalid').length
            log(run.runId, 'ok', `Risposta ricevuta: ${c} corrette, ${w} errate, ${i} invalide`)
          } else if (run.status === 'api_error') {
            log(run.runId, 'error', `Errore API: ${run.errorMessage}`)
          } else {
            log(run.runId, 'error', 'Run cancellato dall utente')
          }
        },
        onProgress: (completed, failed, cancelled) => setProgress({ completed, failed, cancelled }),
      },
    })
    runnerRef.current = runner
    runner.promise.then((exp) => {
      const full: Experiment = { ...exp, summary: computeSummary(exp) }
      setFinalExperiment(full)
      setPhase('done')
    })
  }

  const cancel = () => {
    runnerRef.current?.cancel()
  }

  const reset = () => {
    setPhase('config')
    setFinalExperiment(null)
    setLiveRuns([])
    setApiLog([])
    setProgress({ completed: 0, failed: 0, cancelled: 0 })
    setCurrentRun(0)
  }

  const canStart = parse?.ok === true && apiKey.trim() !== '' && model.trim() !== '' && requestedRuns >= 1

  const liveSorted = [...liveRuns].sort((a, b) => a.runId - b.runId)
  const liveSummary =
    liveSorted.length > 0 && liveBenchmark.length > 0
      ? computeSummary({ requestedRuns, runs: liveSorted, benchmark: liveBenchmark })
      : null
  const liveExperiment: Experiment | null =
    liveSummary && liveBenchmark.length > 0
      ? {
          schemaVersion: '1.0',
          experimentId: 'live',
          createdAt: '',
          model,
          requestedRuns,
          benchmark: liveBenchmark,
          runs: liveSorted,
          summary: liveSummary,
        }
      : null

  const displayExperiment =
    phase === 'done' && finalExperiment ? finalExperiment : liveExperiment

  return (
    <div className="app">
      <header>
        <h1>LLM Benchmark Runner</h1>
        <p className="tagline">Evaluation harness per benchmark MCQ su modelli LLM via OpenRouter</p>
      </header>

      <main>
        <section aria-labelledby="sec-quiz" className="card">
          <h2 id="sec-quiz">1. Questionario</h2>
          <div className="toolbar">
            <button type="button" className="primary" onClick={loadDemo}>
              Carica questionario DEMO
            </button>
            <button type="button" onClick={copyFormattingPrompt}>
              {copied ? 'Prompt copiato!' : 'Copia prompt di formattazione'}
            </button>
          </div>
          <p className="note">
            Il questionario DEMO e sintetico, non validato scientificamente, solo per provare
            l interfaccia. Il prompt di formattazione serve per convertire un tuo questionario nel
            formato richiesto.
          </p>
          <div className="field">
            <label htmlFor="quiz-text">Incolla il questionario (formato [QUESTION])</label>
            <textarea
              id="quiz-text"
              rows={8}
              value={questionnaireText}
              onChange={(e) => applyText(e.target.value)}
            />
          </div>
        </section>

        <section aria-labelledby="sec-config" className="card">
          <h2 id="sec-config">2. Configurazione</h2>
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
              list="model-suggestions"
              placeholder="es. openai/gpt-4o-mini"
            />
            <datalist id="model-suggestions">
              <option value="openai/gpt-4o-mini" />
              <option value="anthropic/claude-3-haiku" />
              <option value="google/gemini-flash-1.5" />
              <option value="mistralai/mistral-small" />
            </datalist>
            <div className="model-picker">
              <label htmlFor="model-select">Oppure seleziona un modello suggerito:</label>
              <select
                id="model-select"
                value=""
              onChange={(e) => setModel(e.target.value)}
            >
                <option value="">— Scegli un modello —</option>
                <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                <option value="anthropic/claude-3-haiku">anthropic/claude-3-haiku</option>
                <option value="google/gemini-flash-1.5">google/gemini-flash-1.5</option>
                <option value="mistralai/mistral-small">mistralai/mistral-small</option>
              </select>
            </div>
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

        <section aria-labelledby="sec-preview" className="card">
          <h2 id="sec-preview">3. Anteprima e validazione</h2>
          {parse === null && <p>Incolla o carica un questionario per vederne l anteprima.</p>}
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

          <h3>Log chiamate API in tempo reale</h3>
          <div
            className="api-log"
            role="log"
            aria-live="polite"
            aria-label="Log chiamate API OpenRouter"
          >
            {apiLog.length === 0 ? (
              <p className="note">Nessuna chiamata ancora effettuata.</p>
            ) : (
              apiLog.map((entry, i) => (
                <p key={i} className={`log-entry log-${entry.level}`}>
                  <span className="log-time">[{entry.time}]</span>{' '}
                  <span className="log-run">Run {entry.run}:</span> {entry.message}
                </p>
              ))
            )}
          </div>
        </section>

        {displayExperiment && (
          <section aria-labelledby="sec-results" className="card">
            <h2 id="sec-results">5. Risultati ed export</h2>
            {phase === 'running' && (
              <p className="note" role="status">
                Risultati parziali in tempo reale ({progress.completed} run completati su{' '}
                {requestedRuns}).
              </p>
            )}
            <p className="note">
              Accuratezza = corrette / (corrette + errate). Le risposte invalide sono mostrate
              separatamente e non entrano nell accuratezza. Gli errori API non sono conteggiati come
              risposte sbagliate.
            </p>
            <KpiCards summary={displayExperiment.summary} />
            <div className="charts-grid">
              <BarChart
                title="Accuratezza per domanda"
                data={displayExperiment.summary.perQuestion.map((q) => ({
                  label: q.questionId,
                  value: q.correctPct,
                }))}
              />
              <BarChart
                title="Accuratezza per run"
                data={displayExperiment.summary.perRun
                  .filter((r) => r.status === 'completed')
                  .map((r) => ({ label: `Run ${r.runId}`, value: r.correctPct }))}
              />
              <DonutChart
                title="Corrette vs Errate vs Invalide"
                segments={[
                  { label: 'Corrette', value: displayExperiment.summary.correct, color: '#16a34a', pattern: '[OK]' },
                  { label: 'Errate', value: displayExperiment.summary.wrong, color: '#dc2626', pattern: '[X]' },
                  { label: 'Invalide', value: displayExperiment.summary.invalid, color: '#9ca3af', pattern: '[?]' },
                ]}
              />
              <DistributionChart rows={displayExperiment.summary.perQuestion} />
            </div>
            <QuestionTable summary={displayExperiment.summary} />
            <RunMatrix experiment={displayExperiment} />
            <ErrorsTable experiment={displayExperiment} />
            <h3>Export</h3>
            <p>
              <button type="button" onClick={() => exportCsv(displayExperiment)}>
                Esporta CSV
              </button>{' '}
              <button type="button" onClick={() => exportJson(displayExperiment)}>
                Esporta JSON
              </button>{' '}
              <span className="hint">Gli export non contengono la API key.</span>
            </p>
          </section>
        )}
      </main>

      <footer>
        <p>
          LLM Benchmark Runner — strumento educativo/didattico, realizzato con Vibe Mistral in
          modalita code. API OpenAI-compatible via OpenRouter.
        </p>
      </footer>
    </div>
  )
}
