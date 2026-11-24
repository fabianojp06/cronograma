/**
 * Paginação por período do Gantt — módulo puro, sem Prisma e sem Next, pelos
 * mesmos motivos de `gantt.ts`: é aritmética de calendário e precisa estar
 * coberta por teste sem banco.
 *
 * A planilha original cobre ~13 meses (~57 semanas). Renderizar tudo de uma vez
 * dá uma grade larga demais para ser lida — então o período total é fatiado em
 * janelas de mês, trimestre, semestre ou ano, e a grade desenha uma janela por vez. As
 * janelas são fatias de calendário (mês cheio, trimestre cheio), não fatias de
 * N semanas: assim o rótulo da janela ("set/26", "3º tri/26") coincide com o
 * cabeçalho de mês da grade e a navegação é previsível entre projetos.
 *
 * Todas as datas em **UTC**, igual a `gantt.ts` e `data-hoje.ts`.
 */

import type { Periodo } from './gantt'

export type Granularidade = 'MES' | 'TRIMESTRE' | 'SEMESTRE' | 'ANO'

/** Na ordem em que aparecem no seletor (do menor período ao maior). */
export const ROTULOS_GRANULARIDADE: Record<Granularidade, string> = {
  MES: 'Mês',
  TRIMESTRE: 'Trimestre',
  SEMESTRE: 'Semestre',
  ANO: 'Ano',
}

/** Meses de calendário que cada janela cobre. */
const MESES_POR_JANELA: Record<Granularidade, number> = { MES: 1, TRIMESTRE: 3, SEMESTRE: 6, ANO: 12 }

export type JanelaPeriodo = {
  /** `aaaa-mm`, `aaaa-Tn`, `aaaa-Sn` ou `aaaa` — chave estável para o React. */
  chave: string
  /** Rótulo pt-BR, ex.: "set/26", "3º tri/26", "2º sem/26" ou "2026". */
  rotulo: string
  /** Primeiro dia da janela, meia-noite UTC. */
  inicio: Date
  /** Último dia da janela, meia-noite UTC (intervalo fechado). */
  fim: Date
}

const MESES_ABREVIADOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function diaUTC(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes, dia))
}

/** Último dia do mês `mes` (0 a 11) — o "dia 0" do mês seguinte. */
function ultimoDiaDoMes(ano: number, mes: number): Date {
  return diaUTC(ano, mes + 1, 0)
}

function anoAbreviado(ano: number): string {
  return String(ano).slice(2)
}

function janelaDoMes(ano: number, mes: number): JanelaPeriodo {
  return {
    chave: `${ano}-${String(mes + 1).padStart(2, '0')}`,
    rotulo: `${MESES_ABREVIADOS[mes]}/${anoAbreviado(ano)}`,
    inicio: diaUTC(ano, mes, 1),
    fim: ultimoDiaDoMes(ano, mes),
  }
}

function janelaDoTrimestre(ano: number, trimestre: number): JanelaPeriodo {
  const primeiroMes = trimestre * 3
  return {
    chave: `${ano}-T${trimestre + 1}`,
    rotulo: `${trimestre + 1}º tri/${anoAbreviado(ano)}`,
    inicio: diaUTC(ano, primeiroMes, 1),
    fim: ultimoDiaDoMes(ano, primeiroMes + 2),
  }
}

function janelaDoSemestre(ano: number, semestre: number): JanelaPeriodo {
  const primeiroMes = semestre * 6
  return {
    chave: `${ano}-S${semestre + 1}`,
    rotulo: `${semestre + 1}º sem/${anoAbreviado(ano)}`,
    inicio: diaUTC(ano, primeiroMes, 1),
    fim: ultimoDiaDoMes(ano, primeiroMes + 5),
  }
}

function janelaDoAno(ano: number): JanelaPeriodo {
  return { chave: String(ano), rotulo: String(ano), inicio: diaUTC(ano, 0, 1), fim: ultimoDiaDoMes(ano, 11) }
}

/**
 * Janelas de calendário que cobrem o período inteiro, em ordem cronológica.
 * Sempre devolve pelo menos uma janela — um período de um único dia rende a
 * janela do mês/trimestre desse dia. `fim` anterior a `inicio` devolve só a
 * janela de `inicio`, mesma tolerância de `gerarSemanas`.
 */
export function gerarJanelas(
  periodo: Periodo,
  granularidade: Granularidade,
): JanelaPeriodo[] {
  const passo = MESES_POR_JANELA[granularidade]
  const anoInicial = periodo.inicio.getUTCFullYear()
  const mesInicial = Math.floor(periodo.inicio.getUTCMonth() / passo) * passo
  const limite = ultimoDiaDoMes(
    periodo.fim.getUTCFullYear(),
    Math.floor(periodo.fim.getUTCMonth() / passo) * passo + passo - 1,
  ).getTime()

  const montar = (ano: number, mes: number) => {
    switch (granularidade) {
      case 'MES':
        return janelaDoMes(ano, mes)
      case 'TRIMESTRE':
        return janelaDoTrimestre(ano, mes / 3)
      case 'SEMESTRE':
        return janelaDoSemestre(ano, mes / 6)
      case 'ANO':
        return janelaDoAno(ano)
    }
  }

  const janelas: JanelaPeriodo[] = []
  let cursor = diaUTC(anoInicial, mesInicial, 1)

  while (cursor.getTime() <= limite) {
    const ano = cursor.getUTCFullYear()
    const mes = cursor.getUTCMonth()
    janelas.push(montar(ano, mes))
    cursor = diaUTC(ano, mes + passo, 1)
  }

  // Só acontece com `fim` anterior a `inicio`; a grade nunca fica sem janela.
  return janelas.length > 0 ? janelas : [montar(anoInicial, mesInicial)]
}

/**
 * Índice da janela que contém `data`, ou `null` se `data` está fora de todas —
 * usado para abrir a grade já na janela de "hoje" e para o botão "Hoje".
 */
export function indiceDaJanela(janelas: JanelaPeriodo[], data: Date): number | null {
  const alvo = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate())
  const indice = janelas.findIndex(
    (j) => j.inicio.getTime() <= alvo && alvo <= j.fim.getTime(),
  )
  return indice === -1 ? null : indice
}

/**
 * Janela inicial da grade: a de `hoje` quando o período a cobre, senão a
 * primeira — abrir num trimestre vazio porque "hoje" ficou fora do projeto
 * esconderia todas as barras.
 */
export function janelaInicial(janelas: JanelaPeriodo[], hoje: Date): number {
  return indiceDaJanela(janelas, hoje) ?? 0
}

/** Mantém o índice dentro de `[0, janelas.length - 1]`. */
export function limitarIndice(indice: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(indice, 0), total - 1)
}
