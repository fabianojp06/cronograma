import type { SaudeBanco } from '@/lib/monitoramento'
import { prisma } from '@/lib/prisma'

const TEMPO_LIMITE_MS = 4000

/** Mede uma consulta trivial ao banco; banco lento demais conta como fora. */
export async function medirBanco(): Promise<SaudeBanco> {
  const inicio = Date.now()
  let temporizador: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rejeitar) => {
        temporizador = setTimeout(() => rejeitar(new Error('tempo esgotado')), TEMPO_LIMITE_MS)
      }),
    ])
    return { ok: true, ms: Date.now() - inicio }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'falha' }
  } finally {
    clearTimeout(temporizador)
  }
}
