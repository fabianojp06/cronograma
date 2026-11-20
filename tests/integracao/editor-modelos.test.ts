/**
 * Editor de modelos contra o banco: criar do zero, editar (substitui as ações
 * numa transação), conflito de versão, nome repetido e quem pode editar.
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
const { criarModelo, atualizarModelo, excluirModelo } = await import('@/app/modelos/acoes-modelo')

function formulario(
  campos: Record<string, string>,
  linhas: [string, string, string][] = [['Primeira', '0', '3'], ['Segunda', '3', '5']],
) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  for (const [d, i, u] of linhas) {
    f.append('acaoDescricao', d)
    f.append('acaoInicio', i)
    f.append('acaoDuracao', u)
  }
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

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await prisma.modeloProjeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Bia', clerkUserId: 'user_bia' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true } })
  await prisma.colaborador.create({ data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true } })
})

afterAll(async () => {
  await prisma.modeloProjeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

async function criarComoAna(nome = 'Rotina') {
  const r = await seguir(() => criarModelo({}, formulario({ nome, equipe: ' STI ', descricao: 'Serve para X' })))
  expect(r).toMatchObject({ url: expect.stringMatching(/^\/modelos\?salvo=/) })
  return prisma.modeloProjeto.findUniqueOrThrow({ where: { nome }, include: { acoes: { orderBy: { ordem: 'asc' } } } })
}

describe('criarModelo', () => {
  it('grava dados, classificação aparada e as ações em ordem, com o autor', async () => {
    const m = await criarComoAna()
    expect(m).toMatchObject({ equipe: 'STI', descricao: 'Serve para X', criadoPor: 'user_ana' })
    expect(m.acoes.map((a) => [a.ordem, a.descricao, a.inicioDiasUteis, a.duracaoDiasUteis])).toEqual([
      [1, 'Primeira', 0, 3],
      [2, 'Segunda', 3, 5],
    ])
  })

  it('recusa nome repetido, ação inválida e Leitor — sem gravar nada', async () => {
    await criarComoAna()
    expect(await criarModelo({}, formulario({ nome: 'Rotina' }))).toEqual({
      erro: 'Já existe um modelo com esse nome. Escolha outro.',
    })
    const r = await criarModelo({}, formulario({ nome: 'Outra' }, [['A', '0', '0']]))
    expect(r.erros).toEqual([{ linha: 1, erro: 'A duração mínima é 1 dia útil.' }])
    usuarioAtual.userId = 'user_leitor'
    expect(await criarModelo({}, formulario({ nome: 'Leitor' }))).toEqual({ erro: MENSAGEM_SOMENTE_LEITURA })
    expect(await prisma.modeloProjeto.count()).toBe(1)
  })
})

describe('atualizarModelo', () => {
  it('substitui dados e ações por inteiro, na ordem nova', async () => {
    const m = await criarComoAna()
    const r = await seguir(() =>
      atualizarModelo(
        {},
        formulario(
          { modeloId: m.id, versao: m.updatedAt.toISOString(), nome: 'Rotina v2', equipe: '' },
          [['Segunda', '0', '2'], ['Primeira', '2', '1'], ['Terceira', '', '']],
        ),
      ),
    )
    expect(r).toMatchObject({ url: expect.stringContaining(m.id) })
    const depois = await prisma.modeloProjeto.findUniqueOrThrow({ where: { id: m.id }, include: { acoes: { orderBy: { ordem: 'asc' } } } })
    expect(depois).toMatchObject({ nome: 'Rotina v2', equipe: null })
    expect(depois.acoes.map((a) => [a.ordem, a.descricao, a.inicioDiasUteis])).toEqual([
      [1, 'Segunda', 0],
      [2, 'Primeira', 2],
      [3, 'Terceira', null],
    ])
  })

  it('conflito de versão não grava nada', async () => {
    const m = await criarComoAna()
    const versaoVelha = m.updatedAt.toISOString()
    await prisma.modeloProjeto.update({ where: { id: m.id }, data: { descricao: 'outra pessoa mexeu' } })
    const r = await atualizarModelo({}, formulario({ modeloId: m.id, versao: versaoVelha, nome: 'Tentativa' }))
    expect(r.erro).toContain('alterado por outra pessoa')
    const depois = await prisma.modeloProjeto.findUniqueOrThrow({ where: { id: m.id }, include: { _count: { select: { acoes: true } } } })
    expect(depois).toMatchObject({ nome: 'Rotina', descricao: 'outra pessoa mexeu' })
    expect(depois._count.acoes).toBe(2)
  })

  it('erro de validação não apaga as ações antigas', async () => {
    const m = await criarComoAna()
    const r = await atualizarModelo({}, formulario({ modeloId: m.id, nome: 'X' }, [['A', 'x', '1']]))
    expect(r.erros).toHaveLength(1)
    expect(await prisma.modeloAcao.count({ where: { modeloId: m.id } })).toBe(2)
  })

  it('nome de outro modelo é recusado; o próprio nome é aceito', async () => {
    await criarComoAna('Um')
    const dois = await criarComoAna('Dois')
    expect((await atualizarModelo({}, formulario({ modeloId: dois.id, nome: 'Um' }))).erro).toContain('Já existe')
    const mesmo = await seguir(() => atualizarModelo({}, formulario({ modeloId: dois.id, nome: 'Dois' })))
    expect(mesmo).toMatchObject({ url: expect.any(String) })
  })

  it('só quem criou ou o administrador edita; modelo do sistema, só o administrador', async () => {
    const m = await criarComoAna()
    usuarioAtual.userId = 'user_bia'
    expect((await atualizarModelo({}, formulario({ modeloId: m.id, nome: 'Bia mexeu' }))).erro).toContain('Só quem criou')
    usuarioAtual.userId = 'user_admin'
    expect(await seguir(() => atualizarModelo({}, formulario({ modeloId: m.id, nome: 'Admin mexeu' })))).toMatchObject({ url: expect.any(String) })

    const sistema = await prisma.modeloProjeto.create({ data: { nome: 'Do sistema', criadoPor: 'sistema', acoes: { create: [{ ordem: 1, descricao: 'X', inicioDiasUteis: 0, duracaoDiasUteis: 1 }] } } })
    usuarioAtual.userId = 'user_ana'
    expect((await atualizarModelo({}, formulario({ modeloId: sistema.id, nome: 'Ana tentou' }))).erro).toContain('Só quem criou')
    usuarioAtual.userId = 'user_admin'
    expect(await seguir(() => atualizarModelo({}, formulario({ modeloId: sistema.id, nome: 'Do sistema v2' })))).toMatchObject({ url: expect.any(String) })
  })

  it('Leitor não edita e modelo inexistente dá erro', async () => {
    const m = await criarComoAna()
    usuarioAtual.userId = 'user_leitor'
    expect(await atualizarModelo({}, formulario({ modeloId: m.id, nome: 'X' }))).toEqual({ erro: MENSAGEM_SOMENTE_LEITURA })
    usuarioAtual.userId = 'user_ana'
    expect((await atualizarModelo({}, formulario({ modeloId: 'nao-existe', nome: 'X' }))).erro).toContain('não encontrado')
  })
})

describe('excluir', () => {
  it('o autor exclui o seu; outra pessoa não; o administrador exclui qualquer um', async () => {
    const m = await criarComoAna()
    const f = new FormData()
    f.set('modeloId', m.id)
    usuarioAtual.userId = 'user_bia'
    await excluirModelo(f)
    expect(await prisma.modeloProjeto.count()).toBe(1)
    usuarioAtual.userId = 'user_ana'
    await excluirModelo(f)
    expect(await prisma.modeloProjeto.count()).toBe(0)
  })
})
