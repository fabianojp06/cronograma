import Link from 'next/link'

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
 * Cada ponto leva o NÚMERO da posição no ranking, e a legenda ao lado liga o
 * número ao nome. Nome escrito dentro do plano se sobrepunha sempre que dois
 * projetos tinham notas parecidas — e não dava para saber qual ponto era qual.
 *
 * O tamanho do ponto codifica o GUT. Área proporcional, não raio: dobrar o
 * raio quadruplica a mancha e exageraria a diferença.
 */

const LARGURA = 720
const ALTURA = 470
const MARGEM = { topo: 16, direita: 20, base: 44, esquerda: 52 }

const AREA_X = LARGURA - MARGEM.esquerda - MARGEM.direita
const AREA_Y = ALTURA - MARGEM.topo - MARGEM.base

// Piso alto o bastante para caber o número do ranking dentro do ponto.
const RAIO_MINIMO = 10
const RAIO_MAXIMO = 17

const FUNDO_QUADRANTE: Record<Quadrante, string> = {
  QUICK_WINS: 'fill-quadQuickWins',
  ESTRATEGICOS: 'fill-quadEstrategicos',
  VIAVEIS: 'fill-quadViaveis',
  DESCARTAR: 'fill-quadDescartar',
}

export type PontoMatriz = {
  id: string
  nome: string
  /** Posição no ranking (1 = maior prioridade) — o número desenhado no ponto. */
  posicao: number
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

type PontoDesenhado = PontoMatriz & {
  /** Posição real no plano. */
  cx: number
  cy: number
  /** Posição desenhada — difere da real quando o ponto foi afastado de um vizinho. */
  dx: number
  dy: number
  r: number
}

/**
 * Pontos com notas iguais (ou quase) caem um em cima do outro e o de baixo
 * some. Agrupa os que se tocam e os distribui num pequeno círculo ao redor do
 * centro do grupo; a posição real continua marcada por um traço fino.
 */
function afastarSobrepostos(pontos: PontoMatriz[], maiorGut: number): PontoDesenhado[] {
  const grupos: PontoDesenhado[][] = []

  for (const ponto of pontos) {
    const desenhado: PontoDesenhado = {
      ...ponto,
      cx: x(ponto.esforco),
      cy: y(ponto.beneficio),
      dx: x(ponto.esforco),
      dy: y(ponto.beneficio),
      r: raio(ponto.gut, maiorGut),
    }
    const grupo = grupos.find((g) =>
      g.some((outro) => Math.hypot(outro.cx - desenhado.cx, outro.cy - desenhado.cy) < outro.r + desenhado.r),
    )
    if (grupo) grupo.push(desenhado)
    else grupos.push([desenhado])
  }

  for (const grupo of grupos) {
    if (grupo.length < 2) continue
    const centroX = grupo.reduce((s, p) => s + p.cx, 0) / grupo.length
    const centroY = grupo.reduce((s, p) => s + p.cy, 0) / grupo.length
    const maiorRaio = Math.max(...grupo.map((p) => p.r))
    // Distância que garante que vizinhos no círculo não se toquem.
    const distancia = (maiorRaio + 2) / Math.sin(Math.PI / Math.max(grupo.length, 2))
    grupo
      .sort((a, b) => a.posicao - b.posicao)
      .forEach((p, i) => {
        const angulo = -Math.PI / 2 + (2 * Math.PI * i) / grupo.length
        p.dx = centroX + Math.cos(angulo) * distancia
        p.dy = centroY + Math.sin(angulo) * distancia
      })
  }

  return grupos.flat()
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

/** Nome do projeto em destaque, ao lado do ponto — só ele, para não embolar. */
function RotuloDestaque({ ponto }: { ponto: PontoDesenhado }) {
  const paraEsquerda = ponto.dx > MARGEM.esquerda + AREA_X * 0.55
  const recorte = ponto.nome.length > 40 ? `${ponto.nome.slice(0, 39)}…` : ponto.nome

  return (
    <text
      x={ponto.dx + (paraEsquerda ? -(ponto.r + 8) : ponto.r + 8)}
      y={ponto.dy + 4}
      textAnchor={paraEsquerda ? 'end' : 'start'}
      className="fill-text stroke-surface text-[12px] font-semibold"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {recorte}
    </text>
  )
}

export function MatrizQuadrantes({
  pontos,
  destaqueId = null,
  hrefDestaque,
}: {
  pontos: PontoMatriz[]
  /** Projeto a realçar; os demais ficam esmaecidos. */
  destaqueId?: string | null
  /** Quando informado, os itens da legenda viram links para destacar o projeto. */
  hrefDestaque?: (id: string) => string
}) {
  const maiorGut = pontos.reduce((maior, p) => Math.max(maior, p.gut), 0)
  const desenhados = afastarSobrepostos(pontos, maiorGut)
  const temDestaque = destaqueId !== null && pontos.some((p) => p.id === destaqueId)
  // O destacado é desenhado por último, para ficar por cima.
  const ordemDesenho = [...desenhados].sort(
    (a, b) => Number(a.id === destaqueId) - Number(b.id === destaqueId),
  )
  const legenda = [...pontos].sort((a, b) => a.posicao - b.posicao)

  const marcas = [0, 3, 6, 9]

  return (
    <figure className="m-0 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div>
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="h-auto w-full"
          role="img"
          aria-label="Projetos posicionados por esforço e benefício, em quatro quadrantes"
        >
          <Regiao quadrante="VIAVEIS" x1={0} x2={LIMIAR_ESFORCO} y1={0} y2={LIMIAR_BENEFICIO} ancora="inferior-esquerdo" />
          <Regiao quadrante="DESCARTAR" x1={LIMIAR_ESFORCO} x2={NOTA_MAXIMA} y1={0} y2={LIMIAR_BENEFICIO} ancora="inferior-direito" />
          <Regiao quadrante="QUICK_WINS" x1={0} x2={LIMIAR_ESFORCO} y1={LIMIAR_BENEFICIO} y2={NOTA_MAXIMA} ancora="superior-esquerdo" />
          <Regiao quadrante="ESTRATEGICOS" x1={LIMIAR_ESFORCO} x2={NOTA_MAXIMA} y1={LIMIAR_BENEFICIO} y2={NOTA_MAXIMA} ancora="superior-direito" />

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
              <text x={x(marca)} y={ALTURA - 24} textAnchor="middle" className="fill-textFaint text-[11px] tabular-nums">
                {marca}
              </text>
              <text x={MARGEM.esquerda - 10} y={y(marca) + 4} textAnchor="end" className="fill-textFaint text-[11px] tabular-nums">
                {marca}
              </text>
            </g>
          ))}

          <text x={MARGEM.esquerda + AREA_X / 2} y={ALTURA - 6} textAnchor="middle" className="fill-textMuted text-[12px] font-medium">
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

          {ordemDesenho.map((ponto) => {
            const descricao = DESCRICAO_QUADRANTE[ponto.quadrante]
            const destacado = ponto.id === destaqueId
            const esmaecido = temDestaque && !destacado
            const afastado = ponto.dx !== ponto.cx || ponto.dy !== ponto.cy
            return (
              <g key={ponto.id} opacity={esmaecido ? 0.3 : 1}>
                {afastado ? (
                  <>
                    <line
                      x1={ponto.cx}
                      y1={ponto.cy}
                      x2={ponto.dx}
                      y2={ponto.dy}
                      className="stroke-textFaint"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={ponto.cx} cy={ponto.cy} r={2.5} className="fill-textMuted" />
                  </>
                ) : null}
                {destacado ? (
                  <circle
                    cx={ponto.dx}
                    cy={ponto.dy}
                    r={ponto.r + 5}
                    className="fill-none stroke-accent"
                    strokeWidth={2}
                  />
                ) : null}
                {/* Anel na cor da superfície para que pontos vizinhos
                    continuem separáveis. */}
                <circle
                  cx={ponto.dx}
                  cy={ponto.dy}
                  r={ponto.r}
                  className="fill-accent stroke-surface"
                  strokeWidth={2}
                >
                  <title>
                    {`${ponto.posicao}. ${ponto.nome} — ${descricao.rotulo}. Benefício ${formatarTotal(
                      ponto.beneficio,
                    )}, esforço ${formatarTotal(ponto.esforco)}, GUT ${ponto.gut}, prioridade ${formatarTotal(
                      ponto.prioridade,
                    )}`}
                  </title>
                </circle>
                <text
                  x={ponto.dx}
                  y={ponto.dy + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-onAccent text-[11px] font-bold tabular-nums"
                >
                  {ponto.posicao}
                </text>
                {destacado ? <RotuloDestaque ponto={ponto} /> : null}
              </g>
            )
          })}
        </svg>

        <figcaption className="mt-3 text-sm text-textMuted">
          O número em cada ponto é a posição no ranking; o tamanho representa o GUT
          (G × U × T). Os limiares são esforço {LIMIAR_ESFORCO} e benefício{' '}
          {LIMIAR_BENEFICIO}, como na planilha original.
          {hrefDestaque ? ' Clique num projeto da legenda para destacá-lo.' : ''}
        </figcaption>
      </div>

      <ol className="m-0 list-none self-start border-l-2 border-borderSoft bg-surface p-0 text-sm">
        {legenda.map((ponto) => {
          const destacado = ponto.id === destaqueId
          const conteudo = (
            <>
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                  destacado ? 'bg-accent text-onAccent' : 'bg-borderSoft text-textMuted'
                }`}
              >
                {ponto.posicao}
              </span>
              <span className="min-w-0">
                <span className={`block ${destacado ? 'font-semibold text-text' : 'text-text'}`}>
                  {ponto.nome}
                </span>
                <span className="block text-xs text-textFaint">
                  {DESCRICAO_QUADRANTE[ponto.quadrante].rotulo} · prioridade{' '}
                  {formatarTotal(ponto.prioridade)}
                </span>
              </span>
            </>
          )
          const classe = `flex gap-3 px-3 py-2 ${destacado ? 'bg-borderSoft' : ''}`
          return (
            <li key={ponto.id} className="border-b border-borderSoft last:border-b-0">
              {hrefDestaque ? (
                <Link
                  scroll={false}
                  href={destacado ? hrefDestaque('') : hrefDestaque(ponto.id)}
                  className={`${classe} hover:bg-borderSoft`}
                  aria-current={destacado ? 'true' : undefined}
                >
                  {conteudo}
                </Link>
              ) : (
                <div className={classe}>{conteudo}</div>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
