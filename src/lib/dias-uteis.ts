/**
 * Cálculo de dias úteis — módulo puro, sem Prisma e sem Next, pelos mesmos
 * motivos de `projeto-validacao.ts`: a regra de negócio fica coberta por teste
 * sem banco nem runtime do servidor.
 *
 * Dia útil = segunda a sexta que não seja feriado nacional de data fixa.
 * Conforme o CLAUDE.md, o MVP ignora feriados móveis (Carnaval, Sexta-feira
 * Santa, Corpus Christi) e feriados estaduais/municipais — entram só se o
 * negócio pedir, e aí viram uma tabela, não uma constante.
 *
 * Todas as datas são tratadas em **UTC**, igual a `data-hoje.ts`, ao seed e à
 * conversão de `acao-validacao.ts`. Ler os componentes em fuso local aqui faria
 * uma data gravada à meia-noite UTC escorregar para o dia anterior no Brasil.
 */

/** `mm-dd` de cada feriado nacional de data fixa (Lei 662/49, 6.802/80, 14.759/24). */
export const FERIADOS_NACIONAIS_FIXOS: ReadonlyMap<string, string> = new Map([
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Consciência Negra'],
  ['12-25', 'Natal'],
])

function chaveMesDia(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(data.getUTCDate()).padStart(2, '0')
  return `${mes}-${dia}`
}

/** Nome do feriado nacional fixo na data, ou `null` se não for feriado. */
export function feriadoNacionalFixo(data: Date): string | null {
  return FERIADOS_NACIONAIS_FIXOS.get(chaveMesDia(data)) ?? null
}

/** Sábado (6) ou domingo (0) em UTC. */
export function ehFimDeSemana(data: Date): boolean {
  const diaDaSemana = data.getUTCDay()
  return diaDaSemana === 0 || diaDaSemana === 6
}

/** Dia útil = não é fim de semana e não é feriado nacional fixo. */
export function ehDiaUtil(data: Date): boolean {
  return !ehFimDeSemana(data) && feriadoNacionalFixo(data) === null
}

/** Meia-noite UTC do dia da data — descarta a hora antes de iterar. */
function inicioDoDiaUTC(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()),
  )
}

function somarDiasCorridos(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 24 * 60 * 60 * 1000)
}

/**
 * Quantidade de dias úteis no intervalo **fechado** `[inicio, fim]` — as duas
 * pontas contam. É a contagem que o negócio usa: uma ação prevista para
 * começar e terminar na mesma segunda-feira dura 1 dia útil, não 0.
 *
 * `fim` anterior a `inicio` devolve 0 (intervalo vazio), não número negativo —
 * quem valida a ordem das datas é `acao-validacao.ts`.
 */
export function diasUteisEntre(inicio: Date, fim: Date): number {
  const ultimo = inicioDoDiaUTC(fim)
  let cursor = inicioDoDiaUTC(inicio)
  let total = 0

  while (cursor.getTime() <= ultimo.getTime()) {
    if (ehDiaUtil(cursor)) total += 1
    cursor = somarDiasCorridos(cursor, 1)
  }

  return total
}

/**
 * Data do N-ésimo dia útil a partir de `inicio`, contando `inicio` como dia 1
 * quando ele próprio for útil — o par natural de `diasUteisEntre`, usado para
 * projetar o término previsto a partir de uma duração.
 *
 * `quantidade` menor que 1 devolve o próprio dia (normalizado à meia-noite UTC).
 */
export function somarDiasUteis(inicio: Date, quantidade: number): Date {
  let cursor = inicioDoDiaUTC(inicio)
  if (quantidade < 1) return cursor

  let restantes = quantidade
  if (ehDiaUtil(cursor)) restantes -= 1

  while (restantes > 0) {
    cursor = somarDiasCorridos(cursor, 1)
    if (ehDiaUtil(cursor)) restantes -= 1
  }

  return cursor
}
