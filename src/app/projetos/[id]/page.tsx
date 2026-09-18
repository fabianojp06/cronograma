import Link from 'next/link'
import { notFound } from 'next/navigation'

import { GanttProjeto, type LinhaGantt } from '@/components/gantt-projeto'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { prisma } from '@/lib/prisma'
import {
  ROTULO_STATUS_AGREGADO,
  resumirAcoes,
} from '@/lib/projeto-resumo'
import type { StatusAcao } from '@/lib/acao-validacao'

export const metadata = { title: 'Cronograma do projeto — Cronograma CTCEA' }

export default async function ProjetoPage({ params }: PageProps<'/projetos/[id]'>) {
  const { id } = await params

  // Projeto excluído logicamente (`ativo = false`) não é visível.
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: {
      id: true,
      nome: true,
      referencia: true,
      equipe: true,
      responsavel: true,
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
  })

  if (!projeto) notFound()

  const hoje = inicioDeHojeUTC()
  const resumo = resumirAcoes(projeto.acoes, hoje)
  const acoes: LinhaGantt[] = projeto.acoes.map((acao) => ({
    ...acao,
    status: acao.status as StatusAcao,
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {projeto.referencia ?? 'Cronograma'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">{projeto.nome}</h1>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-textMuted">
        {projeto.equipe !== null && <span>Equipe: {projeto.equipe}</span>}
        {projeto.responsavel !== null && <span>Responsável: {projeto.responsavel}</span>}
        <span>
          {resumo.acoesConcluidas} de {resumo.totalAcoes} ações concluídas (
          {resumo.percentualConcluido}%) — {ROTULO_STATUS_AGREGADO[resumo.status]}
        </span>
      </div>

      <p className="mt-4 text-sm">
        <Link className="text-accent hover:underline" href="/projetos">
          Voltar para a listagem
        </Link>
        {' · '}
        <Link
          className="text-accent hover:underline"
          href={`/projetos/${projeto.id}/editar`}
        >
          Editar projeto
        </Link>
        {' · '}
        <Link
          className="text-accent hover:underline"
          href={`/projetos/${projeto.id}/acoes/nova`}
        >
          Nova ação
        </Link>
      </p>

      <GanttProjeto acoes={acoes} hoje={hoje} />
    </main>
  )
}
