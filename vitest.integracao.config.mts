/**
 * Testes que precisam de um Postgres de verdade.
 *
 * Ficam fora do `vitest.config.ts` de propósito: o CI roda `npm test` sem
 * banco, e um teste de integração no mesmo `include` deixaria o pipeline
 * vermelho por falta de infraestrutura, não por defeito no código.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/integracao/**/*.test.ts'],
    // Os testes compartilham o mesmo banco e limpam as tabelas no `beforeEach`:
    // em paralelo um apagaria as linhas do outro no meio da execução.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
