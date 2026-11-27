import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ORDEM_PADRAO_PROJETOS } from '@/lib/projeto-filtros'

const { prisma } = await import('@/lib/prisma')

describe('ordem padrão dos projetos', () => {
  beforeAll(async () => {
    await prisma.projeto.deleteMany({ where: { nome: { startsWith: 'ORD-' } } })
    for (const [nome, prioridade] of [
      ['ORD-d sem prioridade', null],
      ['ORD-c', 3],
      ['ORD-b2', 1],
      ['ORD-a', 2],
      ['ORD-b1', 1],
    ] as const) {
      await prisma.projeto.create({ data: { nome, prioridade } })
    }
  })
  afterAll(async () => {
    await prisma.projeto.deleteMany({ where: { nome: { startsWith: 'ORD-' } } })
    await prisma.$disconnect()
  })

  it('prioridade crescente, sem prioridade por último e o nome desempata', async () => {
    const lista = await prisma.projeto.findMany({
      where: { nome: { startsWith: 'ORD-' } },
      orderBy: ORDEM_PADRAO_PROJETOS,
      select: { nome: true },
    })
    expect(lista.map((p) => p.nome)).toEqual(['ORD-b1', 'ORD-b2', 'ORD-a', 'ORD-c', 'ORD-d sem prioridade'])
  })
})
