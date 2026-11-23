import type { PontoCurva } from '@/lib/flash-report'

const L = 640
const A = 260
const MARGEM = { e: 40, d: 16, t: 12, b: 28 }
const TICKS = [0, 20, 40, 60, 80, 100]

export function CurvaAvanco({ curva, escolhida }: { curva: PontoCurva[]; escolhida: number }) {
  if (curva.length === 0) return null
  const w = L - MARGEM.e - MARGEM.d
  const h = A - MARGEM.t - MARGEM.b
  const x = (i: number) => MARGEM.e + (curva.length === 1 ? w / 2 : (i / (curva.length - 1)) * w)
  const y = (v: number) => MARGEM.t + h - (Math.max(0, Math.min(100, v)) / 100) * h
  const previsto = curva.map((p, i) => `${x(i)},${y(p.previsto)}`).join(' ')
  const realizados = curva.flatMap((p, i) => (p.realizado === null ? [] : [{ i, v: p.realizado }]))
  const salto = Math.max(1, Math.ceil(curva.length / 12))

  return (
    <section aria-labelledby="t-curva" className="min-w-0" data-testid="curva-avanco">
      <h2 className="border-b border-border pb-2 font-display text-base font-bold" id="t-curva">
        Curva de avanço semanal (% previsto × % realizado)
      </h2>
      <div className="relative mt-2 overflow-x-auto">
        <svg
          aria-label="Curva de avanço: previsto acumulado tracejado e realizado acumulado contínuo, de 0 a 100%"
          className="h-auto w-full min-w-[30rem]"
          role="img"
          viewBox={`0 0 ${L} ${A}`}
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line className="stroke-border" strokeWidth={1} x1={MARGEM.e} x2={L - MARGEM.d} y1={y(t)} y2={y(t)} />
              <text className="fill-textMuted text-xs tabular-nums" textAnchor="end" x={MARGEM.e - 6} y={y(t) + 4}>
                {t}%
              </text>
            </g>
          ))}
          {curva.map((p, i) =>
            i % salto === 0 || i === curva.length - 1 ? (
              <text className={`text-xs tabular-nums ${i + 1 === escolhida ? 'fill-accent font-bold' : 'fill-textMuted'}`} key={p.rotulo} textAnchor="middle" x={x(i)} y={A - 8}>
                {p.rotulo}
              </text>
            ) : null,
          )}
          {escolhida >= 1 && escolhida <= curva.length ? (
            <line className="stroke-accent" strokeDasharray="2 3" strokeWidth={1.5} x1={x(escolhida - 1)} x2={x(escolhida - 1)} y1={MARGEM.t} y2={MARGEM.t + h} />
          ) : null}
          <polyline className="stroke-previsto" fill="none" points={previsto} strokeDasharray="6 4" strokeWidth={2} />
          {curva.map((p, i) => (
            <circle className="fill-surface stroke-previsto" cx={x(i)} cy={y(p.previsto)} key={p.rotulo} r={3} strokeWidth={1.5} />
          ))}
          {realizados.length > 1 ? (
            <polyline
              className="stroke-realizado"
              fill="none"
              points={realizados.map((r) => `${x(r.i)},${y(r.v)}`).join(' ')}
              strokeWidth={2.5}
            />
          ) : null}
          {realizados.map((r) => (
            <circle className="fill-realizado stroke-surface" cx={x(r.i)} cy={y(r.v)} key={r.i} r={3.5} strokeWidth={1} />
          ))}
        </svg>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-textMuted">
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" className="h-2 w-6" viewBox="0 0 24 8"><line className="stroke-previsto" strokeDasharray="5 3" strokeWidth={2} x1="0" x2="24" y1="4" y2="4" /></svg>
          Previsto acumulado (tracejado)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" className="h-2 w-6" viewBox="0 0 24 8"><line className="stroke-realizado" strokeWidth={2.5} x1="0" x2="24" y1="4" y2="4" /></svg>
          Realizado acumulado (contínuo; para na semana escolhida)
        </span>
      </p>
      <div className="relative mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-right text-xs tabular-nums">
          <caption className="sr-only">Números da curva de avanço por semana do projeto</caption>
          <thead>
            <tr className="border-b border-border font-semibold text-textMuted">
              <th className="py-1 pr-2 text-left" scope="col">Semana</th>
              {curva.map((p) => (
                <th className={`px-1 py-1 ${p.rotulo === `S${String(escolhida).padStart(2, '0')}` ? 'text-accent' : ''}`} key={p.rotulo} scope="col">{p.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-borderSoft">
              <th className="py-1 pr-2 text-left font-medium" scope="row">Previsto</th>
              {curva.map((p) => (
                <td className="px-1 py-1" key={p.rotulo}>{Math.round(p.previsto)}%</td>
              ))}
            </tr>
            <tr className="border-b border-borderSoft">
              <th className="py-1 pr-2 text-left font-medium" scope="row">Realizado</th>
              {curva.map((p) => (
                <td className="px-1 py-1" key={p.rotulo}>{p.realizado === null ? '—' : `${Math.round(p.realizado)}%`}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
