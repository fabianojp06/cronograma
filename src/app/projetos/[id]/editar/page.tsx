import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ExcluirProjeto } from '@/components/excluir-projeto'
import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { FormularioProjeto } from '@/components/formulario-projeto'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'
import { opcoesDoLider } from '@/lib/lider-projeto'
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
      liderId: true,
      apoio: true,
      setorEnvolvido: true,
      comentario: true,
      cliente: true,
      objetivo: true,
    },
  })

  if (!projeto) notFound()

  const { userId } = await auth()
  const podeExcluir = userId !== null && (await contaPodeAdministrar(userId))
  const podeEditar = await sessaoPodeEditar()
  const lideres = opcoesDoLider(
    await prisma.colaborador.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, ativo: true },
    }),
    { liderId: projeto.liderId, responsavel: projeto.responsavel },
  )

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">
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
      {podeEditar ? (
        <FormularioProjeto
          lideres={lideres}
          projeto={{ id: projeto.id, valores: valoresIniciais(projeto) }}
        />
      ) : (
        <AvisoSomenteLeitura voltarPara={`/projetos/${projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      )}
      {podeExcluir ? (
        <ExcluirProjeto id={projeto.id} nome={projeto.nome} />
      ) : (
        <p className="mt-10 border-t border-border pt-6 text-sm text-textMuted">
          Só administradores excluem projetos.
        </p>
      )}
    </main>
  )
}
