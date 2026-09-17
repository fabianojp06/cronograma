import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import {
  acaoEstaAtrasada,
  resumirAcoes,
  ROTULO_STATUS_AGREGADO,
  STATUS_AGREGADOS,
  type AcaoResumivel,
} from './projeto-resumo'

const HOJE = new Date('2026-09-17T00:00:00.000Z')
const PASSADO = new Date('2026-09-01T00:00:00.000Z')
const FUTURO = new Date('2026-10-01T00:00:00.000Z')

function acao(parcial: Partial<AcaoResumivel> = {}): AcaoResumivel {
  return {
    status: StatusAcao.NAO_INICIADO,
    previstoTermino: FUTURO,
    realizadoTermino: null,
    ...parcial,
  }
}

describe('acaoEstaAtrasada', () => {
  it('considera atrasada a ação com previsto vencido, sem realizado e não concluída', () => {
    expect(acaoEstaAtrasada(acao({ previstoTermino: PASSADO }), HOJE)).toBe(true)
  })

  it('não considera atrasada a ação concluída, mesmo com previsto vencido', () => {
    expect(
      acaoEstaAtrasada(
        acao({ previstoTermino: PASSADO, status: StatusAcao.CONCLUIDO }),
        HOJE,
      ),
    ).toBe(false)
  })

  it('não considera atrasada a ação que já tem realizadoTermino', () => {
    expect(
      acaoEstaAtrasada(
        acao({ previstoTermino: PASSADO, realizadoTermino: PASSADO }),
        HOJE,
      ),
    ).toBe(false)
  })

  it('não considera atrasada a ação sem previstoTermino nem a com previsto futuro', () => {
    expect(acaoEstaAtrasada(acao({ previstoTermino: null }), HOJE)).toBe(false)
    expect(acaoEstaAtrasada(acao({ previstoTermino: FUTURO }), HOJE)).toBe(false)
  })
})

describe('resumirAcoes', () => {
  it('devolve SEM_ACOES e 0% para projeto sem ações', () => {
    expect(resumirAcoes([], HOJE)).toEqual({
      totalAcoes: 0,
      acoesConcluidas: 0,
      acoesAtrasadas: 0,
      percentualConcluido: 0,
      status: 'SEM_ACOES',
    })
  })

  it('devolve NAO_INICIADO quando todas as ações estão não iniciadas e no prazo', () => {
    const resumo = resumirAcoes([acao(), acao()], HOJE)
    expect(resumo.status).toBe('NAO_INICIADO')
    expect(resumo.percentualConcluido).toBe(0)
  })

  it('devolve CONCLUIDO e 100% quando todas as ações estão concluídas', () => {
    const concluida = acao({
      status: StatusAcao.CONCLUIDO,
      previstoTermino: PASSADO,
      realizadoTermino: PASSADO,
    })
    const resumo = resumirAcoes([concluida, concluida], HOJE)
    expect(resumo.status).toBe('CONCLUIDO')
    expect(resumo.percentualConcluido).toBe(100)
    expect(resumo.acoesAtrasadas).toBe(0)
  })

  it('devolve EM_ANDAMENTO quando há progresso sem atraso', () => {
    const resumo = resumirAcoes(
      [
        acao({ status: StatusAcao.CONCLUIDO, realizadoTermino: PASSADO }),
        acao({ status: StatusAcao.EM_CURSO_50 }),
        acao(),
      ],
      HOJE,
    )
    expect(resumo.status).toBe('EM_ANDAMENTO')
    expect(resumo.acoesConcluidas).toBe(1)
    expect(resumo.percentualConcluido).toBe(33)
  })

  it('ATRASADO tem precedência sobre EM_ANDAMENTO e NAO_INICIADO', () => {
    const atrasada = acao({ previstoTermino: PASSADO })
    expect(resumirAcoes([acao(), atrasada], HOJE).status).toBe('ATRASADO')
    expect(
      resumirAcoes([acao({ status: StatusAcao.EM_CURSO_75 }), atrasada], HOJE).status,
    ).toBe('ATRASADO')
    expect(resumirAcoes([acao(), atrasada], HOJE).acoesAtrasadas).toBe(1)
  })

  it('todo status agregado tem rótulo em português', () => {
    for (const status of STATUS_AGREGADOS) {
      expect(ROTULO_STATUS_AGREGADO[status]).toBeTruthy()
    }
  })
})
