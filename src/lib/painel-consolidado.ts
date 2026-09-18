/**
 * Indicadores agregados do painel consolidado (visão PLA-DEP) — módulo puro,
 * calculado sobre as linhas já resumidas pela listagem (`montarLinhas`), para
 * que o total do painel e o total da tabela nunca divirjam.
 */

import type { ResumoProjeto } from './projeto-resumo'

export type ResumoPainel = {
  totalProjetos: number
  totalAcoes: number
  acoesConcluidas: number
  /**
   * Inteiro de 0 a 100 sobre o total de Ações de todos os projetos — não é a
   * média dos percentuais por projeto: um projeto com 1 ação não pode pesar o
   * mesmo que um com 40.
   */
  percentualConcluido: number
  projetosConcluidos: number
}

export function resumirPainel(
  linhas: { resumo: ResumoProjeto }[],
): ResumoPainel {
  const totalAcoes = linhas.reduce((soma, l) => soma + l.resumo.totalAcoes, 0)
  const acoesConcluidas = linhas.reduce((soma, l) => soma + l.resumo.acoesConcluidas, 0)

  return {
    totalProjetos: linhas.length,
    totalAcoes,
    acoesConcluidas,
    percentualConcluido:
      totalAcoes === 0 ? 0 : Math.round((acoesConcluidas / totalAcoes) * 100),
    projetosConcluidos: linhas.filter((l) => l.resumo.status === 'CONCLUIDO').length,
  }
}
