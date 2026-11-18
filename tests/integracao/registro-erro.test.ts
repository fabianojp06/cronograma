/**
 * Registro de erros contra o banco: grava só em produção, nunca lança e apaga
 * o que passou da retenção.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = await import('@/lib/prisma')
const { apagarRegistrosAntigos, registrarFalha } = await import('@/lib/registrar-erro')
const { onRequestError } = await import('@/instrumentation')

beforeEach(async () => {
  vi.unstubAllEnvs()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await prisma.registroErro.deleteMany()
})

afterAll(async () => {
  vi.restoreAllMocks()
  await prisma.$disconnect()
})

describe('registrarFalha', () => {
  it('fora de produção não grava no banco', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await registrarFalha('Falha ao salvar WIN', new Error('x'))
    expect(await prisma.registroErro.count()).toBe(0)
  })

  it('em produção grava origem, mensagem e pilha', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    await registrarFalha('Falha ao salvar WIN', new Error('violação de chave'), {
      rota: '/wins',
    })

    const [linha] = await prisma.registroErro.findMany()
    expect(linha).toMatchObject({
      origem: 'Falha ao salvar WIN',
      mensagem: 'Error: violação de chave',
      rota: '/wins',
    })
    expect(linha.detalhe).toContain('violação de chave')
  })

  it('apaga o que passou dos 30 dias, mantendo o recente', async () => {
    const dia = 86_400_000
    await prisma.registroErro.createMany({
      data: [
        { origem: 'velho', mensagem: 'm', criadoEm: new Date(Date.now() - 40 * dia) },
        { origem: 'recente', mensagem: 'm', criadoEm: new Date(Date.now() - 5 * dia) },
      ],
    })

    expect(await apagarRegistrosAntigos()).toBe(1)

    expect((await prisma.registroErro.findMany()).map((r) => r.origem)).toEqual(['recente'])
  })

  it('não lança nem quando o banco falha', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const original = prisma.registroErro.create
    prisma.registroErro.create = (() => Promise.reject(new Error('banco fora'))) as never
    try {
      await expect(registrarFalha('x', new Error('y'))).resolves.toBeUndefined()
    } finally {
      prisma.registroErro.create = original
    }
  })
})

describe('onRequestError', () => {
  it('grava o erro de renderização com rota e digest', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    const erro = Object.assign(new Error('falha ao renderizar'), { digest: 'abc123' })

    await onRequestError(erro, { path: '/dashboards', method: 'GET' }, { routeType: 'render' })

    const [linha] = await prisma.registroErro.findMany()
    expect(linha).toMatchObject({ rota: '/dashboards', digest: 'abc123' })
    expect(linha.origem).toContain('GET')
  })
})
