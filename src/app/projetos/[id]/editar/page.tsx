import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ExcluirProjeto } from '@/components/excluir-projeto'
import { FormularioProjeto } from '@/components/formulario-projeto'
import { prisma } from '@/lib/prisma'
import { valoresIniciais } from '@/lib/projeto-edicao'

export const metadata = { title: 'Editar projeto — Cronograma CTCEA' }

export default async function EditarProjetoPage({
  params,
}: PageProps<'/projetos/[id]/editar'>) {
  const { id } = await params

  // Projeto excluído logicamente (`ativo = false`) não é editável.
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: {
      id: true,
      nome: true,
      prioridade: true,
      referencia: true,
      equipe: true,
      natureza: true,
      categoria: true,
      responsavel: true,
      apoio: true,
      setorEnvolvido: true,
      comentario: true,
    },
  })

  if (!projeto) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Plano de ação
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">{projeto.nome}</h1>
      <p className="mt-2 text-sm text-textMuted">
        Editando o projeto.{' '}
        <Link className="text-accent hover:underline" href="/projetos">
          Voltar para a listagem
        </Link>
        .
      </p>
      <FormularioProjeto
        projeto={{ id: projeto.id, valores: valoresIniciais(projeto) }}
      />
      <ExcluirProjeto id={projeto.id} nome={projeto.nome} />
    </main>
  )
}
