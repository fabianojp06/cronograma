import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
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
  const podeEditar = await sessaoPodeEditar()

  // Só ativos: quem foi desativado não deveria receber ação nova.
  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true },
  })
  const responsaveis = colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    temEmail: c.email !== null,
  }))

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
      {podeEditar ? (
        <FormularioAcao projetoId={projeto.id} responsaveis={responsaveis} />
      ) : (
        <AvisoSomenteLeitura voltarPara={`/projetos/${projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      )}
    </main>
  )
}
