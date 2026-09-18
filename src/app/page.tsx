import Link from 'next/link'

import { FiltrosProjetos } from '@/components/filtros-projetos'
import { IndicadoresPainel } from '@/components/indicadores-painel'
import { ListaProjetos } from '@/components/lista-projetos'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { resumirPainel } from '@/lib/painel-consolidado'
import { prisma } from '@/lib/prisma'
import { filtrarPorStatus, lerFiltros, whereProjetoAtivo } from '@/lib/projeto-filtros'
import { montarLinhas, opcoesDistintas } from '@/lib/projetos-listagem'

export const metadata = { title: 'Painel consolidado — Cronograma CTCEA' }

/**
 * Painel consolidado (visão PLA-DEP): todos os Projetos ativos com progresso
 * agregado. Reaproveita `ListaProjetos` e os filtros da rota `/projetos` —
 * duas tabelas com a mesma regra divergiriam na primeira mudança.
 */
export default async function PainelPage({ searchParams }: PageProps<'/'>) {
  const filtros = lerFiltros(await searchParams)
  const hoje = inicioDeHojeUTC()

  const [projetos, valores] = await Promise.all([
    prisma.projeto.findMany({
      where: whereProjetoAtivo(filtros),
      orderBy: [{ prioridade: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        referencia: true,
        nome: true,
        equipe: true,
        categoria: true,
        responsavel: true,
        prioridade: true,
        acoes: {
          select: { status: true, previstoTermino: true, realizadoTermino: true },
        },
      },
    }),
    // Opções dos selects vêm de todos os projetos ativos, não do resultado
    // filtrado — senão o filtro aplicado esconderia as demais opções.
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, categoria: true },
    }),
  ])

  const linhas = filtrarPorStatus(montarLinhas(projetos, hoje), filtros)
  const painel = resumirPainel(linhas)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            CTCEA — Plano de ação
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            Painel consolidado
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-textMuted">
            Todos os projetos ativos com o progresso calculado a partir das ações.
            Clique em um projeto para abrir o cronograma detalhado.
          </p>
        </div>
        <Link
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent"
          href="/projetos/novo"
        >
          Novo projeto
        </Link>
      </div>

      <IndicadoresPainel painel={painel} />

      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
        acao="/"
      />

      <ListaProjetos linhas={linhas} />
    </main>
  )
}
