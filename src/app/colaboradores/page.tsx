import { auth } from '@clerk/nextjs/server'

import { LinhaColaborador, type ColaboradorAdmin } from '@/components/linha-colaborador'
import { prisma } from '@/lib/prisma'
import { projetosADivergir, projetosDaPessoa } from '@/lib/colaborador-admin'

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
    // Os projetos que cada pessoa responde — mostrado ANTES de renomear,
    // porque é o número que decide se a mudança deve ir junto para o plano.
    //
    // Sem filtro de `ativo`: um projeto excluído logicamente pode ser
    // restaurado, e voltaria com a grafia velha. E é a mesma consulta que a
    // ação usa — contar com uma regra e escrever com outra faria o rótulo
    // prometer N e o resultado relatar M.
    prisma.projeto.findMany({
      where: { responsavel: { not: null } },
      select: { responsavel: true },
    }),
  ])

  const lista: ColaboradorAdmin[] = cadastrados.map((c) => ({
    id: c.id,
    nome: c.nome,
    area: c.area,
    ativo: c.ativo,
    vinculado: c.clerkUserId !== null,
    cards: c._count.cards,
    wins: c._count.wins,
    // Pela MESMA chave da ação: é a divergência de grafia que a tela cura, e
    // contar por igualdade exata a deixaria invisível justamente aqui.
    projetos: projetosDaPessoa(projetos, c.nome).length,
    divergentes: projetosADivergir(projetos, c.nome).length,
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
