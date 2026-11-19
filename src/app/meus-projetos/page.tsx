import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import {
  BarraProgresso,
  COR_TEXTO_STATUS,
  TRACO_STATUS,
} from '@/components/lista-projetos'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import {
  filtrarMeusProjetos,
  lerFiltroMeusProjetos,
  montarMeusProjetos,
  ROTULO_VINCULO,
  type FiltroMeusProjetos,
} from '@/lib/meus-projetos'
import { prisma } from '@/lib/prisma'
import { ROTULO_STATUS_AGREGADO } from '@/lib/projeto-resumo'

export const metadata = { title: 'Meus projetos — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const FILTROS: { valor: FiltroMeusProjetos; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'respondo', rotulo: 'Os que eu respondo' },
  { valor: 'apoio', rotulo: 'Onde sou apoio' },
]

export default async function MeusProjetosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filtro = lerFiltroMeusProjetos((await searchParams).filtro)
  const { userId } = await auth()
  const colaborador =
    userId === null
      ? null
      : await prisma.colaborador.findFirst({
          where: { clerkUserId: userId, ativo: true },
          select: { id: true, nome: true },
        })

  if (!colaborador) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Meus projetos</h1>
        <p className="mt-4 max-w-2xl text-sm text-textMuted">
          Sua conta ainda não está ligada a um colaborador, então não sei quais projetos são
          seus. Escolha seu nome em{' '}
          <Link className="text-accent hover:underline" href="/wins">
            Card WIN
          </Link>{' '}
          e volte aqui.
        </p>
      </main>
    )
  }

  // Responsável e apoio são texto livre e só se comparam em memória (sem acento
  // nem caixa); o banco só descarta quem não tem nenhum dos três vínculos possíveis.
  const projetos = await prisma.projeto.findMany({
    where: {
      ativo: true,
      OR: [
        { acoes: { some: { responsavelId: colaborador.id } } },
        { responsavel: { not: null } },
        { apoio: { not: null } },
      ],
    },
    select: {
      id: true,
      referencia: true,
      nome: true,
      equipe: true,
      responsavel: true,
      apoio: true,
      acoes: {
        select: {
          status: true,
          previstoInicio: true,
          previstoTermino: true,
          realizadoTermino: true,
          responsavelId: true,
        },
      },
    },
  })

  const todos = montarMeusProjetos(projetos, colaborador, inicioDeHojeUTC())
  const itens = filtrarMeusProjetos(todos, filtro)

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">{colaborador.nome}</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Meus projetos</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Os projetos ativos em que você é responsável pelo projeto, responsável por alguma
        ação ou apoio. Os de ação atrasada sua vêm primeiro. A ligação por nome ignora
        acento e maiúsculas; se um projeto seu não aparece, confira a grafia do seu nome
        no campo responsável ou apoio dele.
      </p>

      <nav aria-label="Filtro" className="mt-6 flex flex-wrap gap-2 text-sm">
        {FILTROS.map((f) => (
          <Link
            aria-current={filtro === f.valor ? 'page' : undefined}
            className={`rounded-md border px-3 py-1.5 ${
              filtro === f.valor
                ? 'border-accent bg-surface font-medium text-accent'
                : 'border-border text-textMuted hover:border-accent'
            }`}
            href={f.valor === 'todos' ? '/meus-projetos' : `/meus-projetos?filtro=${f.valor}`}
            key={f.valor}
          >
            {f.rotulo}
          </Link>
        ))}
        <span className="self-center text-xs text-textFaint" role="status">
          {itens.length} {itens.length === 1 ? 'projeto' : 'projetos'}
        </span>
      </nav>

      {itens.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-4 pl-4 text-sm text-textMuted">
          {todos.length === 0
            ? 'Nenhum projeto ativo está ligado ao seu nome ainda.'
            : 'Nenhum projeto neste filtro.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {itens.map((p) => (
            <li
              className={`border-l-2 bg-surface px-4 py-3 ${TRACO_STATUS[p.resumo.status]}`}
              key={p.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div>
                  <Link className="font-medium text-text hover:text-accent" href={`/projetos/${p.id}`}>
                    {p.nome}
                  </Link>
                  <p className="text-xs text-textFaint">
                    {[p.referencia, p.equipe].filter(Boolean).join(' · ') || ' '}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {p.vinculos.map((v) => (
                      <span
                        className="rounded-full border border-border px-2 py-0.5 text-xs text-textMuted"
                        key={v}
                      >
                        {ROTULO_VINCULO[v]}
                        {v === 'RESPONSAVEL_ACOES'
                          ? `: ${p.minhasAcoes}`
                          : ''}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className={`font-medium ${COR_TEXTO_STATUS[p.resumo.status]}`}>
                    {ROTULO_STATUS_AGREGADO[p.resumo.status]}
                  </p>
                  <div className="mt-1 flex justify-end">
                    <BarraProgresso resumo={p.resumo} />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-textMuted">
                    {p.resumo.acoesConcluidas}/{p.resumo.totalAcoes} concluídas
                  </p>
                  {p.minhasAtrasadas > 0 ? (
                    <p className="text-xs text-warn">
                      {p.minhasAtrasadas}{' '}
                      {p.minhasAtrasadas === 1 ? 'ação sua em atraso' : 'ações suas em atraso'}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
