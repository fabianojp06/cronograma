import Link from 'next/link'

import { TabelaEmpilhavel } from '@/components/tabela-empilhavel'
import type { PontoPrioridadeAtraso } from '@/lib/dashboard-gestao'
import { formatarTotal } from '@/lib/matriz-calculo'
import { DESCRICAO_QUADRANTE, LIMIAR_BENEFICIO, LIMIAR_ESFORCO, NOTA_MAXIMA, type Quadrante } from '@/lib/matriz-criterios'

const LARGURA = 720
const ALTURA = 440
const MARGEM = { topo: 16, direita: 20, base: 44, esquerda: 52 }
const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base

const FUNDO: Record<Quadrante, string> = {
  QUICK_WINS: 'fill-quadQuickWins',
  ESTRATEGICOS: 'fill-quadEstrategicos',
  VIAVEIS: 'fill-quadViaveis',
  DESCARTAR: 'fill-quadDescartar',
}

const x = (esforco: number) => MARGEM.esquerda + (Math.min(esforco, NOTA_MAXIMA) / NOTA_MAXIMA) * AREA_X
const y = (beneficio: number) => MARGEM.topo + AREA_Y - (Math.min(beneficio, NOTA_MAXIMA) / NOTA_MAXIMA) * AREA_Y

/** Área proporcional ao número de ações atrasadas (não o raio: dobrar o raio quadruplicaria a mancha). */
const raio = (atrasadas: number, maximo: number) =>
  atrasadas === 0 ? 9 : 11 + 13 * Math.sqrt(atrasadas / Math.max(1, maximo))

/**
 * Matriz Benefício × Esforço com o ATRASO por cima: o tamanho (e a cor) da bolha
 * é quantas ações do projeto estão atrasadas. Bolha cheia na cor de atraso =
 * tem atraso; vazada = em dia. O número dentro liga ao quadro ao lado.
 * Quadrante é posição (tinta de fundo), não cor do ponto — a regra da matriz.
 */
export function BolhasPrioridade({ pontos }: { pontos: PontoPrioridadeAtraso[] }) {
  const maximo = Math.max(0, ...pontos.map((p) => p.atrasadas))
  const xLimiar = x(LIMIAR_ESFORCO)
  const yLimiar = y(LIMIAR_BENEFICIO)

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          aria-label="Projetos por benefício e esforço, com o tamanho pelo número de ações atrasadas"
          className="h-auto w-full min-w-[34rem]"
          role="img"
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        >
          <rect className={FUNDO.QUICK_WINS} height={yLimiar - MARGEM.topo} width={xLimiar - MARGEM.esquerda} x={MARGEM.esquerda} y={MARGEM.topo} />
          <rect className={FUNDO.ESTRATEGICOS} height={yLimiar - MARGEM.topo} width={LARGURA - MARGEM.direita - xLimiar} x={xLimiar} y={MARGEM.topo} />
          <rect className={FUNDO.VIAVEIS} height={ALTURA - MARGEM.base - yLimiar} width={xLimiar - MARGEM.esquerda} x={MARGEM.esquerda} y={yLimiar} />
          <rect className={FUNDO.DESCARTAR} height={ALTURA - MARGEM.base - yLimiar} width={LARGURA - MARGEM.direita - xLimiar} x={xLimiar} y={yLimiar} />

          {(
            [
              ['QUICK_WINS', MARGEM.esquerda + 8, MARGEM.topo + 16],
              ['ESTRATEGICOS', LARGURA - MARGEM.direita - 8, MARGEM.topo + 16],
              ['VIAVEIS', MARGEM.esquerda + 8, ALTURA - MARGEM.base - 8],
              ['DESCARTAR', LARGURA - MARGEM.direita - 8, ALTURA - MARGEM.base - 8],
            ] as const
          ).map(([q, tx, ty]) => (
            <text className="fill-textFaint text-[11px] font-medium uppercase tracking-wide" key={q} textAnchor={tx < LARGURA / 2 ? 'start' : 'end'} x={tx} y={ty}>
              {DESCRICAO_QUADRANTE[q].rotulo}
            </text>
          ))}

          {[0, 3, 6, 9].map((v) => (
            <g key={v}>
              <text className="fill-textFaint text-[11px] tabular-nums" textAnchor="middle" x={x(v)} y={ALTURA - MARGEM.base + 16}>{v}</text>
              <text className="fill-textFaint text-[11px] tabular-nums" textAnchor="end" x={MARGEM.esquerda - 8} y={y(v) + 4}>{v}</text>
            </g>
          ))}
          <text className="fill-textMuted text-xs" textAnchor="middle" x={MARGEM.esquerda + AREA_X / 2} y={ALTURA - 6}>Esforço →</text>
          <text className="fill-textMuted text-xs" textAnchor="middle" transform={`rotate(-90 14 ${MARGEM.topo + AREA_Y / 2})`} x={14} y={MARGEM.topo + AREA_Y / 2}>Benefício →</text>

          {pontos.map((p, i) => (
            <g key={p.projetoId}>
              <title>{`${p.nome}: benefício ${formatarTotal(p.beneficio)}, esforço ${formatarTotal(p.esforco)}, ${p.atrasadas} ação(ões) atrasada(s)`}</title>
              <circle
                className={p.atrasadas > 0 ? 'fill-warn stroke-warn' : 'fill-surface stroke-textMuted'}
                cx={x(p.esforco)}
                cy={y(p.beneficio)}
                fillOpacity={p.atrasadas > 0 ? 0.55 : 1}
                r={raio(p.atrasadas, maximo)}
                strokeWidth={p.critico ? 3 : 1.5}
              />
              <text className="fill-text text-[11px] font-bold tabular-nums" dy="0.35em" textAnchor="middle" x={x(p.esforco)} y={y(p.beneficio)}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-1 text-xs text-textFaint md:hidden">Arraste o gráfico para o lado para ver o plano inteiro.</p>

      <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-textMuted">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-3 rounded-full bg-warn/55 ring-1 ring-warn" /> Com ação atrasada (quanto maior, mais atrasos)</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-3 rounded-full border border-textMuted bg-surface" /> Em dia</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block size-3 rounded-full border-[3px] border-warn bg-warn/55" /> Contorno grosso: alto benefício e atrasado</li>
      </ul>

      <TabelaEmpilhavel className="mt-4">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Projeto</th>
              <th className="px-3 py-2 font-semibold">Equipe</th>
              <th className="px-3 py-2 font-semibold">Quadrante</th>
              <th className="px-3 py-2 text-right font-semibold">Benefício</th>
              <th className="px-3 py-2 text-right font-semibold">Esforço</th>
              <th className="px-3 py-2 text-right font-semibold">Atrasadas</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p, i) => (
              <tr className="border-b border-borderSoft bg-surface" key={p.projetoId}>
                <td className="px-3 py-2 tabular-nums text-textFaint">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link className="font-medium hover:text-accent" href={`/priorizacao?projeto=${p.projetoId}`}>{p.nome}</Link>
                  {p.critico ? <span className="ml-2 rounded border border-warn px-1.5 py-0.5 text-[11px] font-semibold text-warn">alto benefício atrasado</span> : null}
                </td>
                <td className="px-3 py-2 text-textMuted">{p.equipe}</td>
                <td className="px-3 py-2 text-textMuted">{DESCRICAO_QUADRANTE[p.quadrante].rotulo}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatarTotal(p.beneficio)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatarTotal(p.esforco)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${p.atrasadas > 0 ? 'font-semibold text-warn' : 'text-textFaint'}`}>{p.atrasadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaEmpilhavel>
    </div>
  )
}
