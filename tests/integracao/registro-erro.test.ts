/**
 * Registro de erros contra o banco: grava só em produção, nunca lança e apaga
 * o que passou da retenção.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = await import('@/lib/prisma')
const { apagarRegistrosAntigos, registrarFalha } = await import('@/lib/registrar-erro')
const { onRequestError } = await import('@/instrumentation')
const { gravarExecucaoCron } = await import('@/lib/execucao-cron')
const { medirBanco } = await import('@/lib/saude-banco')

beforeEach(async () => {
  vi.unstubAllEnvs()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.unstubAllGlobals()
  await prisma.registroErro.deleteMany()
  await prisma.execucaoCron.deleteMany()
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

describe('alerta por e-mail', () => {
  const enviados: { para: string[]; assunto: string }[] = []

  beforeEach(async () => {
    enviados.length = 0
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', 'chave-de-teste')
    vi.stubEnv('EMAIL_ALERTAS', '')
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body)
      enviados.push({ para: corpo.to, assunto: corpo.subject })
      return new Response('{}', { status: 200 })
    })
    await prisma.colaborador.deleteMany()
    await prisma.colaborador.createMany({
      data: [
        { nome: 'Admin', email: 'admin@ctcea.org.br', administrador: true },
        { nome: 'Admin inativo', email: 'inativo@ctcea.org.br', administrador: true, ativo: false },
        { nome: 'Comum', email: 'comum@ctcea.org.br' },
      ],
    })
  })

  it('avisa só os administradores ativos, uma vez por hora por origem', async () => {
    await registrarFalha('Falha ao salvar WIN', new Error('a'))
    await registrarFalha('Falha ao salvar WIN', new Error('b'))
    expect(enviados).toHaveLength(1)
    expect(enviados[0].para).toEqual(['admin@ctcea.org.br'])
    expect(enviados[0].assunto).toContain('Falha ao salvar WIN')
    // As duas ficaram no registro, mesmo com um só aviso.
    expect(await prisma.registroErro.count()).toBe(2)

    await registrarFalha('Outra origem', new Error('c'))
    expect(enviados).toHaveLength(2)
  })

  it('volta a avisar quando a última da origem tem mais de 1 hora', async () => {
    await prisma.registroErro.create({
      data: { origem: 'Falha ao salvar WIN', mensagem: 'm', criadoEm: new Date(Date.now() - 2 * 3600_000) },
    })
    await registrarFalha('Falha ao salvar WIN', new Error('de novo'))
    expect(enviados).toHaveLength(1)
  })

  it('EMAIL_ALERTAS substitui a lista de administradores', async () => {
    vi.stubEnv('EMAIL_ALERTAS', 'ti@ctcea.org.br')
    await registrarFalha('Falha ao salvar WIN', new Error('a'))
    expect(enviados[0].para).toEqual(['ti@ctcea.org.br'])
  })

  it('falha do próprio e-mail não gera alerta (sem laço)', async () => {
    await registrarFalha('Resend recusou o e-mail', new Error('HTTP 403'))
    expect(enviados).toHaveLength(0)
    expect(await prisma.registroErro.count()).toBe(1)
  })

  it('se o envio do alerta falha, a falha original continua registrada e nada lança', async () => {
    vi.stubGlobal('fetch', async () => new Response('negado', { status: 403 }))
    await expect(registrarFalha('Falha ao salvar WIN', new Error('a'))).resolves.toBeUndefined()
    const origens = (await prisma.registroErro.findMany()).map((r) => r.origem).sort()
    expect(origens).toEqual(['Falha ao salvar WIN', 'Resend recusou o e-mail'])
  })

  it('fora de produção não alerta', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await registrarFalha('Falha ao salvar WIN', new Error('a'))
    expect(enviados).toHaveLength(0)
  })
})

describe('execução do cron e saúde', () => {
  it('guarda o resultado e poda o que passou de 90 dias', async () => {
    await prisma.execucaoCron.create({
      data: { nome: 'atrasos', ok: true, resumo: 'velho', executadoEm: new Date(Date.now() - 100 * 86_400_000) },
    })
    await gravarExecucaoCron('atrasos', true, '{"enviados":3}')
    const linhas = await prisma.execucaoCron.findMany()
    expect(linhas.map((l) => l.resumo)).toEqual(['{"enviados":3}'])
  })

  it('o banco responde à verificação de saúde', async () => {
    const r = await medirBanco()
    expect(r.ok).toBe(true)
  })
})
