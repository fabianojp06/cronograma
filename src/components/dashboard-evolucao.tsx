import type { PontoEvolucao } from '@/lib/dashboard-temporal'

/**
 * Curva acumulada Previsto x Realizado (burn-up), em SVG inline — sem
 * biblioteca de gráfico e sem JavaScript no cliente: a tela inteira é server
 * component, e uma dependência de charting para duas linhas não se paga.
 *
 * Duas séries, então legenda sempre presente e as duas também rotuladas
 * diretamente na ponta da linha — identidade nunca fica só na cor. As cores
 * são as mesmas do Gantt (Previsto = azul, Realizado = verde, CLAUDE.md): a
 * mesma coisa tem a mesma cor em toda a aplicação.
 *
 * Um único eixo Y (contagem de ações) — as duas séries medem a mesma grandeza.
 */

const LARGURA = 840
const ALTURA = 260
const MARGEM = { topo: 16, direita: 132, base: 28, esquerda: 40 }

const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base

function caminho(pontos: { x: number; y: number }[]): string {
  return pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

export function DashboardEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const maximo = Math.max(1, ...pontos.map((p) => p.previstoAcumulado))
  const passo = pontos.length <= 1 ? 0 : AREA_X / (pontos.length - 1)

  const x = (indice: number) => MARGEM.esquerda + indice * passo
  const y = (valor: number) => MARGEM.topo + AREA_Y - (valor / maximo) * AREA_Y

  const previsto = pontos.map((p, i) => ({ x: x(i), y: y(p.previstoAcumulado) }))
  // A curva Realizado para no mês corrente: estendê-la sobre meses futuros
  // desenharia uma queda de ritmo que não aconteceu — só ainda não chegou.
  const realizado = pontos
    .map((p, i) => ({ ...p, x: x(i), y: y(p.realizadoAcumulado) }))
    .filter((p) => p.passado)

  const ultimoPrevisto = previsto[previsto.length - 1]
  const ultimoRealizado = realizado[realizado.length - 1]

  // Rótulos do eixo X rareados para não colidirem quando há muitos meses.
  const saltoRotulo = Math.ceil(pontos.length / 8)

  return (
    <figure className="m-0">
      {/* No celular o gráfico ganha largura mínima e rola de lado: espremido na
          largura da tela, os rótulos ficariam ilegíveis. */}
      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full min-w-[34rem]"
        role="img"
        aria-label="Ações acumuladas previstas e realizadas, mês a mês"
      >
        {/* Grade recessiva: 4 linhas horizontais, sem moldura e sem grade vertical. */}
        {[0, 0.25, 0.5, 0.75, 1].map((fracao) => (
          <g key={fracao}>
            <line
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={y(maximo * fracao)}
              y2={y(maximo * fracao)}
              className="stroke-borderSoft"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={MARGEM.esquerda - 8}
              y={y(maximo * fracao) + 4}
              textAnchor="end"
              className="fill-textFaint text-[11px] tabular-nums"
            >
              {Math.round(maximo * fracao)}
            </text>
          </g>
        ))}

        {pontos.map((ponto, i) =>
          i % saltoRotulo === 0 ? (
            <text
              key={ponto.chave}
              x={x(i)}
              y={ALTURA - 8}
              textAnchor="middle"
              className="fill-textFaint text-[11px]"
            >
              {ponto.rotulo}
            </text>
          ) : null,
        )}

        {/* Previsto: tracejado, como a barra de contorno do Gantt — é plano, não fato. */}
        <path
          d={caminho(previsto)}
          fill="none"
          className="stroke-previsto"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={caminho(realizado)}
          fill="none"
          className="stroke-realizado"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Alvo de hover maior que a marca, em cima de cada mês. */}
        {pontos.map((ponto, i) => (
          <circle key={ponto.chave} cx={x(i)} cy={ALTURA / 2} r={Math.max(passo / 2, 8)} fill="transparent">
            <title>
              {`${ponto.rotulo} — previsto ${ponto.previstoAcumulado}, realizado ${
                ponto.passado ? ponto.realizadoAcumulado : '—'
              }`}
            </title>
          </circle>
        ))}

        {ultimoPrevisto ? (
          <>
            <circle
              cx={ultimoPrevisto.x}
              cy={ultimoPrevisto.y}
              r={4}
              className="fill-previsto"
            />
            <text
              x={ultimoPrevisto.x + 10}
              y={ultimoPrevisto.y + 4}
              className="fill-textMuted text-[11px]"
            >
              Previsto {pontos[pontos.length - 1].previstoAcumulado}
            </text>
          </>
        ) : null}

        {ultimoRealizado ? (
          <>
            <circle
              cx={ultimoRealizado.x}
              cy={ultimoRealizado.y}
              r={4}
              className="fill-realizado"
            />
            <text
              x={ultimoRealizado.x + 10}
              y={ultimoRealizado.y + 4}
              className="fill-textMuted text-[11px]"
            >
              Realizado {ultimoRealizado.realizadoAcumulado}
            </text>
          </>
        ) : null}
      </svg>
      </div>
      <p className="mt-1 text-xs text-textFaint md:hidden">Arraste o gráfico para o lado para ver o período inteiro.</p>

      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-textMuted">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 bg-previsto" />
          Previsto acumulado
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 bg-realizado" />
          Realizado acumulado (até o mês corrente)
        </span>
      </figcaption>
    </figure>
  )
}
