import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { BotaoRestaurarProjeto } from '@/components/botao-restaurar-projeto'
import { NavegacaoAdministracao } from '@/components/navegacao-administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { rotularAutor } from '@/lib/historico-exibicao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Lixeira — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const momento = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default async function LixeiraPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId } = await auth()
  if (!userId || !(await contaPodeAdministrar(userId))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Lixeira</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores acessam a lixeira.
        </p>
      </main>
    )
  }

  const parametros = await searchParams
  const idRestaurado = typeof parametros.restaurado === 'string' ? parametros.restaurado : null
  const idNada = typeof parametros.nada === 'string' ? parametros.nada : null

  const [excluidos, restaurado] = await Promise.all([
    prisma.projeto.findMany({
      where: { ativo: false },
      // Os excluídos mais recentemente primeiro; os antigos, sem data, por último.
      orderBy: [{ excluidoEm: { sort: 'desc', nulls: 'last' } }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        referencia: true,
        equipe: true,
        responsavel: true,
        excluidoEm: true,
        excluidoPor: true,
        _count: { select: { acoes: true } },
      },
    }),
    idRestaurado
      ? prisma.projeto.findFirst({ where: { id: idRestaurado, ativo: true }, select: { id: true, nome: true } })
      : null,
  ])

  const contas = [...new Set(excluidos.map((p) => p.excluidoPor).filter((c): c is string => c !== null))]
  const autores = contas.length
    ? await prisma.colaborador.findMany({ where: { clerkUserId: { in: contas } }, select: { clerkUserId: true, nome: true } })
    : []
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <NavegacaoAdministracao atual="/administracao/lixeira" />
      <p className="text-sm font-medium text-accent">Administração</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Lixeira</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        Projetos excluídos. Restaurar devolve o projeto à lista, com todas as ações, comentários,
        riscos e o histórico: nada é apagado na exclusão. Não há exclusão definitiva, para a trilha
        de auditoria nunca se perder.
      </p>

      {restaurado ? (
        <p className="mt-4 border-l-2 border-realizado bg-surface py-3 pl-4 text-sm" role="status">
          Projeto{' '}
          <Link className="font-medium text-text underline hover:text-accent" href={`/projetos/${restaurado.id}`}>
            {restaurado.nome}
          </Link>{' '}
          restaurado.
        </p>
      ) : null}
      {idNada ? (
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted" role="status">
          Esse projeto não está na lixeira (já foi restaurado por outra pessoa).
        </p>
      ) : null}

      {excluidos.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-4 pl-4 text-sm text-textMuted">
          A lixeira está vazia.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {excluidos.map((p) => (
            <li className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-borderSoft bg-surface px-4 py-3" key={p.id}>
              <div>
                <p className="font-medium">
                  {p.nome}
                  {p.referencia ? <span className="ml-2 text-xs text-textFaint">{p.referencia}</span> : null}
                </p>
                <p className="mt-1 text-xs text-textMuted">
                  {p._count.acoes} {p._count.acoes === 1 ? 'ação' : 'ações'}
                  {p.equipe ? ` · ${p.equipe}` : ''}
                  {p.responsavel ? ` · ${p.responsavel}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-textFaint">
                  {p.excluidoEm
                    ? `Excluído em ${momento.format(p.excluidoEm)} por ${rotularAutor(p.excluidoPor, nomePorConta)}`
                    : 'Excluído antes do registro da data: data não registrada'}
                </p>
              </div>
              <BotaoRestaurarProjeto id={p.id} nome={p.nome} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
