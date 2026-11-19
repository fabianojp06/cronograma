/**
 * Padrões de rota acessíveis sem sessão autenticada.
 * Tudo que NÃO casa com um destes padrões exige login — o sistema é de uso
 * interno da CTCEA, então o padrão é "fechado".
 * Consumido por `src/proxy.ts` (via `createRouteMatcher` do Clerk).
 */
export const ROTAS_PUBLICAS = [
  '/entrar(.*)',
  '/cadastrar(.*)',
  '/api/webhooks(.*)',
  // Cron da Vercel: sem sessão; a própria rota confere o CRON_SECRET.
  '/api/cron(.*)',
] as const
