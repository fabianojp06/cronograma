/**
 * O caminho de entrada num banco recém-migrado — exatamente o estado em que a
 * produção ficou depois do merge da fase 1: tabelas criadas, `Colaborador`
 * vazia, e a única coisa capaz de criar um colaborador era o script de
 * importação. Ninguém passava da tela "Quem é você?".
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = {
  userId: 'user_novo' as string | null,
  email: null as string | null,
  falhaAoLerConta: false,
}

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
  currentUser: async () => {
    if (usuarioAtual.falhaAoLerConta) throw new Error('Clerk fora do ar')
    return usuarioAtual.email ? { primaryEmailAddress: { emailAddress: usuarioAtual.email } } : null
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { cadastrarColaborador, salvarWin, vincularColaborador } = await import(
  '@/app/wins/acoes-win'
)
const { periodoDaSemana } = await import('@/lib/semana-ctcea')

function formulario(nome: string) {
  const fd = new FormData()
  fd.set('nome', nome)
  return fd
}

beforeEach(async () => {
  usuarioAtual.userId = 'user_novo'
  usuarioAtual.email = null
  usuarioAtual.falhaAoLerConta = false
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.colaborador.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('banco zerado: a porta de entrada precisa abrir', () => {
  it('cadastra o primeiro colaborador e já vincula a conta', async () => {
    expect(await prisma.colaborador.count()).toBe(0)

    expect(await cadastrarColaborador({}, formulario('Fabiano José'))).toEqual({})

    const criado = await prisma.colaborador.findFirstOrThrow({
      select: { nome: true, clerkUserId: true, ativo: true },
    })
    expect(criado).toEqual({ nome: 'Fabiano José', clerkUserId: 'user_novo', ativo: true })
  })

  it('normaliza os espaços mas preserva acento e caixa', async () => {
    await cadastrarColaborador({}, formulario('  Márcia   Gonçalves '))
    const criado = await prisma.colaborador.findFirstOrThrow({ select: { nome: true } })
    expect(criado.nome).toBe('Márcia Gonçalves')
  })

  it('recusa nome vazio sem criar nada', async () => {
    const r = await cadastrarColaborador({}, formulario('   '))
    expect(r.erroGeral).toBe('Digite seu nome.')
    expect(await prisma.colaborador.count()).toBe(0)
  })
})

describe('nome que o importador já criou', () => {
  it('vincula o cadastro existente em vez de duplicar', async () => {
    // É o que o `scripts/importar-card-win.ts` deixa no banco.
    await prisma.colaborador.create({ data: { nome: 'Fabiano José', area: 'AGP' } })

    expect(await cadastrarColaborador({}, formulario('Fabiano José'))).toEqual({})

    expect(await prisma.colaborador.count()).toBe(1)
    const c = await prisma.colaborador.findFirstOrThrow({
      select: { clerkUserId: true, area: true },
    })
    // A área que veio da planilha continua lá — não foi recriado do zero.
    expect(c).toEqual({ clerkUserId: 'user_novo', area: 'AGP' })
  })

  it('reconhece a pessoa apesar de acento, caixa e espaço a mais', async () => {
    await prisma.colaborador.create({ data: { nome: 'Fabiano José' } })

    // Sem a comparação por chave isto esbarraria no índice único de `nome`
    // e devolveria um erro de banco em vez de reconhecer a pessoa.
    expect(await cadastrarColaborador({}, formulario('fabiano  jose'))).toEqual({})

    expect(await prisma.colaborador.count()).toBe(1)
    const c = await prisma.colaborador.findFirstOrThrow({ select: { nome: true, clerkUserId: true } })
    expect(c.nome).toBe('Fabiano José')
    expect(c.clerkUserId).toBe('user_novo')
  })

  it('avisa quando o nome já pertence a outra conta', async () => {
    await prisma.colaborador.create({
      data: { nome: 'Fabiano José', clerkUserId: 'user_outro' },
    })

    const r = await cadastrarColaborador({}, formulario('Fabiano José'))
    expect(r.erroGeral).toContain('já está vinculado a outra conta')
    expect(await prisma.colaborador.count()).toBe(1)
  })

  it('avisa quando o colaborador está desativado, sem reativar por conta própria', async () => {
    await prisma.colaborador.create({ data: { nome: 'Saiu da equipe', ativo: false } })

    const r = await cadastrarColaborador({}, formulario('Saiu da equipe'))
    expect(r.erroGeral).toContain('desativado')
    const c = await prisma.colaborador.findFirstOrThrow({ select: { ativo: true, clerkUserId: true } })
    expect(c).toEqual({ ativo: false, clerkUserId: null })
  })
})

describe('uma conta só pode ser um colaborador', () => {
  it('não cria um segundo cadastro para quem já está vinculado', async () => {
    await cadastrarColaborador({}, formulario('Fabiano José'))
    expect(await cadastrarColaborador({}, formulario('Outro Nome'))).toEqual({})

    expect(await prisma.colaborador.count()).toBe(1)
    const c = await prisma.colaborador.findFirstOrThrow({ select: { nome: true } })
    expect(c.nome).toBe('Fabiano José')
  })

  it('não cadastra sem sessão', async () => {
    usuarioAtual.userId = null
    const r = await cadastrarColaborador({}, formulario('Qualquer Um'))
    expect(r.erroGeral).toContain('Sessão expirada')
    expect(await prisma.colaborador.count()).toBe(0)
  })
})

describe('a jornada completa de quem chega num sistema zerado', () => {
  it('cadastra o nome e consegue registrar o primeiro WIN', async () => {
    // Era isto que estava bloqueado: sem colaborador não há card, e sem card
    // não há WIN. A pergunta "consigo cadastrar o WIN?" se responde aqui.
    expect(await prisma.colaborador.count()).toBe(0)

    expect(await cadastrarColaborador({}, formulario('Fabiano José'))).toEqual({})

    const semana = { ano: 2026, semana: 39 }
    const fd = new FormData()
    fd.set('ano', String(semana.ano))
    fd.set('semana', String(semana.semana))
    fd.set('ordem', '1')
    fd.set('descricao', 'Fechar o relatório mensal')
    fd.set('status', 'PENDENTE')
    fd.set('prazo', periodoDaSemana(semana).inicio.toISOString().slice(0, 10))

    expect(await salvarWin({}, fd)).toEqual({ salvo: true })

    const registro = await prisma.winSemana.findFirstOrThrow({
      select: {
        ordem: true,
        win: { select: { descricao: true, colaborador: { select: { nome: true } } } },
        card: { select: { ano: true, semana: true } },
      },
    })
    expect(registro.ordem).toBe(1)
    expect(registro.win.descricao).toBe('Fechar o relatório mensal')
    expect(registro.win.colaborador.nome).toBe('Fabiano José')
    expect(registro.card).toEqual(semana)
  })
})

describe('vínculo com colaborador desativado não pode ser silencioso', () => {
  // A página só procura colaborador com `ativo: true`, então quem está
  // vinculado a um desativado cai de novo na tela "Quem é você?". Um retorno
  // silencioso aqui faria o botão não responder nada — o mesmo beco sem saída
  // que estas ações vieram remover.
  it('avisa em vez de não fazer nada ao tentar cadastrar de novo', async () => {
    await prisma.colaborador.create({
      data: { nome: 'Fabiano José', clerkUserId: 'user_novo', ativo: false },
    })

    const r = await cadastrarColaborador({}, formulario('Fabiano José'))
    expect(r.erroGeral).toContain('desativado')
  })

  it('avisa também no caminho de escolher da lista', async () => {
    const { vincularColaborador } = await import('@/app/wins/acoes-win')
    await prisma.colaborador.create({
      data: { nome: 'Fabiano José', clerkUserId: 'user_novo', ativo: false },
    })
    const livre = await prisma.colaborador.create({
      data: { nome: 'Outra Pessoa' },
      select: { id: true },
    })

    const fd = new FormData()
    fd.set('colaboradorId', livre.id)
    const r = await vincularColaborador({}, fd)
    expect(r.erroGeral).toContain('desativado')
    // E não rouba o colaborador livre no caminho.
    const outro = await prisma.colaborador.findUniqueOrThrow({
      where: { id: livre.id },
      select: { clerkUserId: true },
    })
    expect(outro.clerkUserId).toBeNull()
  })

  it('segue em silêncio quando o vínculo está bom — não é erro', async () => {
    await prisma.colaborador.create({
      data: { nome: 'Fabiano José', clerkUserId: 'user_novo' },
    })
    expect(await cadastrarColaborador({}, formulario('Qualquer Nome'))).toEqual({})
  })
})

describe('e-mail vindo da conta do Clerk', () => {
  it('auto-cadastro grava o e-mail da conta, normalizado', async () => {
    usuarioAtual.email = 'Fabiano.Garcia@CTCEA.org.br'
    expect(await cadastrarColaborador({}, formulario('Fabiano José'))).toEqual({})

    const criado = await prisma.colaborador.findFirstOrThrow({ select: { email: true } })
    expect(criado.email).toBe('fabiano.garcia@ctcea.org.br')
  })

  it('reconhecer o cadastro da planilha semeia o e-mail que faltava', async () => {
    await prisma.colaborador.create({ data: { nome: 'Fabiano José' } })
    usuarioAtual.email = 'fabiano@ctcea.org.br'

    expect(await cadastrarColaborador({}, formulario('fabiano jose'))).toEqual({})

    const c = await prisma.colaborador.findFirstOrThrow({
      select: { email: true, clerkUserId: true },
    })
    expect(c).toEqual({ email: 'fabiano@ctcea.org.br', clerkUserId: 'user_novo' })
  })

  // Semeia, não sobrescreve: o e-mail definido em /colaboradores é escolha de
  // alguém, e vincular a conta não pode desfazê-la em silêncio.
  it('vincular não sobrescreve um e-mail já definido', async () => {
    const c = await prisma.colaborador.create({
      data: { nome: 'Ana', email: 'ana.pessoal@ctcea.org.br' },
      select: { id: true },
    })
    usuarioAtual.email = 'ana@ctcea.org.br'

    const fd = new FormData()
    fd.set('colaboradorId', c.id)
    expect(await vincularColaborador({}, fd)).toEqual({})

    const depois = await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })
    expect(depois).toMatchObject({ clerkUserId: 'user_novo', email: 'ana.pessoal@ctcea.org.br' })
  })

  it('vincular preenche o e-mail de quem não tinha', async () => {
    const c = await prisma.colaborador.create({ data: { nome: 'Ana' }, select: { id: true } })
    usuarioAtual.email = 'ana@ctcea.org.br'

    const fd = new FormData()
    fd.set('colaboradorId', c.id)
    expect(await vincularColaborador({}, fd)).toEqual({})

    const depois = await prisma.colaborador.findUniqueOrThrow({ where: { id: c.id } })
    expect(depois.email).toBe('ana@ctcea.org.br')
  })

  // O e-mail é conveniência: se o Clerk falhar, a pessoa ainda precisa entrar.
  it('falha ao ler a conta não impede o cadastro', async () => {
    usuarioAtual.falhaAoLerConta = true
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await cadastrarColaborador({}, formulario('Fabiano José'))).toEqual({})

    const criado = await prisma.colaborador.findFirstOrThrow({
      select: { nome: true, clerkUserId: true, email: true },
    })
    expect(criado).toEqual({ nome: 'Fabiano José', clerkUserId: 'user_novo', email: null })
    vi.restoreAllMocks()
  })
})
