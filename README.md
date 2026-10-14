# LLM Benchmark Runner

Webapp SPA statica per somministrare ripetutamente un benchmark MCQ (risposta multipla, risposta singola) a modelli LLM tramite l'API di OpenRouter, direttamente dal browser.

Evaluation harness semplificato:

`Questionario + ground truth -> condizioni controllate -> LLM -> raccolta -> scoring -> aggregazione -> confronto`

## Caratteristiche

- **Parser locale deterministico** del questionario (nessun LLM usato per interpretarlo), con validazione e anteprima tabellare domande/chiave.
- **Run indipendenti**: ogni somministrazione è una nuova chiamata API con lo stesso prompt standardizzato, senza la chiave corretta.
- **Scoring binario**: `correct` / `wrong` / `invalid`; le risposte invalide non vengono mai corrette né ritentate automaticamente; gli errori API non vengono conteggiati come risposte sbagliate.
- **KPI**: accuratezza complessiva (corrette / valutabili), metriche per domanda, per run, distribuzione scelte A-E.
- **Dashboard**: KPI card, tabelle (per domanda, matrice run x domanda, errori), grafici accessibili con legende non basate solo sul colore.
- **Risultati live**: KPI, tabelle e grafici si aggiornano dinamicamente a ogni run completato, durante l'esecuzione.
- **Log API in tempo reale**: nella sezione Esecuzione, ogni chiamata OpenRouter è tracciata (avvio, successo, errore HTTP/rete, cancellazione).
- **Export CSV e JSON** versionati (`schemaVersion: 1.0`), senza API key.
- **BYOK**: la API key resta solo in memoria runtime.

## Stack e motivazione

- **Vite + React + TypeScript**: build statico singola pagina, tooling standard e manutenibile, deploy diretto su GitHub Pages.
- **Grafici custom (SVG/CSS)**: nessuna libreria di charting, per minimizzare le dipendenze; i grafici sono tabelle/accessibili nativamente.
- **Vitest + Testing Library**: suite di test con API OpenRouter completamente mockata (nessuna chiave reale richiesta).

Nessuna dipendenza runtime oltre a React. Nessun backend, nessun database.

## Installazione locale

```bash
npm install
```

## Sviluppo

```bash
npm run dev
```

## Build

```bash
npm run build
```

Output in `dist/`. Il base path e configurato via variabile `PAGES_BASE` (default `/`, corretto per dominio custom come `https://benchmark.monaripietro.it/`). Per la pubblicazione su `https://utente.github.io/nome-repository/` usare:

```bash
PAGES_BASE=/nome-repository/ npm run build
```

## Test

```bash
npm test          # vitest in watch mode
npx vitest run    # singola esecuzione (CI)
```

I test coprono: parser questionario (valido, ID duplicati, opzione mancante, ANSWER non valido, domanda incompleta, righe non riconosciute), parser output modello (valido, testo extra, risposta mancante, duplicata), scoring correct/wrong/invalid, aggregazione metriche, runner con API mockata (run indipendenti, errori API, cancellazione, raw response), assenza API key negli export.

## Pubblicazione GitHub Pages

Il workflow `.github/workflows/deploy.yml` pubblica automaticamente la build su GitHub Pages a ogni push su `main`:

1. `Settings > Pages` del repository: scegli **Source: GitHub Actions**.
2. Il sito e pubblicato sul dominio custom configurato (`https://benchmark.monaripietro.it/`). Su GitHub Pages e' servito alla radice, quindi la build usa `PAGES_BASE=/` (default).

Per un repository con altro nome, imposta `PAGES_BASE` nel workflow di deploy (es. `PAGES_BASE: /Benchmark/ npm run build`).

## Uso della webapp

1. **Configurazione**: inserisci la API key OpenRouter (campo password con mostra/nascondi), l'ID del modello (es. `openai/gpt-4o-mini`) e il numero di somministrazioni indipendenti.
2. **Questionario**: in alto trovi il pulsante **Carica questionario DEMO** (benchmark sintetico, non validato scientificamente, solo per provare l'interfaccia) e accanto il pulsante **Copia prompt di formattazione**, che copia negli appunti il prompt riutilizzabile per convertire un tuo questionario nel formato richiesto. Incolla quindi il questionario nella textarea.
3. **Anteprima e validazione**: se il questionario è valido vedi la tabella domande/chiave e il riepilogo; altrimenti l'app blocca l'avvio e indica domanda e problema. Puoi anche ispezionare il prompt esatto che sarà inviato.
4. **Esecuzione**: avvia il benchmark; progress indicator, contatori completati/falliti/cancellati, pulsante di cancellazione e **log in tempo reale delle chiamate API** (avvio, esito, errori HTTP/rete, cancellazioni). Ogni run è una chiamata API indipendente; la risposta grezza è conservata e parsata localmente. La sezione Risultati si aggiorna dinamicamente durante l'esecuzione.
5. **Risultati ed export**: KPI, grafici, tabelle, matrice run x domanda, elenco errori API, export CSV e JSON.

## Sicurezza BYOK

In una webapp client-side una API key usata dal browser non può essere segreta rispetto al browser stesso. Questo prototipo didattico usa il modello **BYOK (Bring Your Own Key)**:

- la chiave è inserita manualmente, in un campo password con mostra/nascondi;
- resta solo nella memoria runtime di React (nessun `localStorage`, `sessionStorage`, cookie, query string, log, analytics);
- non compare mai negli export né nel repository;
- è cancellata al reload/chiusura della pagina.

Questa scelta è appropriata per un prototipo/laboratorio; **per uso produttivo le credenziali vanno gestite server-side** (proxy/backend), mai esposte al browser.

Le chiamate browser a OpenRouter sono supportate: l'API espone header CORS permissivi (`access-control-allow-origin: *`) su `https://openrouter.ai/api/v1/chat/completions` con autenticazione `Authorization: Bearer <KEY>`. Verifica sempre la [documentazione ufficiale](https://openrouter.ai/docs) per eventuali variazioni.

## Formato TXT del benchmark

```text
[QUESTION]
ID: Q01
TEXT: Testo della domanda
A: Prima alternativa
B: Seconda alternativa
C: Terza alternativa
D: Quarta alternativa
E: Quinta alternativa
ANSWER: C
```

Regole di validazione: blocco `[QUESTION]` presente; ID presente e univoco; TEXT non vuoto; opzioni A-E tutte presenti e non vuote; ANSWER presente e in A-E; nessuna riga non riconosciuta. Il numero di domande è variabile (consigliato 10-12). Il file è elaborato esclusivamente nel browser.

### Prompt per formattare un questionario

```text
Converti il questionario seguente nel formato richiesto.

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
Restituisci prima il testo formattato e poi l'elenco delle anomalie rilevate.
```

## Export

- **CSV**: colonne `experiment_id, timestamp, model, run_id, question_id, selected_answer, expected_answer, status` — una riga per risposta (o per run fallito/cancellato).
- **JSON**: esperimento completo — `schemaVersion`, metadati, benchmark con chiave, run-by-run con raw responses, metriche aggregate. Il formato è stabile e versionato per confronti offline e future funzioni di import/confronto tra esperimenti (non inclusa in V1).

Nessun export contiene la API key; la funzione di export JSON include un controllo di sicurezza che blocca il download se individua un pattern di chiave.

## Dati demo

`public/demo-benchmark.txt` contiene un benchmark sintetico di 10 domande, etichettato DEMO, **non** scientificamente validato, esclusivamente per testare l'interfaccia. Si carica con l'apposito pulsante in cima alla sezione Questionario; il caricamento di file `.txt` locale non è più disponibile, il testo va incollato nella textarea.

## Licenza

Vedi [LICENSE](LICENSE).

## Natura del progetto

Strumento educativo/didattico, realizzato con Vibe Mistral in modalità code (come indicato anche nel footer della webapp).
