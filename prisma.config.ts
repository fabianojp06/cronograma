import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// `prisma generate` roda no `postinstall` — inclusive em builds (Vercel) e clones
// onde o DATABASE_URL ainda não existe. `env('DATABASE_URL')` do prisma/config
// lança nesse caso e derruba o `npm install` inteiro. A geração do client não
// precisa da URL; só os comandos de banco (migrate/seed/studio) precisam, e esses
// falham com mensagem própria se a variável estiver vazia.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
