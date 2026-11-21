/**
 * Resumo semanal contra o banco: a foto nasce uma vez por semana, avisa só
 * administradores ativos, tolera chamadas repetidas e simultâneas, o popup só
 * aparece para administrador de verdade e dispensar marca como lido.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_admin' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { garantirResumoDaSemana, resumoPendenteDe, MOTIVO_RESUMO_SEMANAL } = await import('@/lib/resumo-servidor')
const { dispensarResumo } = await import('@/app/resumo-semanal/acoes-resumo')

// Segunda-feira, 8h de Brasília.
const SEGUNDA = new Date('2026-11-16T08:00:00-03:00')
const TERCA = new Date('2026-11-17T15:00:00-03:00')
const PROXIMA_SEGUNDA = new Date('2026-11-23T09:00:00-03:00')
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

let adminId: string
let projetoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_admin'
  await prisma.notificacao.deleteMany()
  await prisma.resumoSemanal.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  adminId = (await prisma.colaborador.create({ data: { nome: 'Admin Um', clerkUserId: 'user_admin', administrador: true } })).id
  await prisma.colaborador.create({ data: { nome: 'Admin Inativo', clerkUserId: 'user_inativo', administrador: true, ativo: false } })
  await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede', equipe: 'STI' } })).id
  await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'Atrasada', previstoTermino: d('2026-11-02'), status: 'EM_CURSO_50' } })
  await prisma.acao.create({ data: { projetoId, numero: 2, descricao: 'Vence logo', previstoTermino: d('2026-11-19'), status: 'NAO_INICIADO' } })
  await prisma.acao.create({ data: { projetoId, numero: 3, descricao: 'Feita', previstoTermino: d('2026-11-10'), realizadoInicio: d('2026-11-05'), realizadoTermino: d('2026-11-13'), status: 'CONCLUIDO' } })
})

afterAll(async () => {
  await prisma.notificacao.deleteMany()
  await prisma.resumoSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

describe('garantirResumoDaSemana', () => {
  it('tira a foto, com o conteúdo certo, e avisa só o administrador ativo', async () => {
    const r = await garantirResumoDaSemana(SEGUNDA)
    expect(r?.semana).toBe('2026-11-16')
    expect(r?.conteudo.totais).toEqual({ concluidas: 1, atrasadas: 1, vencendo: 1 })
    const avisos = await prisma.notificacao.findMany({ where: { motivo: MOTIVO_RESUMO_SEMANAL } })
    expect(avisos.map((a) => a.destinatarioId)).toEqual([adminId])
    expect(avisos[0]).toMatchObject({ lida: false, comentarioId: null, liberacaoId: null })
  })

  it('é idempotente: a foto da semana não muda e ninguém é avisado de novo', async () => {
    const a = await garantirResumoDaSemana(SEGUNDA)
    await prisma.acao.create({ data: { projetoId, numero: 4, descricao: 'Nova atrasada', previstoTermino: d('2026-11-01'), status: 'EM_CURSO_25' } })
    const b = await garantirResumoDaSemana(TERCA)
    expect(b?.id).toBe(a?.id)
    expect(b?.conteudo.totais.atrasadas).toBe(1)
    expect(await prisma.resumoSemanal.count()).toBe(1)
    expect(await prisma.notificacao.count()).toBe(1)
  })

  it('chamadas simultâneas terminam com um resumo só', async () => {
    const todas = await Promise.all([1, 2, 3, 4].map(() => garantirResumoDaSemana(SEGUNDA)))
    expect(new Set(todas.map((r) => r?.id)).size).toBe(1)
    expect(await prisma.resumoSemanal.count()).toBe(1)
    expect(await prisma.notificacao.count()).toBe(1)
  })

  it('semana nova, foto nova; antes das 8h da segunda vale a semana anterior', async () => {
    await garantirResumoDaSemana(SEGUNDA)
    const cedo = await garantirResumoDaSemana(new Date('2026-11-23T07:00:00-03:00'))
    expect(cedo?.semana).toBe('2026-11-16')
    const nova = await garantirResumoDaSemana(PROXIMA_SEGUNDA)
    expect(nova?.semana).toBe('2026-11-23')
    expect(await prisma.resumoSemanal.count()).toBe(2)
  })

  it('ignora projeto excluído e usa o dia do histórico para concluída só por status', async () => {
    const excluido = await prisma.projeto.create({ data: { nome: 'Fora', equipe: 'GIA', ativo: false } })
    await prisma.acao.create({ data: { projetoId: excluido.id, numero: 1, descricao: 'X', previstoTermino: d('2026-10-01'), status: 'NAO_INICIADO' } })
    const sem = await prisma.acao.create({ data: { projetoId, numero: 5, descricao: 'Só status', status: 'CONCLUIDO' } })
    await prisma.historicoAlteracao.create({ data: { acaoId: sem.id, campo: 'status', valorAntigo: 'EM_CURSO_75', valorNovo: 'CONCLUIDO', alteradoEm: new Date('2026-11-14T12:00:00Z') } })
    const r = await garantirResumoDaSemana(SEGUNDA)
    expect(r?.conteudo.equipes.map((e) => e.equipe)).toEqual(['STI'])
    expect(r?.conteudo.totais.concluidas).toBe(2)
  })
})

describe('popup (resumoPendenteDe)', () => {
  it('administrador recebe uma vez; dispensar marca como lido; só volta na semana seguinte', async () => {
    const p = await resumoPendenteDe('user_admin', SEGUNDA)
    expect(p?.conteudo.semana).toBe('2026-11-16')

    // Sem dispensar, o popup volta na próxima entrada.
    expect((await resumoPendenteDe('user_admin', TERCA))?.resumoId).toBe(p?.resumoId)

    await dispensarResumo()
    expect(await resumoPendenteDe('user_admin', TERCA)).toBeNull()
    expect((await resumoPendenteDe('user_admin', PROXIMA_SEGUNDA))?.conteudo.semana).toBe('2026-11-23')
  })

  it('colaborador, administrador inativo e conta sem cadastro não recebem', async () => {
    expect(await resumoPendenteDe('user_colab', SEGUNDA)).toBeNull()
    expect(await resumoPendenteDe('user_inativo', SEGUNDA)).toBeNull()
    expect(await resumoPendenteDe('user_sem_cadastro', SEGUNDA)).toBeNull()
    expect(await prisma.notificacao.count()).toBe(0)
  })

  it('quem vira administrador depois da foto recebe o resumo da semana corrente', async () => {
    await garantirResumoDaSemana(SEGUNDA)
    const novo = await prisma.colaborador.findFirstOrThrow({ where: { clerkUserId: 'user_colab' } })
    expect(await resumoPendenteDe('user_colab', TERCA)).toBeNull()
    await prisma.colaborador.update({ where: { id: novo.id }, data: { administrador: true } })
    expect((await resumoPendenteDe('user_colab', TERCA))?.conteudo.semana).toBe('2026-11-16')
    expect(await prisma.notificacao.count({ where: { destinatarioId: novo.id } })).toBe(1)
  })

  it('dispensar mexe só nos avisos de quem clicou', async () => {
    await garantirResumoDaSemana(SEGUNDA)
    const outro = await prisma.colaborador.create({ data: { nome: 'Admin Dois', clerkUserId: 'user_admin2', administrador: true } })
    await resumoPendenteDe('user_admin2', SEGUNDA)
    usuarioAtual.userId = 'user_admin'
    await dispensarResumo()
    expect(await prisma.notificacao.count({ where: { destinatarioId: outro.id, lida: false } })).toBe(1)
    expect(await prisma.notificacao.count({ where: { destinatarioId: adminId, lida: false } })).toBe(0)
  })
})
