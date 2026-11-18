import { defineConfig } from '@playwright/test'

/**
 * Teste de navegador: sobe o sistema construído de verdade (`next build` +
 * `next start`) contra um Postgres descartável, com o Clerk trocado por um falso
 * (ver `next.config.ts`).
 *
 * Uso local — banco descartável como em CLAUDE.md:
 *   DATABASE_URL=postgresql://postgres:teste@127.0.0.1:57432/cronograma npm run test:e2e
 */
const PORTA = 3100

export default defineConfig({
  testDir: 'tests/e2e',
  // Os testes compartilham o banco e o limpam: em paralelo um apagaria o do outro.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx next build && npx next start -p ${PORTA}`,
    url: `http://127.0.0.1:${PORTA}/entrar`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      E2E_AUTH_FALSA: '1',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      // Chaves só para o Clerk real não reclamar de configuração; o falso as ignora.
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_ZmFsc28uY2xlcmsuYWNjb3VudHMuZGV2JA',
      CLERK_SECRET_KEY: 'sk_test_falso',
    },
  },
})
