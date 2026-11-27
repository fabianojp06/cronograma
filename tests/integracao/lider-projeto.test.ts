/**
 * Líder do projeto escolhido na lista: grava o id e copia o nome canônico, não
 * mexe no texto antigo sem escolha, vale sobre o texto nas liberações, e
 * acompanha a renomeação do colaborador.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_colab' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { criarProjeto, atualizarProjeto } = await import('@/app/projetos/acoes-projeto')
const { pedirLiberacao } = await import('@/app/projetos/acoes-dependencia')
const { adicionarDependencia } = await import('@/app/projetos/acoes-dependencia')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let anaId: string
let brunoId: string
let inativoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_colab'
  await prisma.notificacao.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  anaId = (await prisma.colaborador.create({ data: { nome: 'Ana Silva', clerkUserId: 'user_ana' } })).id
  brunoId = (await prisma.colaborador.create({ data: { nome: 'Bruno José', clerkUserId: 'user_bruno' } })).id
  inativoId = (await prisma.colaborador.create({ data: { nome: 'Inativo', ativo: false } })).id
})

afterAll(async () => {
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

describe('criar e editar o projeto', () => {
  it('criar com líder grava o id e o nome canônico', async () => {
    const r = await criarProjeto({}, fd({ nome: 'P', prioridade: '1', lider: `c:${anaId}` }))
    expect(r.criado).toBeDefined()
    const p = await prisma.projeto.findFirstOrThrow()
    expect(p).toMatchObject({ liderId: anaId, responsavel: 'Ana Silva' })
  })

  it('recusa líder inativo ou inexistente', async () => {
    expect((await criarProjeto({}, fd({ nome: 'P', prioridade: '1', lider: `c:${inativoId}` }))).erros?.responsavel).toBeDefined()
    expect((await criarProjeto({}, fd({ nome: 'P', prioridade: '1', lider: 'c:nao-existe' }))).erros?.responsavel).toBeDefined()
    expect(await prisma.projeto.count()).toBe(0)
  })

  it('"manter" preserva o texto antigo e não liga ninguém', async () => {
    const p = await prisma.projeto.create({ data: { nome: 'Antigo', responsavel: 'Fulano de Fora' } })
    const r = await atualizarProjeto({}, fd({ id: p.id, nome: 'Antigo renomeado', lider: 't' }))
    expect(r.salvo).toBeDefined()
    expect(await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      nome: 'Antigo renomeado',
      responsavel: 'Fulano de Fora',
      liderId: null,
    })
  })

  it('trocar o líder muda id e nome; "sem líder" limpa os dois', async () => {
    const p = await prisma.projeto.create({ data: { nome: 'P', responsavel: 'Ana Silva', liderId: anaId } })
    await atualizarProjeto({}, fd({ id: p.id, nome: 'P', lider: `c:${brunoId}` }))
    expect(await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      liderId: brunoId,
      responsavel: 'Bruno José',
    })
    await atualizarProjeto({}, fd({ id: p.id, nome: 'P', lider: '' }))
    expect(await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({
      liderId: null,
      responsavel: null,
    })
  })

  it('aba antiga (sem o campo lider) continua gravando o texto', async () => {
    const p = await prisma.projeto.create({ data: { nome: 'P', responsavel: 'Ana Silva' } })
    await atualizarProjeto({}, fd({ id: p.id, nome: 'P', responsavel: 'Texto novo' }))
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).responsavel).toBe('Texto novo')
  })

  it('renomear o colaborador atualiza o nome nos projetos que ele lidera', async () => {
    const { salvarColaborador } = await import('@/app/colaboradores/acoes-colaborador')
    await prisma.colaborador.update({ where: { id: brunoId }, data: { administrador: true } })
    usuarioAtual.userId = 'user_bruno'
    const p = await prisma.projeto.create({ data: { nome: 'P', responsavel: 'Ana Silva', liderId: anaId } })
    await salvarColaborador({}, fd({ colaboradorId: anaId, nome: 'Ana Souza' }))
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: p.id } })).responsavel).toBe('Ana Souza')
  })
})

describe('liberação com líder da lista', () => {
  async function cenario(projeto: { responsavel?: string; liderId?: string }) {
    const p = await prisma.projeto.create({ data: { nome: 'P', ...projeto } })
    const a = await prisma.acao.create({ data: { projetoId: p.id, numero: 1, descricao: 'A' } })
    const b = await prisma.acao.create({ data: { projetoId: p.id, numero: 2, descricao: 'B' } })
    await adicionarDependencia({}, fd({ id: b.id, predecessoraId: a.id }))
    return { b: b.id }
  }

  it('o líder da lista libera na hora, mesmo com o texto de outra pessoa', async () => {
    const { b } = await cenario({ liderId: anaId, responsavel: 'Bruno José' })
    usuarioAtual.userId = 'user_ana'
    expect(await pedirLiberacao({}, fd({ id: b, motivo: 'Dá para começar já' }))).toMatchObject({
      ok: expect.stringContaining('liberada'),
    })
  })

  it('quem só tem o nome igual no texto NÃO é líder quando há líder na lista', async () => {
    const { b } = await cenario({ liderId: anaId, responsavel: 'Bruno José' })
    usuarioAtual.userId = 'user_bruno'
    expect(await pedirLiberacao({}, fd({ id: b, motivo: 'Dá para começar já' }))).toMatchObject({
      ok: expect.stringContaining('avisado'),
    })
    const aviso = await prisma.notificacao.findMany({ where: { destinatarioId: anaId } })
    expect(aviso.map((n) => n.motivo)).toEqual(['LIBERACAO_PEDIDA'])
  })

  it('projeto antigo (sem líder na lista) segue valendo pelo nome', async () => {
    const { b } = await cenario({ responsavel: 'ana silva' })
    usuarioAtual.userId = 'user_ana'
    expect(await pedirLiberacao({}, fd({ id: b, motivo: 'Dá para começar já' }))).toMatchObject({
      ok: expect.stringContaining('liberada'),
    })
  })
})
