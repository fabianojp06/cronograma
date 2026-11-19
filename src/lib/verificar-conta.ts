import { clerkClient } from '@clerk/nextjs/server'

import { contaAutorizada, lerExcecoes, type MotivoNegado } from './dominio-permitido'

/**
 * Confere no Clerk o e-mail principal da conta. Uma chamada de API por conta a
 * cada poucos minutos, não por requisição: o resultado fica em memória da
 * instância. O custo de um cache velho é pequeno (quem muda de e-mail demora
 * alguns minutos para ser barrado); o de não ter cache seria uma ida ao Clerk
 * em cada clique.
 */
const VALIDADE_AUTORIZADA_MS = 10 * 60_000
const VALIDADE_NEGADA_MS = 60_000

const cache = new Map<string, { veredito: 'autorizada' | 'dominio'; expira: number }>()

export type VereditoConta = 'autorizada' | MotivoNegado

export async function verificarConta(
  userId: string,
  agora: number = Date.now(),
): Promise<VereditoConta> {
  const guardado = cache.get(userId)
  if (guardado && guardado.expira > agora) return guardado.veredito

  try {
    const clerk = await clerkClient()
    const usuario = await clerk.users.getUser(userId)
    const principal =
      usuario.emailAddresses.find((e) => e.id === usuario.primaryEmailAddressId) ?? null

    const autorizada = contaAutorizada(
      principal
        ? { endereco: principal.emailAddress, verificado: principal.verification?.status === 'verified' }
        : null,
      lerExcecoes(process.env.EMAILS_EXCECAO),
    )
    const veredito = autorizada ? 'autorizada' : 'dominio'
    cache.set(userId, {
      veredito,
      expira: agora + (autorizada ? VALIDADE_AUTORIZADA_MS : VALIDADE_NEGADA_MS),
    })
    return veredito
  } catch {
    // Não guarda a falha: a próxima requisição tenta de novo.
    return 'verificacao'
  }
}
