/**
 * Papel de administrador contra o banco.
 *
 * O risco não é a tela esconder o botão — é a Server Action aceitar o pedido de
 * quem não deveria, porque uma Server Action é um POST que qualquer conta
 * autenticada consegue forjar.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_a' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('REDIRECT')
  },
}))

const { prisma } = await import('@/lib/prisma')
const { alternarAdministrador, alternarAtivo, salvarColaborador } = await import(
  '@/app/colaboradores/acoes-colaborador'
)
const { excluirProjeto } = await import('@/app/projetos/acoes-projeto')
const { salvarPesos } = await import('@/app/priorizacao/acoes-matriz')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let ana: string
let bruno: string
let projetoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_a'
  await prisma.historicoAlteracao.deleteMany()
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  ana = (await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_a' } })).id
  bruno = (await prisma.colaborador.create({ data: { nome: 'Bruno', clerkUserId: 'user_b' } })).id
  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto' } })).id
})

afterAll(async () => {
  await prisma.$disconnect()
})

const promover = (id: string) => alternarAdministrador({}, fd({ colaboradorId: id, acao: 'promover' }))
const remover = (id: string) => alternarAdministrador({}, fd({ colaboradorId: id, acao: 'remover' }))

describe('sem nenhum administrador', () => {
  it('qualquer conta administra, como antes do papel existir', async () => {
    usuarioAtual.userId = 'user_b'
    const r = await salvarColaborador({}, fd({ colaboradorId: ana, nome: 'Ana Souza' }))
    expect(r.erroGeral).toBeUndefined()
  })

  it('qualquer conta pode promover a primeira pessoa', async () => {
    usuarioAtual.userId = 'user_b'
    const r = await promover(ana)
    expect(r.aviso).toContain('agora é administrador')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: ana } })).administrador).toBe(true)
  })
})

describe('com administrador definido', () => {
  beforeEach(async () => {
    await prisma.colaborador.update({ where: { id: ana }, data: { administrador: true } })
  })

  it('quem não é administrador não edita colaborador', async () => {
    usuarioAtual.userId = 'user_b'
    const r = await salvarColaborador({}, fd({ colaboradorId: bruno, nome: 'Bruno Lima' }))
    expect(r.erroGeral).toContain('administradores')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: bruno } })).nome).toBe('Bruno')
  })

  it('quem não é administrador não desativa nem promove', async () => {
    usuarioAtual.userId = 'user_b'
    expect((await alternarAtivo({}, fd({ colaboradorId: ana, acao: 'desativar' }))).erroGeral).toContain('administradores')
    expect((await promover(bruno)).erroGeral).toContain('administradores')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: ana } })).ativo).toBe(true)
  })

  it('quem não é administrador não exclui projeto', async () => {
    usuarioAtual.userId = 'user_b'
    const r = await excluirProjeto({}, fd({ id: projetoId, confirmacao: 'EXCLUIR' }))
    expect(r.erroGeral).toContain('administradores')
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).ativo).toBe(true)
  })

  it('quem não é administrador não salva pesos', async () => {
    usuarioAtual.userId = 'user_b'
    const r = await salvarPesos({}, fd({}))
    expect(r.erroGeral).toContain('administradores')
  })

  it('o administrador exclui o projeto', async () => {
    await expect(excluirProjeto({}, fd({ id: projetoId, confirmacao: 'EXCLUIR' }))).rejects.toThrow('REDIRECT')
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).ativo).toBe(false)
  })

  it('o administrador promove outra pessoa, que passa a poder administrar', async () => {
    expect((await promover(bruno)).aviso).toContain('agora é administrador')
    usuarioAtual.userId = 'user_b'
    expect((await salvarColaborador({}, fd({ colaboradorId: ana, nome: 'Ana Souza' }))).erroGeral).toBeUndefined()
  })

  it('não promove colaborador desativado', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { ativo: false } })
    expect((await promover(bruno)).erroGeral).toContain('ativo')
  })

  it('administrador desativado perde o acesso', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { administrador: true } })
    expect((await alternarAtivo({}, fd({ colaboradorId: bruno, acao: 'desativar' }))).erroGeral).toBeUndefined()
    usuarioAtual.userId = 'user_b'
    expect((await salvarColaborador({}, fd({ colaboradorId: ana, nome: 'Ana X' }))).erroGeral).toContain('administradores')
  })
})

describe('o último administrador', () => {
  beforeEach(async () => {
    await prisma.colaborador.update({ where: { id: ana }, data: { administrador: true } })
  })

  it('não pode ser removido', async () => {
    expect((await remover(ana)).erroGeral).toContain('único administrador')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: ana } })).administrador).toBe(true)
  })

  it('não pode ser desativado por outro administrador', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { administrador: true } })
    await prisma.colaborador.update({ where: { id: ana }, data: { administrador: false } })
    usuarioAtual.userId = 'user_b'
    const r = await alternarAtivo({}, fd({ colaboradorId: bruno, acao: 'desativar' }))
    expect(r.erroGeral).toBeDefined()
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: bruno } })).ativo).toBe(true)
  })

  it('pode ser removido quando existe outro', async () => {
    await promover(bruno)
    expect((await remover(ana)).aviso).toContain('deixou de ser administrador')
  })
})
