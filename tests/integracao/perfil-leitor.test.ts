/**
 * Perfil Leitor contra o banco: a Server Action recusa de verdade (a tela
 * esconder o botão não protege nada), e só administrador define o perfil.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_leitor' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('REDIRECT')
  },
}))
vi.mock('@/lib/enviar-email', () => ({ enviarEmail: async () => ({ enviado: true }) }))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { alternarAdministrador, alternarLeitor } = await import(
  '@/app/colaboradores/acoes-colaborador'
)
const { criarAcao, atualizarAcao, registrarRealizado } = await import('@/app/projetos/acoes-acao')
const { criarProjeto, atualizarProjeto, excluirProjeto } = await import(
  '@/app/projetos/acoes-projeto'
)
const { salvarAvaliacao, salvarPesos } = await import('@/app/priorizacao/acoes-matriz')
const { salvarWin, salvarCard, promoverWin, repetirWin, encerrarWin } = await import(
  '@/app/wins/acoes-win'
)

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let leitor: string
let colaborador: string
let admin: string
let projetoId: string
let acaoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_leitor'
  await prisma.historicoAlteracao.deleteMany()
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  leitor = (
    await prisma.colaborador.create({
      data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true },
    })
  ).id
  colaborador = (
    await prisma.colaborador.create({ data: { nome: 'Colab', clerkUserId: 'user_colab' } })
  ).id
  admin = (
    await prisma.colaborador.create({
      data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true },
    })
  ).id
  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto' } })).id
  acaoId = (
    await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'Ação de partida' } })
  ).id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('leitor não grava', () => {
  it('recusa as ações de projeto e de ação, sem escrever nada', async () => {
    const respostas = [
      await criarProjeto({}, fd({ nome: 'Novo' })),
      await atualizarProjeto({}, fd({ id: projetoId, nome: 'Outro nome' })),
      await criarAcao({}, fd({ id: projetoId, descricao: 'Nova' })),
      await atualizarAcao({}, fd({ id: acaoId, descricao: 'Mudou', status: 'EM_CURSO_50' })),
      await registrarRealizado({}, fd({ id: acaoId, realizadoInicio: '2026-03-02' })),
    ]
    for (const r of respostas) expect(r.erroGeral).toBe(MENSAGEM_SOMENTE_LEITURA)

    expect(await prisma.projeto.count()).toBe(1)
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).nome).toBe(
      'Projeto',
    )
    expect(await prisma.acao.count()).toBe(1)
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: acaoId } })).descricao).toBe(
      'Ação de partida',
    )
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('e a mesma ação, pelo colaborador, é gravada (prova de que a recusa vem do perfil)', async () => {
    usuarioAtual.userId = 'user_colab'
    const r = await atualizarAcao({}, fd({ id: acaoId, descricao: 'Mudou', status: 'EM_CURSO_50' }))
    expect(r.erroGeral).toBeUndefined()
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: acaoId } })).status).toBe('EM_CURSO_50')
  })

  it('recusa a matriz e o Card WIN', async () => {
    const respostas = [
      await salvarAvaliacao({}, fd({ projetoId })),
      await salvarWin({}, fd({ descricao: 'x' })),
      await salvarCard({}, fd({ ano: '2026', semana: '10' })),
      await promoverWin({}, fd({})),
      await repetirWin({}, fd({})),
      await encerrarWin({}, fd({})),
    ]
    for (const r of respostas) expect(r.erroGeral).toBe(MENSAGEM_SOMENTE_LEITURA)
    expect(await prisma.avaliacaoProjeto.count()).toBe(0)
    expect(await prisma.win.count()).toBe(0)
  })

  it('nem administrando: excluir projeto e pesos seguem fechados, mesmo sem administrador', async () => {
    await prisma.colaborador.update({ where: { id: admin }, data: { administrador: false } })

    expect((await excluirProjeto({}, fd({ id: projetoId }))).erroGeral).toBeDefined()
    expect((await salvarPesos({}, fd({}))).erroGeral).toBeDefined()
    expect((await prisma.projeto.findUniqueOrThrow({ where: { id: projetoId } })).ativo).toBe(true)
  })

  it('desativar o leitor não devolve a ele o poder de editar', async () => {
    await prisma.colaborador.update({ where: { id: leitor }, data: { ativo: false } })
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'Nova' }))
    expect(r.erroGeral).toBe(MENSAGEM_SOMENTE_LEITURA)
  })
})

describe('o padrão é Colaborador', () => {
  it('quem não é leitor edita como sempre', async () => {
    usuarioAtual.userId = 'user_colab'
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'Nova ação' }))
    expect(r.erroGeral).toBeUndefined()
    expect(await prisma.acao.count()).toBe(2)
  })

  it('conta sem colaborador cadastrado também edita (a restrição mora no cadastro)', async () => {
    usuarioAtual.userId = 'user_sem_cadastro'
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'Nova ação' }))
    expect(r.erroGeral).toBeUndefined()
  })
})

describe('definir o perfil', () => {
  const tornarLeitor = (id: string) => alternarLeitor({}, fd({ colaboradorId: id, acao: 'tornar-leitor' }))
  const tornarColaborador = (id: string) =>
    alternarLeitor({}, fd({ colaboradorId: id, acao: 'tornar-colaborador' }))

  it('administrador torna leitor e devolve a colaborador', async () => {
    usuarioAtual.userId = 'user_admin'
    expect((await tornarLeitor(colaborador)).aviso).toContain('leitor')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: colaborador } })).somenteLeitura).toBe(true)

    expect((await tornarColaborador(colaborador)).aviso).toContain('colaborador')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: colaborador } })).somenteLeitura).toBe(false)
  })

  it('colaborador e leitor não definem perfil de ninguém', async () => {
    usuarioAtual.userId = 'user_colab'
    expect((await tornarLeitor(admin)).erroGeral).toBeDefined()
    expect((await tornarLeitor(colaborador)).erroGeral).toBeDefined()
    usuarioAtual.userId = 'user_leitor'
    expect((await tornarColaborador(leitor)).erroGeral).toBeDefined()
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: leitor } })).somenteLeitura).toBe(true)
  })

  it('administrador não vira leitor; leitor não é promovido sem voltar a colaborador', async () => {
    usuarioAtual.userId = 'user_admin'
    expect((await tornarLeitor(admin)).erroGeral).toContain('administrador')

    const r = await alternarAdministrador({}, fd({ colaboradorId: leitor, acao: 'promover' }))
    expect(r.erroGeral).toContain('leitor')

    await tornarColaborador(leitor)
    expect((await alternarAdministrador({}, fd({ colaboradorId: leitor, acao: 'promover' }))).aviso).toContain('administrador')
  })

  it('o perfil vale para quem ainda não tem conta ligada', async () => {
    usuarioAtual.userId = 'user_admin'
    const novo = await prisma.colaborador.create({ data: { nome: 'Ainda sem conta' } })
    expect((await tornarLeitor(novo.id)).aviso).toBeDefined()
  })

  it('intenção desconhecida é recusada', async () => {
    usuarioAtual.userId = 'user_admin'
    const r = await alternarLeitor({}, fd({ colaboradorId: colaborador, acao: 'qualquer' }))
    expect(r.erroGeral).toBeDefined()
  })
})
