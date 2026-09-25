import type { ConclusaoSemanal } from '@/lib/dashboard-wins'

/**
 * Conclusão dos WINs por semana — barras empilhadas, SVG inline no servidor.
 *
 * Decisões que não são estéticas:
 *
 * - **A pilha tem ordem fixa** (FEITO → PROMOVIDO → EM_ANDAMENTO → PENDENTE →
 *   NAO_FEITO): do desfecho melhor para o pior, para a leitura de cima a baixo
 *   significar alguma coisa.
 * - **PROMOVIDO se distingue por textura, não por cor.** Usar `accent` gastaria
 *   em status uma cor que o projeto reserva a magnitude; a hachura sobre o
 *   verde mantém o parentesco (promover é desfecho bom) sem inventar uma sexta
 *   cor num gráfico que já tem quatro.
 * - **A semana em curso é contorno tracejado, nunca hachura.** Hachura já
 *   significa "promovido" aqui, e a última barra é sempre a semana em aberto:
 *   as duas marcas coincidiriam e nada as distinguiria.
 * - **Semana sem WIN não vira barra de altura zero**, que se confundiria com
 *   0%. Leva um traço e o rótulo "—".
 */

const ALTURA = 150
const LARGURA_BARRA = 34
const ESPACO = 14
const MARGEM_TOPO = 22
const MARGEM_BASE = 46

const FAIXAS = [
  { chave: 'feitos', rotulo: 'Concluído', classe: 'fill-realizado' },
  { chave: 'promovidos', rotulo: 'Promovido', classe: 'fill-realizado' },
  { chave: 'emAndamento', rotulo: 'Em andamento', classe: 'fill-previsto' },
  { chave: 'pendentes', rotulo: 'Pendente', classe: 'fill-textFaint' },
  { chave: 'naoFeitos', rotulo: 'Não feito', classe: 'fill-warn' },
] as const

export function GraficoWinsSemana({ semanas }: { semanas: ConclusaoSemanal[] }) {
  const maximo = Math.max(1, ...semanas.map((s) => s.total))
  const largura = semanas.length * (LARGURA_BARRA + ESPACO) + ESPACO
  const altura = ALTURA + MARGEM_TOPO + MARGEM_BASE
  const escala = (valor: number) => (valor / maximo) * ALTURA

  return (
    <div className="overflow-x-auto">
      <svg
        className="min-w-full"
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label="WINs por semana, empilhados por desfecho"
      >
        <defs>
          <pattern
            id="hachura-promovido"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className="fill-realizado" opacity="0.35" />
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-realizado" strokeWidth="3" />
          </pattern>
        </defs>

        {semanas.map((semana, indice) => {
          const x = ESPACO + indice * (LARGURA_BARRA + ESPACO)
          let y = MARGEM_TOPO + ALTURA

          return (
            <g key={`${semana.semana.ano}-${semana.semana.semana}`}>
              {semana.total === 0 ? (
                <line
                  x1={x}
                  y1={MARGEM_TOPO + ALTURA}
                  x2={x + LARGURA_BARRA}
                  y2={MARGEM_TOPO + ALTURA}
                  className="stroke-borderSoft"
                  strokeWidth="2"
                />
              ) : (
                FAIXAS.map((faixa) => {
                  const valor = semana[faixa.chave]
                  if (valor === 0) return null
                  const h = escala(valor)
                  y -= h
                  return (
                    <rect
                      key={faixa.chave}
                      x={x}
                      y={y}
                      width={LARGURA_BARRA}
                      height={h}
                      className={faixa.chave === 'promovidos' ? undefined : faixa.classe}
                      fill={
                        faixa.chave === 'promovidos' ? 'url(#hachura-promovido)' : undefined
                      }
                    >
                      <title>{`${faixa.rotulo}: ${valor}`}</title>
                    </rect>
                  )
                })
              )}

              {semana.emCurso ? (
                <rect
                  x={x - 2}
                  y={MARGEM_TOPO - 6}
                  width={LARGURA_BARRA + 4}
                  height={ALTURA + 6}
                  fill="none"
                  className="stroke-textMuted"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              ) : null}

              <text
                x={x + LARGURA_BARRA / 2}
                y={MARGEM_TOPO - 8}
                textAnchor="middle"
                className="fill-text text-[10px] font-medium"
              >
                {semana.taxa === null ? '—' : `${Math.round(semana.taxa * 100)}%`}
              </text>

              <text
                x={x + LARGURA_BARRA / 2}
                y={MARGEM_TOPO + ALTURA + 16}
                textAnchor="middle"
                className="fill-textMuted text-[10px]"
              >
                {semana.rotulo.replace('Semana ', 'S')}
              </text>
              {semana.emCurso ? (
                <text
                  x={x + LARGURA_BARRA / 2}
                  y={MARGEM_TOPO + ALTURA + 30}
                  textAnchor="middle"
                  className="fill-textFaint text-[9px]"
                >
                  em curso
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-textMuted">
        {FAIXAS.map((faixa) => (
          <li key={faixa.chave} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block h-2.5 w-2.5 ${faixa.chave === 'promovidos' ? 'border border-realizado bg-realizado/35' : faixa.classe.replace('fill-', 'bg-')}`}
            />
            {faixa.rotulo}
          </li>
        ))}
      </ul>
    </div>
  )
}
