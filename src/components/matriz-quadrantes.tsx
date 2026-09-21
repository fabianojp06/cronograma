import {
  DESCRICAO_QUADRANTE,
  LIMIAR_BENEFICIO,
  LIMIAR_ESFORCO,
  NOTA_MAXIMA,
  type Quadrante,
} from '@/lib/matriz-criterios'
import { formatarTotal } from '@/lib/matriz-calculo'

/**
 * Plano Esforço (X) × Benefício (Y) da Matriz de Priorização — SVG inline,
 * server component, sem biblioteca de gráfico (regra do CLAUDE.md).
 *
 * Os quatro quadrantes são regiões de FUNDO levemente tingidas; os pontos
 * ficam todos na mesma cor. Num gráfico 2×2 quem carrega a identidade do
 * quadrante é a posição — colori-los seria redundante, e gastaria em decoração
 * as cores que o sistema reserva para status (previsto/realizado/atraso).
 *
 * O tamanho do ponto codifica o GUT. Área proporcional, não raio: dobrar o
 * raio quadruplica a mancha e exageraria a diferença.
 */

const LARGURA = 720
const ALTURA = 470
const MARGEM = { topo: 16, direita: 20, base: 44, esquerda: 52 }

const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base

const RAIO_MINIMO = 5
const RAIO_MAXIMO = 13

const FUNDO_QUADRANTE: Record<Quadrante, string> = {
  QUICK_WINS: 'fill-quadQuickWins',
  ESTRATEGICOS: 'fill-quadEstrategicos',
  VIAVEIS: 'fill-quadViaveis',
  DESCARTAR: 'fill-quadDescartar',
}

export type PontoMatriz = {
  id: string
  nome: string
  beneficio: number
  esforco: number
  gut: number
  prioridade: number
  quadrante: Quadrante
}

const x = (esforco: number) => MARGEM.esquerda + (esforco / NOTA_MAXIMA) * AREA_X
const y = (beneficio: number) => MARGEM.topo + AREA_Y - (beneficio / NOTA_MAXIMA) * AREA_Y

/** Área proporcional ao GUT, que vai de 1 a 125. */
function raio(gut: number, maiorGut: number): number {
  if (maiorGut <= 0) return RAIO_MINIMO
  const fracao = Math.sqrt(Math.max(gut, 0) / maiorGut)
  return RAIO_MINIMO + fracao * (RAIO_MAXIMO - RAIO_MINIMO)
}

/**
 * Região de fundo de um quadrante.
 *
 * O rótulo fica no canto EXTERNO da região (Quick Wins em cima à esquerda,
 * Descartar embaixo à direita, e assim por diante). Colocá-lo sempre no canto
 * superior esquerdo jogava o texto para junto das linhas de limiar, que é
 * exatamente onde os pontos se acumulam.
 */
function Regiao({
  quadrante,
  x1,
  x2,
  y1,
  y2,
  ancora,
}: {
  quadrante: Quadrante
  x1: number
  x2: number
  y1: number
  y2: number
  /** Canto externo onde o rótulo encosta. */
  ancora: 'superior-esquerdo' | 'superior-direito' | 'inferior-esquerdo' | 'inferior-direito'
}) {
  const descricao = DESCRICAO_QUADRANTE[quadrante]
  const esquerda = Math.min(x(x1), x(x2))
  const direita = Math.max(x(x1), x(x2))
  const topo = Math.min(y(y1), y(y2))
  const base = Math.max(y(y1), y(y2))

  const aDireita = ancora.endsWith('direito')
  const embaixo = ancora.startsWith('inferior')

  return (
    <g>
      <rect
        x={esquerda}
        y={topo}
        width={direita - esquerda}
        height={base - topo}
        className={FUNDO_QUADRANTE[quadrante]}
      />
      <text
        x={aDireita ? direita - 10 : esquerda + 10}
        y={embaixo ? base - 10 : topo + 18}
        textAnchor={aDireita ? 'end' : 'start'}
        className="fill-textFaint text-[11px] font-semibold uppercase tracking-wide"
      >
        {descricao.numero}. {descricao.rotulo}
      </text>
    </g>
  )
}

/**
 * Rótulo direto de um ponto — ao LADO, não acima.
 *
 * Acima do ponto o texto caía em cima do vizinho de baixo sempre que dois
 * projetos tinham benefício parecido. Ao lado, o texto só disputa espaço na
 * horizontal, e vira para a esquerda quando o ponto está perto da borda
 * direita. O contorno na cor da superfície (`paint-order: stroke`) mantém o
 * texto legível mesmo passando por cima de uma tinta de quadrante.
 */
function RotuloPonto({ ponto, raioPonto }: { ponto: PontoMatriz; raioPonto: number }) {
  const cx = x(ponto.esforco)
  const paraEsquerda = cx > MARGEM.esquerda + AREA_X * 0.62
  const recorte = ponto.nome.length > 26 ? `${ponto.nome.slice(0, 25)}…` : ponto.nome

  return (
    <text
      x={cx + (paraEsquerda ? -(raioPonto + 8) : raioPonto + 8)}
      y={y(ponto.beneficio) + 4}
      textAnchor={paraEsquerda ? 'end' : 'start'}
      className="fill-text stroke-surface text-[11px] font-medium"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {recorte}
    </text>
  )
}

export function MatrizQuadrantes({ pontos }: { pontos: PontoMatriz[] }) {
  const maiorGut = pontos.reduce((maior, p) => Math.max(maior, p.gut), 0)

  // Rótulo direto só nos três de maior prioridade: um número em cada ponto
  // vira ruído, e são esses três que a tela existe para apontar.
  const rotulados = new Set(
    [...pontos]
      .sort((a, b) => b.prioridade - a.prioridade)
      .slice(0, 3)
      .map((p) => p.id),
  )

  const marcas = [0, 3, 6, 9]

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full"
        role="img"
        aria-label="Projetos posicionados por esforço e benefício, em quatro quadrantes"
      >
        <Regiao
          quadrante="VIAVEIS"
          x1={0}
          x2={LIMIAR_ESFORCO}
          y1={0}
          y2={LIMIAR_BENEFICIO}
          ancora="inferior-esquerdo"
        />
        <Regiao
          quadrante="DESCARTAR"
          x1={LIMIAR_ESFORCO}
          x2={NOTA_MAXIMA}
          y1={0}
          y2={LIMIAR_BENEFICIO}
          ancora="inferior-direito"
        />
        <Regiao
          quadrante="QUICK_WINS"
          x1={0}
          x2={LIMIAR_ESFORCO}
          y1={LIMIAR_BENEFICIO}
          y2={NOTA_MAXIMA}
          ancora="superior-esquerdo"
        />
        <Regiao
          quadrante="ESTRATEGICOS"
          x1={LIMIAR_ESFORCO}
          x2={NOTA_MAXIMA}
          y1={LIMIAR_BENEFICIO}
          y2={NOTA_MAXIMA}
          ancora="superior-direito"
        />

        {/* Limiares — tracejados e recessivos: são referência, não dado. */}
        <line
          x1={x(LIMIAR_ESFORCO)}
          x2={x(LIMIAR_ESFORCO)}
          y1={y(0)}
          y2={y(NOTA_MAXIMA)}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x(0)}
          x2={x(NOTA_MAXIMA)}
          y1={y(LIMIAR_BENEFICIO)}
          y2={y(LIMIAR_BENEFICIO)}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />

        {marcas.map((marca) => (
          <g key={marca}>
            <text
              x={x(marca)}
              y={ALTURA - 24}
              textAnchor="middle"
              className="fill-textFaint text-[11px] tabular-nums"
            >
              {marca}
            </text>
            <text
              x={MARGEM.esquerda - 10}
              y={y(marca) + 4}
              textAnchor="end"
              className="fill-textFaint text-[11px] tabular-nums"
            >
              {marca}
            </text>
          </g>
        ))}

        <text
          x={MARGEM.esquerda + AREA_X / 2}
          y={ALTURA - 6}
          textAnchor="middle"
          className="fill-textMuted text-[12px] font-medium"
        >
          Esforço →
        </text>
        <text
          x={-(MARGEM.topo + AREA_Y / 2)}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          className="fill-textMuted text-[12px] font-medium"
        >
          Benefício →
        </text>

        {pontos.map((ponto) => {
          const descricao = DESCRICAO_QUADRANTE[ponto.quadrante]
          return (
            <g key={ponto.id}>
              {/* Anel na cor da superfície para que pontos sobrepostos
                  continuem separáveis. */}
              <circle
                cx={x(ponto.esforco)}
                cy={y(ponto.beneficio)}
                r={raio(ponto.gut, maiorGut)}
                className="fill-accent stroke-surface"
                strokeWidth={2}
                fillOpacity={0.85}
              >
                <title>
                  {`${ponto.nome} — ${descricao.rotulo}. Benefício ${formatarTotal(
                    ponto.beneficio,
                  )}, esforço ${formatarTotal(ponto.esforco)}, GUT ${
                    ponto.gut
                  }, prioridade ${formatarTotal(ponto.prioridade)}`}
                </title>
              </circle>
              {rotulados.has(ponto.id) ? (
                <RotuloPonto ponto={ponto} raioPonto={raio(ponto.gut, maiorGut)} />
              ) : null}
            </g>
          )
        })}
      </svg>

      <figcaption className="mt-3 text-sm text-textMuted">
        Cada ponto é um projeto avaliado; o tamanho representa o GUT (G × U × T).
        Os limiares são esforço {LIMIAR_ESFORCO} e benefício {LIMIAR_BENEFICIO}, como
        na planilha original.
      </figcaption>
    </figure>
  )
}
