/**
 * Motivo do replanejamento na edição da ação: pedido só quando uma data
 * prevista que já existia muda; gravado nas linhas de data prevista do histórico.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const usuarioAtual = { userId: 'user_ana' as string | null }

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: usuarioAtual.userId }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/enviar-email', () => ({ enviarEmail: vi.fn(async () => ({ enviado: true })) }))

const { prisma } = await import('@/lib/prisma')
const { atualizarAcao, registrarRealizado } = await import('@/app/projetos/acoes-acao')

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

let acaoId: string
let semDataId: string

beforeEach(async () => {
  usuarioAtual.userId = 'user_ana'
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.colaborador.create({ data: { nome: 'Ana', clerkUserId: 'user_ana' } })
  const projetoId = (await prisma.projeto.create({ data: { nome: 'P' } })).id
  acaoId = (await prisma.acao.create({ data: { projetoId, numero: 1, descricao: 'A', previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-10') } })).id
  semDataId = (await prisma.acao.create({ data: { projetoId, numero: 2, descricao: 'B' } })).id
})

afterAll(async () => {
  await prisma.historicoAlteracao.deleteMany()
  await prisma.acao.deleteMany()
  await prisma.projeto.deleteMany()
  await prisma.colaborador.deleteMany()
  await prisma.$disconnect()
})

const base = (id: string) => ({ id, descricao: 'A', status: 'NAO_INICIADO', previstoInicio: '2026-03-02', previstoTermino: '2026-03-10' })

describe('atualizarAcao e o motivo', () => {
  it('mudar o término previsto sem motivo é recusado e nada é gravado', async () => {
    const r = await atualizarAcao({}, fd({ ...base(acaoId), previstoTermino: '2026-03-20' }))
    expect(r.erros?.motivo).toBe('Informe o motivo da mudança de data.')
    expect((await prisma.acao.findUniqueOrThrow({ where: { id: acaoId } })).previstoTermino?.toISOString().slice(0, 10)).toBe('2026-03-10')
    expect(await prisma.historicoAlteracao.count()).toBe(0)
  })

  it('com motivo, grava a data e o motivo na linha do histórico — e devolve a base nova', async () => {
    const r = await atualizarAcao(
      {},
      fd({ ...base(acaoId), previstoTermino: '2026-03-20', motivoReplanejamento: 'RECURSOS', motivoDetalhe: ' Equipe   reduzida ' }),
    )
    expect(r.salva).toMatchObject({ previstoInicio: '2026-03-02', previstoTermino: '2026-03-20' })
    const h = await prisma.historicoAlteracao.findFirstOrThrow({ where: { campo: 'previstoTermino' } })
    expect(h).toMatchObject({ valorAntigo: '2026-03-10', valorNovo: '2026-03-20', motivo: 'RECURSOS', motivoDetalhe: 'Equipe reduzida' })
  })

  it('"Outro" exige o detalhe', async () => {
    const r = await atualizarAcao({}, fd({ ...base(acaoId), previstoTermino: '2026-03-20', motivoReplanejamento: 'OUTRO' }))
    expect(r.erros?.motivo).toContain('Outro')
  })

  it('motivo desconhecido é recusado', async () => {
    const r = await atualizarAcao({}, fd({ ...base(acaoId), previstoTermino: '2026-03-20', motivoReplanejamento: 'PORQUE_SIM' }))
    expect(r.erros?.motivo).toBeDefined()
  })

  it('preencher uma data que estava vazia NÃO pede motivo e a linha não leva motivo', async () => {
    const r = await atualizarAcao({}, fd({ id: semDataId, descricao: 'B', status: 'NAO_INICIADO', previstoInicio: '2026-04-01', previstoTermino: '2026-04-10' }))
    expect(r.salva).toBeDefined()
    const h = await prisma.historicoAlteracao.findMany({ where: { acaoId: semDataId } })
    expect(h.length).toBe(2)
    expect(h.every((x) => x.motivo === null)).toBe(true)
  })

  it('mexer em outro campo, sem mudar data, não pede motivo; início e término mudando juntos pedem um só', async () => {
    const r1 = await atualizarAcao({}, fd({ ...base(acaoId), status: 'EM_CURSO_25' }))
    expect(r1.salva).toBeDefined()
    const r2 = await atualizarAcao(
      {},
      fd({ ...base(acaoId), status: 'EM_CURSO_25', previstoInicio: '2026-03-09', previstoTermino: '2026-03-17', motivoReplanejamento: 'PRIORIDADE' }),
    )
    expect(r2.salva).toBeDefined()
    const datas = await prisma.historicoAlteracao.findMany({ where: { campo: { in: ['previstoInicio', 'previstoTermino'] } } })
    expect(datas).toHaveLength(2)
    expect(datas.every((x) => x.motivo === 'PRIORIDADE')).toBe(true)
    // O motivo só acompanha as linhas de data: a de status não leva.
    const status = await prisma.historicoAlteracao.findFirstOrThrow({ where: { campo: 'status' } })
    expect(status.motivo).toBeNull()
  })

  it('limpar uma data que existia conta como replanejamento', async () => {
    const r = await atualizarAcao({}, fd({ ...base(acaoId), previstoTermino: '' }))
    expect(r.erros?.motivo).toBeDefined()
  })

  it('apontar realizado não mexe no previsto, então nunca pede motivo', async () => {
    const r = await registrarRealizado({}, fd({ id: acaoId, realizadoInicio: '2026-03-03', realizadoTermino: '' }))
    expect(r.apontada).toBeDefined()
  })
})
