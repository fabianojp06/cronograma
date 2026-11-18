/**
 * Filtro de período dos Dashboards — módulo puro. Lê `?de=aaaa-mm-dd&ate=aaaa-mm-dd`
 * e recorta as ações cujo período PREVISTO cruza o intervalo.
 *
 * Critério: a ação ocupa de `previstoInicio` a `previstoTermino` (se só uma das
 * pontas existe, é um dia só). Entra no recorte se esse intervalo toca o
 * filtro, mesmo que parcialmente — uma ação de fevereiro a abril conta num
 * filtro de março. Ação sem nenhuma data prevista não tem onde ser situada e
 * fica de fora; a tela informa quantas foram.
 */

import { periodoDaSemana, semanaAnterior as semanaAnteriorDe, semanaDe, semanaSeguinte, type SemanaCtcea } from './semana-ctcea'
import type { EntradaFiltros } from './projeto-filtros'

export type Periodo = {
  /** `aaaa-mm-dd` ou `null` (sem limite inferior). */
  de: string | null
  /** `aaaa-mm-dd` ou `null` (sem limite superior). */
  ate: string | null
}

export const PERIODO_VAZIO: Periodo = { de: null, ate: null }

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/

/** Aceita só data de calendário real: `2026-02-30` é rejeitada. */
function dataValida(texto: string): boolean {
  const m = FORMATO_DATA.exec(texto)
  if (m === null) return false
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia
}

function lerData(entrada: EntradaFiltros, chave: string): string | null {
  const bruto =
    entrada instanceof URLSearchParams
      ? entrada.get(chave)
      : (entrada as Record<string, string | string[] | undefined>)[chave]
  const valor = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim()
  // Valor inválido é ignorado, não vira erro: a query string vem do usuário.
  return valor !== undefined && dataValida(valor) ? valor : null
}

export function lerPeriodo(entrada: EntradaFiltros): Periodo {
  const de = lerData(entrada, 'de')
  const ate = lerData(entrada, 'ate')
  // Intervalo escrito ao contrário é trocado em vez de zerar a tela.
  if (de !== null && ate !== null && de > ate) return { de: ate, ate: de }
  return { de, ate }
}

export function periodoAtivo(periodo: Periodo): boolean {
  return periodo.de !== null || periodo.ate !== null
}

type AcaoDatada = { previstoInicio: Date | null; previstoTermino: Date | null }

function dia(data: Date): string {
  return data.toISOString().slice(0, 10)
}

/** A ação tem período previsto e ele cruza o filtro. */
export function acaoNoPeriodo(acao: AcaoDatada, periodo: Periodo): boolean {
  if (!periodoAtivo(periodo)) return true
  const inicio = acao.previstoInicio ?? acao.previstoTermino
  const fim = acao.previstoTermino ?? acao.previstoInicio
  if (inicio === null || fim === null) return false
  // `aaaa-mm-dd` compara certo como texto.
  if (periodo.de !== null && dia(fim) < periodo.de) return false
  if (periodo.ate !== null && dia(inicio) > periodo.ate) return false
  return true
}

export type ResultadoRecorte<P> = {
  projetos: P[]
  /** Ações sem data prevista, deixadas de fora por não terem onde ser situadas. */
  semDataPrevista: number
}

/**
 * Recorta as ações de cada projeto. Com o filtro ligado, projeto que fica sem
 * nenhuma ação no período sai da lista: manter com "0 ações" o faria contar
 * como "sem ações" em relatórios que não têm nada a ver com ele. Sem filtro
 * devolve a entrada intacta — os números ficam idênticos aos de antes.
 */
export function recortarPorPeriodo<A extends AcaoDatada, P extends { acoes: A[] }>(
  projetos: P[],
  periodo: Periodo,
): ResultadoRecorte<P> {
  if (!periodoAtivo(periodo)) return { projetos, semDataPrevista: 0 }

  let semDataPrevista = 0
  const recortados: P[] = []
  for (const projeto of projetos) {
    const acoes = projeto.acoes.filter((a) => {
      if (a.previstoInicio === null && a.previstoTermino === null) semDataPrevista++
      return acaoNoPeriodo(a, periodo)
    })
    if (acoes.length > 0) recortados.push({ ...projeto, acoes })
  }
  return { projetos: recortados, semDataPrevista }
}

// ---------------------------------------------------------------------------
// Auditoria e Card WIN: o período vale por data da alteração e por semana.
// ---------------------------------------------------------------------------

const MS_POR_DIA = 24 * 60 * 60 * 1000
/** O sistema é da CTCEA (Brasil): "dia" de uma alteração é o dia em Brasília. */
const DESLOCAMENTO_BRASILIA_MS = 3 * 60 * 60 * 1000

function meiaNoiteBrasilia(aaaammdd: string): number {
  return Date.parse(`${aaaammdd}T00:00:00.000Z`) + DESLOCAMENTO_BRASILIA_MS
}

/**
 * Limites do período para uma coluna de instante (`alteradoEm`), no formato do
 * `where` do Prisma: `gte` no começo do dia `de` e `lt` no começo do dia
 * seguinte a `ate`, ambos em horário de Brasília — uma alteração às 22h de
 * 31/03 ainda é de 31/03, embora em UTC já seja 01/04.
 */
export function limitesDoInstante(periodo: Periodo): { gte?: Date; lt?: Date } {
  return {
    ...(periodo.de !== null ? { gte: new Date(meiaNoiteBrasilia(periodo.de)) } : {}),
    ...(periodo.ate !== null
      ? { lt: new Date(meiaNoiteBrasilia(periodo.ate) + MS_POR_DIA) }
      : {}),
  }
}

const ordinal = ({ ano, semana }: SemanaCtcea) => ano * 100 + semana

function diaUTC(texto: string): Date {
  return new Date(`${texto}T00:00:00.000Z`)
}

/** A semana (domingo a sábado) toca o período. */
export function semanaNoPeriodo(semana: SemanaCtcea, periodo: Periodo): boolean {
  if (!periodoAtivo(periodo)) return true
  const { inicio, fim } = periodoDaSemana(semana)
  if (periodo.de !== null && dia(fim) < periodo.de) return false
  if (periodo.ate !== null && dia(inicio) > periodo.ate) return false
  return true
}

/**
 * As semanas exibidas na conclusão semanal, da mais antiga para a mais nova.
 *
 * Sem filtro: as `padrao` últimas até `semanaAtual`. Com filtro: de `de` até
 * `ate`, sem passar da semana atual (semana futura é sempre vazia). Só `ate`:
 * as `padrao` semanas que terminam nele. Só `de`: dele até a semana atual.
 * O gráfico é limitado às `maximo` semanas mais recentes do intervalo.
 */
export function janelaDoPeriodo(
  periodo: Periodo,
  semanaAtual: SemanaCtcea,
  padrao = 12,
  maximo = 52,
): SemanaCtcea[] {
  const fimBruto = periodo.ate !== null ? semanaDe(diaUTC(periodo.ate)) : semanaAtual
  const fim = ordinal(fimBruto) > ordinal(semanaAtual) ? semanaAtual : fimBruto

  const semanas: SemanaCtcea[] = []
  if (periodo.de !== null) {
    let atual = semanaDe(diaUTC(periodo.de))
    while (ordinal(atual) <= ordinal(fim)) {
      semanas.push(atual)
      atual = semanaSeguinte(atual)
    }
  } else {
    // `semanaAnterior` atravessa a virada de ano; por isso constrói de trás.
    let atual = fim
    for (let i = 0; i < padrao; i += 1) {
      semanas.unshift(atual)
      atual = semanaAnteriorDe(atual)
    }
  }
  return semanas.slice(-maximo)
}
