/**
 * Avanço físico de um conjunto de ações (Flash Report) — módulo puro, sem
 * Prisma e sem Next. É a média, ponderada pelos dias úteis do previsto, do
 * percentual de cada ação: o PREVISTO pela posição da data no intervalo, o
 * REALIZADO pelo status.
 */

import { StatusAcao } from '../generated/prisma/enums'
import { diasUteisEntre } from './dias-uteis'

export const PERCENTUAL_DO_STATUS: Record<StatusAcao, number> = {
  NAO_INICIADO: 0,
  EM_CURSO_25: 25,
  EM_CURSO_50: 50,
  EM_CURSO_75: 75,
  CONCLUIDO: 100,
}

export type AcaoParaAvanco = {
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
}

export type Avanco = {
  /** Percentual de 0 a 100, 1 casa. */
  previsto: number
  /** Percentual de 0 a 100, 1 casa. */
  realizado: number
  /** realizado − previsto, calculado antes de arredondar. */
  desvio: number
  /** Soma dos dias úteis previstos das ações com peso. */
  peso: number
  /** Ações sem datas previstas (ou com término antes do início): ficam fora da média. */
  acoesSemPeso: number
}

export function umaCasa(n: number): number {
  // "+ 0" troca -0 por 0 (Math.round(-0.04) é -0 e apareceria como "-0,0").
  return Math.round(n * 10) / 10 + 0
}

/** Dias úteis do previsto; 0 se faltar data ou o término vier antes do início. */
export function pesoDaAcao(a: AcaoParaAvanco): number {
  if (a.previstoInicio === null || a.previstoTermino === null) return 0
  return diasUteisEntre(a.previstoInicio, a.previstoTermino)
}

/** Percentual previsto da ação em `data`: 0 antes do início, 100 a partir do término. */
export function previstoDaAcaoEm(a: AcaoParaAvanco, data: Date): number {
  const peso = pesoDaAcao(a)
  if (peso === 0 || a.previstoInicio === null || a.previstoTermino === null) {
    return 0
  }
  if (data.getTime() < a.previstoInicio.getTime()) return 0
  if (data.getTime() >= a.previstoTermino.getTime()) return 100
  return Math.min(100, (diasUteisEntre(a.previstoInicio, data) / peso) * 100)
}

export function realizadoDaAcao(a: AcaoParaAvanco): number {
  return PERCENTUAL_DO_STATUS[a.status]
}

/** `null` quando nenhuma ação tem peso (não há o que medir). */
export function avancoEm(
  acoes: readonly AcaoParaAvanco[],
  data: Date,
): Avanco | null {
  let peso = 0
  let somaPrevisto = 0
  let somaRealizado = 0
  let acoesSemPeso = 0

  for (const a of acoes) {
    const p = pesoDaAcao(a)
    if (p === 0) {
      acoesSemPeso += 1
      continue
    }
    peso += p
    somaPrevisto += p * previstoDaAcaoEm(a, data)
    somaRealizado += p * realizadoDaAcao(a)
  }

  if (peso === 0) return null

  const previsto = somaPrevisto / peso
  const realizado = somaRealizado / peso
  return {
    previsto: umaCasa(previsto),
    realizado: umaCasa(realizado),
    desvio: umaCasa(realizado - previsto),
    peso,
    acoesSemPeso,
  }
}
