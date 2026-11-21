'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  agruparPorMes,
  gerarSemanas,
  periodoDaGrade,
  previstoEmAtraso,
  type AcaoNaGrade,
} from '@/lib/gantt'
import {
  ALTURA_LINHA_PX,
  LARGURA_ROTULO_PX,
  LARGURA_SEMANA_PX,
  barraDeProgresso,
  barraEmPx,
  larguraDaGrade,
  montarSetas,
  xDeHoje,
  xDeMarca,
  type DependenciaDoGantt,
} from '@/lib/gantt-geometria'
import {
  gerarJanelas,
  janelaInicial,
  limitarIndice,
  ROTULOS_GRANULARIDADE,
  type Granularidade,
} from '@/lib/gantt-periodo'
import { ROTULOS_STATUS, type StatusAcao } from '@/lib/acao-validacao'

export type LinhaGantt = AcaoNaGrade & {
  id: string
  numero: number
  descricao: string
  status: StatusAcao
  /** Nome do responsável pela ação, quando houver. */
  responsavel?: string | null
  /** Selo de dependência ("bloqueada por #3"); `bloqueada` pinta de atraso. */
  dependencia?: { texto: string; bloqueada: boolean } | null
  /** Quantos links de apoio a ação tem. */
  links?: number
  /** Tela de edição da ação; sem ele, a descrição não é link. */
  href?: string
  /** Riscos e bloqueios ABERTOS que afetam esta ação (o losango marca o prazo). */
  riscos?: MarcaDeRisco[]
}

export type MarcaDeRisco = {
  id: string
  titulo: string
  tipo: 'RISCO' | 'BLOQUEIO'
  impacto: 'BAIXO' | 'MEDIO' | 'ALTO'
  prazo: Date | null
}

const ALTURA_CABECALHO_PX = 56

/**
 * Grade semanal Previsto x Realizado de um Projeto (modelo CRO-DEP).
 *
 * Um único CSS grid para todo o corpo: a coluna 1 é o rótulo da ação (fixa na
 * rolagem horizontal) e as colunas seguintes são as semanas. Cada ação ocupa
 * duas linhas — Previsto em cima, Realizado embaixo — como nas planilhas. Grid
 * único (e não um por ação) para que a linha vertical do "hoje" possa atravessar
 * todas as ações com `gridRow: 3 / -1`.
 *
 * A grade desenha **uma janela de período por vez** (mês ou trimestre, ver
 * `gantt-periodo.ts`): a planilha original cobre ~13 meses e não há tela larga o
 * bastante para tudo. Dentro da janela ainda há rolagem horizontal do contêiner,
 * para telas estreitas. A janela aberta por padrão é a de "hoje" quando o
 * projeto a cobre; a navegação é client-side (o período inteiro já veio do
 * servidor), então trocar de janela não refaz consulta ao banco.
 */
export function GanttProjeto({
  acoes,
  hoje,
  dependencias = [],
}: {
  acoes: LinhaGantt[]
  hoje: Date
  /** Vínculos "de termina → para começa" entre ações do projeto. */
  dependencias?: DependenciaDoGantt[]
}) {
  if (acoes.length === 0) {
    return (
      <p className="mt-6 border-l-2 border-borderSoft pl-4 text-sm text-textMuted">
        Este projeto ainda não tem ações. Cadastre a primeira para ver o cronograma.
      </p>
    )
  }

  return <Grade acoes={acoes} hoje={hoje} dependencias={dependencias} />
}

function Grade({ acoes, hoje, dependencias }: { acoes: LinhaGantt[]; hoje: Date; dependencias: DependenciaDoGantt[] }) {
  const [granularidade, setGranularidade] = useState<Granularidade>('TRIMESTRE')

  const periodo = useMemo(() => periodoDaGrade(acoes, hoje), [acoes, hoje])
  const janelas = useMemo(
    () => gerarJanelas(periodo, granularidade),
    [periodo, granularidade],
  )

  // O índice é guardado junto da granularidade que o gerou: ao trocar de
  // mês para trimestre o número de janelas muda, e reposicionar pela data da
  // janela aberta mantém o usuário no mesmo ponto do calendário.
  const [posicao, setPosicao] = useState(() => ({
    granularidade,
    indice: janelaInicial(janelas, hoje),
  }))

  const indice =
    posicao.granularidade === granularidade
      ? limitarIndice(posicao.indice, janelas.length)
      : janelaInicial(janelas, hoje)
  const janela = janelas[indice]

  function irPara(novoIndice: number) {
    setPosicao({ granularidade, indice: limitarIndice(novoIndice, janelas.length) })
  }

  function trocarGranularidade(nova: Granularidade) {
    const janelasNovas = gerarJanelas(periodo, nova)
    setPosicao({
      granularidade: nova,
      indice: janelaInicial(janelasNovas, janela.inicio),
    })
    setGranularidade(nova)
  }

  const semanas = gerarSemanas(janela.inicio, janela.fim)
  const meses = agruparPorMes(semanas)
  const xHoje = xDeHoje(hoje, semanas)
  const larguraGrade = larguraDaGrade(semanas)
  const alturaCorpo = acoes.length * ALTURA_LINHA_PX
  const barras = acoes.map((a) => ({
    previsto: barraEmPx(a.previstoInicio, a.previstoTermino, semanas),
    realizado: barraEmPx(a.realizadoInicio, a.realizadoTermino, semanas),
    progresso: null as ReturnType<typeof barraDeProgresso>,
  }))
  barras.forEach((b, i) => {
    b.progresso = barraDeProgresso(acoes[i].status, b.previsto, acoes[i].realizadoInicio !== null || acoes[i].realizadoTermino !== null)
  })
  const setas = montarSetas(
    dependencias,
    acoes.map((a, i) => ({ id: a.id, previsto: barras[i].previsto })),
  )
  const haRiscos = acoes.some((a) => a.riscos?.some((r) => r.prazo && xDeMarca(r.prazo, semanas) !== null))
  const indiceDeHoje = janelaInicial(janelas, hoje)

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40"
            onClick={() => irPara(indice - 1)}
            disabled={indice === 0}
            aria-label="Período anterior"
          >
            ←
          </button>
          <span className="min-w-28 text-center font-display text-sm font-bold">
            {janela.rotulo}
          </span>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-sm disabled:opacity-40"
            onClick={() => irPara(indice + 1)}
            disabled={indice === janelas.length - 1}
            aria-label="Próximo período"
          >
            →
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-textMuted disabled:opacity-40"
            onClick={() => irPara(indiceDeHoje)}
            disabled={indice === indiceDeHoje}
          >
            Hoje
          </button>
          <span className="text-xs text-textFaint tabular-nums">
            {indice + 1} de {janelas.length}
          </span>
        </div>

        <label className="flex items-center gap-2 text-xs text-textMuted">
          Exibir por
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
            value={granularidade}
            onChange={(evento) =>
              trocarGranularidade(evento.target.value as Granularidade)
            }
          >
            {(Object.keys(ROTULOS_GRANULARIDADE) as Granularidade[]).map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULOS_GRANULARIDADE[opcao]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-textMuted">
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded-sm border-2 border-previsto" />
          Previsto
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-7 rounded-sm bg-realizado" />
          Realizado (sobre o previsto)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-7 rounded-sm border-2 border-warn bg-warn/15" />
          Previsto em atraso
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2 w-7 rounded-sm"
            style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--color-realizado) 0, var(--color-realizado) 3px, transparent 3px, transparent 6px)' }}
          />
          Progresso estimado (ação em curso, sem data realizada)
        </span>
        {xHoje !== null && (
          <span className="flex items-center gap-2">
            <span className="h-4 w-0.5 bg-accent" />
            Hoje
          </span>
        )}
        {setas.length > 0 && (
          <span className="flex items-center gap-2">
            <svg aria-hidden className="h-3 w-7" viewBox="0 0 28 12">
              <path d="M0 6 H20" className="stroke-textMuted" fill="none" strokeWidth="1.5" />
              <path d="M18 2 L26 6 L18 10 Z" className="fill-textMuted" />
            </svg>
            Dependência: termina → começa
          </span>
        )}
        {haRiscos && (
          <span className="flex items-center gap-2">
            <span className="size-2.5 rotate-45 border-2 border-text bg-surface" />
            Prazo de risco ou bloqueio aberto
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface">
        <div className="relative text-xs" style={{ width: LARGURA_ROTULO_PX + larguraGrade }}>
          {/* Cabeçalho: mês e semana, na mesma régua em pixels das barras. */}
          <div className="flex bg-tableHeadBg" style={{ height: ALTURA_CABECALHO_PX }}>
            <div
              className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-b border-r border-border bg-tableHeadBg px-4"
              style={{ width: LARGURA_ROTULO_PX }}
            >
              <span className="font-display font-bold">Ação</span>
              <span className="text-textFaint">Status e responsável</span>
            </div>
            <div className="shrink-0" style={{ width: larguraGrade }}>
              <div className="flex" style={{ height: ALTURA_CABECALHO_PX / 2 }}>
                {meses.map((mes) => (
                  <div
                    key={mes.chave}
                    className="overflow-hidden whitespace-nowrap border-b border-l border-border px-1 pt-1.5 text-center font-medium text-textMuted"
                    style={{ width: mes.colunas * LARGURA_SEMANA_PX }}
                  >
                    {mes.rotulo}
                  </div>
                ))}
              </div>
              <div className="flex" style={{ height: ALTURA_CABECALHO_PX / 2 }}>
                {semanas.map((semana) => (
                  <div
                    key={semana.chave}
                    className="border-b border-l border-borderSoft pt-1.5 text-center tabular-nums text-textFaint"
                    style={{ width: LARGURA_SEMANA_PX }}
                  >
                    {semana.diaDoMes}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {acoes.map((acao, indice) => {
            const { previsto, realizado, progresso } = barras[indice]
            const emAtraso = previstoEmAtraso(acao, hoje)
            return (
              <div key={acao.id} className="flex border-b border-borderSoft" style={{ height: ALTURA_LINHA_PX }}>
                <div
                  className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-surface px-4"
                  style={{ width: LARGURA_ROTULO_PX }}
                >
                  {acao.href ? (
                    <Link
                      className="truncate hover:text-accent hover:underline"
                      href={acao.href}
                      title={`Editar: ${acao.descricao}`}
                    >
                      <span className="tabular-nums text-textFaint">{acao.numero}.</span> {acao.descricao}
                    </Link>
                  ) : (
                    <span className="truncate" title={acao.descricao}>
                      <span className="tabular-nums text-textFaint">{acao.numero}.</span> {acao.descricao}
                    </span>
                  )}
                  <span className="truncate text-textMuted">
                    {ROTULOS_STATUS[acao.status]}
                    {acao.responsavel ? ` · ${acao.responsavel}` : null}
                    {acao.links ? ` · ${acao.links} ${acao.links === 1 ? 'link' : 'links'}` : null}
                    {acao.dependencia ? (
                      <span className={acao.dependencia.bloqueada ? 'text-warn' : undefined}>
                        {' · '}
                        {acao.dependencia.texto}
                      </span>
                    ) : null}
                  </span>
                </div>

                {/* A raia: linhas verticais a cada semana, alinhadas ao cabeçalho. */}
                <div
                  className="relative shrink-0"
                  style={{
                    width: larguraGrade,
                    backgroundImage:
                      'repeating-linear-gradient(to right, var(--color-borderSoft) 0, var(--color-borderSoft) 1px, transparent 1px, transparent ' +
                      LARGURA_SEMANA_PX +
                      'px)',
                  }}
                >
                  {previsto !== null && (
                    <div
                      className={`absolute h-[22px] rounded-sm border-2 ${emAtraso ? 'border-warn bg-warn/15' : 'border-previsto bg-previsto/10'}`}
                      style={{ left: previsto.esquerda, width: previsto.largura, top: (ALTURA_LINHA_PX - 22) / 2 }}
                      title={emAtraso ? 'Previsto — em atraso' : 'Previsto'}
                    />
                  )}
                  {progresso !== null && (
                    <div
                      className="absolute h-2.5 rounded-sm"
                      style={{
                        left: progresso.esquerda,
                        width: progresso.largura,
                        top: (ALTURA_LINHA_PX - 10) / 2,
                        backgroundImage:
                          'repeating-linear-gradient(135deg, var(--color-realizado) 0, var(--color-realizado) 3px, transparent 3px, transparent 6px)',
                      }}
                      title={`Progresso estimado (${ROTULOS_STATUS[acao.status]}) — sem data realizada apontada`}
                    />
                  )}
                  {realizado !== null && (
                    <div
                      className="absolute h-2.5 rounded-sm bg-realizado"
                      style={{ left: realizado.esquerda, width: realizado.largura, top: (ALTURA_LINHA_PX - 10) / 2 }}
                      title="Realizado"
                    />
                  )}
                  {(acao.riscos ?? []).map((risco) => {
                    const x = risco.prazo ? xDeMarca(risco.prazo, semanas) : null
                    if (x === null) return null
                    const vencido = risco.prazo !== null && risco.prazo.getTime() < hoje.getTime()
                    return (
                      <span
                        key={risco.id}
                        className={`absolute size-3 rotate-45 border-2 ${
                          vencido ? 'border-warn bg-warn' : 'border-text bg-surface'
                        } ${risco.impacto === 'ALTO' ? 'scale-125' : ''}`}
                        style={{ left: x - 6, top: 2 }}
                        title={`${risco.tipo === 'BLOQUEIO' ? 'Bloqueio' : 'Risco'} (impacto ${risco.impacto.toLowerCase()}): ${risco.titulo}${vencido ? ' — prazo vencido' : ''}`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Camada por cima das raias: setas de dependência e a linha do "hoje". */}
          <div
            aria-hidden
            className="pointer-events-none absolute z-10"
            style={{ left: LARGURA_ROTULO_PX, top: ALTURA_CABECALHO_PX, width: larguraGrade, height: alturaCorpo }}
          >
            {setas.length > 0 && (
              <svg className="absolute inset-0" height={alturaCorpo} width={larguraGrade}>
                {setas.map((seta) => (
                  <g key={seta.id} className={seta.bloqueada ? 'text-warn' : 'text-textMuted'}>
                    <path d={seta.d} fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
                    <path
                      d={`M ${seta.x2} ${seta.y2} l -6 -3.5 v 7 Z`}
                      fill="currentColor"
                    />
                  </g>
                ))}
              </svg>
            )}
            {xHoje !== null && (
              <>
                <div className="absolute bottom-0 w-0.5 bg-accent" style={{ left: xHoje - 1, top: 0 }} />
                <span
                  className="absolute rounded bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-onAccent"
                  style={{ left: xHoje, top: -ALTURA_CABECALHO_PX / 2 + 3, transform: 'translateX(-50%)' }}
                >
                  Hoje
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
