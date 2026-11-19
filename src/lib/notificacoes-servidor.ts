import { prisma } from '@/lib/prisma'

/** Quantas notificações a conta ainda não leu; 0 se não tem colaborador vinculado. */
export async function contarNaoLidas(userId: string): Promise<number> {
  try {
    return await prisma.notificacao.count({
      where: { lida: false, destinatario: { clerkUserId: userId } },
    })
  } catch {
    // O sino é conveniência: falhar aqui não pode derrubar o cabeçalho de toda página.
    return 0
  }
}
