/**
 * Relatórios de evolução no tempo — curva acumulada Previsto x Realizado
 * (burn-up) e carga de inícios/términos por mês. Módulo puro, datas em UTC.
 *
 * O burn-up é a leitura que a planilha não dava: a grade semanal mostra ação
 * por ação, mas não responde "o ritmo de entrega está acompanhando o plano?".
 * Duas curvas acumuladas respondem isso de relance — se a verde descola para
 * baixo da azul, o projeto está ficando para trás.
 */

export type AcaoNoTempo = {
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
}

export type Mes = { ano: number; mes: number }

const NOMES_MES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** `aaaa-mm` — chave estável para o React e para ordenação lexicográfica. */
export function chaveDoMes({ ano, mes }: Mes): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

/** Rótulo curto pt-BR, ex.: "set/26". */
export function rotuloDoMes({ ano, mes }: Mes): string {
  return `${NOMES_MES[mes]}/${String(ano).slice(-2)}`
}

/** Último instante do mês, para comparar "terminou até o fim deste mês". */
export function fimDoMesUTC({ ano, mes }: Mes): Date {
  return new Date(Date.UTC(ano, mes + 1, 0, 23, 59, 59, 999))
}

function mesDaData(data: Date): Mes {
  return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() }
}

function comparaMes(a: Mes, b: Mes): number {
  return a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
}

/**
 * Meses contínuos que cobrem todas as datas presentes nas ações — contínuos e
 * não só os que têm dado, senão um mês vazio somem do meio da curva e o
 * espaçamento do eixo mente sobre o tempo decorrido.
 */
export function mesesDoPeriodo(acoes: AcaoNoTempo[]): Mes[] {
  const datas = acoes
    .flatMap((acao) => [
      acao.previstoInicio,
      acao.previstoTermino,
      acao.realizadoInicio,
      acao.realizadoTermino,
    ])
    .filter((data): data is Date => data !== null)

  if (datas.length === 0) return []

  const ordenadas = [...datas].sort((a, b) => a.getTime() - b.getTime())
  const primeiro = mesDaData(ordenadas[0])
  const ultimo = mesDaData(ordenadas[ordenadas.length - 1])

  const meses: Mes[] = []
  const cursor = { ...primeiro }
  while (comparaMes(cursor, ultimo) <= 0) {
    meses.push({ ...cursor })
    cursor.mes += 1
    if (cursor.mes > 11) {
      cursor.mes = 0
      cursor.ano += 1
    }
  }
  return meses
}

export type PontoEvolucao = {
  chave: string
  rotulo: string
  /** Ações cujo `previstoTermino` já passou até o fim deste mês (acumulado). */
  previstoAcumulado: number
  /** Ações cujo `realizadoTermino` já ocorreu até o fim deste mês (acumulado). */
  realizadoAcumulado: number
  /** `true` quando o mês já terminou — depois disso a curva realizada é projeção vazia. */
  passado: boolean
}

/**
 * Curva acumulada. A série Realizado só é desenhada até o mês corrente: meses
 * futuros teriam realizado zero e a linha desabaria até o eixo, sugerindo uma
 * queda de desempenho que não existe (ver `anti-patterns`: extrapolar o vazio).
 */
export function evolucaoMensal(acoes: AcaoNoTempo[], hoje: Date): PontoEvolucao[] {
  const meses = mesesDoPeriodo(acoes)
  const mesDeHoje = mesDaData(hoje)

  return meses.map((mes) => {
    const fim = fimDoMesUTC(mes)
    return {
      chave: chaveDoMes(mes),
      rotulo: rotuloDoMes(mes),
      previstoAcumulado: acoes.filter(
        (a) => a.previstoTermino !== null && a.previstoTermino.getTime() <= fim.getTime(),
      ).length,
      realizadoAcumulado: acoes.filter(
        (a) => a.realizadoTermino !== null && a.realizadoTermino.getTime() <= fim.getTime(),
      ).length,
      passado: comparaMes(mes, mesDeHoje) <= 0,
    }
  })
}

export type PontoCarga = {
  chave: string
  rotulo: string
  /** Ações com `previstoInicio` neste mês. */
  inicios: number
  /** Ações com `previstoTermino` neste mês. */
  terminos: number
}

export function cargaMensal(acoes: AcaoNoTempo[]): PontoCarga[] {
  return mesesDoPeriodo(acoes).map((mes) => {
    const noMes = (data: Date | null) =>
      data !== null && data.getUTCFullYear() === mes.ano && data.getUTCMonth() === mes.mes

    return {
      chave: chaveDoMes(mes),
      rotulo: rotuloDoMes(mes),
      inicios: acoes.filter((a) => noMes(a.previstoInicio)).length,
      terminos: acoes.filter((a) => noMes(a.previstoTermino)).length,
    }
  })
}
