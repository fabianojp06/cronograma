'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  agruparPorMes,
  colunaDeHoje,
  faixaDaBarra,
  gerarSemanas,
  periodoDaGrade,
  previstoEmAtraso,
  type AcaoNaGrade,
} from '@/lib/gantt'
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
  /** Tela de edição da ação; sem ele, a descrição não é link. */
  href?: string
}

/** Largura de cada coluna-semana; casada com o `repeat()` do grid. */
const LARGURA_SEMANA = '2.75rem'
const LARGURA_ROTULO = '18rem'

function Barra({
  faixa,
  linha,
  classe,
  titulo,
}: {
  faixa: { coluna: number; colunas: number }
  linha: number
  classe: string
  titulo: string
}) {
  return (
    <div
      className="flex min-h-5 items-center px-0.5"
      style={{
        gridRow: linha,
        gridColumnStart: faixa.coluna + 2,
        gridColumnEnd: faixa.coluna + 2 + faixa.colunas,
      }}
    >
      <div className={`h-2 w-full rounded-full ${classe}`} title={titulo} />
    </div>
  )
}

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
}: {
  acoes: LinhaGantt[]
  hoje: Date
}) {
  if (acoes.length === 0) {
    return (
      <p className="mt-6 border-l-2 border-borderSoft pl-4 text-sm text-textMuted">
        Este projeto ainda não tem ações. Cadastre a primeira para ver o cronograma.
      </p>
    )
  }

  return <Grade acoes={acoes} hoje={hoje} />
}

function Grade({ acoes, hoje }: { acoes: LinhaGantt[]; hoje: Date }) {
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
  const hojeColuna = colunaDeHoje(semanas, hoje)
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

      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-textMuted">
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full border border-previsto" />
          Previsto
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full bg-realizado" />
          Realizado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-6 rounded-full border border-warn" />
          Previsto em atraso
        </span>
        {hojeColuna !== null && (
          <span className="flex items-center gap-2">
            <span className="h-3 w-0 border-l border-dashed border-accent" />
            Hoje
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface">
        <div
          className="grid min-w-max text-xs"
          style={{
            gridTemplateColumns: `${LARGURA_ROTULO} repeat(${semanas.length}, ${LARGURA_SEMANA})`,
          }}
        >
          {/* Cabeçalho, nível 1: mês */}
          <div
            className="sticky left-0 z-20 border-b border-border bg-tableHeadBg px-4 py-2 font-display font-bold"
            style={{ gridRow: 1 }}
          >
            Ação
          </div>
          {meses.map((mes) => (
            <div
              key={mes.chave}
              className="border-b border-l border-border bg-tableHeadBg px-1 py-2 text-center font-medium text-textMuted"
              style={{ gridRow: 1, gridColumnEnd: `span ${mes.colunas}` }}
            >
              {mes.rotulo}
            </div>
          ))}

          {/* Cabeçalho, nível 2: dia da segunda-feira de cada semana */}
          <div
            className="sticky left-0 z-20 border-b border-border bg-tableHeadBg px-4 pb-2 text-textFaint"
            style={{ gridRow: 2 }}
          >
            Previsto / Realizado
          </div>
          {semanas.map((semana) => (
            <div
              key={semana.chave}
              className="border-b border-l border-borderSoft bg-tableHeadBg pb-2 text-center tabular-nums text-textFaint"
              style={{ gridRow: 2 }}
            >
              {semana.diaDoMes}
            </div>
          ))}

          {/* Linha vertical do "hoje", atravessando todas as ações. */}
          {hojeColuna !== null && (
            <div
              aria-hidden
              className="pointer-events-none z-10 border-l border-dashed border-accent"
              style={{ gridRow: '3 / -1', gridColumn: hojeColuna + 2 }}
            />
          )}

          {acoes.map((acao, indice) => {
            const linhaPrevisto = 3 + indice * 2
            const linhaRealizado = linhaPrevisto + 1
            const previsto = faixaDaBarra(
              acao.previstoInicio,
              acao.previstoTermino,
              semanas,
            )
            const emAtraso = previstoEmAtraso(acao, hoje)
            const realizado = faixaDaBarra(
              acao.realizadoInicio,
              acao.realizadoTermino,
              semanas,
            )

            return (
              <div key={acao.id} className="contents">
                <div
                  className="sticky left-0 z-20 flex flex-col justify-center gap-0.5 border-b border-borderSoft bg-surface px-4 py-2"
                  style={{ gridRow: `${linhaPrevisto} / span 2` }}
                >
                  {acao.href ? (
                    <Link
                      className="truncate hover:text-accent hover:underline"
                      href={acao.href}
                      title={`Editar: ${acao.descricao}`}
                    >
                      <span className="tabular-nums text-textFaint">{acao.numero}.</span>{' '}
                      {acao.descricao}
                    </Link>
                  ) : (
                    <span className="truncate" title={acao.descricao}>
                      <span className="tabular-nums text-textFaint">{acao.numero}.</span>{' '}
                      {acao.descricao}
                    </span>
                  )}
                  <span className="truncate text-textMuted">
                    {ROTULOS_STATUS[acao.status]}
                    {acao.responsavel ? ` · ${acao.responsavel}` : null}
                  </span>
                </div>

                {/* Fundo das duas sublinhas — dá a raia de cada ação. */}
                <div
                  aria-hidden
                  className="border-b border-borderSoft"
                  style={{
                    gridRow: `${linhaPrevisto} / span 2`,
                    gridColumn: `2 / span ${semanas.length}`,
                  }}
                />

                {/* Altura fixa das duas sublinhas — sem isto uma ação sem
                    barra apontada colapsaria a raia. */}
                {[linhaPrevisto, linhaRealizado].map((linha) => (
                  <div
                    key={linha}
                    aria-hidden
                    className="h-5"
                    style={{ gridRow: linha, gridColumn: 2 }}
                  />
                ))}

                {previsto !== null && (
                  <Barra
                    faixa={previsto}
                    linha={linhaPrevisto}
                    classe={emAtraso ? 'border border-warn bg-warn/20' : 'border border-previsto'}
                    titulo={emAtraso ? 'Previsto — em atraso' : 'Previsto'}
                  />
                )}
                {realizado !== null && (
                  <Barra
                    faixa={realizado}
                    linha={linhaRealizado}
                    classe="bg-realizado"
                    titulo="Realizado"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
