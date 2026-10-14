export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  signal?: AbortSignal
}

export class ApiError extends Error {
  kind: 'http' | 'network' | 'timeout'
  constructor(kind: 'http' | 'network' | 'timeout', message: string) {
    super(message)
    this.kind = kind
  }
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

export async function chatCompletion(opts: ChatOptions): Promise<string> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
      }),
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('network', `Errore di rete: ${(err as Error).message}`)
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message ?? JSON.stringify(body)
    } catch {
      detail = res.statusText
    }
    throw new ApiError('http', `Errore HTTP ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new ApiError('http', 'Risposta API senza contenuto valido')
  }
  return content
}
