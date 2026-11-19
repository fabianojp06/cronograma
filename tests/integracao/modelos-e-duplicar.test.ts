/**
 * Modelos de projeto e duplicação de ação contra o banco: salvar como modelo
 * guarda datas relativas e não guarda pessoas; criar do modelo posiciona as
 * datas e é atômico; só quem salvou (ou o administrador) exclui; duplicar não
 * carrega o andamento.
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
vi.mock('@/lib/enviar-email', () => ({
  enviarEmail: vi.fn(async () => ({ enviado: true })),
}))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { salvarComoModelo, criarProjetoDeModelo, excluirModelo } = await import('@/app/modelos/acoes-modelo')
const { duplicarAcao } = await import('@/app/projetos/acoes-duplicar')
const { enviarEmail } = await import('@/lib/enviar-email')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null

/** As Server Actions terminam em `redirect`, que aqui é uma exceção com a URL. */
async function seguir<T>(fn: () => Promise<T>): Promise<{ url: string } | { retorno: T }> {
  try {
    return { retorno: await fn() }
  } catch (erro) {
    const m = /^REDIRECT:(.+)$/.exec((erro as Error).message)
    if (!m) throw erro
    return { url: m[1] }
  }
}

let projetoId: string
let bruno: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  vi.mocked(enviarEmail).mockClear()
  await prisma.modeloProjeto.deleteMany()
  await prisma.notificacao.deleteMany()
  await prisma.comentarioAcao.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitora', somenteLeitura: true } })
  await prisma.colaborador.create({ data: { nome: 'Outro', clerkUserId: 'user_outro' } })
  await prisma.colaborador.create({ data: { nome: 'Admin', clerkUserId: 'user_admin', administrador: true } })
  bruno = (await prisma.colaborador.create({ data: { nome: 'Bruno', email: 'bruno@ctcea.org.br' } })).id
  projetoId = (
    await prisma.projeto.create({
      data: { nome: 'Fechamento 2026', equipe: 'GRH', natureza: 'Rotina', categoria: 'Folha', responsavel: 'Ana', apoio: 'Bruno' },
    })
  ).id
  await prisma.acao.createMany({
    data: [
      { projetoId, numero: 1, descricao: 'Coletar ponto', previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-06'), status: 'CONCLUIDO', realizadoInicio: d('2026-03-02'), realizadoTermino: d('2026-03-06'), responsavelId: bruno },
      { projetoId, numero: 2, descricao: 'Calcular folha', previstoInicio: d('2026-03-09'), previstoTermino: d('2026-03-13'), status: 'EM_CURSO_50', responsavelId: bruno },
      { projetoId, numero: 3, descricao: 'Sem data', previstoInicio: null, previstoTermino: null },
    ],
  })
})

afterAll(async () => {
  await prisma.modeloProjeto.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

async function salvar(nome = 'Modelo de fechamento') {
  const r = await seguir(() => salvarComoModelo({}, fd({ id: projetoId, nome, descricao: 'Rotina mensal' })))
  return r
}

describe('salvar como modelo', () => {
  it('guarda a classificação e as ações com datas relativas, sem pessoas nem andamento', async () => {
    const r = await salvar()
    expect('url' in r && r.url).toMatch(/^\/modelos\?salvo=/)

    const m = await prisma.modeloProjeto.findFirstOrThrow({ include: { acoes: { orderBy: { ordem: 'asc' } } } })
    expect([m.nome, m.equipe, m.natureza, m.categoria, m.apoio, m.criadoPor]).toEqual([
      'Modelo de fechamento', 'GRH', 'Rotina', 'Folha', 'Bruno', 'user_ana',
    ])
    expect(m.acoes.map((a) => [a.ordem, a.descricao, a.inicioDiasUteis, a.duracaoDiasUteis])).toEqual([
      [1, 'Coletar ponto', 0, 5],
      [2, 'Calcular folha', 5, 5],
      [3, 'Sem data', null, null],
    ])
    // O projeto de origem não mudou.
    expect(await prisma.acao.count({ where: { projetoId } })).toBe(3)
  })

  it('recusa nome repetido, projeto sem ações e perfil Leitor', async () => {
    await salvar()
    const repetido = await seguir(() => salvarComoModelo({}, fd({ id: projetoId, nome: 'Modelo de fechamento' })))
    expect('retorno' in repetido && repetido.retorno.erro).toMatch(/Já existe/)

    const vazio = await prisma.projeto.create({ data: { nome: 'Vazio' } })
    const semAcoes = await seguir(() => salvarComoModelo({}, fd({ id: vazio.id, nome: 'Outro' })))
    expect('retorno' in semAcoes && semAcoes.retorno.erro).toMatch(/não tem ações/)

    usuarioAtual.userId = 'user_leitora'
    const leitor = await seguir(() => salvarComoModelo({}, fd({ id: projetoId, nome: 'Do leitor' })))
    expect('retorno' in leitor && leitor.retorno.erro).toBe(MENSAGEM_SOMENTE_LEITURA)
    expect(await prisma.modeloProjeto.count()).toBe(1)
  })
})

describe('criar projeto a partir do modelo', () => {
  it('cria o projeto e as ações com as datas posicionadas, numeradas, sem responsável nem andamento', async () => {
    await salvar()
    const modelo = await prisma.modeloProjeto.findFirstOrThrow()

    const r = await seguir(() =>
      criarProjetoDeModelo({}, fd({ modeloId: modelo.id, nome: 'Fechamento 2027', inicio: '2027-01-04', equipe: 'GRH', responsavel: 'Carla' })),
    )
    const url = 'url' in r ? r.url : ''
    expect(url).toMatch(/^\/projetos\//)

    const novo = await prisma.projeto.findFirstOrThrow({
      where: { nome: 'Fechamento 2027' },
      include: { acoes: { orderBy: { numero: 'asc' } } },
    })
    expect(url).toBe(`/projetos/${novo.id}`)
    expect([novo.equipe, novo.responsavel]).toEqual(['GRH', 'Carla'])
    expect(novo.acoes.map((a) => [a.numero, a.descricao, iso(a.previstoInicio), iso(a.previstoTermino), a.status, a.responsavelId])).toEqual([
      [1, 'Coletar ponto', '2027-01-04', '2027-01-08', 'NAO_INICIADO', null],
      [2, 'Calcular folha', '2027-01-11', '2027-01-15', 'NAO_INICIADO', null],
      [3, 'Sem data', null, null, 'NAO_INICIADO', null],
    ])
    expect(novo.acoes.every((a) => a.realizadoInicio === null && a.realizadoTermino === null)).toBe(true)
  })

  it('exige nome e data de início válidos, e não cria nada com erro', async () => {
    await salvar()
    const modelo = await prisma.modeloProjeto.findFirstOrThrow()
    const antes = await prisma.projeto.count()

    const sem = await seguir(() => criarProjetoDeModelo({}, fd({ modeloId: modelo.id, nome: '', inicio: '' })))
    const e = 'retorno' in sem ? sem.retorno.erros : undefined
    expect(e?.nome).toBeDefined()
    expect(e?.inicio).toMatch(/Informe/)

    const invalida = await seguir(() => criarProjetoDeModelo({}, fd({ modeloId: modelo.id, nome: 'X', inicio: '2027-02-31' })))
    expect('retorno' in invalida && invalida.retorno.erros?.inicio).toMatch(/inválida/)
    expect(await prisma.projeto.count()).toBe(antes)
  })

  it('modelo excluído e perfil Leitor são recusados', async () => {
    const sumiu = await seguir(() => criarProjetoDeModelo({}, fd({ modeloId: 'nao-existe', nome: 'X', inicio: '2027-01-04' })))
    expect('retorno' in sumiu && sumiu.retorno.erroGeral).toMatch(/não encontrado/)
    usuarioAtual.userId = 'user_leitora'
    const leitor = await seguir(() => criarProjetoDeModelo({}, fd({ modeloId: 'x', nome: 'X', inicio: '2027-01-04' })))
    expect('retorno' in leitor && leitor.retorno.erroGeral).toBe(MENSAGEM_SOMENTE_LEITURA)
  })
})

describe('excluir modelo', () => {
  it('quem salvou exclui; outra pessoa não; administrador sim; o Leitor não', async () => {
    await salvar()
    const { id } = await prisma.modeloProjeto.findFirstOrThrow()

    usuarioAtual.userId = 'user_outro'
    await excluirModelo(fd({ modeloId: id }))
    expect(await prisma.modeloProjeto.count()).toBe(1)

    usuarioAtual.userId = 'user_leitora'
    await excluirModelo(fd({ modeloId: id }))
    expect(await prisma.modeloProjeto.count()).toBe(1)

    usuarioAtual.userId = 'user_admin'
    await excluirModelo(fd({ modeloId: id }))
    expect(await prisma.modeloProjeto.count()).toBe(0)
    expect(await prisma.modeloAcao.count()).toBe(0) // cascata
  })

  it('o autor exclui o seu, e os projetos já criados com ele não mudam', async () => {
    await salvar()
    const modelo = await prisma.modeloProjeto.findFirstOrThrow()
    await seguir(() => criarProjetoDeModelo({}, fd({ modeloId: modelo.id, nome: 'Filho', inicio: '2027-01-04' })))
    await excluirModelo(fd({ modeloId: modelo.id }))
    expect(await prisma.modeloProjeto.count()).toBe(0)
    expect(await prisma.acao.count({ where: { projeto: { nome: 'Filho' } } })).toBe(3)
  })
})

describe('duplicar ação', () => {
  it('copia descrição, previsto e responsável; zera status e realizado; numera no fim; avisa o responsável', async () => {
    const original = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 1 } })
    const r = await seguir(() => duplicarAcao({}, fd({ id: original.id })))
    const copia = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 4 } })
    expect('url' in r && r.url).toBe(`/projetos/${projetoId}/acoes/${copia.id}/editar`)

    expect(copia).toMatchObject({ descricao: 'Coletar ponto (cópia)', status: 'NAO_INICIADO', responsavelId: bruno })
    expect([iso(copia.previstoInicio), iso(copia.previstoTermino)]).toEqual(['2026-03-02', '2026-03-06'])
    expect([copia.realizadoInicio, copia.realizadoTermino]).toEqual([null, null])
    // A original (concluída) não foi tocada, e a cópia não herda histórico.
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: original.id } })).status).toBe('CONCLUIDO')
    expect(await prisma.historicoAlteracao.count({ where: { acaoId: copia.id } })).toBe(0)
    expect(enviarEmail).toHaveBeenCalledTimes(1)
  })

  it('responsável desativado não é copiado, e duplicar a cópia não empilha o sufixo', async () => {
    await prisma.colaborador.update({ where: { id: bruno }, data: { ativo: false } })
    const original = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 2 } })
    await seguir(() => duplicarAcao({}, fd({ id: original.id })))
    const c1 = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 4 } })
    expect(c1.responsavelId).toBeNull()
    expect(enviarEmail).not.toHaveBeenCalled()

    await seguir(() => duplicarAcao({}, fd({ id: c1.id })))
    const c2 = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 5 } })
    expect(c2.descricao).toBe('Calcular folha (cópia)')
  })

  it('Leitor e projeto excluído são recusados', async () => {
    const original = await prisma.acao.findFirstOrThrow({ where: { projetoId, numero: 1 } })
    usuarioAtual.userId = 'user_leitora'
    const leitor = await seguir(() => duplicarAcao({}, fd({ id: original.id })))
    expect('retorno' in leitor && leitor.retorno.erro).toBe(MENSAGEM_SOMENTE_LEITURA)

    usuarioAtual.userId = 'user_ana'
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    const excluido = await seguir(() => duplicarAcao({}, fd({ id: original.id })))
    expect('retorno' in excluido && excluido.retorno.erro).toMatch(/excluído/)
    expect(await prisma.acao.count({ where: { projetoId } })).toBe(3)
  })
})
