/**
 * Os relatórios de WIN contra o banco.
 *
 * Os módulos puros já têm 19 testes; o que só o banco prova é que a CONSULTA da
 * página entrega o formato que a agregação espera — e que um WIN promovido
 * continua contando nas semanas anteriores, que é a razão de existir da
 * migration `wins_desfecho_da_aparicao`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u' }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { DesfechoWin } = await import('@/generated/prisma/enums')
const { janelaDeSemanas, taxaDeConclusao, winsReincidentes } = await import(
  '@/lib/dashboard-wins'
)

const ATUAL = { ano: 2026, semana: 39 }

async function lerConclusao() {
  const registros = await prisma.winSemana.findMany({
    select: { status: true, desfecho: true, card: { select: { ano: true, semana: true } } },
  })
  return taxaDeConclusao(
    registros.map((r) => ({
      ano: r.card.ano,
      semana: r.card.semana,
      status: r.status,
      desfecho: r.desfecho,
    })),
    janelaDeSemanas(ATUAL, 4),
    ATUAL,
  )
}

async function lerReincidentes() {
  const wins = await prisma.win.findMany({
    select: {
      id: true,
      descricao: true,
      aparicoesAnteriores: true,
      promovidoEm: true,
      encerradoEm: true,
      projetoId: true,
      colaborador: { select: { nome: true } },
      registros: { select: { card: { select: { ano: true, semana: true } } } },
    },
  })
  return winsReincidentes(
    wins.map((w) => ({
      winId: w.id,
      descricao: w.descricao,
      colaborador: w.colaborador.nome,
      aparicoesAnteriores: w.aparicoesAnteriores,
      promovidoEm: w.promovidoEm,
      encerradoEm: w.encerradoEm,
      projetoId: w.projetoId,
      aparicoes: w.registros.map((r) => r.card),
    })),
  )
}

/** Cria o WIN com uma aparição por semana pedida. */
async function semear(
  descricao: string,
  semanas: number[],
  extra: { aparicoesAnteriores?: number; promovidoEm?: Date } = {},
) {
  const colaborador =
    (await prisma.colaborador.findFirst({ select: { id: true } })) ??
    (await prisma.colaborador.create({ data: { nome: 'Ana' }, select: { id: true } }))
  const win = await prisma.win.create({
    data: {
      colaboradorId: colaborador.id,
      descricao,
      aparicoesAnteriores: extra.aparicoesAnteriores ?? 0,
      promovidoEm: extra.promovidoEm ?? null,
    },
    select: { id: true },
  })
  for (const semana of semanas) {
    const card =
      (await prisma.cardSemanal.findFirst({
        where: { colaboradorId: colaborador.id, ano: 2026, semana },
        select: { id: true },
      })) ??
      (await prisma.cardSemanal.create({
        data: { colaboradorId: colaborador.id, ano: 2026, semana },
        select: { id: true },
      }))
    const ocupadas = await prisma.winSemana.count({ where: { cardId: card.id } })
    await prisma.winSemana.create({
      data: { winId: win.id, cardId: card.id, ordem: ocupadas + 1 },
    })
  }
  return win.id
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

describe('taxa de conclusão sobre dados reais', () => {
  it('a janela é densa mesmo com só uma semana preenchida', async () => {
    await semear('Único', [39])
    const r = await lerConclusao()
    expect(r).toHaveLength(4)
    expect(r.map((s) => s.total)).toEqual([0, 0, 0, 1])
  })

  it('promovido sai do denominador e não é contado duas vezes', async () => {
    const winId = await semear('Promovido', [39])
    await semear('Concluído', [39])
    await prisma.winSemana.updateMany({ where: { winId }, data: { desfecho: DesfechoWin.PROMOVIDO } })
    await prisma.winSemana.updateMany({
      where: { win: { descricao: 'Concluído' } },
      data: { status: 'FEITO' },
    })

    const s39 = (await lerConclusao())[3]
    expect(s39.total).toBe(2)
    expect(s39.promovidos).toBe(1)
    expect(s39.taxa).toBe(1)
    expect(
      s39.feitos + s39.naoFeitos + s39.emAndamento + s39.pendentes + s39.promovidos,
    ).toBe(s39.total)
  })

  it('semana em que tudo foi promovido não se confunde com semana vazia', async () => {
    const winId = await semear('Só esse', [39])
    await prisma.winSemana.updateMany({ where: { winId }, data: { desfecho: DesfechoWin.PROMOVIDO } })

    const r = await lerConclusao()
    expect(r[3].motivoSemTaxa).toBe('TODOS_PROMOVIDOS')
    expect(r[0].motivoSemTaxa).toBe('SEM_WINS')
  })
})

describe('reincidentes sobre dados reais', () => {
  it('o WIN promovido continua contando as semanas anteriores', async () => {
    // É a razão de existir da migration: antes, promover apagava a linha da
    // semana e o WIN perdia uma aparição.
    const winId = await semear('Repetido', [37, 38, 39])
    await prisma.win.update({ where: { id: winId }, data: { promovidoEm: new Date() } })
    await prisma.winSemana.updateMany({
      where: { winId, card: { semana: 39 } },
      data: { desfecho: DesfechoWin.PROMOVIDO },
    })

    const [r] = await lerReincidentes()
    expect(r.aparicoes).toBe(3)
    expect(r.situacao).toBe('PROMOVIDO')
    expect(r.primeiraSemana).toEqual({ ano: 2026, semana: 37 })
    expect(r.ultimaSemana).toEqual({ ano: 2026, semana: 39 })
  })

  it('soma as aparições anteriores à importação', async () => {
    await semear('Importado', [39], { aparicoesAnteriores: 2 })
    const [r] = await lerReincidentes()
    expect(r.aparicoes).toBe(3)
  })

  it('WIN de uma semana só fica de fora', async () => {
    await semear('Novo', [39])
    expect(await lerReincidentes()).toEqual([])
  })
})
