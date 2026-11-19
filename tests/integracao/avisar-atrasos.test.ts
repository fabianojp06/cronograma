/**
 * Aviso de ações atrasadas contra o banco: quem entra na consulta e quem recebe.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
const { avisarAtrasos } = await import('@/lib/avisar-atrasos')

const AGORA = new Date('2026-11-16T11:00:00Z')
const PASSADO = new Date('2026-11-05T00:00:00Z')
const FUTURO = new Date('2026-12-05T00:00:00Z')

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
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function projeto(ativo = true) {
  return prisma.projeto.create({ data: { nome: 'Portal', ativo } })
}

describe('avisarAtrasos', () => {
  it('manda um e-mail por pessoa, com todas as ações atrasadas dela', async () => {
    const ana = await prisma.colaborador.create({ data: { nome: 'Ana', email: 'ana@x.br' } })
    const p = await projeto()
    await prisma.acao.createMany({
      data: [
        { projetoId: p.id, numero: 1, descricao: 'Um', previstoTermino: PASSADO, responsavelId: ana.id },
        { projetoId: p.id, numero: 2, descricao: 'Dois', previstoTermino: PASSADO, responsavelId: ana.id },
      ],
    })

    const resumo = await avisarAtrasos(AGORA)

    expect(resumo).toMatchObject({ destinatarios: 1, enviados: 1, falhas: 0 })
    expect(envio.chamadas).toHaveLength(1)
    expect(envio.chamadas[0].para).toBe('ana@x.br')
    expect(envio.chamadas[0].assunto).toContain('2 ações atrasadas')
  })

  it('não cita concluída, no prazo, com realizado nem de projeto excluído', async () => {
    const ana = await prisma.colaborador.create({ data: { nome: 'Ana', email: 'ana@x.br' } })
    const p = await projeto()
    const excluido = await projeto(false)
    await prisma.acao.createMany({
      data: [
        { projetoId: p.id, numero: 1, descricao: 'Concluída', status: 'CONCLUIDO', previstoTermino: PASSADO, responsavelId: ana.id },
        { projetoId: p.id, numero: 2, descricao: 'No prazo', previstoTermino: FUTURO, responsavelId: ana.id },
        { projetoId: p.id, numero: 3, descricao: 'Realizada', previstoTermino: PASSADO, realizadoTermino: PASSADO, responsavelId: ana.id },
        { projetoId: excluido.id, numero: 1, descricao: 'Excluído', previstoTermino: PASSADO, responsavelId: ana.id },
      ],
    })

    expect(await avisarAtrasos(AGORA)).toMatchObject({ destinatarios: 0, enviados: 0 })
    expect(envio.chamadas).toHaveLength(0)
  })

  it('conta sem e-mail e sem responsável, e não avisa colaborador desativado', async () => {
    const semEmail = await prisma.colaborador.create({ data: { nome: 'Bia' } })
    const saiu = await prisma.colaborador.create({
      data: { nome: 'Caio', email: 'caio@x.br', ativo: false },
    })
    const p = await projeto()
    await prisma.acao.createMany({
      data: [
        { projetoId: p.id, numero: 1, descricao: 'a', previstoTermino: PASSADO, responsavelId: semEmail.id },
        { projetoId: p.id, numero: 2, descricao: 'b', previstoTermino: PASSADO },
        { projetoId: p.id, numero: 3, descricao: 'c', previstoTermino: PASSADO, responsavelId: saiu.id },
      ],
    })

    const resumo = await avisarAtrasos(AGORA)

    expect(resumo).toMatchObject({ destinatarios: 0, semEmail: 1, semResponsavel: 1 })
    expect(envio.chamadas).toHaveLength(0)
  })

  it('conta a falha de envio sem interromper os demais', async () => {
    const ana = await prisma.colaborador.create({ data: { nome: 'Ana', email: 'ana@x.br' } })
    const bia = await prisma.colaborador.create({ data: { nome: 'Bia', email: 'bia@x.br' } })
    const p = await projeto()
    await prisma.acao.createMany({
      data: [
        { projetoId: p.id, numero: 1, descricao: 'a', previstoTermino: PASSADO, responsavelId: ana.id },
        { projetoId: p.id, numero: 2, descricao: 'b', previstoTermino: PASSADO, responsavelId: bia.id },
      ],
    })
    envio.resultado = { enviado: false, motivo: 'FALHA_NO_ENVIO' }

    expect(await avisarAtrasos(AGORA)).toMatchObject({ destinatarios: 2, enviados: 0, falhas: 2 })
    expect(envio.chamadas).toHaveLength(2)
  })
})
