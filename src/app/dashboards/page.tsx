import Link from 'next/link'

import { BarraExportacao } from '@/components/barra-exportacao'
import { DashboardBarras } from '@/components/dashboard-barras'
import {
  DashboardComposicao,
  contarPorStatus,
} from '@/components/dashboard-composicao'
import { DashboardIndice } from '@/components/dashboard-indice'
import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { FiltrosProjetos } from '@/components/filtros-projetos'
import { IndicadoresPainel } from '@/components/indicadores-painel'
import {
  DIMENSOES,
  ROTULO_DIMENSAO,
  agruparPorDimensao,
  maiorVolume,
  type Dimensao,
} from '@/lib/dashboard-dimensoes'
import { periodoAtivo } from '@/lib/filtro-periodo'
import { opcoesDistintas } from '@/lib/projetos-listagem'

import { carregarDashboard } from './dados'
import { SecoesAuditoria } from './secoes/auditoria'
import { SecoesPrazos } from './secoes/prazos'
import { SecaoQualidade } from './secoes/qualidade'
import { rel } from './secoes/rel'
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
  } = await carregarDashboard(await searchParams)

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
      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
        responsaveis={opcoesDistintas(valores.map((v) => v.responsavel))}
        acao="/dashboards"
        periodo={periodo}
      />
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
        <DashboardIndice />
      </div>

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
        <SecoesPrazos
          aderencia={aderencia}
          atrasos={atrasos}
          janelas={janelas}
          evolucao={evolucao}
          carga={carga}
        />

        <SecaoQualidade pendencias={pendencias} />

        <SecoesWins
          conclusaoSemanal={conclusaoSemanal}
          reincidentes={reincidentes}
          comPeriodo={periodoAtivo(periodo)}
        />

        <SecoesAuditoria
          auditoria={auditoria}
          replanejamentos={replanejamentos}
          registros={registros}
          porCampo={porCampo}
        />
      </div>
    </main>
  )
}
