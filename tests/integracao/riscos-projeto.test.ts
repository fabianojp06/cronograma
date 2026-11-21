/**
 * Riscos e bloqueios contra o banco: criar, editar com histórico e resolvidoEm,
 * aviso ao responsável, vínculos (ação do mesmo projeto, responsável ativo),
 * permissões e exclusão.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

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
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { criarRisco, atualizarRisco, excluirRisco } = await import('@/app/projetos/acoes-risco')

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
let outroProjetoId: string
let acaoId: string
let acaoDeFora: string
let anaId: string
let biaId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await prisma.notificacao.deleteMany()
  await prisma.riscoProjeto.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  anaId = (await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })).id
  biaId = (await prisma.colaborador.create({ data: { nome: 'Bia', clerkUserId: 'user_bia' } })).id
  await prisma.colaborador.create({ data: { nome: 'Inativo', ativo: false } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true } })
  await prisma.colaborador.create({ data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede' } })).id
  outroProjetoId = (await prisma.projeto.create({ data: { nome: 'Outro' } })).id
  acaoId = (await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A' } })).id
  acaoDeFora = (await prisma.acao.create({ data: { projetoId: outroProjetoId, numero: 1, descricao: 'B' } })).id
})

afterAll(async () => {
  await prisma.notificacao.deleteMany()
  await prisma.riscoProjeto.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const base = { id: '', tipo: 'RISCO', titulo: 'Fornecedor pode atrasar', impacto: 'ALTO' }
const criar = (extra: Record<string, string> = {}) => seguir(() => criarRisco({}, fd({ ...base, id: projetoId, ...extra })))

describe('criarRisco', () => {
  it('grava e volta para a seção do projeto; aberto não tem resolvidoEm', async () => {
    const r = await criar({ acaoId, responsavelId: biaId, prazo: '2026-12-10', plano: 'Cotar outro fornecedor' })
    expect(r).toEqual({ url: `/projetos/${projetoId}#riscos` })
    const x = await prisma.riscoProjeto.findFirstOrThrow()
    expect(x).toMatchObject({ projetoId, acaoId, responsavelId: biaId, impacto: 'ALTO', status: 'ABERTO', criadoPor: 'user_ana', resolvidoEm: null, plano: 'Cotar outro fornecedor' })
    expect(x.prazo?.toISOString().slice(0, 10)).toBe('2026-12-10')
  })

  it('avisa o responsável, mas não quem está registrando para si mesmo', async () => {
    await criar({ responsavelId: biaId })
    await criar({ responsavelId: anaId })
    const avisos = await prisma.notificacao.findMany({ include: { risco: true } })
    expect(avisos.map((n) => [n.destinatarioId, n.motivo])).toEqual([[biaId, 'RISCO_RESPONSAVEL']])
    expect(avisos[0].risco?.titulo).toBe('Fornecedor pode atrasar')
  })

  it('recusa ação de outro projeto, responsável inativo, dados inválidos e Leitor — sem gravar', async () => {
    const inativo = await prisma.colaborador.findFirstOrThrow({ where: { nome: 'Inativo' } })
    const r1 = await seguir(() => criarRisco({}, fd({ ...base, id: projetoId, acaoId: acaoDeFora })))
    expect(r1).toMatchObject({ retorno: { erros: { acaoId: expect.any(String) } } })
    const r2 = await seguir(() => criarRisco({}, fd({ ...base, id: projetoId, responsavelId: inativo.id })))
    expect(r2).toMatchObject({ retorno: { erros: { responsavelId: expect.any(String) } } })
    const r3 = await seguir(() => criarRisco({}, fd({ id: projetoId, tipo: '', titulo: '', impacto: '' })))
    expect(r3).toMatchObject({ retorno: { erros: { titulo: expect.any(String) } } })
    usuarioAtual.userId = 'user_leitor'
    expect(await seguir(() => criarRisco({}, fd({ ...base, id: projetoId })))).toEqual({ retorno: { erroGeral: MENSAGEM_SOMENTE_LEITURA } })
    expect(await prisma.riscoProjeto.count()).toBe(0)
  })

  it('projeto excluído não recebe registro', async () => {
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    expect(await criar()).toMatchObject({ retorno: { erroGeral: expect.stringContaining('excluído') } })
  })
})

describe('atualizarRisco', () => {
  async function existente(extra: Record<string, string> = {}) {
    await criar({ responsavelId: biaId, prazo: '2026-12-10', ...extra })
    return prisma.riscoProjeto.findFirstOrThrow()
  }
  const editar = (riscoId: string, extra: Record<string, string>) =>
    seguir(() => atualizarRisco({}, fd({ ...base, id: projetoId, riscoId, ...extra })))

  it('muda o status: grava o histórico, resolvidoEm e reabrir limpa', async () => {
    const x = await existente()
    expect(await editar(x.id, { status: 'RESOLVIDO', responsavelId: biaId, prazo: '2026-12-10' })).toMatchObject({ url: expect.any(String) })
    const resolvido = await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: x.id } })
    expect(resolvido.status).toBe('RESOLVIDO')
    expect(resolvido.resolvidoEm).not.toBeNull()
    const h = await prisma.riscoHistorico.findMany({ where: { riscoId: x.id } })
    expect(h.map((l) => [l.campo, l.valorAntigo, l.valorNovo, l.alteradoPor])).toEqual([['status', 'ABERTO', 'RESOLVIDO', 'user_ana']])

    await editar(x.id, { status: 'ABERTO', responsavelId: biaId, prazo: '2026-12-10' })
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: x.id } })).resolvidoEm).toBeNull()
  })

  it('trocar o responsável grava o NOME no histórico e avisa a pessoa nova', async () => {
    const x = await existente()
    await prisma.notificacao.deleteMany()
    await seguir(() => atualizarRisco({}, fd({ ...base, id: projetoId, riscoId: x.id, responsavelId: anaId, prazo: '2026-12-10' })))
    // Ana está salvando e é a nova responsável: sem aviso para si mesma.
    expect(await prisma.notificacao.count()).toBe(0)
    const h = await prisma.riscoHistorico.findFirstOrThrow({ where: { riscoId: x.id, campo: 'responsavel' } })
    expect([h.valorAntigo, h.valorNovo]).toEqual(['Bia', 'Ana'])

    // Outra pessoa salva e passa o tratamento ao administrador: só ele é avisado.
    const chefe = await prisma.colaborador.findFirstOrThrow({ where: { nome: 'Admin' } })
    usuarioAtual.userId = 'user_bia'
    await seguir(() => atualizarRisco({}, fd({ ...base, id: projetoId, riscoId: x.id, responsavelId: chefe.id, prazo: '2026-12-10', titulo: 'Novo título' })))
    expect(await prisma.notificacao.count()).toBe(1)
    expect((await prisma.notificacao.findFirstOrThrow()).destinatarioId).toBe(chefe.id)
  })

  it('salvar sem mudar nada de auditado não gera histórico nem aviso', async () => {
    const x = await existente()
    await prisma.notificacao.deleteMany()
    await editar(x.id, { responsavelId: biaId, prazo: '2026-12-10', descricao: 'só a descrição' })
    expect(await prisma.riscoHistorico.count()).toBe(0)
    expect(await prisma.notificacao.count()).toBe(0)
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: x.id } })).descricao).toBe('só a descrição')
  })

  it('erro de validação não altera nada; Leitor e registro inexistente são recusados', async () => {
    const x = await existente()
    const r = await editar(x.id, { titulo: '', responsavelId: biaId })
    expect(r).toMatchObject({ retorno: { erros: { titulo: expect.any(String) } } })
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: x.id } })).titulo).toBe('Fornecedor pode atrasar')
    expect(await editar('nao-existe', {})).toMatchObject({ retorno: { erroGeral: expect.stringContaining('não encontrado') } })
    usuarioAtual.userId = 'user_leitor'
    expect(await editar(x.id, {})).toEqual({ retorno: { erroGeral: MENSAGEM_SOMENTE_LEITURA } })
  })

  it('responsável que ficou inativo é mantido ao salvar outro campo', async () => {
    const x = await existente()
    await prisma.colaborador.update({ where: { id: biaId }, data: { ativo: false } })
    expect(await editar(x.id, { responsavelId: biaId, prazo: '2026-12-10', titulo: 'Renomeado' })).toMatchObject({ url: expect.any(String) })
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: x.id } })).responsavelId).toBe(biaId)
  })
})

describe('excluirRisco', () => {
  it('quem registrou exclui; outra pessoa não; o administrador exclui qualquer um; leva o histórico', async () => {
    await criar()
    const x = await prisma.riscoProjeto.findFirstOrThrow()
    await prisma.riscoHistorico.create({ data: { riscoId: x.id, campo: 'status', valorAntigo: 'ABERTO', valorNovo: 'RESOLVIDO' } })
    const f = fd({ riscoId: x.id })

    usuarioAtual.userId = 'user_bia'
    await excluirRisco(f)
    expect(await prisma.riscoProjeto.count()).toBe(1)

    usuarioAtual.userId = 'user_admin'
    await excluirRisco(f)
    expect(await prisma.riscoProjeto.count()).toBe(0)
    expect(await prisma.riscoHistorico.count()).toBe(0)
  })

  it('apagar a ação não apaga o risco: ele só perde o vínculo', async () => {
    await criar({ acaoId })
    await prisma.acao.delete({ where: { id: acaoId } })
    expect(await prisma.riscoProjeto.findFirstOrThrow()).toMatchObject({ acaoId: null })
  })
})
