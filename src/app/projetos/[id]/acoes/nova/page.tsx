import { notFound } from 'next/navigation'

import { FormularioAcao } from '@/components/formulario-acao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Nova ação — Cronograma CTCEA' }

export default async function NovaAcaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Só projeto ativo aceita ações novas — mesma regra da tela de edição.
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: { id: true, nome: true, referencia: true },
  })
  if (!projeto) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {projeto.referencia ?? 'Projeto'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Nova ação</h1>
      <p className="mt-2 text-sm text-textMuted">
        Projeto <strong className="text-text">{projeto.nome}</strong>. A numeração da
        ação é sequencial e atribuída automaticamente dentro do projeto.
      </p>
      <FormularioAcao projetoId={projeto.id} />
    </main>
  )
}
