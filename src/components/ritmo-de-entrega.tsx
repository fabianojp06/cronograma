import type { SemanaDoRitmo } from '@/lib/dashboard-gestao'

const LARGURA = 760
const ALTURA = 280
const MARGEM = { topo: 20, direita: 16, base: 34, esquerda: 36 }
const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * Ritmo de entrega: barras das ações CONCLUÍDAS por semana (cor de realizado),
 * linha das ações NOVAS por semana (cor de magnitude) e a média móvel das
 * concluídas (tracejada). Um eixo só — as três séries são contagens de ações.
 * Concluir acima da linha de criação é o que faz a carteira encolher.
 */
export function RitmoDeEntrega({ semanas }: { semanas: SemanaDoRitmo[] }) {
  const maximo = Math.max(1, ...semanas.flatMap((s) => [s.concluidas, s.criadas, s.mediaMovel]))
  const passo = AREA_X / semanas.length
  const cx = (i: number) => MARGEM.esquerda + passo * i + passo / 2
  const y = (v: number) => MARGEM.topo + AREA_Y - (v / maximo) * AREA_Y
  const largura = Math.min(34, passo * 0.55)

  const linha = (valor: (s: SemanaDoRitmo) => number) =>
    semanas.map((s, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${y(valor(s))}`).join(' ')

  const concluidas = semanas.reduce((s, x) => s + x.concluidas, 0)
  const criadas = semanas.reduce((s, x) => s + x.criadas, 0)
  const saldo = criadas - concluidas

  return (
    <figure className="m-0">
      <p className="text-sm text-textMuted" role="status">
        Nas últimas {semanas.length} semanas: <strong className="text-text">{concluidas}</strong> ações concluídas e{' '}
        <strong className="text-text">{criadas}</strong> criadas
        {saldo > 0 ? ` — a carteira cresceu em ${saldo} ações.` : saldo < 0 ? ` — a carteira encolheu em ${-saldo} ações.` : ' — a carteira ficou do mesmo tamanho.'}
      </p>
      <div className="mt-3 overflow-x-auto">
        <svg aria-label="Ações concluídas e criadas por semana, nas últimas semanas" className="h-auto w-full min-w-[34rem]" role="img" viewBox={`0 0 ${LARGURA} ${ALTURA}`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line className="stroke-borderSoft" strokeWidth={1} vectorEffect="non-scaling-stroke" x1={MARGEM.esquerda} x2={LARGURA - MARGEM.direita} y1={y(maximo * f)} y2={y(maximo * f)} />
              <text className="fill-textFaint text-xs tabular-nums" textAnchor="end" x={MARGEM.esquerda - 6} y={y(maximo * f) + 4}>{Math.round(maximo * f)}</text>
            </g>
          ))}
          {semanas.map((s, i) => (
            <g key={s.inicio}>
              <title>{`Semana de ${dm(s.inicio)}: ${s.concluidas} concluídas, ${s.criadas} criadas`}</title>
              <rect className="fill-realizado" height={Math.max(0, MARGEM.topo + AREA_Y - y(s.concluidas))} width={largura} x={cx(i) - largura / 2} y={y(s.concluidas)} />
              {s.concluidas > 0 ? (
                <text className="fill-text text-xs font-semibold tabular-nums" textAnchor="middle" x={cx(i)} y={y(s.concluidas) - 4}>{s.concluidas}</text>
              ) : null}
              <text className="fill-textFaint text-xs tabular-nums" textAnchor="middle" x={cx(i)} y={ALTURA - 12}>{dm(s.inicio)}</text>
            </g>
          ))}
          <path className="stroke-textMuted" d={linha((s) => s.mediaMovel)} fill="none" strokeDasharray="5 4" strokeWidth={2} />
          <path className="stroke-accent" d={linha((s) => s.criadas)} fill="none" strokeWidth={2.5} />
          {semanas.map((s, i) => (
            <circle className="fill-accent stroke-surface" cx={cx(i)} cy={y(s.criadas)} key={s.inicio} r={4} strokeWidth={1.5} />
          ))}
        </svg>
      </div>
      <p className="mt-1 text-xs text-textFaint md:hidden">Arraste o gráfico para o lado para ver todas as semanas.</p>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-textMuted">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block size-3 bg-realizado" /> Concluídas por semana</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-0.5 w-5 bg-accent" /> Ações criadas por semana</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-textMuted" /> Média de concluídas (4 semanas)</span>
      </figcaption>
    </figure>
  )
}
