import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { BotaoExcluirModelo } from '@/components/botao-excluir-modelo'
import { contaPodeAdministrar, sessaoPodeEditar } from '@/lib/administracao-servidor'
import { descreverItem, podeAlterarModelo, podeExcluirModelo } from '@/lib/modelo-projeto'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Modelos de projeto — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function ModelosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const salvo = (await searchParams).salvo
  const { userId } = await auth()
  const podeEditar = await sessaoPodeEditar()
  const administrador = userId !== null && (await contaPodeAdministrar(userId))

  const modelos = await prisma.modeloProjeto.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      descricao: true,
      equipe: true,
      categoria: true,
      criadoPor: true,
      _count: { select: { acoes: true } },
      acoes: {
        orderBy: { ordem: 'asc' },
        select: { ordem: true, descricao: true, inicioDiasUteis: true, duracaoDiasUteis: true, macroetapa: true },
      },
    },
  })
  const autores = await prisma.colaborador.findMany({
    where: { clerkUserId: { in: [...new Set(modelos.map((m) => m.criadoPor))] } },
    select: { clerkUserId: true, nome: true },
  })
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Plano de ação</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Modelos de projeto</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Esqueletos para projetos parecidos (ciclos anuais, rotinas da STI, GIA e GRH): as ações
        vêm prontas e as datas são calculadas a partir do início que você informar. Crie um
        modelo do zero em <strong className="font-medium">Novo modelo</strong>, ou abra um projeto
        e use <strong className="font-medium">Salvar como modelo</strong>.
      </p>
      {podeEditar ? (
        <Link
          className="mt-4 inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-onAccent"
          href="/modelos/novo"
        >
          Novo modelo
        </Link>
      ) : null}

      {typeof salvo === 'string' ? (
        <p className="mt-4 border-l-2 border-realizado bg-surface py-3 pl-4 text-sm" role="status">
          Modelo salvo.
        </p>
      ) : null}

      {modelos.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-4 pl-4 text-sm text-textMuted">
          Nenhum modelo ainda. Crie um em &quot;Novo modelo&quot; ou salve um projeto bem montado como modelo.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {modelos.map((m) => (
            <li className="border-l-2 border-accent bg-surface px-4 py-3" key={m.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{m.nome}</p>
                  {m.descricao ? <p className="text-sm text-textMuted">{m.descricao}</p> : null}
                  <p className="mt-1 text-xs text-textFaint">
                    {m._count.acoes} {m._count.acoes === 1 ? 'ação' : 'ações'}
                    {m.equipe ? ` · ${m.equipe}` : ''}
                    {m.categoria ? ` · ${m.categoria}` : ''}
                    {' · salvo por '}
                    {nomePorConta.get(m.criadoPor) ?? 'conta sem colaborador vinculado'}
                  </p>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-textMuted hover:text-accent">Ver as ações</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-textMuted">
                      {m.acoes.map((a) => (
                        <li key={a.ordem}>
                          {a.descricao}{' '}
                          <span className="text-xs text-textFaint">({descreverItem(a)})</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
                {podeEditar ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Link className="rounded-md bg-accent px-3 py-1.5 font-semibold text-onAccent" href={`/modelos/${m.id}/usar`}>
                      Usar este modelo
                    </Link>
                    {userId !== null && podeAlterarModelo(m.criadoPor, userId, administrador) ? (
                      <Link className="text-textMuted hover:text-accent" href={`/modelos/${m.id}/editar`}>
                        Editar
                      </Link>
                    ) : null}
                    {userId !== null && podeExcluirModelo(m.criadoPor, userId, administrador) ? (
                      <BotaoExcluirModelo id={m.id} nome={m.nome} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
