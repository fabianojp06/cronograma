import Link from 'next/link'

import { FiltrosProjetos } from '@/components/filtros-projetos'
import { ListaProjetos } from '@/components/lista-projetos'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'
import { filtrarPorStatus, lerFiltros, whereProjetoAtivo } from '@/lib/projeto-filtros'
import { montarLinhas, opcoesDistintas } from '@/lib/projetos-listagem'

export const metadata = { title: 'Projetos — Cronograma CTCEA' }

export default async function ProjetosPage({ searchParams }: PageProps<'/projetos'>) {
  const filtros = lerFiltros(await searchParams)
  const hoje = inicioDeHojeUTC()
  const podeEditar = await sessaoPodeEditar()

  // As opções dos selects vêm de todos os projetos ativos, não do resultado
  // filtrado — senão o filtro aplicado esconderia as demais opções.
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
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, responsavel: true, categoria: true },
    }),
  ])

  const linhas = filtrarPorStatus(montarLinhas(projetos, hoje), filtros)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            Plano de ação
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold">Projetos</h1>
          <p className="mt-2 text-sm text-textMuted">
            {linhas.length} projeto(s) ativo(s). O status e o progresso são calculados
            a partir das ações de cada projeto.
          </p>
        </div>
        {podeEditar ? (
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent"
            href="/projetos/novo"
          >
            Novo projeto
          </Link>
        ) : null}
      </div>

      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        responsaveis={opcoesDistintas(valores.map((v) => v.responsavel))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
      />

      <ListaProjetos linhas={linhas} podeEditar={podeEditar} />
    </main>
  )
}
