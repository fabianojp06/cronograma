/**
 * Notificações de comentário contra o banco: quem é avisado, que o comentário e
 * os avisos andam juntos, que cada pessoa mexe só nas suas e que apagar o
 * comentário leva os avisos.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { comentarAcao, excluirComentario } = await import('@/app/projetos/acoes-comentario')
const { marcarLida, marcarTodasLidas } = await import('@/app/notificacoes/acoes-notificacao')
const { contarNaoLidas } = await import('@/lib/notificacoes-servidor')

function fd(campos: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) f.append(k, valor)
  }
  return f
}

let ana: string, bruno: string, carla: string, inativo: string
let acaoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await prisma.notificacao.deleteMany()
  await prisma.comentarioAcao.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  ana = (await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })).id
  bruno = (await prisma.colaborador.create({ data: { nome: 'Bruno', clerkUserId: 'user_bruno' } })).id
  carla = (await prisma.colaborador.create({ data: { nome: 'Carla', clerkUserId: 'user_carla' } })).id
  inativo = (await prisma.colaborador.create({ data: { nome: 'Saiu', ativo: false } })).id
  const projeto = await prisma.projeto.create({ data: { nome: 'Projeto' } })
  acaoId = (
    await prisma.acao.create({
      data: { projetoId: projeto.id, numero: 1, descricao: 'Ação', responsavelId: bruno },
    })
  ).id
})

afterAll(async () => {
  await prisma.notificacao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const comentar = (extra: Record<string, string | string[]> = {}) =>
  comentarAcao({}, fd({ id: acaoId, texto: 'Preciso do relatório', ...extra }))

const avisos = async () =>
  (await prisma.notificacao.findMany({ orderBy: { destinatarioId: 'asc' } })).map((n) => ({
    id: n.destinatarioId,
    motivo: n.motivo,
    lida: n.lida,
  }))

describe('quem é avisado', () => {
  it('o responsável sempre, mesmo sem ser marcado', async () => {
    expect((await comentar()).enviado).toBe(true)
    expect(await avisos()).toEqual([{ id: bruno, motivo: 'RESPONSAVEL', lida: false }])
  })

  it('os marcados, e o responsável marcado vira MARCADO sem duplicar', async () => {
    await comentar({ avisar: [bruno, carla] })
    const lista = await avisos()
    expect(lista).toHaveLength(2)
    expect(lista.find((a) => a.id === bruno)?.motivo).toBe('MARCADO')
    expect(lista.find((a) => a.id === carla)?.motivo).toBe('MARCADO')
  })

  it('não avisa o próprio autor, nem inativo, nem id inventado', async () => {
    await comentar({ avisar: [ana, inativo, 'id-inventado'] })
    expect(await avisos()).toEqual([{ id: bruno, motivo: 'RESPONSAVEL', lida: false }])
  })

  it('o responsável comentando a própria ação não se avisa', async () => {
    usuarioAtual.userId = 'user_bruno'
    await comentar()
    expect(await avisos()).toEqual([])
  })

  it('texto inválido não grava comentário nem aviso', async () => {
    expect((await comentarAcao({}, fd({ id: acaoId, texto: '  ', avisar: [carla] }))).erro).toBeDefined()
    expect(await prisma.notificacao.count()).toBe(0)
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })
})

describe('contagem, leitura e isolamento', () => {
  it('conta só as não lidas da própria conta', async () => {
    await comentar({ avisar: [carla] })
    expect(await contarNaoLidas('user_bruno')).toBe(1)
    expect(await contarNaoLidas('user_carla')).toBe(1)
    expect(await contarNaoLidas('user_ana')).toBe(0)
    expect(await contarNaoLidas('user_sem_cadastro')).toBe(0)
  })

  it('marcar como lida age só na própria notificação', async () => {
    await comentar({ avisar: [carla] })
    const deBruno = await prisma.notificacao.findFirstOrThrow({ where: { destinatarioId: bruno } })

    usuarioAtual.userId = 'user_carla'
    await marcarLida(fd({ notificacaoId: deBruno.id })) // forjando o id de outra pessoa
    expect(await contarNaoLidas('user_bruno')).toBe(1)

    usuarioAtual.userId = 'user_bruno'
    await marcarLida(fd({ notificacaoId: deBruno.id }))
    expect(await contarNaoLidas('user_bruno')).toBe(0)
    expect(await contarNaoLidas('user_carla')).toBe(1)
  })

  it('marcar todas lê só as da própria pessoa', async () => {
    await comentar({ avisar: [carla] })
    await comentar()
    usuarioAtual.userId = 'user_bruno'
    await marcarTodasLidas(new FormData())
    expect(await contarNaoLidas('user_bruno')).toBe(0)
    expect(await contarNaoLidas('user_carla')).toBe(1)
  })

  it('o Leitor também marca as suas como lidas (estado pessoal)', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { somenteLeitura: true } })
    await comentar()
    usuarioAtual.userId = 'user_bruno'
    await marcarTodasLidas(new FormData())
    expect(await contarNaoLidas('user_bruno')).toBe(0)
  })
})

describe('ciclo de vida', () => {
  it('apagar o comentário apaga os avisos', async () => {
    await comentar({ avisar: [carla] })
    const comentario = await prisma.comentarioAcao.findFirstOrThrow()
    await excluirComentario(fd({ comentarioId: comentario.id }))
    expect(await prisma.notificacao.count()).toBe(0)
  })

  it('comentar apaga o que foi lido há mais de 30 dias e guarda o resto', async () => {
    const velho = await prisma.comentarioAcao.create({ data: { acaoId, texto: 'a', autor: 'x' } })
    const novo = await prisma.comentarioAcao.create({ data: { acaoId, texto: 'b', autor: 'x' } })
    await prisma.notificacao.createMany({
      data: [
        { destinatarioId: carla, comentarioId: velho.id, motivo: 'MARCADO', lida: true, criadoEm: new Date(Date.now() - 40 * 86_400_000) },
        { destinatarioId: carla, comentarioId: novo.id, motivo: 'MARCADO', lida: true, criadoEm: new Date(Date.now() - 5 * 86_400_000) },
      ],
    })
    await comentar()
    const restantes = await prisma.notificacao.findMany({ where: { destinatarioId: carla } })
    expect(restantes.map((n) => n.comentarioId)).toEqual([novo.id])
  })

  it('desativar o colaborador não apaga o histórico de avisos dele', async () => {
    await comentar()
    await prisma.colaborador.update({ where: { id: bruno }, data: { ativo: false } })
    expect(await prisma.notificacao.count({ where: { destinatarioId: bruno } })).toBe(1)
  })
})
