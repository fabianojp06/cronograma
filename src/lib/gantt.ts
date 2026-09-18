/**
 * Grade semanal do Gantt de um Projeto — módulo puro, sem Prisma e sem Next,
 * pelos mesmos motivos de `projeto-resumo.ts`: o posicionamento das barras é
 * aritmética de calendário e precisa estar coberto por teste sem banco.
 *
 * A unidade da grade é a **semana**, igual às planilhas PLA-DEP/CRO-DEP: cada
 * coluna é uma semana de segunda a domingo, e uma barra ocupa da coluna da sua
 * data de início até a coluna da sua data de término. Semana (e não dia) porque
 * é assim que o negócio aponta Previsto x Realizado hoje; dia daria ~400
 * colunas para os 13 meses da planilha sem ganho de informação.
 *
 * Todas as datas são tratadas em **UTC**, igual a `data-hoje.ts`, `dias-uteis.ts`
 * e à conversão de `acao-validacao.ts` — ler componentes em fuso local aqui faria
 * uma data gravada à meia-noite UTC cair na semana anterior no Brasil.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

function inicioDoDiaUTC(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()),
  )
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * MS_POR_DIA)
}

/**
 * Segunda-feira da semana da data (meia-noite UTC). Semana começando na
 * segunda é a convenção da planilha original; `getUTCDay()` devolve 0 para
 * domingo, que aqui pertence à semana que começou seis dias antes.
 */
export function inicioDaSemanaUTC(data: Date): Date {
  const dia = inicioDoDiaUTC(data)
  const diaDaSemana = dia.getUTCDay()
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1
  return somarDias(dia, -recuo)
}

export type Semana = {
  /** Segunda-feira, meia-noite UTC. */
  inicio: Date
  /** Domingo da mesma semana, meia-noite UTC (intervalo fechado). */
  fim: Date
  /** `aaaa-mm-dd` da segunda-feira — chave estável para `key` do React. */
  chave: string
  /** Dia do mês da segunda-feira, o rótulo da coluna. */
  diaDoMes: number
  /** 0 a 11, em UTC — usado para agrupar as colunas por mês no cabeçalho. */
  mes: number
  ano: number
}

function chaveISO(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function montarSemana(inicio: Date): Semana {
  return {
    inicio,
    fim: somarDias(inicio, 6),
    chave: chaveISO(inicio),
    diaDoMes: inicio.getUTCDate(),
    mes: inicio.getUTCMonth(),
    ano: inicio.getUTCFullYear(),
  }
}

/**
 * Semanas que cobrem o intervalo fechado `[inicio, fim]`, da semana de `inicio`
 * até a de `fim`. `fim` anterior a `inicio` devolve só a semana de `inicio` —
 * a grade nunca fica vazia quando existe um período.
 */
export function gerarSemanas(inicio: Date, fim: Date): Semana[] {
  const primeira = inicioDaSemanaUTC(inicio)
  const ultima = inicioDaSemanaUTC(fim)
  const semanas: Semana[] = []

  let cursor = primeira
  while (cursor.getTime() <= ultima.getTime()) {
    semanas.push(montarSemana(cursor))
    cursor = somarDias(cursor, 7)
  }

  return semanas.length > 0 ? semanas : [montarSemana(primeira)]
}

/** Recorte mínimo de uma Ação para desenhar suas duas barras. */
export type AcaoNaGrade = {
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
}

export type Periodo = { inicio: Date; fim: Date }

/**
 * Menor e maior data apontada entre todas as ações (qualquer um dos 4 campos).
 * `null` quando nenhuma ação tem data — nesse caso não há grade a desenhar, e
 * quem chama decide a mensagem.
 */
export function periodoDasAcoes(acoes: AcaoNaGrade[]): Periodo | null {
  const datas = acoes
    .flatMap((a) => [
      a.previstoInicio,
      a.previstoTermino,
      a.realizadoInicio,
      a.realizadoTermino,
    ])
    .filter((d): d is Date => d !== null)

  if (datas.length === 0) return null

  const tempos = datas.map((d) => inicioDoDiaUTC(d).getTime())
  return {
    inicio: new Date(Math.min(...tempos)),
    fim: new Date(Math.max(...tempos)),
  }
}

/**
 * Período da grade: o das ações, alargado por `hoje` para que a linha do "hoje"
 * sempre tenha onde aparecer. Sem ações com data, devolve a semana de `hoje`.
 */
export function periodoDaGrade(acoes: AcaoNaGrade[], hoje: Date): Periodo {
  const periodo = periodoDasAcoes(acoes)
  const dia = inicioDoDiaUTC(hoje)
  if (periodo === null) return { inicio: dia, fim: dia }

  return {
    inicio: new Date(Math.min(periodo.inicio.getTime(), dia.getTime())),
    fim: new Date(Math.max(periodo.fim.getTime(), dia.getTime())),
  }
}

/**
 * Faixa de colunas (base 0) que uma barra ocupa na grade.
 * `colunas` é a quantidade de semanas, sempre >= 1.
 */
export type FaixaBarra = { coluna: number; colunas: number }

function indiceDaSemana(semanas: Semana[], data: Date): number {
  const alvo = inicioDaSemanaUTC(data).getTime()
  const primeiro = semanas[0].inicio.getTime()
  return Math.round((alvo - primeiro) / (7 * MS_POR_DIA))
}

/**
 * Faixa de colunas de uma barra entre duas datas, recortada ao tamanho da
 * grade. Regras:
 * - as duas datas ausentes → `null` (não há barra);
 * - só uma das pontas → barra de uma semana na semana da ponta conhecida, que é
 *   a informação que existe (ação iniciada sem término apontado);
 * - término anterior ao início → trata como uma semana só, em vez de faixa
 *   negativa; a ordem das datas é validada em `acao-validacao.ts`;
 * - barra inteiramente fora da grade → `null`.
 */
export function faixaDaBarra(
  inicio: Date | null,
  fim: Date | null,
  semanas: Semana[],
): FaixaBarra | null {
  if (semanas.length === 0) return null

  const de = inicio ?? fim
  const ate = fim ?? inicio
  if (de === null || ate === null) return null

  const primeira = indiceDaSemana(semanas, de)
  const ultima = indiceDaSemana(semanas, ate)
  if (ultima < 0 || primeira > semanas.length - 1) return null

  const recortada = Math.max(primeira, 0)
  const fimRecortado = Math.min(Math.max(ultima, recortada), semanas.length - 1)

  return { coluna: recortada, colunas: fimRecortado - recortada + 1 }
}

/**
 * Coluna da semana de `hoje`, ou `null` se `hoje` está fora da grade — a linha
 * vertical do "hoje" do protótipo só é desenhada quando cai dentro do período.
 */
export function colunaDeHoje(semanas: Semana[], hoje: Date): number | null {
  if (semanas.length === 0) return null
  const indice = indiceDaSemana(semanas, hoje)
  if (indice < 0 || indice > semanas.length - 1) return null
  return indice
}

export type GrupoDeMes = {
  /** `aaaa-mm` — chave estável para `key` do React. */
  chave: string
  /** Rótulo pt-BR abreviado, ex.: "set/26". */
  rotulo: string
  /** Quantidade de colunas (semanas) do mês na grade. */
  colunas: number
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

/**
 * Agrupa as colunas por mês da segunda-feira, para o cabeçalho de dois níveis
 * (mês em cima, dia da semana embaixo) do protótipo.
 */
export function agruparPorMes(semanas: Semana[]): GrupoDeMes[] {
  const grupos: GrupoDeMes[] = []

  for (const semana of semanas) {
    const chave = `${semana.ano}-${String(semana.mes + 1).padStart(2, '0')}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo !== undefined && ultimo.chave === chave) {
      ultimo.colunas += 1
      continue
    }
    grupos.push({
      chave,
      rotulo: `${MESES_ABREVIADOS[semana.mes]}/${String(semana.ano).slice(2)}`,
      colunas: 1,
    })
  }

  return grupos
}
