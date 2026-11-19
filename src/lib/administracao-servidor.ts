import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/prisma'
import { podeAdministrar, podeEditar, type SituacaoAdmin } from '@/lib/administracao'

/** Situação do papel para a conta logada, lida do banco a cada chamada. */
export async function situacaoAdmin(userId: string): Promise<SituacaoAdmin> {
  const [eu, totalAdministradores] = await Promise.all([
    prisma.colaborador.findFirst({
      where: { clerkUserId: userId, ativo: true, administrador: true },
      select: { id: true },
    }),
    prisma.colaborador.count({ where: { administrador: true, ativo: true } }),
  ])
  return { totalAdministradores, eAdministrador: eu !== null }
}

/**
 * A conta é de um Leitor. Não filtra `ativo`: desativar um leitor não pode
 * devolver a ele o poder de editar. Conta sem colaborador é Colaborador (o
 * padrão), porque a restrição mora na linha do cadastro.
 */
export async function contaSomenteLeitura(userId: string): Promise<boolean> {
  const eu = await prisma.colaborador.findFirst({
    where: { clerkUserId: userId, somenteLeitura: true },
    select: { id: true },
  })
  return eu !== null
}

/** `true` se a conta pode gravar (Colaborador ou Administrador). */
export async function contaPodeEditar(userId: string): Promise<boolean> {
  return podeEditar({ somenteLeitura: await contaSomenteLeitura(userId) })
}

/** `true` se a conta pode fazer o que só o administrador faz. */
export async function contaPodeAdministrar(userId: string): Promise<boolean> {
  // Leitor nunca administra, mesmo no estado "ainda não há administrador".
  if (await contaSomenteLeitura(userId)) return false
  return podeAdministrar(await situacaoAdmin(userId))
}

/** Para as telas: a sessão atual pode gravar? Sem sessão, não. */
export async function sessaoPodeEditar(): Promise<boolean> {
  const { userId } = await auth()
  return userId !== null && (await contaPodeEditar(userId))
}
