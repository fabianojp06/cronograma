/**
 * A visão de equipe contra o banco: é uma tela de LEITURA que agrega o card de
 * todo mundo, e os erros dela são de consulta — filtro a mais, filtro a menos.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_prova' }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { montarEquipe, semWins } = await import('@/lib/wins-equipe')
const { DesfechoWin } = await import('@/generated/prisma/enums')

const SEMANA = { ano: 2026, semana: 39 }

/** Mesma seleção da página — se ela mudar lá, este teste tem de mudar junto. */
const SELECAO = {
  area: true,
  atividade: true,
  alertaRiscos: true,
  pedidoAjuda: true,
  colaborador: { select: { id: true, nome: true, ativo: true } },
  registros: {
    where: { desfecho: DesfechoWin.NO_CARD },
    orderBy: { ordem: 'asc' as const },
    select: {
      ordem: true,
      prazo: true,
      status: true,
      win: {
        select: {
          id: true,
          descricao: true,
          suporte: true,
          aparicoesAnteriores: true,
          promovidoEm: true,
          encerradoEm: true,
          registros: { select: { card: { select: { ano: true, semana: true } } } },
        },
      },
    },
  },
}

async function lerEquipe() {
  const cards = await prisma.cardSemanal.findMany({
    where: { ano: SEMANA.ano, semana: SEMANA.semana },
    orderBy: { colaborador: { nome: 'asc' } },
    select: SELECAO,
  })
  return montarEquipe(cards, SEMANA)
}

async function criarCard(nome: string, wins: string[], ativo = true) {
  const colaborador = await prisma.colaborador.create({
    data: { nome, ativo },
    select: { id: true },
  })
  const card = await prisma.cardSemanal.create({
    data: { colaboradorId: colaborador.id, ...SEMANA, area: 'AGP' },
    select: { id: true },
  })
  for (const [i, descricao] of wins.entries()) {
    const win = await prisma.win.create({
      data: { colaboradorId: colaborador.id, descricao },
      select: { id: true },
    })
    await prisma.winSemana.create({
      data: { winId: win.id, cardId: card.id, ordem: i + 1 },
    })
  }
  return colaborador.id
}

beforeEach(async () => {
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.colaborador.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('a semana da equipe', () => {
  it('traz o card de todo mundo, ordenado por nome', async () => {
    await criarCard('Bruno', ['WIN do Bruno'])
    await criarCard('Ana', ['WIN da Ana'])

    const cards = await lerEquipe()
    expect(cards.map((c) => c.colaborador.nome)).toEqual(['Ana', 'Bruno'])
  })

  it('não mostra WIN que já saiu do card', async () => {
    const id = await criarCard('Ana', ['Ficou', 'Saiu'])
    const saiu = await prisma.winSemana.findFirstOrThrow({
      where: { win: { descricao: 'Saiu' } },
      select: { id: true },
    })
    await prisma.winSemana.update({
      where: { id: saiu.id },
      data: { desfecho: DesfechoWin.PROMOVIDO },
    })

    const cards = await lerEquipe()
    expect(cards[0].wins.map((w) => w.descricao)).toEqual(['Ficou'])
    expect(id).toBeTruthy()
  })

  it('preserva o card de quem saiu da equipe', async () => {
    // O card é de uma semana passada: escondê-lo reescreveria o que aconteceu.
    await criarCard('Saiu da equipe', ['O que ele comprometeu'], false)

    const cards = await lerEquipe()
    expect(cards).toHaveLength(1)
    expect(cards[0].colaborador.ativo).toBe(false)
    expect(cards[0].wins).toHaveLength(1)
  })

  it('quem tem card só de cabeçalho entra na lista de quem falta', async () => {
    await criarCard('Ana', [])
    await criarCard('Bruno', ['WIN do Bruno'])

    const cards = await lerEquipe()
    const ativos = await prisma.colaborador.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    })
    expect(semWins(ativos, cards).map((p) => p.nome)).toEqual(['Ana'])
  })

  it('não cobra card de quem foi desativado', async () => {
    await criarCard('Saiu', [], false)
    await criarCard('Ana', ['WIN da Ana'])

    const cards = await lerEquipe()
    const ativos = await prisma.colaborador.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    })
    expect(semWins(ativos, cards)).toEqual([])
  })

  it('a contagem de aparições bate com a da tela individual', async () => {
    // Divergir entre as duas telas é o defeito que a planilha tinha entre as
    // abas S36 e S37 — é o motivo de as duas partirem das mesmas funções.
    const colaboradorId = await criarCard('Ana', ['Repetido'])
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    for (const semana of [37, 38]) {
      const card = await prisma.cardSemanal.create({
        data: { colaboradorId, ano: 2026, semana },
        select: { id: true },
      })
      await prisma.winSemana.create({ data: { winId: win.id, cardId: card.id, ordem: 1 } })
    }

    const cards = await lerEquipe()
    expect(cards[0].wins[0].aparicoes).toBe(3)
    expect(cards[0].wins[0].deveSerPromovido).toBe(true)
  })
})
