/**
 * Macroetapas contra o banco: ordem, troca de vizinhas, exclusão que desvincula
 * as ações e grava o histórico, Leitor recusado e isolamento entre projetos.
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
const { criarAcao, atualizarAcao } = await import('@/app/projetos/acoes-acao')
const { duplicarAcao } = await import('@/app/projetos/acoes-duplicar')
const { criarProjeto, atualizarProjeto } = await import('@/app/projetos/acoes-projeto')
const { criarRisco, atualizarRisco } = await import('@/app/projetos/acoes-risco')
const { criarMacroetapa, renomearMacroetapa, reordenarMacroetapa, excluirMacroetapa } = await import(
  '@/app/projetos/acoes-macroetapa'
)

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let outroId: string

async function limpar() {
  await prisma.riscoHistorico.deleteMany()
  await prisma.riscoProjeto.deleteMany()
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.macroetapa.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
}

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await limpar()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede' } })).id
  outroId = (await prisma.projeto.create({ data: { nome: 'Outro' } })).id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

const criar = (nome: string, pid = projetoId) => criarMacroetapa({}, fd({ projetoId: pid, nome }))
const ordenadas = (pid = projetoId) => prisma.macroetapa.findMany({ where: { projetoId: pid }, orderBy: { ordem: 'asc' } })

describe('criarMacroetapa', () => {
  it('numera a ordem 1, 2, ...', async () => {
    expect((await criar('Planejamento')).ok).toBe(true)
    expect((await criar('Execução')).ok).toBe(true)
    expect((await ordenadas()).map((m) => [m.nome, m.ordem])).toEqual([['Planejamento', 1], ['Execução', 2]])
  })

  it('recusa nome repetido sem acento/caixa e a 13ª macroetapa', async () => {
    await criar('Homologação')
    const r = await criar('homologacao')
    expect(r.ok).toBe(false)
    for (let i = 2; i <= 12; i++) await criar(`Etapa ${i}`)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(12)
    expect((await criar('Etapa 13')).ok).toBe(false)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(12)
  })

  it('14 criações simultâneas: exatamente 12 passam, com ordens 1..12 únicas', async () => {
    const r = await Promise.all(Array.from({ length: 14 }, (_, i) => criar(`Etapa ${i + 1}`)))
    expect(r.filter((x) => x.ok)).toHaveLength(12)
    expect((await ordenadas()).map((m) => m.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('criações simultâneas do mesmo nome: só uma grava, a outra recebe a mensagem amigável', async () => {
    const r = await Promise.all([criar('Mesmo'), criar('mesmo'), criar('MESMO')])
    expect(r.filter((x) => x.ok)).toHaveLength(1)
    expect(r.filter((x) => !x.ok).every((x) => /Já existe/.test(x.mensagem ?? ''))).toBe(true)
    expect(await prisma.macroetapa.count({ where: { projetoId } })).toBe(1)
  })

  it('Leitor e sessão ausente são recusados sem gravar', async () => {
    usuarioAtual.userId = 'user_leitor'
    expect(await criar('X')).toEqual({ ok: false, mensagem: MENSAGEM_SOMENTE_LEITURA })
    usuarioAtual.userId = null
    expect((await criar('X')).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(0)
  })

  it('projeto inexistente ou excluído é recusado', async () => {
    expect((await criar('X', 'nao-existe')).ok).toBe(false)
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    expect((await criar('X')).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(0)
  })
})

describe('renomearMacroetapa', () => {
  it('renomeia, inclusive só a caixa do próprio nome', async () => {
    await criar('Homologação')
    const m = (await ordenadas())[0]
    expect((await renomearMacroetapa({}, fd({ projetoId, id: m.id, nome: 'homologação' }))).ok).toBe(true)
    expect((await ordenadas())[0].nome).toBe('homologação')
  })

  it('id de outro projeto não é afetado', async () => {
    await criar('Alvo', outroId)
    const alvo = (await ordenadas(outroId))[0]
    const r = await renomearMacroetapa({}, fd({ projetoId, id: alvo.id, nome: 'Invadido' }))
    expect(r.ok).toBe(false)
    expect((await ordenadas(outroId))[0].nome).toBe('Alvo')
  })

  it('Leitor é recusado', async () => {
    await criar('A')
    const m = (await ordenadas())[0]
    usuarioAtual.userId = 'user_leitor'
    expect((await renomearMacroetapa({}, fd({ projetoId, id: m.id, nome: 'B' }))).ok).toBe(false)
    expect((await ordenadas())[0].nome).toBe('A')
  })
})

describe('reordenarMacroetapa', () => {
  it('sobe e desce trocando a ordem das duas vizinhas', async () => {
    await criar('A'); await criar('B'); await criar('C')
    const [a, b, c] = await ordenadas()
    expect((await reordenarMacroetapa({}, fd({ projetoId, id: b.id, intencao: 'subir' }))).ok).toBe(true)
    expect((await ordenadas()).map((m) => m.nome)).toEqual(['B', 'A', 'C'])
    await reordenarMacroetapa({}, fd({ projetoId, id: a.id, intencao: 'descer' }))
    expect((await ordenadas()).map((m) => m.nome)).toEqual(['B', 'C', 'A'])
    expect(c.id).toBeTruthy()
  })

  it('subir a primeira e descer a última não mudam nada', async () => {
    await criar('A'); await criar('B')
    const [a, b] = await ordenadas()
    await reordenarMacroetapa({}, fd({ projetoId, id: a.id, intencao: 'subir' }))
    await reordenarMacroetapa({}, fd({ projetoId, id: b.id, intencao: 'descer' }))
    expect((await ordenadas()).map((m) => [m.nome, m.ordem])).toEqual([['A', 1], ['B', 2]])
  })

  it('id de outro projeto não é afetado; intenção inválida é recusada', async () => {
    await criar('X', outroId); await criar('Y', outroId)
    const [x] = await ordenadas(outroId)
    expect((await reordenarMacroetapa({}, fd({ projetoId, id: x.id, intencao: 'descer' }))).ok).toBe(false)
    expect((await ordenadas(outroId)).map((m) => m.nome)).toEqual(['X', 'Y'])
    expect((await reordenarMacroetapa({}, fd({ projetoId: outroId, id: x.id, intencao: 'xis' }))).ok).toBe(false)
  })
})

describe('excluirMacroetapa', () => {
  it('desvincula as ações e grava uma linha de histórico por ação', async () => {
    await criar('Homologação')
    const m = (await ordenadas())[0]
    const a1 = await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A', macroetapaId: m.id } })
    const a2 = await prisma.acao.create({ data: { projetoId, numero: 2, descricao: 'B', macroetapaId: m.id } })
    const solta = await prisma.acao.create({ data: { projetoId, numero: 3, descricao: 'C' } })

    const r = await excluirMacroetapa({}, fd({ projetoId, id: m.id }))
    expect(r.ok).toBe(true)
    expect(await prisma.macroetapa.count()).toBe(0)
    expect((await prisma.acao.findMany({ where: { projetoId } })).every((a) => a.macroetapaId === null)).toBe(true)
    const h = await prisma.historicoAlteracao.findMany({ where: { campo: 'macroetapa' } })
    expect(h.map((x) => x.acaoId).sort()).toEqual([a1.id, a2.id].sort())
    expect(h.every((x) => x.valorAntigo === 'Homologação' && (x.valorNovo === null || x.valorNovo === '') && x.alteradoPor === 'user_ana')).toBe(true)
    expect(h.some((x) => x.acaoId === solta.id)).toBe(false)
  })

  it('id de outro projeto não é afetado', async () => {
    await criar('Alvo', outroId)
    const alvo = (await ordenadas(outroId))[0]
    const a = await prisma.acao.create({ data: { projetoId: outroId, numero: 1, descricao: 'A', macroetapaId: alvo.id } })
    const r = await excluirMacroetapa({}, fd({ projetoId, id: alvo.id }))
    expect(r.ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(1)
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: a.id } })).macroetapaId).toBe(alvo.id)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('Leitor é recusado e nada muda', async () => {
    await criar('A')
    const m = (await ordenadas())[0]
    usuarioAtual.userId = 'user_leitor'
    expect((await excluirMacroetapa({}, fd({ projetoId, id: m.id }))).ok).toBe(false)
    expect(await prisma.macroetapa.count()).toBe(1)
  })
})

async function seguir<T>(fn: () => Promise<T>): Promise<{ url: string } | { retorno: T }> {
  try {
    return { retorno: await fn() }
  } catch (erro) {
    const m = erro instanceof Error ? /^REDIRECT:(.*)$/.exec(erro.message) : null
    if (m) return { url: m[1] }
    throw erro
  }
}

describe('macroetapa na ação', () => {
  async function novaAcao(extra: Record<string, string> = {}) {
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'Instalar switches', ...extra }))
    expect(r.criada).toBeDefined()
    return r.criada!.id
  }
  const historico = (acaoId: string) =>
    prisma.historicoAlteracao.findMany({ where: { acaoId, campo: 'macroetapa' }, orderBy: { alteradoEm: 'asc' } })

  it('criar com macroetapa do mesmo projeto grava o vínculo', async () => {
    await criar('Planejamento')
    const [m] = await ordenadas()
    const id = await novaAcao({ macroetapaId: m.id })
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).macroetapaId).toBe(m.id)
  })

  it('criar com macroetapa de OUTRO projeto é recusado e nada é criado', async () => {
    await criar('Alheia', outroId)
    const [alheia] = await ordenadas(outroId)
    const r = await criarAcao({}, fd({ id: projetoId, descricao: 'X', macroetapaId: alheia.id }))
    expect(r.criada).toBeUndefined()
    expect(r.erros?.macroetapaId).toMatch(/macroetapa/i)
    expect(await prisma.acao.count()).toBe(0)
  })

  it('atualizar grava o vínculo e uma linha de histórico com os NOMES antigo/novo', async () => {
    await criar('Planejamento'); await criar('Execução')
    const [a, b] = await ordenadas()
    const id = await novaAcao({ macroetapaId: a.id })
    const atual = await prisma.acao.findUniqueOrThrow({ where: { id } })
    const r = await atualizarAcao({}, fd({ id, descricao: 'Instalar switches', macroetapaId: b.id, versao: atual.updatedAt.toISOString() }))
    expect(r.salva).toBeDefined()
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).macroetapaId).toBe(b.id)
    const h = await historico(id)
    expect(h).toHaveLength(1)
    expect([h[0].valorAntigo, h[0].valorNovo]).toEqual(['Planejamento', 'Execução'])
    expect(h[0].motivo).toBeNull()
  })

  it('tirar a macroetapa (vazio) grava o nome antigo e valor novo nulo', async () => {
    await criar('Planejamento')
    const [a] = await ordenadas()
    const id = await novaAcao({ macroetapaId: a.id })
    await atualizarAcao({}, fd({ id, descricao: 'Instalar switches', macroetapaId: '' }))
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).macroetapaId).toBeNull()
    const h = await historico(id)
    expect([h[0].valorAntigo, h[0].valorNovo]).toEqual(['Planejamento', null])
  })

  it('macroetapa de OUTRO projeto (id forjado) é recusada e nada muda', async () => {
    await criar('Planejamento'); await criar('Alheia', outroId)
    const [a] = await ordenadas()
    const [alheia] = await ordenadas(outroId)
    const id = await novaAcao({ macroetapaId: a.id })
    const r = await atualizarAcao({}, fd({ id, descricao: 'Mudou', macroetapaId: alheia.id }))
    expect(r.erros?.macroetapaId).toMatch(/macroetapa/i)
    const depois = await prisma.acao.findUniqueOrThrow({ where: { id } })
    expect(depois.macroetapaId).toBe(a.id)
    expect(depois.descricao).toBe('Instalar switches')
    expect(await historico(id)).toHaveLength(0)
  })

  it('campo ausente não altera a macroetapa nem grava histórico', async () => {
    await criar('Planejamento')
    const [a] = await ordenadas()
    const id = await novaAcao({ macroetapaId: a.id })
    await atualizarAcao({}, fd({ id, descricao: 'Só a descrição mudou' }))
    expect((await prisma.acao.findUniqueOrThrow({ where: { id } })).macroetapaId).toBe(a.id)
    expect(await historico(id)).toHaveLength(0)
  })

  it('mudar só a macroetapa não pede motivo de replanejamento', async () => {
    await criar('Planejamento'); await criar('Execução')
    const [a, b] = await ordenadas()
    const id = await novaAcao({ macroetapaId: a.id, previstoInicio: '2026-03-02', previstoTermino: '2026-03-06' })
    const r = await atualizarAcao({}, fd({ id, descricao: 'Instalar switches', previstoInicio: '2026-03-02', previstoTermino: '2026-03-06', macroetapaId: b.id }))
    expect(r.salva).toBeDefined()
  })

  it('duplicar a ação mantém a macroetapa', async () => {
    await criar('Planejamento')
    const [a] = await ordenadas()
    const id = await novaAcao({ macroetapaId: a.id })
    await seguir(() => duplicarAcao({}, fd({ id })))
    const copia = await prisma.acao.findFirstOrThrow({ where: { projetoId, NOT: { id } } })
    expect(copia.macroetapaId).toBe(a.id)
  })
})

describe('cliente e objetivo do projeto', () => {
  it('criar persiste e editar só o nome não os apaga (campo ausente)', async () => {
    const r = await criarProjeto({}, fd({ nome: 'Novo', cliente: 'Marinha', objetivo: 'Modernizar' }))
    expect(r.criado).toBeDefined()
    const id = r.criado!.id
    let p = await prisma.projeto.findUniqueOrThrow({ where: { id } })
    expect([p.cliente, p.objetivo]).toEqual(['Marinha', 'Modernizar'])
    const e = await atualizarProjeto({}, fd({ id, nome: 'Novo nome' }))
    expect(e.salvo).toBeDefined()
    p = await prisma.projeto.findUniqueOrThrow({ where: { id } })
    expect([p.nome, p.cliente, p.objetivo]).toEqual(['Novo nome', 'Marinha', 'Modernizar'])
  })

  it('campo vazio remove; texto novo troca', async () => {
    const id = (await criarProjeto({}, fd({ nome: 'P', cliente: 'A', objetivo: 'B' }))).criado!.id
    await atualizarProjeto({}, fd({ id, nome: 'P', cliente: '', objetivo: 'C' }))
    const p = await prisma.projeto.findUniqueOrThrow({ where: { id } })
    expect([p.cliente, p.objetivo]).toEqual([null, 'C'])
  })

  it('cliente acima de 120 caracteres é recusado', async () => {
    const r = await criarProjeto({}, fd({ nome: 'P', cliente: 'x'.repeat(121) }))
    expect(r.erros?.cliente).toBeDefined()
    expect(await prisma.projeto.count({ where: { nome: 'P' } })).toBe(0)
  })
})

describe('risco que pede decisão da diretoria', () => {
  const base = { tipo: 'RISCO', titulo: 'Fornecedor atrasa', impacto: 'ALTO' }

  it('criar com a caixa marcada persiste; pedido = riscoAberto + pedeAjuda', async () => {
    await seguir(() => criarRisco({}, fd({ id: projetoId, ...base, pedeAjudaCampo: '1', pedeAjuda: 'on' })))
    const r = await prisma.riscoProjeto.findFirstOrThrow({ where: { projetoId } })
    expect(r.pedeAjuda).toBe(true)
    const pedidos = await prisma.riscoProjeto.findMany({ where: { projetoId, pedeAjuda: true, status: { in: ['ABERTO', 'EM_TRATAMENTO'] } } })
    expect(pedidos).toHaveLength(1)
  })

  it('caixa desmarcada (campo presente) grava false; campo ausente não mexe', async () => {
    await seguir(() => criarRisco({}, fd({ id: projetoId, ...base, pedeAjudaCampo: '1', pedeAjuda: 'on' })))
    const r = await prisma.riscoProjeto.findFirstOrThrow({ where: { projetoId } })
    // aba antiga: sem o campo, mantém
    await seguir(() => atualizarRisco({}, fd({ id: projetoId, riscoId: r.id, ...base, titulo: 'Outro título' })))
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: r.id } })).pedeAjuda).toBe(true)
    // desmarcou de propósito
    await seguir(() => atualizarRisco({}, fd({ id: projetoId, riscoId: r.id, ...base, pedeAjudaCampo: '1' })))
    expect((await prisma.riscoProjeto.findUniqueOrThrow({ where: { id: r.id } })).pedeAjuda).toBe(false)
  })

  it('sem a caixa na criação o padrão é false', async () => {
    await seguir(() => criarRisco({}, fd({ id: projetoId, ...base, pedeAjudaCampo: '1' })))
    expect((await prisma.riscoProjeto.findFirstOrThrow({ where: { projetoId } })).pedeAjuda).toBe(false)
  })
})
