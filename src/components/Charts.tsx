interface BarChartProps {
  data: { label: string; value: number }[]
  title: string
  max?: number
}

export function BarChart({ data, title, max }: BarChartProps) {
  const top = max ?? Math.max(100, ...data.map((d) => d.value))
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <table className="chart-table">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>
                <div className="bar-wrap" role="img" aria-label={`${d.label}: ${d.value.toFixed(1)}%`}>
                  <div
                    className="bar"
                    style={{ width: `${Math.min(100, (d.value / top) * 100)}%` }}
                  />
                </div>
              </td>
              <td className="bar-val">{d.value.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

interface DonutProps {
  segments: { label: string; value: number; color: string; pattern: string }[]
  title: string
}

export function DonutChart({ segments, title }: DonutProps) {
  const r = 45
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  const arcs = segments.reduce<{ label: string; color: string; dash: number; offset: number }[]>(
    (list, s) => {
      const prev = list[list.length - 1]
      const offset = prev ? prev.offset + prev.dash : 0
      const dash = (s.value / total) * c
      return [...list, { label: s.label, color: s.color, dash, offset }]
    },
    [],
  )
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {total === 0 ? (
        <p>Nessun dato disponibile.</p>
      ) : (
        <div className="donut-wrap">
          <svg viewBox="0 0 120 120" width="160" height="160" role="img" aria-label={title}>
            {arcs.map((s) => (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${s.dash} ${c - s.dash}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 60 60)"
              />
            ))}
            <text x="60" y="64" textAnchor="middle" className="donut-total">
              {total}
            </text>
          </svg>
          <ul className="legend">
            {segments.map((s) => (
              <li key={s.label}>
                <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                <span className="pattern-tag">{s.pattern}</span> {s.label}: {s.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  )
}

interface DistributionProps {
  rows: { questionId: string; distribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number> }[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

export function DistributionChart({ rows }: DistributionProps) {
  const colors: Record<string, string> = {
    A: '#2563eb',
    B: '#16a34a',
    C: '#d97706',
    D: '#9333ea',
    E: '#dc2626',
  }
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.distribution)))
  return (
    <figure className="chart">
      <figcaption>Distribuzione scelte A-E per domanda</figcaption>
      <table className="chart-table dist">
        <caption className="sr-only">Distribuzione scelte per domanda</caption>
        <thead>
          <tr>
            <th scope="col">Domanda</th>
            {LETTERS.map((l) => (
              <th scope="col" key={l}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.questionId}>
              <th scope="row">{r.questionId}</th>
              {LETTERS.map((l) => (
                <td key={l}>
                  <div
                    className="dist-bar"
                    style={{
                      width: `${(r.distribution[l] / max) * 100}%`,
                      background: colors[l],
                    }}
                    title={`${r.questionId}:${l} = ${r.distribution[l]}`}
                  />
                  <span className="dist-n">{r.distribution[l]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="legend inline">
        {LETTERS.map((l) => (
          <li key={l}>
            <span className="swatch" style={{ background: colors[l] }} aria-hidden="true" />
            <span className="pattern-tag">[{l}]</span> Scelta {l}
          </li>
        ))}
      </ul>
    </figure>
  )
}
