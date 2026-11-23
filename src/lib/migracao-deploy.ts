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

/** Branch que publica o ambiente de homologação (banco próprio, só dela). */
export const BRANCH_HOMOLOGACAO = 'homologacao'
/**
 * `host:porta` do banco da homologação (não é segredo), cadastrada SÓ para a
 * branch `homologacao` ao lado da `DATABASE_URL` dela. É a trava que impede o
 * build da homologação de migrar (ou subir apontando para) o banco de produção,
 * que é o que a `DATABASE_URL` de Preview das outras branches aponta.
 */
export const VARIAVEL_HOST_HOMOLOGACAO = 'HOMOLOGACAO_BANCO_HOST'

export type AmbienteBuild = {
  /** `VERCEL_ENV`: "production", "preview" ou "development". Ausente fora da Vercel. */
  VERCEL_ENV?: string
  DATABASE_URL?: string
  /** Escape manual para destravar um deploy sem mexer no código. */
  PULAR_MIGRACAO?: string
  /** `VERCEL_GIT_COMMIT_REF`: a branch do deploy. */
  VERCEL_GIT_COMMIT_REF?: string
  /** `host:porta` esperado do banco da homologação (ver `VARIAVEL_HOST_HOMOLOGACAO`). */
  HOMOLOGACAO_BANCO_HOST?: string
}

/** `host:porta` de uma URL de banco; `null` se não der para ler. */
export function hostDoBanco(url: string | undefined): string | null {
  if (typeof url !== 'string' || url.trim() === '') return null
  try {
    const u = new URL(url.trim())
    return u.port ? `${u.hostname}:${u.port}` : u.hostname
  } catch {
    return null
  }
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

  // Homologação: preview da branch `homologacao`, com banco PRÓPRIO. Aqui a
  // migration roda, mas só com a prova de que a DATABASE_URL é a do banco dela.
  // Falha fechada: sem a trava ou com host diferente o build ERRA, em vez de
  // migrar ou publicar contra o banco de produção.
  if (vercelEnv === 'preview' && ambiente.VERCEL_GIT_COMMIT_REF === BRANCH_HOMOLOGACAO) {
    const esperado = (ambiente.HOMOLOGACAO_BANCO_HOST ?? '').trim()
    if (esperado === '') {
      return {
        acao: 'ERRO',
        motivo:
          `Branch ${BRANCH_HOMOLOGACAO} sem ${VARIAVEL_HOST_HOMOLOGACAO}. ` +
          'Cadastre, só para esta branch, o host:porta do banco da homologação.',
      }
    }
    const atual = hostDoBanco(ambiente.DATABASE_URL)
    if (atual === null) {
      return {
        acao: 'ERRO',
        motivo: `Branch ${BRANCH_HOMOLOGACAO} sem DATABASE_URL válida.`,
      }
    }
    if (atual !== esperado) {
      return {
        acao: 'ERRO',
        motivo:
          `A DATABASE_URL da branch ${BRANCH_HOMOLOGACAO} aponta para ${atual}, ` +
          `não para ${esperado}. Build interrompido para não tocar em outro banco.`,
      }
    }
    return { acao: 'APLICAR' }
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
