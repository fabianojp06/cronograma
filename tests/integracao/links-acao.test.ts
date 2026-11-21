/**
 * Links de apoio da ação contra o banco: adicionar, editar e remover gravam o
 * histórico; só http/https; Leitor não mexe; projeto excluído não recebe.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const { prisma } = await import('@/lib/prisma')
const { MENSAGEM_SOMENTE_LEITURA } = await import('@/lib/administracao')
const { adicionarLink, atualizarLink, removerLink } = await import('@/app/projetos/acoes-link')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

let projetoId: string
let acaoId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  await prisma.colaborador.create({ data: { nome: 'Leitora', clerkUserId: 'user_leitor', somenteLeitura: true } })
  projetoId = (await prisma.projeto.create({ data: { nome: 'Rede' } })).id
  acaoId = (await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A' } })).id
})

afterAll(async () => {
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const novo = (extra: Record<string, string> = {}) =>
  adicionarLink({}, fd({ id: acaoId, titulo: 'Ata do kickoff', url: 'https://ctcea.sharepoint.com/ata.pdf', tipo: 'ATA', ...extra }))

describe('adicionarLink', () => {
  it('grava o link e uma linha de histórico com quem fez', async () => {
    const r = await novo()
    expect(r.feitoEm).toBeTypeOf('number')
    expect(await prisma.linkAcao.findFirstOrThrow()).toMatchObject({ acaoId, titulo: 'Ata do kickoff', tipo: 'ATA', criadoPor: 'user_ana', url: 'https://ctcea.sharepoint.com/ata.pdf' })
    const h = await prisma.historicoAlteracao.findFirstOrThrow({ where: { campo: 'link' } })
    expect([h.valorAntigo, h.valorNovo, h.alteradoPor]).toEqual([null, 'Ata: Ata do kickoff (ctcea.sharepoint.com)', 'user_ana'])
  })

  it('recusa endereço perigoso ou incompleto, sem gravar nada', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ctcea.sharepoint.com/a', '']) {
      const r = await novo({ url })
      expect(r.erros?.url, url).toBeDefined()
    }
    expect((await novo({ titulo: '' })).erros?.titulo).toBeDefined()
    expect(await prisma.linkAcao.count()).toBe(0)
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('Leitor, sessão ausente, ação inexistente e projeto excluído são recusados', async () => {
    usuarioAtual.userId = 'user_leitor'
    expect(await novo()).toEqual({ erro: MENSAGEM_SOMENTE_LEITURA })
    usuarioAtual.userId = null
    expect((await novo()).erro).toMatch(/Sessão expirada/)
    usuarioAtual.userId = 'user_ana'
    expect((await adicionarLink({}, fd({ id: 'nao-existe', titulo: 'T', url: 'https://x.com' }))).erro).toContain('não encontrada')
    await prisma.projeto.update({ where: { id: projetoId }, data: { ativo: false } })
    expect((await novo()).erro).toContain('excluído')
    expect(await prisma.linkAcao.count()).toBe(0)
  })
})

describe('atualizarLink e removerLink', () => {
  it('editar grava o antes e o depois no histórico; sem mudança, não grava', async () => {
    await novo()
    const l = await prisma.linkAcao.findFirstOrThrow()
    await prisma.historicoAlteracao.deleteMany()

    expect((await atualizarLink({}, fd({ linkId: l.id, titulo: 'Ata do kickoff', url: l.url, tipo: 'ATA' }))).feitoEm).toBeTypeOf('number')
    expect(await prisma.historicoAlteracao.count()).toBe(0)

    await atualizarLink({}, fd({ linkId: l.id, titulo: 'Contrato assinado', url: 'https://drive.google.com/x', tipo: 'CONTRATO' }))
    expect(await prisma.linkAcao.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ titulo: 'Contrato assinado', tipo: 'CONTRATO', url: 'https://drive.google.com/x' })
    const h = await prisma.historicoAlteracao.findFirstOrThrow({ where: { campo: 'link' } })
    expect([h.valorAntigo, h.valorNovo]).toEqual(['Ata: Ata do kickoff (ctcea.sharepoint.com)', 'Contrato: Contrato assinado (drive.google.com)'])
  })

  it('editar com dado inválido não altera o link', async () => {
    await novo()
    const l = await prisma.linkAcao.findFirstOrThrow()
    const r = await atualizarLink({}, fd({ linkId: l.id, titulo: 'X', url: 'javascript:1', tipo: 'ATA' }))
    expect(r.erros?.url).toBeDefined()
    expect((await prisma.linkAcao.findUniqueOrThrow({ where: { id: l.id } })).url).toBe('https://ctcea.sharepoint.com/ata.pdf')
  })

  it('remover apaga o link e registra; apagar a ação leva os links', async () => {
    await novo()
    await novo({ titulo: 'Planilha', url: 'https://x.com/p', tipo: 'PLANILHA' })
    const [a] = await prisma.linkAcao.findMany({ orderBy: { criadoEm: 'asc' } })
    await removerLink(fd({ linkId: a.id }))
    expect(await prisma.linkAcao.count()).toBe(1)
    const h = await prisma.historicoAlteracao.findMany({ where: { campo: 'link', valorNovo: null } })
    expect(h.map((x) => x.valorAntigo)).toEqual(['Ata: Ata do kickoff (ctcea.sharepoint.com)'])

    usuarioAtual.userId = 'user_leitor'
    const [b] = await prisma.linkAcao.findMany()
    await removerLink(fd({ linkId: b.id }))
    expect(await prisma.linkAcao.count()).toBe(1)

    await prisma.acao.delete({ where: { id: acaoId } })
    expect(await prisma.linkAcao.count()).toBe(0)
  })
})
