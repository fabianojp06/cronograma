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
  // O vínculo tenta semear o e-mail da conta; aqui a conta não tem e-mail.
  currentUser: async () => null,
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { DesfechoWin } = await import('@/generated/prisma/enums')
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

    // A vaga da semana da promoção é liberada pelo DESFECHO, não pelo sumiço
    // da linha: ela continua no banco registrando que aquela semana aconteceu.
    const daSemanaDaPromocao = await prisma.winSemana.findMany({
      where: { card: { semana: SEMANAS[2].semana } },
      select: { desfecho: true },
    })
    expect(daSemanaDaPromocao).toEqual([{ desfecho: DesfechoWin.PROMOVIDO }])
    expect(
      await prisma.winSemana.count({
        where: { card: { semana: SEMANAS[2].semana }, desfecho: DesfechoWin.NO_CARD },
      }),
    ).toBe(0)

    // E as três aparições continuam todas no banco — é o que faz o relatório
    // de recorrência contar certo.
    const todas = await prisma.winSemana.findMany({
      select: { card: { select: { semana: true } }, desfecho: true },
    })
    expect(todas.map((r) => r.card.semana).sort()).toEqual([
      SEMANAS[0].semana,
      SEMANAS[1].semana,
      SEMANAS[2].semana,
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
    // Só havia a aparição da S37: ela vive, marcada como promovida.
    expect(
      await prisma.winSemana.count({ where: { desfecho: DesfechoWin.NO_CARD } }),
    ).toBe(0)
    expect(await prisma.winSemana.count()).toBe(1)
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
    fd.set('desfecho', 'CONCLUI')
    expect(await encerrarWin({}, fd)).toEqual({})

    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { encerradoEm: true },
    })
    expect(depois.encerradoEm).not.toBeNull()
    // A vaga sai, a história fica — e o desfecho escolhido virou status.
    const linha = await prisma.winSemana.findFirstOrThrow({
      select: { desfecho: true, status: true },
    })
    expect(linha).toEqual({ desfecho: DesfechoWin.ENCERRADO, status: 'FEITO' })
  })

  it('um WIN encerrado não pode ser repetido', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    const encerrar = new FormData()
    encerrar.set('winId', win.id)
    encerrar.set('ano', String(SEMANAS[0].ano))
    encerrar.set('semana', String(SEMANAS[0].semana))
    encerrar.set('desfecho', 'ABANDONEI')
    expect(await encerrarWin({}, encerrar)).toEqual({})

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
    fd.set('desfecho', 'CONCLUI')
    expect(await encerrarWin({}, fd)).toEqual({})

    // A vaga da S39 sai; o que foi comprometido na S37 e na S38 continua lá.
    // A S39 sai do card; S37 e S38 continuam como estavam.
    const porSemana = await prisma.winSemana.findMany({
      select: { card: { select: { semana: true } }, desfecho: true },
      orderBy: { card: { semana: 'asc' } },
    })
    expect(porSemana).toEqual([
      { card: { semana: SEMANAS[0].semana }, desfecho: DesfechoWin.NO_CARD },
      { card: { semana: SEMANAS[1].semana }, desfecho: DesfechoWin.NO_CARD },
      { card: { semana: SEMANAS[2].semana }, desfecho: DesfechoWin.ENCERRADO },
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

describe('o desfecho libera a vaga sem apagar a história', () => {
  it('depois de promover, a MESMA posição aceita um WIN novo', async () => {
    // É o risco central da migration: se a ocupação contasse as linhas que já
    // saíram do card, a posição ficaria presa para sempre. O índice único
    // parcial é quem permite as duas linhas convivendo na ordem 1.
    await salvarWin({}, formulario(0, { descricao: 'O que saiu' }))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const promover = new FormData()
    promover.set('winId', win.id)
    promover.set('ano', String(SEMANAS[0].ano))
    promover.set('semana', String(SEMANAS[0].semana))
    promover.set('destino', 'PROJETO')
    expect((await promoverWin({}, promover)).erroGeral).toBeUndefined()

    expect(
      await salvarWin({}, formulario(0, { ordem: '1', descricao: 'O que entrou' })),
    ).toEqual({ salvo: true })

    const naOrdem1 = await prisma.winSemana.findMany({
      where: { ordem: 1 },
      select: { desfecho: true, win: { select: { descricao: true } } },
      orderBy: { desfecho: 'asc' },
    })
    expect(naOrdem1).toHaveLength(2)
    expect(naOrdem1.map((r) => r.win.descricao).sort()).toEqual([
      'O que entrou',
      'O que saiu',
    ])
  })

  it('o limite de 3 não conta as linhas que já saíram do card', async () => {
    for (const ordem of ['1', '2', '3']) {
      await salvarWin({}, formulario(0, { ordem, descricao: `WIN ${ordem}` }))
    }
    const primeiro = await prisma.win.findFirstOrThrow({
      where: { descricao: 'WIN 1' },
      select: { id: true },
    })

    const encerrar = new FormData()
    encerrar.set('winId', primeiro.id)
    encerrar.set('ano', String(SEMANAS[0].ano))
    encerrar.set('semana', String(SEMANAS[0].semana))
    encerrar.set('desfecho', 'CONCLUI')
    expect(await encerrarWin({}, encerrar)).toEqual({})

    // A vaga 1 voltou a existir, embora haja 3 linhas no card.
    expect(await prisma.winSemana.count()).toBe(3)
    expect(
      await salvarWin({}, formulario(0, { ordem: '1', descricao: 'Substituto' })),
    ).toEqual({ salvo: true })
    expect(await prisma.winSemana.count()).toBe(4)
  })

  it('um WIN encerrado é barrado antes mesmo da guarda do card', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const encerrar = new FormData()
    encerrar.set('winId', win.id)
    encerrar.set('ano', String(SEMANAS[0].ano))
    encerrar.set('semana', String(SEMANAS[0].semana))
    encerrar.set('desfecho', 'ABANDONEI')
    await encerrarWin({}, encerrar)

    const fd = formulario(0)
    fd.set('winId', win.id)
    expect((await repetirWin({}, fd)).erroGeral).toContain('já encerrado')
  })

  it('a guarda de duplicata enxerga as linhas que já saíram do card', async () => {
    // `@@unique([cardId, winId])` vale para TODAS as linhas, não só as
    // NO_CARD. Hoje `repetirWin` barra antes, pelos marcadores do próprio
    // `Win` — mas se a guarda do card olhasse só as NO_CARD, bastaria existir
    // um caminho de desfazer promoção para isto virar um P2002 cru.
    //
    // O estado é montado direto no banco justamente porque nenhuma ação o
    // produz hoje: é a guarda defensiva que está sendo exercitada.
    await salvarWin({}, formulario(0))
    const registro = await prisma.winSemana.findFirstOrThrow({
      select: { id: true, winId: true },
    })
    await prisma.winSemana.update({
      where: { id: registro.id },
      data: { desfecho: DesfechoWin.PROMOVIDO },
    })

    const fd = formulario(0)
    fd.set('winId', registro.winId)
    const r = await repetirWin({}, fd)

    expect(r.erroGeral).toContain('não volta')
    // E nada foi gravado: continua só a linha original.
    expect(await prisma.winSemana.count()).toBe(1)
  })
})

describe('encerrar exige saber como terminou', () => {
  it('recusa desfecho ausente, sem deixar o WIN meio encerrado', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    const r = await encerrarWin({}, fd)

    expect(r.erroGeral).toContain('concluído ou abandonado')
    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { encerradoEm: true },
    })
    expect(depois.encerradoEm).toBeNull()
    expect(
      await prisma.winSemana.count({ where: { desfecho: DesfechoWin.NO_CARD } }),
    ).toBe(1)
  })

  it('recusa desfecho forjado', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    fd.set('desfecho', 'APAGUE_TUDO')
    expect((await encerrarWin({}, fd)).erroGeral).toContain('concluído ou abandonado')
    expect(await prisma.winSemana.count()).toBe(1)
  })

  it('ABANDONEI grava NAO_FEITO', async () => {
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })

    const fd = new FormData()
    fd.set('winId', win.id)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    fd.set('desfecho', 'ABANDONEI')
    await encerrarWin({}, fd)

    const linha = await prisma.winSemana.findFirstOrThrow({ select: { status: true } })
    expect(linha.status).toBe('NAO_FEITO')
  })
})

describe('as garantias que só existem em SQL', () => {
  /**
   * O índice único parcial e a CHECK de `ordem` vivem na migration, não no
   * datamodel do Prisma — ele não expressa nenhum dos dois. Estes testes
   * existem para que perdê-los seja BARULHENTO: um `prisma migrate dev` que
   * gere um DROP para o índice tiraria em silêncio a camada de banco do limite
   * de 3 WINs, e tudo continuaria compilando.
   */
  it('o índice único parcial existe, e é parcial', async () => {
    const [{ indexdef }] = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'WinSemana' AND indexname = 'WinSemana_cardId_ordem_no_card'`,
    )
    expect(indexdef).toContain('UNIQUE')
    expect(indexdef).toContain("WHERE (desfecho = 'NO_CARD'")
  })

  it('a CHECK de ordem continua barrando posições fora de 1 a 3', async () => {
    const colaborador = await prisma.colaborador.create({
      data: { nome: 'Teste CHECK' },
      select: { id: true },
    })
    const card = await prisma.cardSemanal.create({
      data: { colaboradorId: colaborador.id, ano: 2026, semana: 39 },
      select: { id: true },
    })
    const win = await prisma.win.create({
      data: { colaboradorId: colaborador.id, descricao: 'Fora da faixa' },
      select: { id: true },
    })

    await expect(
      prisma.winSemana.create({ data: { winId: win.id, cardId: card.id, ordem: 4 } }),
    ).rejects.toThrow()
    await expect(
      prisma.winSemana.create({ data: { winId: win.id, cardId: card.id, ordem: 0 } }),
    ).rejects.toThrow()
  })
})

describe('a aba velha não reescreve o que já saiu do card', () => {
  /**
   * Todos estes partem do mesmo cenário: alguém tem a página aberta, promove ou
   * encerra o WIN por outro caminho (ou outra pessoa o faz), e depois clica num
   * botão que a aba antiga ainda mostra. O `desfecho` tem de ser consultado em
   * TODA ação que age sobre uma aparição — foi introduzir o conceito e não
   * aplicá-lo em quatro lugares que a revisão pegou.
   */
  async function winPromovido() {
    await salvarWin({}, formulario(0))
    const registro = await prisma.winSemana.findFirstOrThrow({
      select: { id: true, winId: true },
    })
    const fd = new FormData()
    fd.set('winId', registro.winId)
    fd.set('ano', String(SEMANAS[0].ano))
    fd.set('semana', String(SEMANAS[0].semana))
    fd.set('destino', 'PROJETO')
    await promoverWin({}, fd)
    return registro
  }

  it('"Tirar da semana" não apaga uma aparição já promovida', async () => {
    const registro = await winPromovido()

    const fd = new FormData()
    fd.set('registroId', registro.id)
    await removerWinDaSemana(fd)

    // A linha promovida continua lá — é o histórico que os relatórios leem.
    const depois = await prisma.winSemana.findUniqueOrThrow({
      where: { id: registro.id },
      select: { desfecho: true },
    })
    expect(depois.desfecho).toBe(DesfechoWin.PROMOVIDO)
  })

  it('tirar a última aparição de um WIN ENCERRADO não apaga o Win', async () => {
    await salvarWin({}, formulario(0))
    const registro = await prisma.winSemana.findFirstOrThrow({
      select: { id: true, winId: true },
    })
    const encerrar = new FormData()
    encerrar.set('winId', registro.winId)
    encerrar.set('ano', String(SEMANAS[0].ano))
    encerrar.set('semana', String(SEMANAS[0].semana))
    encerrar.set('desfecho', 'CONCLUI')
    await encerrarWin({}, encerrar)

    // Força o estado que a varredura de órfãos olharia: sem aparição nenhuma.
    await prisma.winSemana.delete({ where: { id: registro.id } })
    await prisma.win.deleteMany({
      where: {
        id: registro.winId,
        registros: { none: {} },
        promovidoEm: null,
        encerradoEm: null,
        aparicoesAnteriores: 0,
      },
    })

    // O `Win` sobrevive: ele registra que a pessoa chegou a encerrá-lo.
    expect(await prisma.win.count({ where: { id: registro.winId } })).toBe(1)
  })

  it('o formulário antigo não reescreve um WIN que já foi promovido', async () => {
    const registro = await winPromovido()

    const fd = formulario(0, { descricao: 'Texto de uma aba velha' })
    fd.set('registroId', registro.id)
    const r = await salvarWin({}, fd)

    expect(r.erroGeral).toContain('já saiu do card')
    const win = await prisma.win.findUniqueOrThrow({
      where: { id: registro.winId },
      select: { descricao: true },
    })
    expect(win.descricao).toBe('Fechar o relatório mensal')
  })

  it('um WIN já encerrado não pode ser encerrado de novo por outra semana', async () => {
    // Encerrar na S38 deixa a aparição da S37 ainda NO_CARD; sem a guarda,
    // daria para encerrar por ali e sobrescrever `encerradoEm`.
    await salvarWin({}, formulario(0))
    const win = await prisma.win.findFirstOrThrow({ select: { id: true } })
    await repetir(1, win.id)

    const primeiro = new FormData()
    primeiro.set('winId', win.id)
    primeiro.set('ano', String(SEMANAS[1].ano))
    primeiro.set('semana', String(SEMANAS[1].semana))
    primeiro.set('desfecho', 'CONCLUI')
    expect(await encerrarWin({}, primeiro)).toEqual({})

    const encerradoEm = (
      await prisma.win.findUniqueOrThrow({
        where: { id: win.id },
        select: { encerradoEm: true },
      })
    ).encerradoEm

    const segundo = new FormData()
    segundo.set('winId', win.id)
    segundo.set('ano', String(SEMANAS[0].ano))
    segundo.set('semana', String(SEMANAS[0].semana))
    segundo.set('desfecho', 'ABANDONEI')
    expect((await encerrarWin({}, segundo)).erroGeral).toContain('já promovido ou encerrado')

    const depois = await prisma.win.findUniqueOrThrow({
      where: { id: win.id },
      select: { encerradoEm: true },
    })
    expect(depois.encerradoEm).toEqual(encerradoEm)
    // E a S37 continua no card, intocada.
    const s37 = await prisma.winSemana.findFirstOrThrow({
      where: { card: { semana: SEMANAS[0].semana } },
      select: { desfecho: true, status: true },
    })
    expect(s37).toEqual({ desfecho: DesfechoWin.NO_CARD, status: 'PENDENTE' })
  })
})
