import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

/**
 * A conta tem colaborador? Pergunta ao banco, e só guarda em memória o "sim"
 * (10 minutos): o "não" nunca é guardado, para quem acabou de se cadastrar ser
 * liberado na hora. Se o banco falhar, responde "sim": esta conferência só
 * conduz ao cadastro, e uma falha dela não pode trancar ninguém fora do sistema.
 */
const VALIDADE_MS = 10 * 60_000
const cache = new Map<string, number>()

export async function contaTemColaborador(userId: string, agora: number = Date.now()): Promise<boolean> {
  const validoAte = cache.get(userId)
  if (validoAte !== undefined && validoAte > agora) return true

  try {
    const existe = await prisma.colaborador.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (existe) cache.set(userId, agora + VALIDADE_MS)
    return existe !== null
  } catch (erro) {
    await registrarFalha('Falha ao conferir o cadastro de colaborador no primeiro acesso', erro)
    return true
  }
}
