import Link from 'next/link'

import { DashboardBarras } from '@/components/dashboard-barras'
import { DashboardCarga } from '@/components/dashboard-carga'
import {
  DashboardComposicao,
  contarPorStatus,
} from '@/components/dashboard-composicao'
import { DashboardEvolucao } from '@/components/dashboard-evolucao'
import { DashboardIndice } from '@/components/dashboard-indice'
import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { FiltrosProjetos } from '@/components/filtros-projetos'
import { IndicadoresPainel } from '@/components/indicadores-painel'
import {
  contarPorCampo,
  rankingReplanejamentos,
  resumirAuditoria,
  rotularCampo,
  type RegistroHistorico,
} from '@/lib/dashboard-auditoria'
import { RELATORIOS, type Relatorio } from '@/lib/dashboard-catalogo'
import {
  DIMENSOES,
  ROTULO_DIMENSAO,
  agruparPorDimensao,
  maiorVolume,
  type Dimensao,
} from '@/lib/dashboard-dimensoes'
import {
  proximosVencimentos,
  rankingAtrasos,
  resumirAderencia,
  type AcaoComPrazo,
} from '@/lib/dashboard-prazos'
import { apurarPendencias, totalPendencias } from '@/lib/dashboard-qualidade'
import { cargaMensal, evolucaoMensal } from '@/lib/dashboard-temporal'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { formatarDataBR } from '@/lib/formatacao'
import { resumirPainel } from '@/lib/painel-consolidado'
import { prisma } from '@/lib/prisma'
import { filtrarPorStatus, lerFiltros, whereProjetoAtivo } from '@/lib/projeto-filtros'
import { montarLinhas, opcoesDistintas } from '@/lib/projetos-listagem'
import type { StatusAcao } from '@/lib/acao-validacao'

export const metadata = { title: 'Dashboards — Cronograma CTCEA' }

/** Relatório do catálogo pelo id — estoura cedo se um id for renomeado. */
function rel(id: string): Relatorio {
  const relatorio = RELATORIOS.find((item) => item.id === id)
  if (relatorio === undefined) {
    throw new Error(`Relatório "${id}" não existe no catálogo (dashboard-catalogo.ts)`)
  }
  return relatorio
}

const SECAO_POR_DIMENSAO: Record<Dimensao, string> = {
  equipe: 'por-equipe',
  responsavel: 'por-responsavel',
  natureza: 'por-natureza',
  categoria: 'por-categoria',
  prioridade: 'por-prioridade',
}

/** Só as dimensões que a listagem sabe filtrar viram link clicável. */
const FILTRO_DA_DIMENSAO: Partial<Record<Dimensao, string>> = {
  equipe: 'equipe',
  responsavel: 'responsavel',
  categoria: 'categoria',
}

export default async function DashboardsPage({ searchParams }: PageProps<'/dashboards'>) {
  const filtros = lerFiltros(await searchParams)
  const hoje = inicioDeHojeUTC()

  const [projetos, valores, historico] = await Promise.all([
    prisma.projeto.findMany({
      where: whereProjetoAtivo(filtros),
      orderBy: [{ prioridade: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        referencia: true,
        nome: true,
        equipe: true,
        natureza: true,
        categoria: true,
        responsavel: true,
        prioridade: true,
        acoes: {
          orderBy: { numero: 'asc' },
          select: {
            id: true,
            numero: true,
            descricao: true,
            status: true,
            previstoInicio: true,
            previstoTermino: true,
            realizadoInicio: true,
            realizadoTermino: true,
          },
        },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, categoria: true, responsavel: true },
    }),
    // A auditoria NÃO segue os filtros da carteira: a pergunta é "o que mudou
    // no sistema", e recortá-la por equipe esconderia justamente o que se quer
    // fiscalizar. Limitada às últimas alterações para não crescer sem teto.
    prisma.historicoAlteracao.findMany({
      orderBy: { alteradoEm: 'desc' },
      take: 500,
      select: {
        id: true,
        campo: true,
        valorAntigo: true,
        valorNovo: true,
        alteradoEm: true,
        alteradoPor: true,
        acao: {
          select: {
            id: true,
            numero: true,
            descricao: true,
            projeto: { select: { id: true, nome: true } },
          },
        },
      },
    }),
  ])

  const linhas = filtrarPorStatus(montarLinhas(projetos, hoje), filtros)
  const resumoPorId = new Map(linhas.map((linha) => [linha.id, linha.resumo]))
  const visiveis = projetos.filter((projeto) => resumoPorId.has(projeto.id))

  const painel = resumirPainel(linhas)

  // Ações achatadas com o projeto junto — base dos relatórios de prazo, tempo
  // e qualidade.
  const acoes: AcaoComPrazo[] = visiveis.flatMap((projeto) =>
    projeto.acoes.map((acao) => ({
      ...acao,
      status: acao.status as StatusAcao,
      projetoId: projeto.id,
      projetoNome: projeto.nome,
      equipe: projeto.equipe,
      responsavel: projeto.responsavel,
    })),
  )

  const agrupaveis = visiveis.map((projeto) => ({
    equipe: projeto.equipe,
    responsavel: projeto.responsavel,
    natureza: projeto.natureza,
    categoria: projeto.categoria,
    prioridade: projeto.prioridade,
    resumo: resumoPorId.get(projeto.id)!,
  }))

  const aderencia = resumirAderencia(acoes)
  const atrasos = rankingAtrasos(acoes, hoje)
  const janelas = proximosVencimentos(acoes, hoje)
  const ultimaJanela = janelas[janelas.length - 1]
  const evolucao = evolucaoMensal(acoes, hoje)
  const carga = cargaMensal(acoes)

  const pendencias = apurarPendencias(
    visiveis.map((projeto) => ({
      id: projeto.id,
      nome: projeto.nome,
      equipe: projeto.equipe,
      responsavel: projeto.responsavel,
      totalAcoes: projeto.acoes.length,
    })),
    acoes,
  )

  const registros: RegistroHistorico[] = historico.map((registro) => ({
    id: registro.id,
    campo: registro.campo,
    valorAntigo: registro.valorAntigo,
    valorNovo: registro.valorNovo,
    alteradoEm: registro.alteradoEm,
    alteradoPor: registro.alteradoPor,
    acaoId: registro.acao.id,
    acaoNumero: registro.acao.numero,
    acaoDescricao: registro.acao.descricao,
    projetoId: registro.acao.projeto.id,
    projetoNome: registro.acao.projeto.nome,
  }))

  const auditoria = resumirAuditoria(registros)
  const porCampo = contarPorCampo(registros)
  const replanejamentos = rankingReplanejamentos(registros)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Cronograma CTCEA
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Dashboards</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Relatórios sobre a carteira de projetos. Os filtros abaixo valem para todas as
        seções, exceto as de auditoria, que sempre olham o sistema inteiro.
      </p>

      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
        responsaveis={opcoesDistintas(valores.map((v) => v.responsavel))}
        acao="/dashboards"
      />

      <DashboardIndice />

      <div className="mt-10 space-y-10">
        <DashboardSecao
          relatorio={rel('panorama')}
          acao={
            <Link className="text-sm text-textMuted hover:text-accent" href="/">
              Ver no painel consolidado
            </Link>
          }
        >
          <IndicadoresPainel painel={painel} />
        </DashboardSecao>

        <DashboardSecao relatorio={rel('composicao-status')}>
          {linhas.length === 0 ? (
            <SemDados>Nenhum projeto ativo com esses filtros.</SemDados>
          ) : (
            <DashboardComposicao fatias={contarPorStatus(linhas)} />
          )}
        </DashboardSecao>

        {DIMENSOES.map((dimensao) => {
          const linhasDimensao = agruparPorDimensao(agrupaveis, dimensao)
          return (
            <DashboardSecao key={dimensao} relatorio={rel(SECAO_POR_DIMENSAO[dimensao])}>
              {linhasDimensao.length === 0 ? (
                <SemDados>Nenhum projeto ativo com esses filtros.</SemDados>
              ) : (
                <DashboardBarras
                  linhas={linhasDimensao}
                  maximo={maiorVolume(linhasDimensao)}
                  rotuloDimensao={ROTULO_DIMENSAO[dimensao]}
                  filtro={FILTRO_DA_DIMENSAO[dimensao]}
                />
              )}
            </DashboardSecao>
          )
        })}

        <DashboardSecao relatorio={rel('aderencia-prazo')}>
          {aderencia.avaliaveis === 0 ? (
            <SemDados>
              Nenhuma ação concluída com data prevista e realizada — sem as duas pontas
              não há aderência a medir.
            </SemDados>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-l-2 border-realizado bg-surface py-2 pl-4">
                <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  Entregues no prazo
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-realizado">
                  {aderencia.percentualNoPrazo}%
                </p>
                <p className="text-xs text-textFaint">
                  {aderencia.noPrazo} de {aderencia.avaliaveis} avaliáveis
                </p>
              </div>
              <div className="border-l-2 border-warn bg-surface py-2 pl-4">
                <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  Entregues com atraso
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-warn">
                  {aderencia.comAtraso}
                </p>
                <p className="text-xs text-textFaint">ações concluídas fora do prazo</p>
              </div>
              <div className="border-l-2 border-warn bg-surface py-2 pl-4">
                <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  Atraso médio
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {aderencia.atrasoMedioDiasUteis}
                </p>
                <p className="text-xs text-textFaint">dias úteis, só entre as atrasadas</p>
              </div>
              <div className="border-l-2 border-borderSoft bg-surface py-2 pl-4">
                <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  Fora da base
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-textMuted">
                  {aderencia.naoAvaliaveis}
                </p>
                <p className="text-xs text-textFaint">sem previsto e/ou sem realizado</p>
              </div>
            </div>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('ranking-atrasos')}>
          {atrasos.length === 0 ? (
            <SemDados>Nenhuma ação em atraso aberto neste recorte.</SemDados>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                    <th className="px-3 py-2 font-semibold">Ação</th>
                    <th className="px-3 py-2 font-semibold">Projeto</th>
                    <th className="px-3 py-2 font-semibold">Responsável</th>
                    <th className="px-3 py-2 font-semibold">Previsto</th>
                    <th className="px-3 py-2 text-right font-semibold">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasos.map((linha) => (
                    <tr key={linha.id} className="border-b border-borderSoft bg-surface">
                      <td className="border-l-2 border-warn px-3 py-2.5">
                        <span className="text-textFaint">{linha.numero}.</span>{' '}
                        {linha.descricao}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          className="text-textMuted hover:text-accent"
                          href={`/projetos/${linha.projetoId}`}
                        >
                          {linha.projetoNome}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-textMuted">
                        {linha.responsavel ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-textMuted">
                        {formatarDataBR(linha.previstoTermino!)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-warn">
                        {linha.diasUteisDeAtraso} dia(s) úteis
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('proximos-vencimentos')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {janelas.map((janela) => (
              <div
                key={janela.dias}
                className="border-l-2 border-previsto bg-surface py-2 pl-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  {janela.rotulo}
                </p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                  {janela.acoes.length}
                </p>
                <p className="text-xs text-textFaint">ações a vencer</p>
              </div>
            ))}
          </div>

          {ultimaJanela.acoes.length > 0 ? (
            <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-previsto bg-surface">
              {ultimaJanela.acoes.slice(0, 10).map((acao) => (
                <li
                  key={acao.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <span>
                    <span className="text-textFaint">{acao.numero}.</span> {acao.descricao}
                    <Link
                      className="ml-2 text-xs text-textMuted hover:text-accent"
                      href={`/projetos/${acao.projetoId}`}
                    >
                      {acao.projetoNome}
                    </Link>
                  </span>
                  <span className="tabular-nums text-textMuted">
                    {formatarDataBR(acao.previstoTermino!)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('evolucao-mensal')}>
          {evolucao.length === 0 ? (
            <SemDados>
              Nenhuma ação com data preenchida — a curva precisa de pelo menos uma data
              prevista ou realizada.
            </SemDados>
          ) : (
            <DashboardEvolucao pontos={evolucao} />
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('carga-mensal')}>
          {carga.length === 0 ? (
            <SemDados>Nenhuma ação com data prevista preenchida.</SemDados>
          ) : (
            <DashboardCarga pontos={carga} />
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('higiene-dados')}>
          <p className="mb-4 text-sm text-textMuted">
            {totalPendencias(pendencias)} ocorrência(s) no recorte atual.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                  <th className="px-3 py-2 font-semibold">Pendência</th>
                  <th className="px-3 py-2 font-semibold">Efeito nos números</th>
                  <th className="px-3 py-2 text-right font-semibold">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {pendencias.map((linha) => (
                  <tr
                    key={linha.pendencia}
                    className="border-b border-borderSoft bg-surface"
                  >
                    <td
                      className={`border-l-2 px-3 py-2.5 ${
                        linha.quantidade > 0 ? 'border-warn' : 'border-borderSoft'
                      }`}
                    >
                      {linha.rotulo}
                    </td>
                    <td className="px-3 py-2.5 text-textMuted">{linha.efeito}</td>
                    <td
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        linha.quantidade > 0 ? 'text-warn' : 'text-textFaint'
                      }`}
                    >
                      {linha.quantidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSecao>

        <DashboardSecao relatorio={rel('replanejamentos')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border-l-2 border-accent bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Alterações registradas
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.totalAlteracoes}
              </p>
              <p className="text-xs text-textFaint">últimas 500</p>
            </div>
            <div className="border-l-2 border-warn bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Replanejamentos
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.totalReplanejamentos}
              </p>
              <p className="text-xs text-textFaint">
                em {auditoria.acoesReplanejadas} ação(ões)
              </p>
            </div>
            <div className="border-l-2 border-borderSoft bg-surface py-2 pl-4">
              <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
                Autores distintos
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                {auditoria.autores}
              </p>
              <p className="text-xs text-textFaint">incluindo não identificados</p>
            </div>
          </div>

          {replanejamentos.length === 0 ? (
            <div className="mt-4">
              <SemDados>Nenhuma data prevista foi alterada até agora.</SemDados>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-2xl border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                    <th className="px-3 py-2 font-semibold">Ação</th>
                    <th className="px-3 py-2 font-semibold">Projeto</th>
                    <th className="px-3 py-2 text-right font-semibold">Vezes</th>
                    <th className="px-3 py-2 font-semibold">Última mudança</th>
                  </tr>
                </thead>
                <tbody>
                  {replanejamentos.map((linha) => (
                    <tr
                      key={linha.acaoId}
                      className="border-b border-borderSoft bg-surface"
                    >
                      <td className="border-l-2 border-warn px-3 py-2.5">
                        <span className="text-textFaint">{linha.acaoNumero}.</span>{' '}
                        {linha.acaoDescricao}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          className="text-textMuted hover:text-accent"
                          href={`/projetos/${linha.projetoId}`}
                        >
                          {linha.projetoNome}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-warn">
                        {linha.vezes}
                      </td>
                      <td className="px-3 py-2.5 text-textMuted">
                        {linha.ultimoValorAntigo ?? '—'} → {linha.ultimoValorNovo ?? '—'}
                        <span className="block text-xs text-textFaint">
                          {formatarDataBR(linha.ultimaEm)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardSecao>

        <DashboardSecao relatorio={rel('alteracoes-recentes')}>
          {registros.length === 0 ? (
            <SemDados>
              Nenhuma alteração registrada — a trilha de auditoria começa na primeira
              edição de uma ação.
            </SemDados>
          ) : (
            <>
              <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-textMuted">
                {porCampo.map((contagem) => (
                  <li key={contagem.campo}>
                    {contagem.rotulo}:{' '}
                    <span className="tabular-nums text-text">{contagem.quantidade}</span>
                  </li>
                ))}
              </ul>

              <ul className="mt-4 divide-y divide-borderSoft border-l-2 border-accent bg-surface">
                {registros.slice(0, 15).map((registro) => (
                  <li key={registro.id} className="px-4 py-2.5 text-sm">
                    <span className="text-textMuted">{rotularCampo(registro.campo)}</span>{' '}
                    de{' '}
                    <Link
                      className="hover:text-accent"
                      href={`/projetos/${registro.projetoId}`}
                    >
                      {registro.projetoNome}
                    </Link>{' '}
                    <span className="text-textFaint">
                      (ação {registro.acaoNumero}): {registro.valorAntigo ?? '—'} →{' '}
                      {registro.valorNovo ?? '—'}
                    </span>
                    <span className="block text-xs text-textFaint">
                      {formatarDataBR(registro.alteradoEm)} ·{' '}
                      {registro.alteradoPor ?? 'não identificado'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardSecao>
      </div>
    </main>
  )
}
