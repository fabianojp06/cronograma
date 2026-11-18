/**
 * Decide se o sistema pode enviar e-mail, e de onde — módulo puro, sem tocar
 * em `process.env`: recebe o ambiente por parâmetro, como `migracao-deploy.ts`.
 *
 * **Só produção envia.** A `DATABASE_URL` aponta para o mesmo banco do
 * Railway nos três ambientes da Vercel, então o preview de um pull request
 * trabalha com os colaboradores reais: testar a tela de ação num preview
 * mandaria aviso de verdade para quem nem sabe que a mudança existe.
 * Fora da Vercel (máquina local, CI) também não envia, pelo mesmo motivo.
 */

export type MotivoSemEnvio = 'SEM_CHAVE' | 'FORA_DE_PRODUCAO'

export type ConfiguracaoEmail =
  | { ativo: true; chave: string; remetente: string; urlBase: string | null }
  | { ativo: false; motivo: MotivoSemEnvio; urlBase: string | null }

/**
 * Remetente de teste do Resend. Funciona sem domínio verificado, mas só
 * entrega para o e-mail do dono da conta — serve para validar a integração
 * antes de o DNS da CTCEA ficar pronto.
 */
export const REMETENTE_PADRAO = 'Cronograma CTCEA <onboarding@resend.dev>'

/**
 * As variáveis lidas são RESEND_API_KEY, EMAIL_REMETENTE, VERCEL_ENV, APP_URL
 * e VERCEL_PROJECT_PRODUCTION_URL. O tipo é aberto para aceitar `process.env`.
 */
type Ambiente = Readonly<Record<string, string | undefined>>

/** URL pública do sistema, para o link do e-mail. Sem ela, o e-mail sai sem link. */
export function urlBaseDoSistema(env: Ambiente): string | null {
  const explicita = env.APP_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, '')
  // A Vercel define esta variável sozinha, com o domínio de produção sem esquema.
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return vercel ? `https://${vercel.replace(/\/+$/, '')}` : null
}

export function configuracaoEmail(env: Ambiente): ConfiguracaoEmail {
  const urlBase = urlBaseDoSistema(env)
  if (env.VERCEL_ENV !== 'production') return { ativo: false, motivo: 'FORA_DE_PRODUCAO', urlBase }

  const chave = env.RESEND_API_KEY?.trim()
  if (!chave) return { ativo: false, motivo: 'SEM_CHAVE', urlBase }

  const remetente = env.EMAIL_REMETENTE?.trim() || REMETENTE_PADRAO
  return { ativo: true, chave, remetente, urlBase }
}
