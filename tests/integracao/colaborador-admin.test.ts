/**
 * Administração de colaboradores contra o banco.
 *
 * O risco desta tela não é renomear — é o que renomear ARRASTA: o nome já foi
 * copiado para `Projeto.responsavel` em toda promoção de WIN, e deixar os dois
 * divergirem parte a pessoa em duas no relatório por responsável.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_admin' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { salvarColaborador, alternarAtivo } = await import(
  '@/app/colaboradores/acoes-colaborador'
)

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

beforeEach(async () => {
  usuarioAtual.userId = 'user_admin'
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('renomear e o plano de ação', () => {
  it('leva o nome novo para os projetos quando pedido', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Fabiano Jose', clerkUserId: 'user_admin' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Fabiano Jose' } })
    await prisma.projeto.create({ data: { nome: 'P2', responsavel: 'Fabiano Jose' } })
    await prisma.projeto.create({ data: { nome: 'P3', responsavel: 'Outra Pessoa' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Fabiano José', propagar: 'sim' }),
    )
    expect(r.aviso).toContain('2 projeto(s)')

    const responsaveis = await prisma.projeto.findMany({
      orderBy: { nome: 'asc' },
      select: { responsavel: true },
    })
    expect(responsaveis.map((p) => p.responsavel)).toEqual([
      'Fabiano José',
      'Fabiano José',
      'Outra Pessoa',
    ])
  })

  it('deixa os projetos como estavam quando NÃO se pede a propagação', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Antigo Nome' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Antigo Nome' } })

    await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'Nome Novo' }))

    const p = await prisma.projeto.findFirstOrThrow({ select: { responsavel: true } })
    expect(p.responsavel).toBe('Antigo Nome')
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { nome: true },
    })
    expect(depois.nome).toBe('Nome Novo')
  })

  it('permite corrigir só o acento — o caso de uso principal', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Marcia Goncalves' },
      select: { id: true },
    })
    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Márcia Gonçalves' }),
    )
    expect(r.erroGeral).toBeUndefined()
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { nome: true },
    })
    expect(depois.nome).toBe('Márcia Gonçalves')
  })

  it('recusa nome que colide com outro, mesmo sem acento', async () => {
    const a = await prisma.colaborador.create({
      data: { nome: 'Fabiano José' },
      select: { id: true },
    })
    await prisma.colaborador.create({ data: { nome: 'Márcia Gonçalves' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: a.id, nome: 'marcia goncalves' }),
    )
    expect(r.erroGeral).toContain('Já existe outro colaborador')
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: a.id },
      select: { nome: true },
    })
    expect(depois.nome).toBe('Fabiano José')
  })

  it('não escreve nada quando o nome e os projetos já estão certos', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Fabiano José' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Fabiano José' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: '  Fabiano   José ', propagar: 'sim' }),
    )
    expect(r.aviso).toContain('Nada a alterar')
  })
})

describe('desativar e reativar', () => {
  it('desativa sem apagar histórico', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Vai sair' },
      select: { id: true },
    })
    const card = await prisma.cardSemanal.create({
      data: { colaboradorId: c.id, ano: 2026, semana: 39 },
      select: { id: true },
    })
    const win = await prisma.win.create({
      data: { colaboradorId: c.id, descricao: 'O que comprometeu' },
      select: { id: true },
    })
    await prisma.winSemana.create({ data: { winId: win.id, cardId: card.id, ordem: 1 } })

    const r = await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'desativar' }))
    expect(r.aviso).toContain('desativado')

    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { ativo: true },
    })
    expect(depois.ativo).toBe(false)
    // O histórico continua inteiro.
    expect(await prisma.cardSemanal.count()).toBe(1)
    expect(await prisma.winSemana.count()).toBe(1)
  })

  it('não solta o vínculo do Clerk ao desativar', async () => {
    // Soltar deixaria a conta se cadastrar de novo com outro nome, e o
    // histórico da pessoa ficaria órfão.
    const c = await prisma.colaborador.create({
      data: { nome: 'Vai sair', clerkUserId: 'user_dela' },
      select: { id: true },
    })
    await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'desativar' }))
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { clerkUserId: true },
    })
    expect(depois.clerkUserId).toBe('user_dela')
  })

  it('recusa desativar a si mesmo', async () => {
    const eu = await prisma.colaborador.create({
      data: { nome: 'Eu Mesmo', clerkUserId: 'user_admin' },
      select: { id: true },
    })
    const r = await alternarAtivo({}, fd({ colaboradorId: eu.id, acao: 'desativar' }))
    expect(r.erroGeral).toContain('não pode desativar a si mesmo')
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: eu.id },
      select: { ativo: true },
    })
    expect(depois.ativo).toBe(true)
  })

  it('reativa devolvendo o acesso como era', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Voltou', clerkUserId: 'user_dela', ativo: false },
      select: { id: true },
    })
    const r = await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'reativar' }))
    expect(r.aviso).toContain('voltou a ficar ativo')
    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { ativo: true, clerkUserId: true },
    })
    expect(depois).toEqual({ ativo: true, clerkUserId: 'user_dela' })
  })

  it('não age sem sessão', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Alguém' },
      select: { id: true },
    })
    usuarioAtual.userId = null
    expect((await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'desativar' }))).erroGeral).toContain(
      'Sessão expirada',
    )
    expect((await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'X Y' }))).erroGeral).toContain(
      'Sessão expirada',
    )
  })
})

describe('propagar não depende de renomear', () => {
  it('alinha os projetos mesmo quando o nome não muda', async () => {
    // Quem desmarcou a caixa uma vez precisa poder voltar e alinhar depois.
    // Antes, a propagação só andava de carona numa mudança de nome, e a
    // divergência ficava sem conserto pela tela.
    const c = await prisma.colaborador.create({
      data: { nome: 'Fabiano José' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Fabiano Jose' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Fabiano José', propagar: 'sim' }),
    )
    expect(r.aviso).toContain('1 projeto(s)')

    const p = await prisma.projeto.findFirstOrThrow({ select: { responsavel: true } })
    expect(p.responsavel).toBe('Fabiano José')
  })

  it('acha a divergência de acento, que um where exato não enxerga', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Márcia Gonçalves' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Marcia Goncalves' } })
    await prisma.projeto.create({ data: { nome: 'P2', responsavel: 'MARCIA GONCALVES' } })
    await prisma.projeto.create({ data: { nome: 'P3', responsavel: 'Outra Pessoa' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Márcia Gonçalves', propagar: 'sim' }),
    )
    expect(r.aviso).toContain('2 projeto(s)')

    const todos = await prisma.projeto.findMany({
      orderBy: { nome: 'asc' },
      select: { responsavel: true },
    })
    expect(todos.map((p) => p.responsavel)).toEqual([
      'Márcia Gonçalves',
      'Márcia Gonçalves',
      'Outra Pessoa',
    ])
  })

  it('alcança projeto excluído logicamente', async () => {
    // Ele pode ser restaurado, e voltaria com a grafia velha.
    const c = await prisma.colaborador.create({
      data: { nome: 'Fabiano José' },
      select: { id: true },
    })
    await prisma.projeto.create({
      data: { nome: 'Arquivado', responsavel: 'Fabiano Jose', ativo: false },
    })

    await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Fabiano José', propagar: 'sim' }),
    )
    const p = await prisma.projeto.findFirstOrThrow({ select: { responsavel: true } })
    expect(p.responsavel).toBe('Fabiano José')
  })

  it('avisa quando não há nada a fazer', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana Silva' },
      select: { id: true },
    })
    await prisma.projeto.create({ data: { nome: 'P1', responsavel: 'Ana Silva' } })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Ana Silva', propagar: 'sim' }),
    )
    expect(r.aviso).toContain('Nada a alterar')
  })
})

describe('a intenção clicada manda, não o estado lido', () => {
  it('desativar num colaborador já desativado avisa, em vez de reativar', async () => {
    // Duas pessoas administrando, ou um POST reenviado: negar o estado lido
    // faria um clique em "Desativar" reativar alguém e relatar o oposto.
    const c = await prisma.colaborador.create({
      data: { nome: 'Já saiu', ativo: false },
      select: { id: true },
    })

    const r = await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'desativar' }))
    expect(r.erroGeral).toContain('já alterou este colaborador')

    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { ativo: true },
    })
    expect(depois.ativo).toBe(false)
  })

  it('reativar num colaborador já ativo avisa, em vez de desativar', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Está ativo' },
      select: { id: true },
    })

    const r = await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'reativar' }))
    expect(r.erroGeral).toContain('já alterou este colaborador')

    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { ativo: true },
    })
    expect(depois.ativo).toBe(true)
  })

  it('recusa intenção ausente ou forjada', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Alguém' },
      select: { id: true },
    })
    expect((await alternarAtivo({}, fd({ colaboradorId: c.id }))).erroGeral).toBeTruthy()
    expect(
      (await alternarAtivo({}, fd({ colaboradorId: c.id, acao: 'apagar' }))).erroGeral,
    ).toBeTruthy()

    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: c.id },
      select: { ativo: true },
    })
    expect(depois.ativo).toBe(true)
  })
})

describe('área do colaborador', () => {
  it('grava a área de quem se cadastrou pela tela e nasceu sem ela', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Fabiano Santos Garcia', clerkUserId: 'user_admin' },
      select: { id: true, area: true },
    })
    expect(c.area).toBeNull()

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Fabiano Santos Garcia', area: 'AGP' }),
    )
    expect(r.erroGeral).toBeUndefined()
    expect(r.aviso).toContain('AGP')

    const depois = await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })
    expect(depois.area).toBe('AGP')
    expect(depois.nome).toBe('Fabiano Santos Garcia')
  })

  it('campo vazio remove a área, em vez de recusar', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', area: 'APD' },
      select: { id: true },
    })

    const r = await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'Ana', area: '' }))
    expect(r.aviso).toContain('Área removida')
    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })).area).toBeNull()
  })

  it('muda nome e área na mesma gravação', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana Souza', area: 'APD' },
      select: { id: true },
    })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Ana Sousa', area: 'ACT' }),
    )
    expect(r.aviso).toContain('Nome alterado')
    expect(r.aviso).toContain('ACT')

    const depois = await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })
    expect(depois).toMatchObject({ nome: 'Ana Sousa', area: 'ACT' })
  })

  /**
   * O ponto que motivou a separação: `Colaborador.area` é o padrão de um card
   * NOVO. Os cards já gravados guardam a área da semana deles, e reescrevê-los
   * apagaria o registro de quem mudou de área no meio do ano.
   */
  it('não reescreve a área dos cards já salvos', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', area: 'APD' },
      select: { id: true },
    })
    await prisma.cardSemanal.create({
      data: { colaboradorId: c.id, ano: 2026, semana: 39, area: 'APD' },
    })

    await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'Ana', area: 'ACT' }))

    const card = await prisma.cardSemanal.findFirstOrThrow({ where: { colaboradorId: c.id } })
    expect(card.area).toBe('APD')
  })

  it('não diz que mudou algo quando nada mudou', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', area: 'APD' },
      select: { id: true },
    })

    const r = await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'Ana', area: 'APD' }))
    expect(r.aviso).toContain('Nada a alterar')
  })

  /**
   * Um formulário sem o campo `area` não pode significar "apague a área". Se
   * significasse, qualquer chamada antiga — uma aba aberta antes desta versão —
   * limparia a área de quem veio da planilha, em silêncio.
   */
  it('formulário sem o campo area não apaga a área existente', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', area: 'APD' },
      select: { id: true },
    })

    await salvarColaborador({}, fd({ colaboradorId: c.id, nome: 'Ana' }))

    expect((await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })).area).toBe('APD')
  })

  it('recusa área acima do limite sem tocar no nome', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', area: 'APD' },
      select: { id: true },
    })

    const r = await salvarColaborador(
      {},
      fd({ colaboradorId: c.id, nome: 'Ana Nova', area: 'a'.repeat(121) }),
    )
    expect(r.erroGeral).toContain('área')

    const depois = await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })
    expect(depois).toMatchObject({ nome: 'Ana', area: 'APD' })
  })
})
