import Link from 'next/link'

import { BarraExportacao } from '@/components/barra-exportacao'
import { DashboardBarras } from '@/components/dashboard-barras'
import {
  DashboardComposicao,
  contarPorStatus,
} from '@/components/dashboard-composicao'
import { AbasDashboard } from '@/components/abas-dashboard'
import { ResumoAtencao } from '@/components/resumo-atencao'
import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { FiltrosProjetos } from '@/components/filtros-projetos'
import { FiltrosRecolhiveis } from '@/components/filtros-recolhiveis'
import { IndicadoresPainel } from '@/components/indicadores-painel'
import {
  DIMENSOES,
  ROTULO_DIMENSAO,
  agruparPorDimensao,
  maiorVolume,
  type Dimensao,
} from '@/lib/dashboard-dimensoes'
import { ABA_PADRAO, abaMostra, lerAba, resumoDeAtencao, slugDaAba } from '@/lib/dashboard-abas'
import { periodoAtivo } from '@/lib/filtro-periodo'
import { filtrosComoParametros } from '@/lib/projeto-filtros'
import { opcoesDistintas } from '@/lib/projetos-listagem'

import { carregarDashboard } from './dados'
import { SecoesAuditoria } from './secoes/auditoria'
import { SecoesGestao } from './secoes/gestao'
import { SecoesPrazos } from './secoes/prazos'
import { SecaoQualidade } from './secoes/qualidade'
import { rel } from './secoes/rel'
import { SecoesTempo } from './secoes/tempo'
import { SecoesWins } from './secoes/wins'

export const metadata = { title: 'Dashboards — Cronograma CTCEA' }

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
  const buscaParams = await searchParams
  const aba = lerAba(buscaParams.aba)
  const dados = await carregarDashboard(buscaParams)
  const {
    filtros,
    periodo,
    valores,
    semDataPrevista,
    linhas,
    painel,
    agrupaveis,
    aderencia,
    atrasos,
    janelas,
    evolucao,
    carga,
    pendencias,
    conclusaoSemanal,
    reincidentes,
    registros,
    auditoria,
    porCampo,
    replanejamentos,
    porMotivo,
    semaforo,
    mapaCalor,
    prioridadeAtraso,
    riscosEquipe,
    ritmo,
    idadeAtraso,
    motivosEquipe,
  } = dados

  // O que a pessoa já escolheu (filtros e período) acompanha cada link de aba.
  const parametros: Record<string, string> = {
    ...filtrosComoParametros(filtros),
    ...(periodo.de ? { de: periodo.de } : {}),
    ...(periodo.ate ? { ate: periodo.ate } : {}),
  }
  const resumo = resumoDeAtencao({
    acoesAtrasadas: painel.acoesAtrasadas,
    vencendoEm7Dias: janelas.find((j) => j.dias === 7)?.acoes.length ?? 0,
    projetosSemAcoes: pendencias.find((p) => p.pendencia === 'PROJETO_SEM_ACAO')?.quantidade ?? 0,
    winsParaPromover: reincidentes.filter((w) => w.situacao === 'DEVE_PROMOVER').length,
    replanejamentos: auditoria.totalReplanejamentos,
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Cronograma CTCEA
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Dashboards</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Relatórios sobre a carteira de projetos. O <strong className="font-medium">período</strong>{' '}
        vale para todas as seções. Equipe, responsável, categoria e status valem para
        todas, exceto as de <strong className="font-medium">Card WIN</strong> e as de
        auditoria, que sempre olham o sistema inteiro — equipe, natureza e prioridade
        são dimensões de projeto, e um WIN não tem nenhuma delas.
      </p>

      <div className="print:hidden">
      <FiltrosRecolhiveis ativos={Object.keys(parametros).length}>
      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
        responsaveis={opcoesDistintas(valores.map((v) => v.responsavel))}
        acao="/dashboards"
        periodo={periodo}
        extras={aba === ABA_PADRAO ? undefined : { aba: slugDaAba(aba) }}
      />
      </FiltrosRecolhiveis>
      </div>
      <BarraExportacao mostrarExcel={false} />

      {periodoAtivo(periodo) ? (
        <p className="mt-3 text-sm text-textMuted" role="status">
          Período aplicado. A auditoria usa a data da alteração e o Card WIN, as semanas que tocam o intervalo.
          {semDataPrevista > 0
            ? ` ${semDataPrevista} ${semDataPrevista === 1 ? 'ação sem data prevista ficou' : 'ações sem data prevista ficaram'} de fora.`
            : null}
        </p>
      ) : null}

      <div className="print:hidden">
        <ResumoAtencao itens={resumo} parametros={parametros} />
      </div>
      <AbasDashboard ativa={aba} parametros={parametros} />

      <div className="mt-8 space-y-10">
        {abaMostra(aba, 'GESTAO') ? (
          <SecoesGestao
            mapaCalor={mapaCalor}
            prioridadeAtraso={prioridadeAtraso}
            ritmo={ritmo}
            riscosEquipe={riscosEquipe}
            semaforo={semaforo}
          />
        ) : null}

        {abaMostra(aba, 'PANORAMA') ? (
          <>
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
          </>
        ) : null}

        {abaMostra(aba, 'DISTRIBUICAO')
          ? DIMENSOES.map((dimensao) => {
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
            })
          : null}

        {abaMostra(aba, 'PRAZOS') ? (
          <SecoesPrazos aderencia={aderencia} atrasos={atrasos} idadeAtraso={idadeAtraso} janelas={janelas} />
        ) : null}

        {abaMostra(aba, 'TEMPO') ? <SecoesTempo evolucao={evolucao} carga={carga} /> : null}

        {abaMostra(aba, 'QUALIDADE') ? <SecaoQualidade pendencias={pendencias} /> : null}

        {abaMostra(aba, 'WINS') ? (
          <SecoesWins
            conclusaoSemanal={conclusaoSemanal}
            reincidentes={reincidentes}
            comPeriodo={periodoAtivo(periodo)}
          />
        ) : null}

        {abaMostra(aba, 'AUDITORIA') ? (
          <SecoesAuditoria
            auditoria={auditoria}
            replanejamentos={replanejamentos}
            registros={registros}
            porCampo={porCampo}
            porMotivo={porMotivo}
            motivosEquipe={motivosEquipe}
          />
        ) : null}
      </div>
    </main>
  )
}
