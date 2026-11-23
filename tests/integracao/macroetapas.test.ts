/**
 * Macroetapas contra o banco: ordem, troca de vizinhas, exclusão que desvincula
 * as ações e grava o histórico, Leitor recusado e isolamento entre projetos.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { criarMacroetapa, renomearMacroetapa, reordenarMacroetapa, excluirMacroetapa } = await import(
  '@/app/projetos/acoes-macroetapa'
)

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let outroId: string

async function limpar() {
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.macroetapa.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
}

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await limpar()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede' } })).id
  outroId = (await prisma.projeto.create({ data: { nome: 'Outro' } })).id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

const criar = (nome: string, pid = projetoId) => criarMacroetapa({}, fd({ projetoId: pid, nome }))
const ordenadas = (pid = projetoId) => prisma.macroetapa.findMany({ where: { projetoId: pid }, orderBy: { ordem: 'asc' } })

describe('criarMacroetapa', () => {
  it('numera a ordem 1, 2, ...', async () => {
    expect((await criar('Planejamento')).ok).toBe(true)
    expect((await criar('Execução')).ok).toBe(true)
    expect((await ordenadas()).map((m) => [m.nome, m.ordem])).toEqual([['Planejamento', 1], ['Execução', 2]])
  })

  it('recusa nome repetido sem acento/caixa e a 13ª macroetapa', async () => {
    await criar('Homologação')
    const r = await criar('homologacao')
    expect(r.ok).toBe(false)
    for (let i = 2; i <= 12; i++) await criar(`Etapa ${i}`)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(12)
    expect((await criar('Etapa 13')).ok).toBe(false)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(12)
  })

  it('14 criações simultâneas: exatamente 12 passam, com ordens 1..12 únicas', async () => {
    const r = await Promise.all(Array.from({ length: 14 }, (_, i) => criar(`Etapa ${i + 1}`)))
    expect(r.filter((x) => x.ok)).toHaveLength(12)
    expect((await ordenadas()).map((m) => m.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('criações simultâneas do mesmo nome: só uma grava, a outra recebe a mensagem amigável', async () => {
    const r = await Promise.all([criar('Mesmo'), criar('mesmo'), criar('MESMO')])
    expect(r.filter((x) => x.ok)).toHaveLength(1)
    expect(r.filter((x) => !x.ok).every((x) => /Já existe/.test(x.mensagem ?? ''))).toBe(true)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(1)
  })

  it('Leitor e sessão ausente são recusados sem gravar', async () => {
    usuarioAtual.userId = 'user_leitor'
    expect(await criar('X')).toEqual({ ok: false, mensagem: MENSAGEM_SOMENTE_LEITURA })
    usuarioAtual.userId = null
    expect((await criar('X')).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(0)
  })

  it('projeto inexistente ou excluído é recusado', async () => {
    expect((await criar('X', 'nao-existe')).ok).toBe(false)
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    expect((await criar('X')).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(0)
  })
})

describe('renomearMacroetapa', () => {
  it('renomeia, inclusive só a caixa do próprio nome', async () => {
    await criar('Homologação')
    const m = (await ordenadas())[0]
    expect((await renomearMacroetapa({}, fd({ projetoId, id: m.id, nome: 'homologação' }))).ok).toBe(true)
    expect((await ordenadas())[0].nome).toBe('homologação')
  })

  it('id de outro projeto não é afetado', async () => {
    await criar('Alvo', outroId)
    const alvo = (await ordenadas(outroId))[0]
    const r = await renomearMacroetapa({}, fd({ projetoId, id: alvo.id, nome: 'Invadido' }))
    expect(r.ok).toBe(false)
    expect((await ordenadas(outroId))[0].nome).toBe('Alvo')
  })

  it('Leitor é recusado', async () => {
    await criar('A')
    const m = (await ordenadas())[0]
    usuarioAtual.userId = 'user_leitor'
    expect((await renomearMacroetapa({}, fd({ projetoId, id: m.id, nome: 'B' }))).ok).toBe(false)
    expect((await ordenadas())[0].nome).toBe('A')
  })
})

describe('reordenarMacroetapa', () => {
  it('sobe e desce trocando a ordem das duas vizinhas', async () => {
    await criar('A'); await criar('B'); await criar('C')
    const [a, b, c] = await ordenadas()
    expect((await reordenarMacroetapa({}, fd({ projetoId, id: b.id, intencao: 'subir' }))).ok).toBe(true)
    expect((await ordenadas()).map((m) => m.nome)).toEqual(['B', 'A', 'C'])
    await reordenarMacroetapa({}, fd({ projetoId, id: a.id, intencao: 'descer' }))
    expect((await ordenadas()).map((m) => m.nome)).toEqual(['B', 'C', 'A'])
    expect(c.id).toBeTruthy()
  })

  it('subir a primeira e descer a última não mudam nada', async () => {
    await criar('A'); await criar('B')
    const [a, b] = await ordenadas()
    await reordenarMacroetapa({}, fd({ projetoId, id: a.id, intencao: 'subir' }))
    await reordenarMacroetapa({}, fd({ projetoId, id: b.id, intencao: 'descer' }))
    expect((await ordenadas()).map((m) => [m.nome, m.ordem])).toEqual([['A', 1], ['B', 2]])
  })

  it('id de outro projeto não é afetado; intenção inválida é recusada', async () => {
    await criar('X', outroId); await criar('Y', outroId)
    const [x] = await ordenadas(outroId)
    expect((await reordenarMacroetapa({}, fd({ projetoId, id: x.id, intencao: 'descer' }))).ok).toBe(false)
    expect((await ordenadas(outroId)).map((m) => m.nome)).toEqual(['X', 'Y'])
    expect((await reordenarMacroetapa({}, fd({ projetoId: outroId, id: x.id, intencao: 'xis' }))).ok).toBe(false)
  })
})

describe('excluirMacroetapa', () => {
  it('desvincula as ações e grava uma linha de histórico por ação', async () => {
    await criar('Homologação')
    const m = (await ordenadas())[0]
    const a1 = await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A', macroetapaId: m.id } })
    const a2 = await prisma.acao.create({ data: { projetoId, numero: 2, descricao: 'B', macroetapaId: m.id } })
    const solta = await prisma.acao.create({ data: { projetoId, numero: 3, descricao: 'C' } })

    const r = await excluirMacroetapa({}, fd({ projetoId, id: m.id }))
    expect(r.ok).toBe(true)
    expect(await prisma.macroetapa.count()).toBe(0)
    expect((await prisma.acao.findMany({ where: { projetoId } })).every((a) => a.macroetapaId === null)).toBe(true)
    const h = await prisma.historicoAlteracao.findMany({ where: { campo: 'macroetapa' } })
    expect(h.map((x) => x.acaoId).sort()).toEqual([a1.id, a2.id].sort())
    expect(h.every((x) => x.valorAntigo === 'Homologação' && (x.valorNovo === null || x.valorNovo === '') && x.alteradoPor === 'user_ana')).toBe(true)
    expect(h.some((x) => x.acaoId === solta.id)).toBe(false)
  })

  it('id de outro projeto não é afetado', async () => {
    await criar('Alvo', outroId)
    const alvo = (await ordenadas(outroId))[0]
    const a = await prisma.acao.create({ data: { projetoId: outroId, numero: 1, descricao: 'A', macroetapaId: alvo.id } })
    const r = await excluirMacroetapa({}, fd({ projetoId, id: alvo.id }))
    expect(r.ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(1)
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: a.id } })).macroetapaId).toBe(alvo.id)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('Leitor é recusado e nada muda', async () => {
    await criar('A')
    const m = (await ordenadas())[0]
    usuarioAtual.userId = 'user_leitor'
    expect((await excluirMacroetapa({}, fd({ projetoId, id: m.id }))).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(1)
  })
})
