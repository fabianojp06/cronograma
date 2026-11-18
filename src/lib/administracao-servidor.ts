import { prisma } from '@/lib/prisma'
import { podeAdministrar, type SituacaoAdmin } from '@/lib/administracao'

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

/** `true` se a conta pode fazer o que só o administrador faz. */
export async function contaPodeAdministrar(userId: string): Promise<boolean> {
  return podeAdministrar(await situacaoAdmin(userId))
}
