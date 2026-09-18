import { describe, expect, it } from 'vitest'

import { resumirPainel } from './painel-consolidado'
import type { ResumoProjeto, StatusAgregado } from './projeto-resumo'

function linha(
  totalAcoes: number,
  acoesConcluidas: number,
  status: StatusAgregado,
  acoesAtrasadas = 0,
): { resumo: ResumoProjeto } {
  return {
    resumo: {
      totalAcoes,
      acoesConcluidas,
      acoesAtrasadas,
      percentualConcluido:
        totalAcoes === 0 ? 0 : Math.round((acoesConcluidas / totalAcoes) * 100),
      status,
    },
  }
}

describe('resumirPainel', () => {
  it('devolve zeros quando não há projetos', () => {
    expect(resumirPainel([])).toEqual({
      totalProjetos: 0,
      totalAcoes: 0,
      acoesConcluidas: 0,
      percentualConcluido: 0,
      projetosConcluidos: 0,
      projetosAtrasados: 0,
      acoesAtrasadas: 0,
    })
  })

  it('soma ações de todos os projetos', () => {
    const painel = resumirPainel([
      linha(4, 2, 'EM_ANDAMENTO'),
      linha(6, 3, 'ATRASADO'),
    ])

    expect(painel.totalProjetos).toBe(2)
    expect(painel.totalAcoes).toBe(10)
    expect(painel.acoesConcluidas).toBe(5)
    expect(painel.percentualConcluido).toBe(50)
  })

  it('pondera pelo total de ações, não pela média dos percentuais', () => {
    // Média dos percentuais seria 50%; ponderado pelas ações é 2/41 ≈ 5%.
    const painel = resumirPainel([linha(1, 1, 'CONCLUIDO'), linha(40, 1, 'EM_ANDAMENTO')])

    expect(painel.percentualConcluido).toBe(5)
  })

  it('não divide por zero quando todos os projetos estão sem ações', () => {
    const painel = resumirPainel([linha(0, 0, 'SEM_ACOES'), linha(0, 0, 'SEM_ACOES')])

    expect(painel.totalProjetos).toBe(2)
    expect(painel.percentualConcluido).toBe(0)
  })

  it('conta apenas os projetos com status agregado CONCLUIDO', () => {
    const painel = resumirPainel([
      linha(2, 2, 'CONCLUIDO'),
      linha(2, 2, 'CONCLUIDO'),
      linha(3, 1, 'ATRASADO'),
    ])

    expect(painel.projetosConcluidos).toBe(2)
  })

  it('conta projetos com pelo menos uma ação atrasada e soma as ações atrasadas', () => {
    const painel = resumirPainel([
      linha(4, 1, 'ATRASADO', 2),
      linha(3, 0, 'ATRASADO', 1),
      linha(5, 2, 'EM_ANDAMENTO'),
    ])

    expect(painel.projetosAtrasados).toBe(2)
    expect(painel.acoesAtrasadas).toBe(3)
  })

  it('não conta como atrasado o projeto sem ações atrasadas', () => {
    const painel = resumirPainel([linha(2, 2, 'CONCLUIDO'), linha(0, 0, 'SEM_ACOES')])

    expect(painel.projetosAtrasados).toBe(0)
    expect(painel.acoesAtrasadas).toBe(0)
  })
})
