import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { FormularioUsarModelo } from '@/components/formulario-modelo'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { descreverItem } from '@/lib/modelo-projeto'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Usar modelo — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function UsarModeloPage({ params }: { params: Promise<{ id: string }> }) {
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
      acoes: {
        orderBy: { ordem: 'asc' },
        select: { ordem: true, descricao: true, inicioDiasUteis: true, duracaoDiasUteis: true, macroetapa: true },
      },
    },
  })
  if (!modelo) notFound()
  const podeEditar = await sessaoPodeEditar()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Modelos</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Novo projeto a partir de um modelo</h1>
      <p className="mt-2 text-sm text-textMuted">
        Modelo <strong className="font-medium text-text">{modelo.nome}</strong>
        {modelo.descricao ? ` — ${modelo.descricao}` : ''}.{' '}
        <Link className="text-accent hover:underline" href="/modelos">
          Ver outros modelos
        </Link>
      </p>

      {podeEditar ? (
        <FormularioUsarModelo
          modeloId={modelo.id}
          valores={{
            equipe: modelo.equipe,
            natureza: modelo.natureza,
            categoria: modelo.categoria,
            apoio: modelo.apoio,
            setorEnvolvido: modelo.setorEnvolvido,
          }}
        />
      ) : (
        <AvisoSomenteLeitura voltarPara="/modelos" rotuloVoltar="Voltar para os modelos" />
      )}

      <section aria-labelledby="titulo-acoes-modelo" className="mt-10">
        <h2 className="font-display text-base font-bold" id="titulo-acoes-modelo">
          As {modelo.acoes.length} ações que o modelo cria
        </h2>
        <ol className="mt-3 space-y-1.5">
          {modelo.acoes.map((a) => (
            <li className="border-l-2 border-borderSoft bg-surface px-4 py-2 text-sm" key={a.ordem}>
              <span className="tabular-nums text-textFaint">{a.ordem}.</span> {a.descricao}
              <span className="block text-xs text-textMuted">{descreverItem(a)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
