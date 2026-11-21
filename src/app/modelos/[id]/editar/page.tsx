import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { EditorModelo } from '@/components/editor-modelo'
import { contaPodeAdministrar, sessaoPodeEditar } from '@/lib/administracao-servidor'
import { podeAlterarModelo } from '@/lib/modelo-projeto'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Editar modelo — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function EditarModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const modelo = await prisma.modeloProjeto.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      descricao: true,
      equipe: true,
      natureza: true,
      categoria: true,
      apoio: true,
      setorEnvolvido: true,
      criadoPor: true,
      updatedAt: true,
      acoes: {
        orderBy: { ordem: 'asc' },
        select: { descricao: true, inicioDiasUteis: true, duracaoDiasUteis: true },
      },
    },
  })
  if (!modelo) notFound()

  const { userId } = await auth()
  const podeEditar = await sessaoPodeEditar()
  const administrador = userId !== null && (await contaPodeAdministrar(userId))
  const permitido = userId !== null && podeAlterarModelo(modelo.criadoPor, userId, administrador)

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Modelos</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Editar modelo</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        As alterações valem para os projetos criados a partir de agora. Os projetos já criados com
        este modelo não mudam.
      </p>
      {!podeEditar ? (
        <AvisoSomenteLeitura voltarPara="/modelos" rotuloVoltar="Voltar para os modelos" />
      ) : !permitido ? (
        <p className="mt-6 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só quem criou este modelo, ou um administrador, pode editá-lo.{' '}
          <Link className="text-accent hover:underline" href="/modelos">
            Voltar para os modelos
          </Link>
          .
        </p>
      ) : (
        <EditorModelo
          inicial={{
            nome: modelo.nome,
            descricao: modelo.descricao ?? '',
            equipe: modelo.equipe ?? '',
            natureza: modelo.natureza ?? '',
            categoria: modelo.categoria ?? '',
            apoio: modelo.apoio ?? '',
            setorEnvolvido: modelo.setorEnvolvido ?? '',
            linhas: modelo.acoes.map((a) => ({
              descricao: a.descricao,
              inicio: a.inicioDiasUteis === null ? '' : String(a.inicioDiasUteis),
              duracao: a.duracaoDiasUteis === null ? '' : String(a.duracaoDiasUteis),
            })),
          }}
          modeloId={modelo.id}
          versao={modelo.updatedAt.toISOString()}
        />
      )}
    </main>
  )
}
