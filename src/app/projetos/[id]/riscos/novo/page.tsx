import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { FormularioRisco, RISCO_EM_BRANCO } from '@/components/formulario-risco'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Novo risco ou bloqueio — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function NovoRiscoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: { id: true, nome: true, acoes: { orderBy: { numero: 'asc' }, select: { id: true, numero: true, descricao: true } } },
  })
  if (!projeto) notFound()
  const podeEditar = await sessaoPodeEditar()
  const pessoas = await prisma.colaborador.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } })

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Riscos e bloqueios</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Novo risco ou bloqueio</h1>
      <p className="mt-2 text-sm text-textMuted">
        Projeto{' '}
        <Link className="text-text hover:text-accent" href={`/projetos/${projeto.id}`}>
          <strong>{projeto.nome}</strong>
        </Link>
        . <strong className="font-medium">Risco</strong> é o que pode acontecer; <strong className="font-medium">bloqueio</strong> é o que já está travando o trabalho.
      </p>
      {podeEditar ? (
        <FormularioRisco
          acoes={projeto.acoes.map((a) => ({ id: a.id, rotulo: `${a.numero} — ${a.descricao.length > 60 ? `${a.descricao.slice(0, 60)}…` : a.descricao}` }))}
          inicial={RISCO_EM_BRANCO}
          projetoId={projeto.id}
          responsaveis={pessoas}
        />
      ) : (
        <AvisoSomenteLeitura voltarPara={`/projetos/${projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      )}
    </main>
  )
}
