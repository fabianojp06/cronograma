/**
 * Comentários por ação contra o banco: quem lê não comenta, só o autor (ou o
 * administrador) apaga, e a ação de projeto excluído não recebe comentário.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_colab' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { comentarAcao, excluirComentario } = await import('@/app/projetos/acoes-comentario')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let acaoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_colab'
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  await prisma.colaborador.create({ data: { nome: 'Outra', clerkUserId: 'user_outra' } })
  await prisma.colaborador.create({
    data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true },
  })
  await prisma.colaborador.create({
    data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true },
  })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto' } })).id
  acaoId = (await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'Ação' } })).id
})

afterAll(async () => {
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const comentar = (texto: string) => comentarAcao({}, fd({ id: acaoId, texto }))

describe('comentarAcao', () => {
  it('grava o comentário com o autor e o texto aparado', async () => {
    const r = await comentar('  Aguardando o fornecedor  ')
    expect(r).toEqual({ enviado: true })
    const [c] = await prisma.comentarioAcao.findMany({ where: { acaoId } })
    expect(c.texto).toBe('Aguardando o fornecedor')
    expect(c.autor).toBe('user_colab')
  })

  it('recusa texto vazio e não grava', async () => {
    expect((await comentar('   ')).erro).toBeDefined()
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })

  it('o Leitor não comenta (comentar é gravar)', async () => {
    usuarioAtual.userId = 'user_leitor'
    expect((await comentar('oi')).erro).toBe(MENSAGEM_SOMENTE_LEITURA)
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })

  it('sem sessão não comenta', async () => {
    usuarioAtual.userId = null
    expect((await comentar('oi')).erro).toMatch(/Sessão expirada/)
  })

  it('ação de projeto excluído não recebe comentário', async () => {
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    expect((await comentar('oi')).erro).toMatch(/excluído/)
  })

  it('apagar a ação leva os comentários junto', async () => {
    await comentar('oi')
    await prisma.acao.delete({ where: { id: acaoId } })
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })
})

describe('excluirComentario', () => {
  async function umComentario(autor: string) {
    return (await prisma.comentarioAcao.create({ data: { acaoId, texto: 'x', autor } })).id
  }

  it('o autor apaga o seu', async () => {
    const id = await umComentario('user_colab')
    await excluirComentario(fd({ comentarioId: id }))
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })

  it('outra pessoa não apaga o comentário alheio', async () => {
    const id = await umComentario('user_outra')
    await excluirComentario(fd({ comentarioId: id }))
    expect(await prisma.comentarioAcao.count()).toBe(1)
  })

  it('o administrador apaga o de qualquer um', async () => {
    const id = await umComentario('user_outra')
    usuarioAtual.userId = 'user_admin'
    await excluirComentario(fd({ comentarioId: id }))
    expect(await prisma.comentarioAcao.count()).toBe(0)
  })

  it('o Leitor não apaga nem o próprio', async () => {
    const id = await umComentario('user_leitor')
    usuarioAtual.userId = 'user_leitor'
    await excluirComentario(fd({ comentarioId: id }))
    expect(await prisma.comentarioAcao.count()).toBe(1)
  })
})
