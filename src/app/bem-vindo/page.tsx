import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { VincularColaborador } from '@/components/vincular-colaborador'
import { encontrarPorNome } from '@/lib/colaborador-validacao'
import { caminhoSeguro } from '@/lib/primeiro-acesso'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Bem-vindo — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

/**
 * Primeiro acesso: a conta já entrou (domínio conferido pelo proxy) mas ainda
 * não é um colaborador. O cadastro acontece aqui, antes de qualquer outra tela,
 * e volta ao endereço que a pessoa tentou abrir (`?volta=`).
 */
export default async function BemVindoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const bruto = (await searchParams).volta
  const volta = caminhoSeguro(Array.isArray(bruto) ? bruto[0] : bruto)

  const { userId } = await auth()
  if (userId) {
    const jaTem = await prisma.colaborador.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    // Quem já tem cadastro não tem o que fazer aqui: segue para onde ia.
    if (jaTem) redirect(volta)
  }

  const [livres, responsaveis, usuario] = await Promise.all([
    prisma.colaborador.findMany({
      where: { clerkUserId: null, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, clerkUserId: true, ativo: true },
    }),
    prisma.projeto.findMany({
      where: { ativo: true, responsavel: { not: null } },
      distinct: ['responsavel'],
      orderBy: { responsavel: 'asc' },
      select: { responsavel: true },
    }),
    currentUser().catch(() => null),
  ])

  const nomeDoClerk =
    usuario?.fullName?.trim() ||
    [usuario?.firstName, usuario?.lastName].filter(Boolean).join(' ').trim() ||
    null
  // O nome que o Clerk conhece pode ser o de alguém que veio da planilha: um clique só.
  const provavel = nomeDoClerk ? encontrarPorNome(livres, nomeDoClerk) : null

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Cronograma CTCEA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Bem-vindo ao sistema</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        Antes de continuar, diga quem é você. Este cadastro é feito uma vez só e é o que
        permite que você seja responsável por ações, receba avisos e veja os seus
        projetos. Depois dele você volta direto para o que estava abrindo.
      </p>
      {provavel ? (
        <p className="mt-3 text-sm text-text" role="status">
          Encontramos <strong>{provavel.nome}</strong> na lista de colaboradores. Se for
          você, é só confirmar.
        </p>
      ) : null}

      <VincularColaborador
        livres={livres.map((c) => ({ id: c.id, nome: c.nome }))}
        nomeSugerido={nomeDoClerk}
        preselecionadoId={provavel?.id ?? null}
        sugestoes={responsaveis
          .map((p) => p.responsavel)
          .filter((n): n is string => n !== null && n.trim() !== '')}
        volta={volta}
      />
    </main>
  )
}
