import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { FormularioSalvarModelo } from '@/components/formulario-modelo'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Salvar como modelo — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function SalvarComoModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: { id: true, nome: true, _count: { select: { acoes: true } } },
  })
  if (!projeto) notFound()
  const podeEditar = await sessaoPodeEditar()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Modelos</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Salvar como modelo</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        O modelo guarda a classificação do projeto{' '}
        <Link className="text-text hover:text-accent" href={`/projetos/${projeto.id}`}>
          <strong>{projeto.nome}</strong>
        </Link>{' '}
        e as suas {projeto._count.acoes} ações com as datas <strong className="font-medium">relativas</strong>{' '}
        ao início (em dias úteis). Responsáveis e andamento não vão: quem usa o modelo
        informa a data de início e as pessoas do novo projeto.
      </p>
      {podeEditar ? (
        <FormularioSalvarModelo nomeSugerido={`Modelo — ${projeto.nome}`.slice(0, 120)} projetoId={projeto.id} />
      ) : (
        <AvisoSomenteLeitura voltarPara={`/projetos/${projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      )}
    </main>
  )
}
