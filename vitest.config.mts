import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    // `tests/integracao/` exige um Postgres de verdade e roda por
    // `npm run test:integracao`. Sem esta exclusão o CI, que não sobe banco,
    // ficaria vermelho por falta de infraestrutura e não por defeito no código.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/integracao/**'],
  },
})
