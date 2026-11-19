import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { excluirModelo } from '@/app/modelos/acoes-modelo'
import { contaPodeAdministrar, sessaoPodeEditar } from '@/lib/administracao-servidor'
import { podeExcluirModelo } from '@/lib/modelo-projeto'
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
    },
  })
  const autores = await prisma.colaborador.findMany({
    where: { clerkUserId: { in: [...new Set(modelos.map((m) => m.criadoPor))] } },
    select: { clerkUserId: true, nome: true },
  })
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Plano de ação</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Modelos de projeto</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Esqueletos para projetos parecidos (ciclos anuais, rotinas da STI, GIA e GRH): as ações
        vêm prontas e as datas são calculadas a partir do início que você informar. Para criar
        um modelo, abra um projeto e use <strong className="font-medium">Salvar como modelo</strong>.
      </p>

      {typeof salvo === 'string' ? (
        <p className="mt-4 border-l-2 border-realizado bg-surface py-3 pl-4 text-sm" role="status">
          Modelo salvo.
        </p>
      ) : null}

      {modelos.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-4 pl-4 text-sm text-textMuted">
          Nenhum modelo ainda. Abra um projeto bem montado e salve-o como modelo.
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
                </div>
                {podeEditar ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Link className="rounded-md bg-accent px-3 py-1.5 font-semibold text-onAccent" href={`/modelos/${m.id}/usar`}>
                      Usar este modelo
                    </Link>
                    {userId !== null && podeExcluirModelo(m.criadoPor, userId, administrador) ? (
                      <form action={excluirModelo}>
                        <input name="modeloId" type="hidden" value={m.id} />
                        <button aria-label={`Excluir o modelo ${m.nome}`} className="text-textMuted hover:text-warn" type="submit">
                          Excluir
                        </button>
                      </form>
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
