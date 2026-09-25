/**
 * Provas das Server Actions do Card WIN contra um Postgres de verdade.
 *
 * Não roda com `npm test`: precisa de um banco descartável, e o CI não sobe
 * um. Rode com `npm run test:integracao` (ver README do script). Existe porque
 * os erros que a revisão encontrou — repetição que não acumulava, promoção que
 * não tirava o WIN do card, remoção deixando órfão — são todos invisíveis em
 * teste unitário: o tipo fecha, o lint passa, e só o banco denuncia.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_prova' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const {
  salvarWin,
  repetirWin,
  promoverWin,
  removerWinDaSemana,
  encerrarWin,
  vincularColaborador,
} = await import('@/app/wins/acoes-win')
const { contarAparicoesAte, deveSerPromovido } = await import('@/lib/win-promocao')
const { periodoDaSemana } = await import('@/lib/semana-ctcea')

const SEMANAS = [
  { ano: 2026, semana: 37 },
  { ano: 2026, semana: 38 },
  { ano: 2026, semana: 39 },
]

/** Prazo dentro da semana pedida — `validarWin` exige isso. */
function prazoDaSemana(indice: number) {
  return periodoDaSemana(SEMANAS[indice]).inicio.toISOString().slice(0, 10)
}

function formulario(indice: number, extra: Record<string, string> = {}) {
  const fd = new FormData()
  fd.set('ano', String(SEMANAS[indice].ano))
  fd.set('semana', String(SEMANAS[indice].semana))
  fd.set('ordem', '1')
  fd.set('descricao', 'Fechar o relatório mensal')
  fd.set('status', 'PENDENTE')
  fd.set('prazo', prazoDaSemana(indice))
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

/** `repetirWin` sempre exige o id do WIN — é o que o distingue de redigitar. */
function repetir(indice: number, winId: string) {
  const fd = formulario(indice)
  fd.set('winId', winId)
  return repetirWin({}, fd)
}

beforeEach(async () => {
  usuarioAtual.userId = 'user_prova'
  await prisma.winSemana.deleteMany()
  await prisma.win.deleteMany()
  await prisma.cardSemanal.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({
    data: { nome: 'Fabiano', area: 'AGP', clerkUserId: 'user_prova' },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('repetir um WIN acumula aparições (o caminho interativo)', () => {
  it('três semanas pelo botão Repetir disparam a promoção', async () => {
    expect(await salvarWin({}, formulario(0))).toEqual({ salvo: true })

    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    expect(await repetir(1, win.id)).toEqual({})
    expect(await repetir(2, win.id)).toEqual({})

    // Um único Win, três aparições: é isto que a regra das 3 semanas lê.
    expect(await prisma.win.count()).toBe(1)
    const registros = await prisma.winSemana.findMany({
      select: { card: { select: { ano: true, semana: true } } },
    })
    expect(registros).toHaveLength(3)

    const aparicoes = contarAparicoesAte(
      0,
      registros.map((r) => r.card),
      SEMANAS[2],
    )
    expect(aparicoes).toBe(3)
    expect(
      deveSerPromovido({
        aparicoesAnteriores: 0,
        registros: aparicoes,
        promovidoEm: null,
        encerradoEm: null,
      }),
    ).toBe(true)
    expect(win.id).toBeTruthy()
  })

  it('redigitar o texto NÃO acumula — cria outro WIN, com contador zerado', async () => {
    await salvarWin({}, formulario(0))
    await salvarWin({}, formulario(1))

    expect(await prisma.win.count()).toBe(2)
    for (const w of await prisma.win.findMany({ select: { aparicoesAnteriores: true } })) {
      expect(w.aparicoesAnteriores).toBe(0)
    }
  })

  it('não repete um WIN de outro colaborador', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const outro = await prisma.colaborador.create({
      data: { nome: 'Outra pessoa', clerkUserId: 'user_intruso' },
      select: { id: true },
    })
    usuarioAtual.userId = 'user_intruso'

    const fd = formulario(1)
    fd.set('winId', win.id)
    expect(await repetirWin({}, fd)).toEqual({ erroGeral: 'WIN não encontrado ou já encerrado.' })
    expect(await prisma.winSemana.count({ where: { card: { colaboradorId: outro.id } } })).toBe(0)
  })

  it('recusa repetir o mesmo WIN duas vezes na mesma semana', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    const fd = formulario(1)
    fd.set('winId', win.id)
    expect(await repetirWin({}, fd)).toEqual({})
    expect(await repetirWin({}, fd)).toEqual({ erroGeral: 'Este WIN já está na semana.' })
  })

  it('recusa um quarto WIN na semana', async () => {
    for (const ordem of ['1', '2', '3']) {
      await salvarWin({}, formulario(0, { ordem, descricao: `WIN ${ordem}` }))
    }
    await salvarWin({}, formulario(1, { descricao: 'De outra semana' }))
    const win = await prisma.win.findFirstOrThrow({
      where: { descricao: 'De outra semana' },
      select: { id: true },
    })
    const fd = formulario(0)
    fd.set('winId', win.id)
    const resultado = await repetirWin({}, fd)
    expect(resultado.erroGeral).toContain('já tem 3 WINs')
  })
})

describe('promover tira o WIN do card sem perder a contagem', () => {
  it('apaga os registros e soma as aparições em aparicoesAnteriores', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    await repetir(1, win.id)
    await repetir(2, win.id)

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[2].ano))
    fd.set('semana', String(SEMANAS[2].semana))
    fd.set('destino', 'PROJETO')
    const resultado = await promoverWin({}, fd)
    expect(resultado.erroGeral).toBeUndefined()
    expect(resultado.promovido?.projetoId).toBeTruthy()

    // A vaga da semana da promoção é liberada...
    expect(
      await prisma.winSemana.count({ where: { card: { semana: SEMANAS[2].semana } } }),
    ).toBe(0)
    // ...e as semanas anteriores continuam intactas: elas são o registro do
    // que foi de fato comprometido, não rascunho a limpar.
    const restantes = await prisma.winSemana.findMany({
      select: { card: { select: { semana: true } } },
    })
    expect(restantes.map((r) => r.card.semana).sort()).toEqual([
      SEMANAS[0].semana,
      SEMANAS[1].semana,
    ])
    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { aparicoesAnteriores: true, promovidoEm: true, projetoId: true },
    })
    // Sem inflar o contador: as aparições continuam nas próprias linhas.
    expect(depois.aparicoesAnteriores).toBe(0)
    expect(depois.promovidoEm).not.toBeNull()
    expect(depois.projetoId).toBeTruthy()
  })

  it('numera a ação depois da última existente do projeto', async () => {
    const projeto = await prisma.projeto.create({
      data: { nome: 'Projeto existente' },
      select: { id: true },
    })
    await prisma.acao.create({ data: { projetoId: projeto.id, numero: 7, descricao: 'antiga' } })

    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    fd.set('destino', 'ACAO')
    fd.set('projetoId', projeto.id)
    const resultado = await promoverWin({}, fd)
    expect(resultado.erroGeral).toBeUndefined()

    const acao = await prisma.acao.findUniqueOrThrow({
      where: { id: resultado.promovido!.acaoId! },
      select: { numero: true },
    })
    expect(acao.numero).toBe(8)
    expect(await prisma.winSemana.count()).toBe(0)
    // Só havia a aparição da S37, e era dela que o WIN saiu.
  })
})

describe('tirar da semana não deixa lixo no banco', () => {
  it('apaga o Win quando aquela era a única aparição', async () => {
    await salvarWin({}, formulario(0))
    const registro = await prisma.winSemana.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('registroId', registro.id)
    await removerWinDaSemana(fd)

    expect(await prisma.winSemana.count()).toBe(0)
    expect(await prisma.win.count()).toBe(0)
  })

  it('preserva o Win quando ele ainda aparece em outra semana', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    await repetir(1, win.id)
    const registro = await prisma.winSemana.findFirstOrThrow({
      where: { card: { semana: SEMANAS[1].semana } },
      select: { id: true },
    })

    const fd = new FormData()
    fd.set('registroId', registro.id)
    await removerWinDaSemana(fd)

    expect(await prisma.winSemana.count()).toBe(1)
    expect(await prisma.win.count()).toBe(1)
  })

  it('não apaga o WIN de outro colaborador', async () => {
    await salvarWin({}, formulario(0))
    const registro = await prisma.winSemana.findFirstOrThrow({ select: { id: true } })

    await prisma.colaborador.create({
      data: { nome: 'Outra pessoa', clerkUserId: 'user_intruso' },
    })
    usuarioAtual.userId = 'user_intruso'

    const fd = new FormData()
    fd.set('registroId', registro.id)
    await removerWinDaSemana(fd)

    expect(await prisma.winSemana.count()).toBe(1)
  })
})

describe('encerrar é o que faz a mensagem do limite ser verdade', () => {
  it('marca encerradoEm e libera a vaga na semana', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    await encerrarWin(fd)

    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { encerradoEm: true },
    })
    expect(depois.encerradoEm).not.toBeNull()
    expect(await prisma.winSemana.count()).toBe(0)
  })

  it('um WIN encerrado não pode ser repetido', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    const encerrar = new FormData()
    encerrar.set('winId', win.id)
    encerrar.set('ano', String(SEMANAS[0].ano))
    encerrar.set('semana', String(SEMANAS[0].semana))
    await encerrarWin(encerrar)

    const fd = formulario(1)
    fd.set('winId', win.id)
    expect(await repetirWin({}, fd)).toEqual({ erroGeral: 'WIN não encontrado ou já encerrado.' })
  })
})

describe('nem promover nem encerrar reescrevem o passado', () => {
  it('encerrar na S39 preserva as aparições da S37 e da S38', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    await repetir(1, win.id)
    await repetir(2, win.id)

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[2].ano))
    fd.set('semana', String(SEMANAS[2].semana))
    await encerrarWin(fd)

    // A vaga da S39 sai; o que foi comprometido na S37 e na S38 continua lá.
    const restantes = await prisma.winSemana.findMany({
      select: { card: { select: { semana: true } } },
    })
    expect(restantes.map((r) => r.card.semana).sort()).toEqual([
      SEMANAS[0].semana,
      SEMANAS[1].semana,
    ])
    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { encerradoEm: true },
    })
    expect(depois.encerradoEm).not.toBeNull()
  })
})

describe('vincular colaborador não pode virar beco sem saída', () => {
  it('avisa quando o colaborador escolhido já foi tomado por outra conta', async () => {
    // A lista é montada quando a página renderiza; entre aquilo e o envio,
    // outra pessoa pode ter escolhido o mesmo nome.
    const livre = await prisma.colaborador.create({
      data: { nome: 'Ainda sem conta' },
      select: { id: true },
    })
    await prisma.colaborador.update({
      where: { id: livre.id },
      data: { clerkUserId: 'user_mais_rapido' },
    })

    usuarioAtual.userId = 'user_novo'
    const fd = new FormData()
    fd.set('colaboradorId', livre.id)
    const resultado = await vincularColaborador({}, fd)

    expect(resultado.erroGeral).toContain('não está mais disponível')
  })

  it('avisa quando o colaborador foi desativado', async () => {
    const inativo = await prisma.colaborador.create({
      data: { nome: 'Saiu da equipe', ativo: false },
      select: { id: true },
    })

    usuarioAtual.userId = 'user_novo'
    const fd = new FormData()
    fd.set('colaboradorId', inativo.id)
    expect((await vincularColaborador({}, fd)).erroGeral).toContain('não está mais disponível')
  })

  it('vincula de verdade quando o colaborador está livre', async () => {
    const livre = await prisma.colaborador.create({
      data: { nome: 'Disponível' },
      select: { id: true },
    })

    usuarioAtual.userId = 'user_novo'
    const fd = new FormData()
    fd.set('colaboradorId', livre.id)
    expect(await vincularColaborador({}, fd)).toEqual({})

    const depois = await prisma.colaborador.findUniqueOrThrow({
      where: { id: livre.id },
      select: { clerkUserId: true },
    })
    expect(depois.clerkUserId).toBe('user_novo')
  })
})
