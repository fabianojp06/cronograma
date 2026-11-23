/**
 * Sinal (farol) do projeto no Flash Report — módulo puro, sem Prisma e sem
 * Next. Sai do desvio de avanço físico (realizado − previsto, em pontos
 * percentuais) e sobe UM nível se houver risco de impacto alto vencido.
 */

import { avancoEm, type AcaoParaAvanco } from './avanco-fisico'
import { riscoAberto } from './risco-projeto'

/** Desvio igual ou abaixo disto: atrasado. */
export const LIMITE_ATRASADO = -10
/** Desvio igual ou abaixo disto (e acima do atrasado): atenção. */
export const LIMITE_ATENCAO = -3
/** Desvio acima disto: adiantado. */
export const LIMITE_ADIANTADO = 3

export type SinalProjeto =
  | 'ATRASADO'
  | 'ATENCAO'
  | 'EM_DIA'
  | 'ADIANTADO'
  | 'SEM_DADOS'

export const ROTULO_SINAL: Record<SinalProjeto, string> = {
  ATRASADO: 'Atrasado',
  ATENCAO: 'Atenção',
  EM_DIA: 'Em dia',
  ADIANTADO: 'Adiantado',
  SEM_DADOS: 'Sem dados',
}

/** Do pior ao melhor, para ordenar. */
export const ORDEM_SINAL: readonly SinalProjeto[] = [
  'ATRASADO',
  'ATENCAO',
  'EM_DIA',
  'ADIANTADO',
  'SEM_DADOS',
]

export type RiscoParaSinal = {
  impacto: string
  status: string
  prazo: Date | null
}

export type Farol = {
  sinal: SinalProjeto
  desvio: number | null
  motivo: string
  subiuPorRisco: boolean
}

/** Passos do "sobe um nível": do melhor para o pior. */
const ESCADA: readonly SinalProjeto[] = [
  'ADIANTADO',
  'EM_DIA',
  'ATENCAO',
  'ATRASADO',
]

function sinalDoDesvio(d: number): SinalProjeto {
  if (d <= LIMITE_ATRASADO) return 'ATRASADO'
  if (d <= LIMITE_ATENCAO) return 'ATENCAO'
  if (d <= LIMITE_ADIANTADO) return 'EM_DIA'
  return 'ADIANTADO'
}

/** Número em pt-BR, com sinal explícito e menos de verdade (U+2212). */
function desvioEscrito(d: number): string {
  const texto = Math.abs(d).toString().replace('.', ',')
  if (d < 0) return `−${texto} p.p.`
  if (d > 0) return `+${texto} p.p.`
  return `${texto} p.p.`
}

function temRiscoAltoVencido(
  riscos: readonly RiscoParaSinal[],
  hoje: Date,
): boolean {
  return riscos.some(
    (r) =>
      r.impacto === 'ALTO' &&
      riscoAberto(r.status) &&
      r.prazo !== null &&
      r.prazo.getTime() < hoje.getTime(),
  )
}

export function sinalDoProjeto(e: {
  acoes: readonly AcaoParaAvanco[]
  riscos: readonly RiscoParaSinal[]
  hoje: Date
}): Farol {
  const avanco = avancoEm(e.acoes, e.hoje)
  if (avanco === null) {
    return {
      sinal: 'SEM_DADOS',
      desvio: null,
      motivo: 'Sem ações com datas previstas',
      subiuPorRisco: false,
    }
  }

  // `+ 0` troca -0 por 0.
  const desvio = Math.round(avanco.desvio * 10) / 10 + 0
  const base = sinalDoDesvio(desvio)
  const posicao = ESCADA.indexOf(base)
  const sobe =
    base !== 'ATRASADO' && temRiscoAltoVencido(e.riscos, e.hoje)
  const sinal = sobe ? ESCADA[posicao + 1] : base

  const motivo = sobe
    ? `Desvio de ${desvioEscrito(desvio)}; sinal subiu um nível por risco de impacto alto com prazo vencido`
    : `Desvio de ${desvioEscrito(desvio)} entre realizado e previsto`

  return { sinal, desvio, motivo, subiuPorRisco: sobe }
}
