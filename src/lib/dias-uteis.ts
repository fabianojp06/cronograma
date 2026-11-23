/**
 * Cálculo de dias úteis — módulo puro, sem Prisma e sem Next, pelos mesmos
 * motivos de `projeto-validacao.ts`: a regra de negócio fica coberta por teste
 * sem banco nem runtime do servidor.
 *
 * Dia útil = segunda a sexta que não seja feriado nacional de data fixa nem um
 * dos feriados móveis ligados à Páscoa (Carnaval — segunda e terça —, Sexta-feira
 * Santa e Corpus Christi). Os móveis são CALCULADOS a partir da Páscoa de cada
 * ano, sem tabela para manter nem biblioteca. Feriados estaduais e municipais
 * continuam de fora: dependem do endereço e entram só se o negócio pedir, e aí
 * viram uma tabela, não uma constante.
 *
 * A Quarta-feira de Cinzas (meio expediente) conta como dia útil.
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

/**
 * Domingo de Páscoa do ano, à meia-noite UTC — algoritmo de Meeus/Jones/Butcher
 * (calendário gregoriano), só aritmética inteira.
 */
export function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, dia))
}

/**
 * Feriados móveis do ano, como dias antes/depois da Páscoa. É a única lista a mexer
 * se a CTCEA trabalhar algum deles (ex.: tirar o Carnaval, que é ponto facultativo).
 */
const MOVEIS_POR_DESLOCAMENTO_DA_PASCOA: ReadonlyArray<readonly [number, string]> = [
  [-48, 'Carnaval'], // segunda-feira
  [-47, 'Carnaval'], // terça-feira
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi'],
]

// `ehDiaUtil` roda dentro de laços dia a dia: calcula a Páscoa uma vez por ano.
const cacheDosMoveis = new Map<number, ReadonlyMap<string, string>>()

/** `mm-dd` → nome de cada feriado móvel do ano. */
export function feriadosMoveis(ano: number): ReadonlyMap<string, string> {
  const guardado = cacheDosMoveis.get(ano)
  if (guardado) return guardado
  const base = pascoa(ano)
  const mapa = new Map<string, string>()
  for (const [deslocamento, nome] of MOVEIS_POR_DESLOCAMENTO_DA_PASCOA) {
    mapa.set(chaveMesDia(somarDiasCorridos(base, deslocamento)), nome)
  }
  cacheDosMoveis.set(ano, mapa)
  return mapa
}

/** Nome do feriado móvel na data (pela Páscoa do ano dela), ou `null`. */
export function feriadoMovel(data: Date): string | null {
  return feriadosMoveis(data.getUTCFullYear()).get(chaveMesDia(data)) ?? null
}

/** Nome do feriado (fixo ou móvel) na data, ou `null`. O fixo prevalece se coincidirem. */
export function feriadoDoDia(data: Date): string | null {
  return feriadoNacionalFixo(data) ?? feriadoMovel(data)
}

/** Sábado (6) ou domingo (0) em UTC. */
export function ehFimDeSemana(data: Date): boolean {
  const diaDaSemana = data.getUTCDay()
  return diaDaSemana === 0 || diaDaSemana === 6
}

/** Dia útil = não é fim de semana e não é feriado (fixo ou móvel). */
export function ehDiaUtil(data: Date): boolean {
  return !ehFimDeSemana(data) && feriadoDoDia(data) === null
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

/**
 * Desloca uma data em `quantidade` dias úteis (negativa = para trás; 0 devolve a
 * própria data). O dia de partida não conta: o primeiro dia útil andado é o 1.
 * Partir de um sábado ou feriado funciona do mesmo jeito — anda até cair em dia
 * útil, o que mantém a ordem entre duas datas deslocadas pela mesma quantidade.
 */
export function deslocarDiasUteis(data: Date, quantidade: number): Date {
  let cursor = inicioDoDiaUTC(data)
  const passo = quantidade < 0 ? -1 : 1
  let restantes = Math.abs(quantidade)
  while (restantes > 0) {
    cursor = somarDiasCorridos(cursor, passo)
    if (ehDiaUtil(cursor)) restantes -= 1
  }
  return cursor
}
