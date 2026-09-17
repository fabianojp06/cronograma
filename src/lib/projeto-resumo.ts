/**
 * Resumo agregado de um Projeto a partir de suas Ações — módulo puro (sem
 * Prisma, sem Next), para que a regra de "status agregado" e a de atraso
 * fiquem cobertas por teste unitário sem depender de banco.
 *
 * Regra de atraso (CLAUDE.md): `previstoTermino < hoje`, sem `realizadoTermino`
 * e `status != CONCLUIDO`.
 */

import { StatusAcao } from '../generated/prisma/enums'

/** Recorte mínimo de uma Ação necessário para o resumo. */
export type AcaoResumivel = {
  status: StatusAcao
  previstoTermino: Date | null
  realizadoTermino: Date | null
}

/**
 * Status do projeto calculado a partir das ações — não existe como coluna no
 * banco. `ATRASADO` tem precedência por ser o que o painel precisa destacar.
 */
export const STATUS_AGREGADOS = [
  'SEM_ACOES',
  'NAO_INICIADO',
  'EM_ANDAMENTO',
  'ATRASADO',
  'CONCLUIDO',
] as const

export type StatusAgregado = (typeof STATUS_AGREGADOS)[number]

export const ROTULO_STATUS_AGREGADO: Record<StatusAgregado, string> = {
  SEM_ACOES: 'Sem ações',
  NAO_INICIADO: 'Não iniciado',
  EM_ANDAMENTO: 'Em andamento',
  ATRASADO: 'Atrasado',
  CONCLUIDO: 'Concluído',
}

export type ResumoProjeto = {
  totalAcoes: number
  acoesConcluidas: number
  acoesAtrasadas: number
  /** Inteiro de 0 a 100; 0 quando o projeto não tem ações. */
  percentualConcluido: number
  status: StatusAgregado
}

export function acaoEstaAtrasada(acao: AcaoResumivel, hoje: Date): boolean {
  if (acao.status === StatusAcao.CONCLUIDO) return false
  if (acao.realizadoTermino !== null) return false
  if (acao.previstoTermino === null) return false
  return acao.previstoTermino.getTime() < hoje.getTime()
}

export function resumirAcoes(acoes: AcaoResumivel[], hoje: Date): ResumoProjeto {
  const totalAcoes = acoes.length
  if (totalAcoes === 0) {
    return {
      totalAcoes: 0,
      acoesConcluidas: 0,
      acoesAtrasadas: 0,
      percentualConcluido: 0,
      status: 'SEM_ACOES',
    }
  }

  const acoesConcluidas = acoes.filter((a) => a.status === StatusAcao.CONCLUIDO).length
  const acoesAtrasadas = acoes.filter((a) => acaoEstaAtrasada(a, hoje)).length
  const percentualConcluido = Math.round((acoesConcluidas / totalAcoes) * 100)

  let status: StatusAgregado
  if (acoesConcluidas === totalAcoes) {
    status = 'CONCLUIDO'
  } else if (acoesAtrasadas > 0) {
    status = 'ATRASADO'
  } else if (acoes.every((a) => a.status === StatusAcao.NAO_INICIADO)) {
    status = 'NAO_INICIADO'
  } else {
    status = 'EM_ANDAMENTO'
  }

  return {
    totalAcoes,
    acoesConcluidas,
    acoesAtrasadas,
    percentualConcluido,
    status,
  }
}
