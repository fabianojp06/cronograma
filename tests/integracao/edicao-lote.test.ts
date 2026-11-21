/**
 * Edição em lote contra o banco: o histórico sai por ação e por campo, a
 * operação é conferida por versão, o Leitor é recusado e nada grava pela metade.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/enviar-email', () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true })),
}))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { previaLote, aplicarLote } = await import('@/app/projetos/acoes-lote')
const { enviarEmail } = await import('@/lib/enviar-email')

function fd(campos: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x)
  return f
}
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null

let projetoId: string
let outroProjetoId: string
let bruno: string
let a1: string, a2: string, a3: string, aConcluida: string, aOutro: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  vi.mocked(enviarEmail).mockClear()
  await prisma.notificacao.deleteMany()
  await prisma.comentarioAcao.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitora', somenteLeitura: true } })
  bruno = (await prisma.colaborador.create({ data: { nome: 'Bruno', email: 'bruno@ctcea.org.br' } })).id
  projetoId = (await prisma.projeto.create({ data: { nome: 'Projeto' } })).id
  outroProjetoId = (await prisma.projeto.create({ data: { nome: 'Outro' } })).id
  const nova = (numero: number, extra: object = {}) =>
    prisma.acao.create({
      data: { projetoId, numero, descricao: `Ação ${numero}`, previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-06'), ...extra },
    })
  a1 = (await nova(1)).id
  a2 = (await nova(2)).id
  a3 = (await nova(3, { previstoInicio: null, previstoTermino: null })).id
  aConcluida = (await nova(4, { status: 'CONCLUIDO' })).id
  aOutro = (await prisma.acao.create({ data: { projetoId: outroProjetoId, numero: 1, descricao: 'Alheia' } })).id
})

afterAll(async () => {
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

async function preVisualizar(campos: Record<string, string | string[]>) {
  const r = await previaLote({}, fd({ id: projetoId, ...campos }))
  return r
}

async function aplicarDaPrevia(campos: Record<string, string | string[]>, extras?: Record<string, string>) {
  const r = await preVisualizar(campos)
  if (!r.previa) throw new Error(r.erro)
  const { previa } = r
  return aplicarLote(
    {},
    fd({
      id: previa.projetoId,
      ids: previa.campos.ids,
      quantidade: previa.campos.quantidade,
      sentido: previa.campos.sentido,
      responsavelId: previa.campos.responsavelId,
      versao: previa.linhas.map((l) => `${l.acaoId}|${l.versao}`),
      ...(extras ?? { motivoReplanejamento: 'ESCOPO' }),
    }),
  )
}

describe('prévia', () => {
  it('mostra o de/para sem gravar nada', async () => {
    const r = await preVisualizar({ ids: [a1, a2], quantidade: '3', sentido: 'adiar' })
    expect(r.previa?.quantasMudam).toBe(2)
    expect(r.previa?.linhas[0].mudancas).toEqual([
      { campo: 'previstoInicio', de: '2026-03-02', para: '2026-03-05' },
      { campo: 'previstoTermino', de: '2026-03-06', para: '2026-03-11' },
    ])
    const a = await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })
    expect(iso(a.previstoTermino)).toBe('2026-03-06')
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('recusa ação de outro projeto, pedido vazio e operação sem efeito', async () => {
    expect((await preVisualizar({ ids: [a1, aOutro], quantidade: '1' })).erro).toMatch(/não é deste projeto|não existe/)
    expect((await preVisualizar({ ids: [a1] })).erro).toMatch(/Escolha o que fazer/)
    expect((await preVisualizar({ ids: [aConcluida, a3], quantidade: '1' })).erro).toMatch(/Nenhuma das ações/)
  })

  it('responsável inativo ou inexistente é recusado', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { ativo: false } })
    expect((await preVisualizar({ ids: [a1], responsavelId: bruno })).erro).toBeDefined()
  })
})

describe('aplicar', () => {
  it('desloca o previsto e grava uma linha de histórico por ação e por campo', async () => {
    const r = await aplicarDaPrevia({ ids: [a1, a2, a3, aConcluida], quantidade: '2', sentido: 'adiar' })
    expect(r.resultado?.gravadas).toBe(2)
    expect(r.resultado?.semMudanca).toBe(2) // sem data prevista e concluída

    const a = await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })
    expect([iso(a.previstoInicio), iso(a.previstoTermino)]).toEqual(['2026-03-04', '2026-03-10'])

    const hist = await prisma.historicoAlteracao.findMany({ orderBy: [{ acaoId: 'asc' }, { campo: 'asc' }] })
    expect(hist).toHaveLength(4)
    expect(hist.every((h) => h.alteradoPor === 'user_ana')).toBe(true)
    const doA1 = hist.filter((h) => h.acaoId === a1)
    expect(doA1.map((h) => [h.campo, h.valorAntigo, h.valorNovo])).toEqual([
      ['previstoInicio', '2026-03-02', '2026-03-04'],
      ['previstoTermino', '2026-03-06', '2026-03-10'],
    ])
    // A concluída não foi tocada.
    const c = await prisma.acao.findUniqueOrThrow({ where: { id: aConcluida } })
    expect(iso(c.previstoTermino)).toBe('2026-03-06')
  })

  it('adiantar anda para trás em dias úteis', async () => {
    await aplicarDaPrevia({ ids: [a1], quantidade: '1', sentido: 'adiantar' })
    const a = await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })
    expect(iso(a.previstoInicio)).toBe('2026-02-27') // segunda - 1 útil = sexta
  })

  it('troca o responsável, grava o NOME no histórico e manda UM e-mail com a lista', async () => {
    const r = await aplicarDaPrevia({ ids: [a1, a2], responsavelId: bruno })
    expect(r.resultado?.gravadas).toBe(2)
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })).responsavelId).toBe(bruno)

    const hist = await prisma.historicoAlteracao.findMany({ where: { campo: 'responsavel' } })
    expect(hist.map((h) => [h.valorAntigo, h.valorNovo])).toEqual([[null, 'Bruno'], [null, 'Bruno']])

    expect(enviarEmail).toHaveBeenCalledTimes(1)
    const [para, mensagem] = vi.mocked(enviarEmail).mock.calls[0]
    expect(para).toBe('bruno@ctcea.org.br')
    expect(mensagem.texto).toContain('Ação 1')
    expect(mensagem.texto).toContain('Ação 2')
    expect(r.resultado?.avisos[0]).toContain('bruno@ctcea.org.br')
  })

  it('remover o responsável não manda e-mail', async () => {
    await prisma.acao.update({ where: { id: a1 }, data: { responsavelId: bruno } })
    await aplicarDaPrevia({ ids: [a1], responsavelId: '__nenhum__' })
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })).responsavelId).toBeNull()
    expect(enviarEmail).not.toHaveBeenCalled()
  })

  it('ação salva por outra pessoa depois da prévia é pulada, as demais gravam, e o histórico é só das gravadas', async () => {
    const r = await preVisualizar({ ids: [a1, a2], quantidade: '1' })
    // Alguém edita a ação 1 depois da prévia.
    await prisma.acao.update({ where: { id: a1 }, data: { descricao: 'Editada por outra pessoa' } })
    const previa = r.previa!
    const res = await aplicarLote(
      {},
      fd({
        id: previa.projetoId,
        ids: previa.campos.ids,
        quantidade: previa.campos.quantidade,
        sentido: previa.campos.sentido,
        responsavelId: previa.campos.responsavelId,
        versao: previa.linhas.map((l) => `${l.acaoId}|${l.versao}`),
        motivoReplanejamento: 'ESCOPO',
      }),
    )
    expect(res.resultado?.gravadas).toBe(1)
    expect(res.resultado?.conflitos).toEqual([{ numero: 1, descricao: 'Editada por outra pessoa' }])
    const a = await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })
    expect(iso(a.previstoTermino)).toBe('2026-03-06') // não sobrescrita
    const hist = await prisma.historicoAlteracao.findMany()
    expect(hist.every((h) => h.acaoId === a2)).toBe(true)
  })

  it('sem a versão da prévia, a ação conflita em vez de gravar às cegas', async () => {
    const res = await aplicarLote({}, fd({ id: projetoId, ids: [a1], quantidade: '1', motivoReplanejamento: 'ESCOPO' }))
    expect(res.resultado?.gravadas).toBe(0)
    expect(res.resultado?.conflitos).toHaveLength(1)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })
})

describe('motivo do replanejamento', () => {
  it('a prévia diz se pede o motivo: só quando alguma data prevista vai mudar', async () => {
    expect((await preVisualizar({ ids: [a1], quantidade: '1' })).previa?.precisaMotivo).toBe(true)
    expect((await preVisualizar({ ids: [a1], responsavelId: bruno })).previa?.precisaMotivo).toBe(false)
  })

  it('sem motivo, o lote que muda data não grava nada', async () => {
    const r = await aplicarDaPrevia({ ids: [a1, a2], quantidade: '2' }, {})
    expect(r.erro).toBe('Informe o motivo da mudança de data.')
    expect(await prisma.historicoAlteracao.count()).toBe(0)
    expect(iso((await prisma.acao.findUniqueOrThrow({ where: { id: a1 } })).previstoTermino)).toBe('2026-03-06')
  })

  it('"Outro" sem detalhe é recusado', async () => {
    const r = await aplicarDaPrevia({ ids: [a1], quantidade: '2' }, { motivoReplanejamento: 'OUTRO' })
    expect(r.erro).toContain('Outro')
  })

  it('com motivo, as linhas de DATA recebem o mesmo motivo e a de responsável não', async () => {
    const r = await aplicarDaPrevia(
      { ids: [a1, a2], quantidade: '2', responsavelId: bruno },
      { motivoReplanejamento: 'DEPENDENCIA_EXTERNA', motivoDetalhe: 'Fornecedor atrasou' },
    )
    expect(r.resultado?.gravadas).toBe(2)
    const hist = await prisma.historicoAlteracao.findMany()
    const datas = hist.filter((h) => h.campo.startsWith('previsto'))
    expect(datas.length).toBe(4)
    expect(datas.every((h) => h.motivo === 'DEPENDENCIA_EXTERNA' && h.motivoDetalhe === 'Fornecedor atrasou')).toBe(true)
    expect(hist.filter((h) => h.campo === 'responsavel').every((h) => h.motivo === null)).toBe(true)
  })

  it('lote só de responsável não pede motivo', async () => {
    const r = await aplicarDaPrevia({ ids: [a1], responsavelId: bruno }, {})
    expect(r.resultado?.gravadas).toBe(1)
  })
})

describe('perfil', () => {
  it('o Leitor é recusado na prévia e na gravação, sem escrever nada', async () => {
    usuarioAtual.userId = 'user_leitora'
    expect((await preVisualizar({ ids: [a1], quantidade: '1' })).erro).toBe(MENSAGEM_SOMENTE_LEITURA)
    const r = await aplicarLote({}, fd({ id: projetoId, ids: [a1], quantidade: '1', versao: `${a1}|2026-01-01T00:00:00.000Z` }))
    expect(r.erro).toBe(MENSAGEM_SOMENTE_LEITURA)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('sem sessão, recusa', async () => {
    usuarioAtual.userId = null
    expect((await preVisualizar({ ids: [a1], quantidade: '1' })).erro).toMatch(/Sessão expirada/)
  })
})
