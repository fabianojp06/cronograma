/**
 * Roda `prisma migrate deploy` somente quando o build é de produção na Vercel.
 *
 * Executado antes do `next build` (ver o script `build` no package.json). A
 * decisão de aplicar ou não fica em `src/lib/migracao-deploy.ts`, coberta por
 * teste; aqui só há a execução.
 *
 * Ordem deliberada — migrar ANTES de construir. Se o build falhar depois, o
 * banco fica à frente do código, o que é seguro porque as migrations deste
 * projeto são aditivas (CLAUDE.md: nunca sobrescrever migration aplicada,
 * exclusão lógica em vez de DELETE). O inverso — publicar código que espera
 * tabelas que ainda não existem — não seria.
 */

import { spawnSync } from 'node:child_process'

import { decidirMigracao } from '../src/lib/migracao-deploy'

const decisao = decidirMigracao({
  VERCEL_ENV: process.env.VERCEL_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  PULAR_MIGRACAO: process.env.PULAR_MIGRACAO,
})

if (decisao.acao === 'ERRO') {
  console.error(`[migração] ${decisao.motivo}`)
  process.exit(1)
}

if (decisao.acao === 'PULAR') {
  console.log(`[migração] ${decisao.motivo}`)
  process.exit(0)
}

console.log('[migração] Build de produção — aplicando migrations pendentes.')

const resultado = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  // `shell: false` de propósito: nada aqui vem de entrada do usuário, e sem
  // shell não há interpretação de metacaracteres da DATABASE_URL.
  shell: false,
})

if (resultado.error) {
  console.error('[migração] Falha ao executar o Prisma:', resultado.error.message)
  process.exit(1)
}

if (resultado.status !== 0) {
  console.error(
    `[migração] prisma migrate deploy terminou com código ${resultado.status}. ` +
      'O build foi interrompido para não publicar código sem o schema correspondente.',
  )
  process.exit(resultado.status ?? 1)
}

console.log('[migração] Migrations aplicadas.')
