/**
 * Calendário de semanas da CTCEA — módulo puro, sem Prisma e sem Next.
 *
 * **Não é a semana ISO.** A aba `Referências` do Card WIN define o próprio
 * calendário: a semana começa no **domingo** e termina no sábado, e a semana 1
 * de 2026 começa em **28/12/2025**. Usar `getISOWeek` daria números diferentes
 * e desalinharia todo o histórico da equipe em silêncio.
 *
 * A regra que reproduz a tabela: **a semana 1 de um ano começa no domingo igual
 * ou anterior a 1º de janeiro daquele ano**. Para 2026, 1º de janeiro cai numa
 * quinta, então a semana 1 começa no domingo anterior, 28/12/2025 — exatamente
 * o que a planilha traz.
 *
 * A planilha lista 53 linhas, mas a própria busca dela pela semana corrente
 * (`XLOOKUP(hoje; B5:B56; A5:A56)`) só alcança as linhas 5 a 56, ou seja as
 * semanas 1 a 52. A 53ª linha é sobra da fórmula `B6 = C5 + 1` se estendendo
 * sozinha: ela cobre 27/12/2026 a 02/01/2027, que por esta regra já é a semana
 * 1 de 2027. Por isso 2026 tem 52 semanas aqui, e não 53.
 *
 * Todas as datas em **UTC**, como no resto do sistema (`data-hoje.ts`).
 */

const MS_POR_DIA = 86_400_000
const DIAS_POR_SEMANA = 7

/** Domingo igual ou anterior a 1º de janeiro — início da semana 1 do ano. */
export function inicioDaSemana1(ano: number): Date {
  const primeiroDeJaneiro = new Date(Date.UTC(ano, 0, 1))
  // getUTCDay: 0 = domingo. Voltar esse tanto de dias cai no domingo.
  return new Date(Date.UTC(ano, 0, 1 - primeiroDeJaneiro.getUTCDay()))
}

/**
 * Quantas semanas o ano tem — 52 ou 53, conforme o encaixe dos domingos.
 * Derivado, nunca constante: 53 semanas acontecem de tempos em tempos.
 */
export function totalDeSemanas(ano: number): number {
  const diferenca = inicioDaSemana1(ano + 1).getTime() - inicioDaSemana1(ano).getTime()
  return Math.round(diferenca / (MS_POR_DIA * DIAS_POR_SEMANA))
}

export type SemanaCtcea = { ano: number; semana: number }

export type PeriodoSemana = {
  /** Domingo, meia-noite UTC. */
  inicio: Date
  /** Sábado, meia-noite UTC. */
  fim: Date
}

export function ehSemanaValida({ ano, semana }: SemanaCtcea): boolean {
  return Number.isInteger(semana) && semana >= 1 && semana <= totalDeSemanas(ano)
}

export function periodoDaSemana({ ano, semana }: SemanaCtcea): PeriodoSemana {
  const inicio = new Date(
    inicioDaSemana1(ano).getTime() + (semana - 1) * DIAS_POR_SEMANA * MS_POR_DIA,
  )
  return {
    inicio,
    fim: new Date(inicio.getTime() + (DIAS_POR_SEMANA - 1) * MS_POR_DIA),
  }
}

/**
 * Ano e semana de uma data. O ano do calendário pode não ser o ano civil da
 * data, e a divergência acontece nos dois sentidos: 30/12/2025 já pertence à
 * semana 1 de **2026**, e 27/12/2026 já pertence à semana 1 de **2027** (a
 * semana 52 de 2026 termina em 26/12). É o que a planilha faz, e é o que
 * mantém o histórico contínuo.
 */
export function semanaDe(data: Date): SemanaCtcea {
  const dia = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate())

  // O ano civil é o chute inicial; no máximo um passo para cada lado corrige.
  let ano = data.getUTCFullYear()
  if (dia < inicioDaSemana1(ano).getTime()) ano -= 1
  else if (dia >= inicioDaSemana1(ano + 1).getTime()) ano += 1

  const decorrido = dia - inicioDaSemana1(ano).getTime()
  return {
    ano,
    semana: Math.floor(decorrido / (MS_POR_DIA * DIAS_POR_SEMANA)) + 1,
  }
}

/** Semana anterior, atravessando a virada de ano. */
export function semanaAnterior({ ano, semana }: SemanaCtcea): SemanaCtcea {
  if (semana > 1) return { ano, semana: semana - 1 }
  return { ano: ano - 1, semana: totalDeSemanas(ano - 1) }
}

/** Semana seguinte, atravessando a virada de ano. */
export function semanaSeguinte({ ano, semana }: SemanaCtcea): SemanaCtcea {
  if (semana < totalDeSemanas(ano)) return { ano, semana: semana + 1 }
  return { ano: ano + 1, semana: 1 }
}

/** Rótulo curto usado na UI e nas abas da planilha original ("S39/2026"). */
export function rotuloSemana({ ano, semana }: SemanaCtcea): string {
  return `S${semana}/${ano}`
}

/** Chave estável para ordenação e para o React — `2026-39` ordena certo. */
export function chaveSemana({ ano, semana }: SemanaCtcea): string {
  return `${ano}-${String(semana).padStart(2, '0')}`
}

/** Quantas semanas separam duas semanas (b − a); negativo se `b` vier antes. */
export function distanciaEmSemanas(a: SemanaCtcea, b: SemanaCtcea): number {
  const diferenca =
    periodoDaSemana(b).inicio.getTime() - periodoDaSemana(a).inicio.getTime()
  return Math.round(diferenca / (MS_POR_DIA * DIAS_POR_SEMANA))
}
