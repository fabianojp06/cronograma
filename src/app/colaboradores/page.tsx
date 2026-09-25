import { auth } from '@clerk/nextjs/server'

import { LinhaColaborador, type ColaboradorAdmin } from '@/components/linha-colaborador'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Colaboradores — Cronograma CTCEA' }

export default async function ColaboradoresPage() {
  const { userId } = await auth()
  if (!userId) return null

  const [cadastrados, projetos] = await Promise.all([
    prisma.colaborador.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        area: true,
        ativo: true,
        clerkUserId: true,
        _count: { select: { cards: true, wins: true } },
      },
    }),
    // Quantos projetos cada nome responde — mostrado ANTES de renomear, porque
    // é o número que decide se a mudança deve ir para o plano de ação junto.
    prisma.projeto.groupBy({
      by: ['responsavel'],
      where: { ativo: true, responsavel: { not: null } },
      _count: { _all: true },
    }),
  ])

  const porResponsavel = new Map(
    projetos.map((p) => [p.responsavel as string, p._count._all]),
  )

  const lista: ColaboradorAdmin[] = cadastrados.map((c) => ({
    id: c.id,
    nome: c.nome,
    area: c.area,
    ativo: c.ativo,
    vinculado: c.clerkUserId !== null,
    cards: c._count.cards,
    wins: c._count.wins,
    projetos: porResponsavel.get(c.nome) ?? 0,
  }))

  const ativos = lista.filter((c) => c.ativo).length

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Equipe</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Colaboradores</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        {ativos} ativo(s) de {lista.length}. Desativar não apaga nada: os cards e os
        WINs continuam no histórico, e a tela de equipe segue mostrando o que a pessoa
        comprometeu nas semanas em que esteve. O que muda é que ela deixa de ser
        cobrada na lista de quem falta.
      </p>

      {lista.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Ninguém cadastrado ainda. O primeiro cadastro acontece na tela Card WIN.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {lista.map((colaborador) => (
            <LinhaColaborador key={colaborador.id} colaborador={colaborador} />
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-border pt-6 text-xs text-textFaint">
        O nome vai para o responsável do projeto quando um WIN é promovido — por isso
        renomear oferece atualizar os projetos junto. O comentário de promoção, que
        também cita o nome, fica como estava: é registro do que aconteceu na época.
      </p>
    </main>
  )
}
