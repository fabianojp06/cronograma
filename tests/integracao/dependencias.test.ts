/**
 * Dependência entre ações contra o banco: o início é bloqueado enquanto a
 * predecessora não termina, o líder libera (ou o pedido dele é decidido por
 * ele), e tudo fica no histórico e nos avisos.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_colab' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { registrarRealizado, atualizarAcao } = await import('@/app/projetos/acoes-acao')
const { adicionarDependencia, removerDependencia, pedirLiberacao, decidirLiberacao } =
  await import('@/app/projetos/acoes-dependencia')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let a: string // predecessora
let b: string // depende de a

beforeEach(async () => {
  usuarioAtual.userId = 'user_colab'
  await prisma.notificacao.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  await prisma.colaborador.create({ data: { nome: 'Líder Silva', clerkUserId: 'user_lider' } })
  await prisma.colaborador.create({
    data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true },
  })
  await prisma.colaborador.create({
    data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true },
  })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto', responsavel: 'lider silva' } }))
    .id
  a = (await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A' } })).id
  b = (await prisma.acao.create({ data: { projetoId, numero: 2, descricao: 'B' } })).id
})

afterAll(async () => {
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const vincular = () => adicionarDependencia({}, fd({ id: b, predecessoraId: a }))
const iniciarB = () => registrarRealizado({}, fd({ id: b, realizadoInicio: '2026-01-05', realizadoTermino: '' }))
const pedir = (motivo = 'Já dá para começar em paralelo') =>
  pedirLiberacao({}, fd({ id: b, motivo }))

describe('vínculo', () => {
  it('cria, registra no histórico e recusa duplicata e ciclo', async () => {
    expect(await vincular()).toMatchObject({ ok: expect.any(String) })
    const h = await prisma.historicoAlteracao.findFirst({ where: { acaoId: b, campo: 'dependencia' } })
    expect(h?.valorNovo).toBe('Depende da ação 1')
    expect(await vincular()).toMatchObject({ erro: expect.stringContaining('já existe') })
    expect(await adicionarDependencia({}, fd({ id: a, predecessoraId: b }))).toMatchObject({
      erro: expect.stringContaining('ciclo'),
    })
  })

  it('só vale dentro do mesmo projeto', async () => {
    const outro = await prisma.projeto.create({ data: { nome: 'Outro' } })
    const c = await prisma.acao.create({ data: { projetoId: outro.id, numero: 1, descricao: 'C' } })
    expect(await adicionarDependencia({}, fd({ id: b, predecessoraId: c.id }))).toMatchObject({
      erro: expect.stringContaining('mesmo projeto'),
    })
  })

  it('Leitor não vincula', async () => {
    usuarioAtual.userId = 'user_leitor'
    expect(await vincular()).toEqual({ erro: MENSAGEM_SOMENTE_LEITURA })
  })

  it('remover apaga o vínculo e registra', async () => {
    await vincular()
    const v = await prisma.dependenciaAcao.findFirstOrThrow({ where: { acaoId: b } })
    await removerDependencia(fd({ dependenciaId: v.id }))
    expect(await prisma.dependenciaAcao.count()).toBe(0)
    expect(await prisma.historicoAlteracao.count({ where: { acaoId: b, campo: 'dependencia' } })).toBe(2)
  })
})

describe('bloqueio do início', () => {
  it('recusa apontar realizado e avançar o status enquanto A não termina', async () => {
    await vincular()
    expect(await iniciarB()).toMatchObject({ erroGeral: expect.stringContaining('ação #1') })
    const r = await atualizarAcao(
      {},
      fd({ id: b, descricao: 'B', status: 'EM_CURSO_25' }),
    )
    expect(r.erros?.status).toContain('#1')
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: b } })).status).toBe('NAO_INICIADO')
  })

  it('libera sozinho quando A termina, e editar sem iniciar nunca bloqueia', async () => {
    await vincular()
    const r = await atualizarAcao({}, fd({ id: b, descricao: 'B renomeada', status: 'NAO_INICIADO' }))
    expect(r.salva).toBeDefined()
    await prisma.acao.update({ where: { id: a }, data: { status: 'CONCLUIDO' } })
    expect(await iniciarB()).toMatchObject({ apontada: expect.anything() })
  })

  it('ação já em andamento não é bloqueada por vínculo criado depois', async () => {
    await prisma.acao.update({ where: { id: b }, data: { status: 'EM_CURSO_50' } })
    await vincular()
    const r = await atualizarAcao({}, fd({ id: b, descricao: 'B', status: 'EM_CURSO_75' }))
    expect(r.salva).toBeDefined()
  })
})

describe('liberação pelo líder', () => {
  it('pedido fica pendente e avisa o líder; a ação segue bloqueada', async () => {
    await vincular()
    expect(await pedir()).toMatchObject({ ok: expect.stringContaining('avisado') })
    const lider = await prisma.colaborador.findFirstOrThrow({ where: { clerkUserId: 'user_lider' } })
    const avisos = await prisma.notificacao.findMany({ where: { destinatarioId: lider.id } })
    expect(avisos.map((n) => n.motivo)).toEqual(['LIBERACAO_PEDIDA'])
    expect(await iniciarB()).toMatchObject({ erroGeral: expect.any(String) })
    expect(await pedir()).toMatchObject({ erro: expect.stringContaining('aguardando') })
  })

  it('o líder aprova: a ação libera, histórico e aviso ao solicitante', async () => {
    await vincular()
    await pedir()
    const pedido = await prisma.liberacaoAcao.findFirstOrThrow({ where: { acaoId: b } })

    usuarioAtual.userId = 'user_colab'
    expect(await decidirLiberacao({}, fd({ liberacaoId: pedido.id, decisao: 'aprovar' }))).toMatchObject({
      erro: expect.stringContaining('líder'),
    })

    usuarioAtual.userId = 'user_lider'
    expect(await decidirLiberacao({}, fd({ liberacaoId: pedido.id, decisao: 'aprovar' }))).toEqual({
      ok: 'Pedido aprovado.',
    })
    expect(await decidirLiberacao({}, fd({ liberacaoId: pedido.id, decisao: 'recusar', justificativa: 'tarde demais' }))).toMatchObject({
      erro: expect.stringContaining('já foi decidido'),
    })

    usuarioAtual.userId = 'user_colab'
    expect(await iniciarB()).toMatchObject({ apontada: expect.anything() })
    const colab = await prisma.colaborador.findFirstOrThrow({ where: { clerkUserId: 'user_colab' } })
    expect((await prisma.notificacao.findMany({ where: { destinatarioId: colab.id } })).map((n) => n.motivo)).toEqual(['LIBERACAO_APROVADA'])
    const linhas = await prisma.historicoAlteracao.findMany({ where: { acaoId: b, campo: 'liberacao' } })
    expect(linhas.map((l) => l.valorNovo)).toEqual(expect.arrayContaining([expect.stringMatching(/^Pedida/), 'Aprovada']))
  })

  it('recusa exige justificativa e mantém o bloqueio', async () => {
    await vincular()
    await pedir()
    const pedido = await prisma.liberacaoAcao.findFirstOrThrow({ where: { acaoId: b } })
    usuarioAtual.userId = 'user_admin'
    expect(await decidirLiberacao({}, fd({ liberacaoId: pedido.id, decisao: 'recusar' }))).toMatchObject({
      erro: expect.stringContaining('Para recusar'),
    })
    expect(await decidirLiberacao({}, fd({ liberacaoId: pedido.id, decisao: 'recusar', justificativa: 'depende do contrato' }))).toEqual({ ok: 'Pedido recusado.' })
    usuarioAtual.userId = 'user_colab'
    expect(await iniciarB()).toMatchObject({ erroGeral: expect.any(String) })
    // Recusado, pode pedir de novo.
    expect(await pedir('Mudou a situação')).toMatchObject({ ok: expect.any(String) })
  })

  it('pedido do próprio líder já nasce aprovado', async () => {
    await vincular()
    usuarioAtual.userId = 'user_lider'
    expect(await pedir()).toMatchObject({ ok: expect.stringContaining('liberada') })
    const p = await prisma.liberacaoAcao.findFirstOrThrow({ where: { acaoId: b } })
    expect(p).toMatchObject({ status: 'APROVADA', decididoPor: 'user_lider' })
    expect(await iniciarB()).toMatchObject({ apontada: expect.anything() })
  })

  it('motivo curto é recusado e ação sem bloqueio não pede', async () => {
    await vincular()
    expect(await pedir('ok')).toMatchObject({ erro: expect.stringContaining('motivo') })
    await prisma.acao.update({ where: { id: a }, data: { status: 'CONCLUIDO' } })
    expect(await pedir()).toMatchObject({ erro: expect.stringContaining('não está bloqueada') })
  })
})
