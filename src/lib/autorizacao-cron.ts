import { timingSafeEqual } from 'node:crypto'

/**
 * Confere o cabeçalho que a Vercel manda nas chamadas de cron:
 * `Authorization: Bearer <CRON_SECRET>`. A rota é pública para o Clerk (não há
 * sessão num cron), então esta conferência é a única porta.
 *
 * - `sem-segredo`: a variável não existe — a rota recusa tudo, em vez de ficar aberta.
 * - `negado`: cabeçalho ausente ou errado.
 */
export type ResultadoCron = 'ok' | 'sem-segredo' | 'negado'

export function autorizarCron(
  cabecalho: string | null,
  segredo: string | undefined,
): ResultadoCron {
  const esperado = segredo?.trim()
  if (!esperado) return 'sem-segredo'
  if (!cabecalho) return 'negado'

  const recebido = Buffer.from(cabecalho)
  const correto = Buffer.from(`Bearer ${esperado}`)
  // timingSafeEqual exige o mesmo tamanho; tamanho diferente já é "negado".
  if (recebido.length !== correto.length) return 'negado'
  return timingSafeEqual(recebido, correto) ? 'ok' : 'negado'
}
