/**
 * Responsável pela ação contra o banco.
 *
 * O que o teste unitário não alcança: a relação com `Colaborador`, o nome que
 * vai para `HistoricoAlteracao` vindo de uma consulta, e a regra de que só
 * colaborador ativo pode ser escolhido — exceto o que a ação já tem.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'user_prova' }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

// O envio real nunca roda em teste: as chamadas ficam registradas aqui, e o
// resultado devolvido é controlado caso a caso.
const envio = vi.hoisted(() => ({
  chamadas: [] as { para: string; assunto: string; texto: string }[],
  resultado: { enviado: true } as { enviado: true } | { enviado: false; motivo: string },
}))
vi.mock('@/lib/enviar-email', () => ({
  enviarEmail: async (para: string, mensagem: { assunto: string; texto: string }) => {
    envio.chamadas.push({ para, assunto: mensagem.assunto, texto: mensagem.texto })
    return envio.resultado
  },
}))

const { prisma } = await import('@/lib/prisma')
const { criarAcao, atualizarAcao, registrarRealizado } = await import(
  '@/app/projetos/acoes-acao'
)

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let ana: string
let marcia: string

beforeEach(async () => {
  envio.chamadas = []
  envio.resultado = { enviado: true }
  await prisma.historicoAlteracao.deleteMany()
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()

  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto de prova' } })).id
  ana = (await prisma.colaborador.create({ data: { nome: 'Ana Souza' } })).id
  marcia = (await prisma.colaborador.create({ data: { nome: 'Márcia Gonçalves' } })).id
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function criar(campos: Record<string, string> = {}) {
  const r = await criarAcao({}, fd({ id: projetoId, descricao: 'Levantar inventário', ...campos }))
  expect(r.erros).toBeUndefined()
  expect(r.erroGeral).toBeUndefined()
  return r.criada!.id
}

/** Os campos que o formulário de edição manda, como estão no banco. */
function edicao(acaoId: string, campos: Record<string, string>) {
  return fd({ id: acaoId, descricao: 'Levantar inventário', status: 'NAO_INICIADO', ...campos })
}

describe('criar ação com responsável', () => {
  it('grava o responsável escolhido', async () => {
    const id = await criar({ responsavelId: ana })
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(ana)
  })

  it('aceita criar sem responsável', async () => {
    const id = await criar({ responsavelId: '' })
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBeNull()
  })

  it('recusa colaborador desativado, sem criar a ação', async () => {
    await prisma.colaborador.update({ where: { id: ana }, data: { ativo: false } })

    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'X', responsavelId: ana }))
    expect(r.erros?.responsavelId).toContain('colaborador ativo')
    expect(await prisma.acao.count()).toBe(0)
  })

  it('recusa id que não existe (POST forjado), sem criar a ação', async () => {
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'X', responsavelId: 'nao-existe' }))
    expect(r.erros?.responsavelId).toBeDefined()
    expect(await prisma.acao.count()).toBe(0)
  })
})

describe('trocar o responsável', () => {
  it('troca e registra os NOMES no histórico', async () => {
    const id = await criar({ responsavelId: ana })

    const r = await atualizarAcao({}, edicao(id, { responsavelId: marcia }))
    expect(r.salva).toBeDefined()

    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(marcia)
    const historico = await prisma.historicoAlteracao.findMany({ where: { acaoId: id } })
    expect(historico).toEqual([
      expect.objectContaining({
        campo: 'responsavel',
        valorAntigo: 'Ana Souza',
        valorNovo: 'Márcia Gonçalves',
        alteradoPor: 'user_prova',
      }),
    ])
  })

  it('tirar o responsável também vai para o histórico', async () => {
    const id = await criar({ responsavelId: ana })

    await atualizarAcao({}, edicao(id, { responsavelId: '' }))

    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBeNull()
    const [linha] = await prisma.historicoAlteracao.findMany({ where: { acaoId: id } })
    expect(linha).toMatchObject({ campo: 'responsavel', valorAntigo: 'Ana Souza', valorNovo: null })
  })

  it('salvar sem trocar o responsável não gera histórico', async () => {
    const id = await criar({ responsavelId: ana })

    await atualizarAcao({}, edicao(id, { responsavelId: ana }))

    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  // Uma aba aberta antes desta versão não manda o campo.
  it('formulário sem o campo não apaga o responsável', async () => {
    const id = await criar({ responsavelId: ana })

    await atualizarAcao({}, edicao(id, { status: 'EM_CURSO_25' }))

    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(ana)
    const historico = await prisma.historicoAlteracao.findMany({ where: { acaoId: id } })
    expect(historico.map((h) => h.campo)).toEqual(['status'])
  })

  /**
   * A pessoa foi desativada DEPOIS de virar responsável. Editar outra coisa na
   * ação reenvia o mesmo id; recusar isso travaria a ação inteira, e apagar o
   * responsável em silêncio reescreveria quem respondia por ela.
   */
  it('mantém o responsável desativado ao editar outro campo', async () => {
    const id = await criar({ responsavelId: ana })
    await prisma.colaborador.update({ where: { id: ana }, data: { ativo: false } })

    const r = await atualizarAcao({}, edicao(id, { responsavelId: ana, status: 'EM_CURSO_50' }))
    expect(r.erros).toBeUndefined()
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(ana)
  })

  it('recusa TROCAR para um colaborador desativado', async () => {
    const id = await criar({ responsavelId: ana })
    await prisma.colaborador.update({ where: { id: marcia }, data: { ativo: false } })

    const r = await atualizarAcao({}, edicao(id, { responsavelId: marcia }))
    expect(r.erros?.responsavelId).toBeDefined()
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(ana)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('o apontamento de realizado não mexe no responsável', async () => {
    const id = await criar({ responsavelId: ana })

    const r = await registrarRealizado({}, fd({ id, realizadoInicio: '2026-03-02' }))
    expect(r.erros).toBeUndefined()

    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).responsavelId).toBe(ana)
    const campos = (await prisma.historicoAlteracao.findMany({ where: { acaoId: id } })).map(
      (h) => h.campo,
    )
    expect(campos).not.toContain('responsavel')
  })
})

describe('aviso por e-mail ao responsável', () => {
  beforeEach(async () => {
    await prisma.colaborador.update({ where: { id: ana }, data: { email: 'ana@ctcea.org.br' } })
  })

  it('avisa ao criar a ação com responsável', async () => {
    const r = await criarAcao(
      {},
      fd({ id: projetoId, descricao: 'Levantar inventário', responsavelId: ana }),
    )

    expect(envio.chamadas).toHaveLength(1)
    expect(envio.chamadas[0]).toMatchObject({ para: 'ana@ctcea.org.br' })
    expect(envio.chamadas[0].assunto).toContain('Projeto de prova')
    expect(envio.chamadas[0].texto).toContain('Uma nova ação foi cadastrada')
    expect(envio.chamadas[0].texto).toContain('Levantar inventário')
    expect(r.aviso).toBe('Aviso enviado para ana@ctcea.org.br.')
  })

  it('não envia a quem não tem e-mail, e diz isso', async () => {
    const r = await criarAcao(
      {},
      fd({ id: projetoId, descricao: 'X', responsavelId: marcia }),
    )
    expect(envio.chamadas).toHaveLength(0)
    expect(r.aviso).toContain('Márcia Gonçalves não tem e-mail cadastrado')
  })

  it('ação sem responsável não avisa ninguém', async () => {
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'X', responsavelId: '' }))
    expect(envio.chamadas).toHaveLength(0)
    expect(r.aviso).toBeUndefined()
  })

  it('avisa quem PASSOU a ser responsável na edição', async () => {
    await prisma.colaborador.update({ where: { id: marcia }, data: { email: 'marcia@ctcea.org.br' } })
    const id = await criar({ responsavelId: ana })
    envio.chamadas = []

    const r = await atualizarAcao({}, edicao(id, { responsavelId: marcia }))

    expect(envio.chamadas).toHaveLength(1)
    expect(envio.chamadas[0]).toMatchObject({ para: 'marcia@ctcea.org.br' })
    expect(envio.chamadas[0].texto).toContain('Você passou a ser o responsável')
    expect(r.aviso).toBe('Aviso enviado para marcia@ctcea.org.br.')
  })

  it('salvar de novo com a mesma pessoa não reenvia', async () => {
    const id = await criar({ responsavelId: ana })
    envio.chamadas = []

    const r = await atualizarAcao({}, edicao(id, { responsavelId: ana, status: 'EM_CURSO_25' }))

    expect(envio.chamadas).toHaveLength(0)
    expect(r.aviso).toBeUndefined()
  })

  it('tirar o responsável não avisa ninguém', async () => {
    const id = await criar({ responsavelId: ana })
    envio.chamadas = []

    await atualizarAcao({}, edicao(id, { responsavelId: '' }))
    expect(envio.chamadas).toHaveLength(0)
  })

  // O aviso é consequência de salvar, não condição.
  it('falha no envio não desfaz a ação, e a tela é avisada', async () => {
    envio.resultado = { enviado: false, motivo: 'FALHA_NO_ENVIO' }

    const r = await criarAcao(
      {},
      fd({ id: projetoId, descricao: 'Levantar inventário', responsavelId: ana }),
    )

    expect(r.criada).toBeDefined()
    expect(await prisma.acao.count()).toBe(1)
    expect(r.aviso).toContain('Não foi possível enviar o aviso')
  })
})
