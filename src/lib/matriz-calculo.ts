/**
 * Cálculo da Matriz de Priorização — módulo puro, sem Prisma e sem Next.
 *
 * Transcreve fielmente as fórmulas da planilha da CTCEA:
 *
 *   TOTAL DE BENEFÍCIO = Σ (nota × peso)          [5 critérios de benefício]
 *   TOTAL DE ESFORÇO   = Σ (nota × peso)          [5 critérios de esforço]
 *   TOTAL GUT          = G × U × T                [produto, não média]
 *   PRIORIDADE         = SE(Esforço = 0; Benefício × GUT; (Benefício × GUT) / Esforço)
 *
 * Duas observações sobre essas fórmulas, ambas deliberadas:
 *
 * 1. O GUT é **produto**, não soma ponderada. A planilha declara "33%" numa
 *    linha de pesos ao lado de G, U e T, mas nenhuma fórmula usa esses 33% —
 *    são decorativos. Multiplicar é o que dá ao GUT sua não-linearidade
 *    característica: 5×5×5 = 125 pesa muito mais que 3×3×3 = 27.
 * 2. Quando o esforço é zero a planilha **não divide** — devolve apenas
 *    Benefício × GUT, como se o divisor fosse 1. Sem essa guarda o resultado
 *    seria divisão por zero. Reproduzido como está.
 */

import {
  CRITERIOS,
  FATORES_GUT,
  LIMIAR_BENEFICIO,
  LIMIAR_ESFORCO,
  criteriosDoGrupo,
  type CriterioId,
  type FatorGut,
  type GrupoCriterio,
  type Quadrante,
} from './matriz-criterios'

/** Notas dos dez critérios (escala 0/3/6/9). */
export type NotasCriterios = Record<CriterioId, number>

/** Notas dos três fatores do GUT (escala 1 a 5). */
export type NotasGut = Record<FatorGut, number>

export type Avaliacao = NotasCriterios & NotasGut

/** Pesos em pontos percentuais inteiros, por critério. */
export type PesosCriterios = Record<CriterioId, number>

export const PESOS_PADRAO: PesosCriterios = Object.fromEntries(
  CRITERIOS.map((criterio) => [criterio.id, criterio.pesoPadrao]),
) as PesosCriterios

/**
 * Soma ponderada de um grupo. A soma é feita **em inteiros** e só então
 * dividida por 100: `9 × 20 + ... = 540`, depois `/100 = 5.4` exato. Somar
 * `nota × 0.2` em ponto flutuante daria 5.400000000000001 — é literalmente o
 * que a planilha guarda, e não há motivo para herdar o erro dela.
 */
export function totalPonderado(
  notas: NotasCriterios,
  pesos: PesosCriterios,
  grupo: GrupoCriterio,
): number {
  const soma = criteriosDoGrupo(grupo).reduce(
    (acumulado, criterio) =>
      acumulado + (notas[criterio.id] ?? 0) * (pesos[criterio.id] ?? 0),
    0,
  )
  return soma / 100
}

/** G × U × T. */
export function totalGut(notas: NotasGut): number {
  return FATORES_GUT.reduce((produto, fator) => produto * (notas[fator] ?? 0), 1)
}

export function prioridadeRecomendada(
  beneficio: number,
  esforco: number,
  gut: number,
): number {
  const numerador = beneficio * gut
  return esforco === 0 ? numerador : numerador / esforco
}

/**
 * Quadrante pela posição no plano Esforço (X) × Benefício (Y).
 *
 * O limiar pertence ao lado "alto": esforço exatamente 3 é alto esforço. A
 * planilha deixa isso ambíguo (as faixas 0–3 e 3–6 se tocam no 3) e alguma
 * escolha precisa ser feita — esta é a conservadora, que não subestima
 * esforço. Também não há teto: a planilha para em 6 de esforço e 8 de
 * benefício, mas a escala vai até 9, e um projeto com 9 de esforço não pode
 * simplesmente ficar sem quadrante.
 */
export function quadranteDe(beneficio: number, esforco: number): Quadrante {
  const altoBeneficio = beneficio >= LIMIAR_BENEFICIO
  const altoEsforco = esforco >= LIMIAR_ESFORCO

  if (altoBeneficio) return altoEsforco ? 'ESTRATEGICOS' : 'QUICK_WINS'
  return altoEsforco ? 'DESCARTAR' : 'VIAVEIS'
}

export type ResultadoAvaliacao = {
  beneficio: number
  esforco: number
  gut: number
  prioridade: number
  quadrante: Quadrante
}

export function calcularAvaliacao(
  avaliacao: Avaliacao,
  pesos: PesosCriterios = PESOS_PADRAO,
): ResultadoAvaliacao {
  const beneficio = totalPonderado(avaliacao, pesos, 'BENEFICIO')
  const esforco = totalPonderado(avaliacao, pesos, 'ESFORCO')
  const gut = totalGut(avaliacao)

  return {
    beneficio,
    esforco,
    gut,
    prioridade: prioridadeRecomendada(beneficio, esforco, gut),
    quadrante: quadranteDe(beneficio, esforco),
  }
}

/**
 * Ordena da maior prioridade para a menor — a ordem em que a matriz responde
 * "o que fazer primeiro". Empate é desfeito por maior benefício e depois por
 * menor esforço, nessa ordem, para que a lista seja estável entre execuções.
 */
export function ordenarPorPrioridade<T extends { resultado: ResultadoAvaliacao }>(
  linhas: T[],
): T[] {
  return [...linhas].sort((a, b) => {
    if (b.resultado.prioridade !== a.resultado.prioridade) {
      return b.resultado.prioridade - a.resultado.prioridade
    }
    if (b.resultado.beneficio !== a.resultado.beneficio) {
      return b.resultado.beneficio - a.resultado.beneficio
    }
    return a.resultado.esforco - b.resultado.esforco
  })
}

/** Formata um total (benefício/esforço) com 2 casas, padrão pt-BR. */
export function formatarTotal(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
