/**
 * Decide se a migration do banco deve ser aplicada durante um build — módulo
 * puro, sem tocar em `process.env` nem executar nada.
 *
 * Existe por causa de uma armadilha real desta instalação: a `DATABASE_URL`
 * está cadastrada nos TRÊS ambientes da Vercel (Production, Preview e
 * Development) apontando para o MESMO banco do Railway. Um
 * `prisma migrate deploy` solto no build rodaria também nos previews — e o
 * preview de um pull request aplicaria a migration em produção antes do
 * merge, migrando o banco à frente do código que está no ar.
 *
 * Por isso a decisão é explícita e coberta por teste, em vez de um `&&` na
 * linha do `build`.
 */

export const VARIAVEL_ESCAPE = 'PULAR_MIGRACAO'

export type AmbienteBuild = {
  /** `VERCEL_ENV`: "production", "preview" ou "development". Ausente fora da Vercel. */
  VERCEL_ENV?: string
  DATABASE_URL?: string
  /** Escape manual para destravar um deploy sem mexer no código. */
  PULAR_MIGRACAO?: string
}

export type DecisaoMigracao =
  | { acao: 'APLICAR' }
  | { acao: 'PULAR'; motivo: string }
  | { acao: 'ERRO'; motivo: string }

export function decidirMigracao(ambiente: AmbienteBuild): DecisaoMigracao {
  if (typeof ambiente.PULAR_MIGRACAO === 'string' && ambiente.PULAR_MIGRACAO !== '') {
    return {
      acao: 'PULAR',
      motivo: `${VARIAVEL_ESCAPE} está definida — migration pulada de propósito.`,
    }
  }

  const vercelEnv = ambiente.VERCEL_ENV

  // Fora da Vercel: build local ou no CI. O CI roda `next build` com uma
  // DATABASE_URL descartável apontando para localhost; tentar migrar ali
  // derrubaria o pipeline sem motivo.
  if (typeof vercelEnv !== 'string' || vercelEnv === '') {
    return {
      acao: 'PULAR',
      motivo: 'Build fora da Vercel (local ou CI) — migration não se aplica aqui.',
    }
  }

  if (vercelEnv !== 'production') {
    return {
      acao: 'PULAR',
      motivo:
        `Ambiente "${vercelEnv}" compartilha o banco com produção — ` +
        'migrar aqui aplicaria a mudança antes do merge.',
    }
  }

  // Em produção e sem banco configurado, falhar é o certo: seguir com o build
  // publicaria uma versão que espera tabelas que ninguém criou.
  if (typeof ambiente.DATABASE_URL !== 'string' || ambiente.DATABASE_URL.trim() === '') {
    return {
      acao: 'ERRO',
      motivo:
        'VERCEL_ENV=production mas DATABASE_URL está vazia. ' +
        'Cadastre a variável na Vercel antes de implantar.',
    }
  }

  return { acao: 'APLICAR' }
}
