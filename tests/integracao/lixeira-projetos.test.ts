/**
 * Lixeira contra o banco: excluir grava quando e quem; restaurar (só
 * administrador) devolve o projeto com tudo que ele tinha; restaurar de novo é
 * inofensivo; excluir outra vez vale como a última exclusão.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_admin' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

const { prisma } = await import('@/lib/prisma')
const { excluirProjeto, restaurarProjeto } = await import('@/app/projetos/acoes-projeto')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

async function seguir<T>(fn: () => Promise<T>): Promise<{ url: string } | { retorno: T }> {
  try {
    return { retorno: await fn() }
  } catch (erro) {
    const m = erro instanceof Error ? /^REDIRECT:(.*)$/.exec(erro.message) : null
    if (m) return { url: m[1] }
    throw erro
  }
}

let projetoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_admin'
  await prisma.riscoProjeto.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true } })
  await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede', equipe: 'STI' } })).id
  const acao = await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A' } })
  await prisma.historicoAlteracao.create({ data: { acaoId: acao.id, campo: 'status', valorAntigo: 'A', valorNovo: 'B' } })
  await prisma.riscoProjeto.create({ data: { projetoId, tipo: 'RISCO', titulo: 'R', impacto: 'ALTO', criadoPor: 'x' } })
})

afterAll(async () => {
  await prisma.riscoProjeto.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const excluir = () => seguir(() => excluirProjeto({}, fd({ id: projetoId, confirmacao: 'EXCLUIR' })))
const restaurar = () => seguir(() => restaurarProjeto(fd({ id: projetoId })))

describe('excluir', () => {
  it('grava inativo, quando e quem excluiu — e não apaga nada', async () => {
    await excluir()
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })
    expect(p).toMatchObject({ ativo: false, excluidoPor: 'user_admin', restauradoEm: null })
    expect(p.excluidoEm).not.toBeNull()
    expect(await prisma.acao.count()).toBe(1)
    expect(await prisma.historicoAlteracao.count()).toBe(1)
    expect(await prisma.riscoProjeto.count()).toBe(1)
  })
})

describe('restaurar', () => {
  it('o administrador restaura: volta ativo, registra quem e quando, e tudo continua lá', async () => {
    await excluir()
    expect(await restaurar()).toEqual({ url: `/administracao/lixeira?restaurado=${projetoId}` })
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId }, include: { _count: { select: { acoes: true, riscos: true } } } })
    expect(p).toMatchObject({ ativo: true, restauradoPor: 'user_admin', excluidoPor: 'user_admin' })
    expect(p.restauradoEm).not.toBeNull()
    expect(p._count).toEqual({ acoes: 1, riscos: 1 })
    expect(await prisma.historicoAlteracao.count()).toBe(1)
  })

  it('restaurar de novo é inofensivo e avisa que não havia nada na lixeira', async () => {
    await excluir()
    await restaurar()
    const antes = (await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).restauradoEm
    expect(await restaurar()).toEqual({ url: `/administracao/lixeira?nada=${projetoId}` })
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).restauradoEm).toEqual(antes)
  })

  it('quem não é administrador não restaura, e sem sessão também não', async () => {
    await excluir()
    usuarioAtual.userId = 'user_colab'
    expect(await restaurar()).toEqual({ retorno: undefined })
    usuarioAtual.userId = null
    expect(await restaurar()).toEqual({ retorno: undefined })
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).ativo).toBe(false)
  })

  it('excluir de novo um projeto restaurado vale como a última exclusão', async () => {
    await excluir()
    await restaurar()
    await excluir()
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })
    expect(p).toMatchObject({ ativo: false, restauradoEm: null, restauradoPor: null })
  })

  it('projeto ativo não é afetado por restaurar', async () => {
    expect(await restaurar()).toEqual({ url: `/administracao/lixeira?nada=${projetoId}` })
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).restauradoEm).toBeNull()
  })
})
