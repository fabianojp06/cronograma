/**
 * Substituto de `@clerk/nextjs/server` SÓ para o teste de navegador.
 *
 * O teste precisa entrar no sistema sem uma conta de verdade no Clerk. Em vez de
 * abrir uma exceção no código de produção, o `next.config.ts` troca o módulo
 * inteiro quando `E2E_AUTH_FALSA=1` — o código de domínio continua chamando
 * `auth()` como sempre, e o que muda é só quem responde.
 *
 * Recusa carregar na Vercel: se alguém ligar a variável por engano num deploy,
 * o build falha em vez de publicar um sistema sem login.
 */
if (process.env.VERCEL) {
  throw new Error('Autenticação falsa de teste carregada na Vercel — remova E2E_AUTH_FALSA.')
}

export const USUARIO_E2E = process.env.E2E_USER_ID ?? 'user_e2e'

export async function auth() {
  return { userId: USUARIO_E2E }
}

export async function currentUser() {
  return null
}

/** O proxy do sistema exporta o resultado desta função: deixa tudo passar. */
export function clerkMiddleware() {
  return () => undefined
}

export function createRouteMatcher() {
  return () => false
}
