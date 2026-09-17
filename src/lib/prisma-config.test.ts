import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O `postinstall` do projeto roda `prisma generate`, e o `prisma.config.ts` é
 * carregado antes de qualquer variável de ambiente existir no build da Vercel.
 * Se o config exigir DATABASE_URL na hora de carregar, o `npm install` inteiro
 * falha (foi exatamente o que derrubou o primeiro deploy). Este teste trava
 * esse comportamento.
 */
describe('prisma.config.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('carrega sem DATABASE_URL definido (build da Vercel / clone limpo)', async () => {
    vi.stubEnv('DATABASE_URL', undefined)
    const config = await import('../../prisma.config')
    expect(config.default).toBeDefined()
    vi.unstubAllEnvs()
  })

  it('usa o DATABASE_URL do ambiente quando ele existe', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://u:s@host:5432/db')
    const config = await import('../../prisma.config')
    expect(config.default.datasource?.url).toBe('postgresql://u:s@host:5432/db')
    vi.unstubAllEnvs()
  })
})
