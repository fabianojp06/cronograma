import Link from 'next/link'

import { FiltrosProjetos } from '@/components/filtros-projetos'
import { ListaProjetos } from '@/components/lista-projetos'
import { Paginacao } from '@/components/paginacao'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { lerPagina, paginar, TAMANHO_PAGINA_PROJETOS } from '@/lib/paginacao'
import { prisma } from '@/lib/prisma'
import {
  filtrarPorBusca,
  filtrarPorSinal,
  filtrarPorStatus,
  ordenarLinhas,
  filtrosComoParametros,
  lerFiltros,
  whereProjetoAtivo,
} from '@/lib/projeto-filtros'
import { montarLinhas, opcoesDistintas } from '@/lib/projetos-listagem'

export const metadata = { title: 'Projetos — Cronograma CTCEA' }

export default async function ProjetosPage({ searchParams }: PageProps<'/projetos'>) {
  const parametros = await searchParams
  const filtros = lerFiltros(parametros)
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
          select: {
            status: true,
            previstoInicio: true,
            previstoTermino: true,
            realizadoTermino: true,
          },
        },
        // Só os abertos e só o que o sinal lê: entra na mesma consulta (sem N+1).
        riscos: {
          where: { status: { in: ['ABERTO', 'EM_TRATAMENTO'] } },
          select: { impacto: true, status: true, prazo: true },
        },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, responsavel: true, categoria: true },
    }),
  ])

  const linhas = ordenarLinhas(
    filtrarPorBusca(filtrarPorSinal(filtrarPorStatus(montarLinhas(projetos, hoje), filtros), filtros), filtros),
    filtros,
  )
  const pagina = paginar(linhas, lerPagina(parametros), TAMANHO_PAGINA_PROJETOS)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">
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
        {podeEditar ? (
          <Link
            className="rounded-md border border-border px-4 py-2 text-sm text-textMuted hover:border-accent hover:text-accent"
            href="/modelos"
          >
            A partir de um modelo
          </Link>
        ) : null}
      </div>

      <FiltrosProjetos
        filtros={filtros}
        equipes={opcoesDistintas(valores.map((v) => v.equipe))}
        responsaveis={opcoesDistintas(valores.map((v) => v.responsavel))}
        categorias={opcoesDistintas(valores.map((v) => v.categoria))}
        comBusca
        comSinal
      />

      <ListaProjetos linhas={pagina.itens} podeEditar={podeEditar} />
      <Paginacao
        pagina={pagina}
        rota="/projetos"
        parametros={filtrosComoParametros(filtros)}
        nome="projetos"
      />
    </main>
  )
}
