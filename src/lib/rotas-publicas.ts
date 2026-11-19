/**
 * Padrões de rota acessíveis sem sessão autenticada.
 * Tudo que NÃO casa com um destes padrões exige login — o sistema é de uso
 * interno da CTCEA, então o padrão é "fechado".
 * Consumido por `src/proxy.ts` (via `createRouteMatcher` do Clerk).
 */
export const ROTAS_PUBLICAS = [
  '/entrar(.*)',
  '/cadastrar(.*)',
  // Onde cai quem tem conta mas não é do domínio: precisa ser pública, senão o
  // proxy o mandaria para cá de novo, em laço.
  '/acesso-negado(.*)',
  '/api/webhooks(.*)',
  // Cron da Vercel: sem sessão; a própria rota confere o CRON_SECRET.
  '/api/cron(.*)',
  // Verificação de saúde para monitoramento externo: devolve só ok/fora e o
  // tempo do banco, nada que identifique pessoas ou configuração.
  '/api/saude',
] as const
