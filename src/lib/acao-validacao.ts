/**
 * Validação dos dados de uma Ação — módulo puro, sem Prisma e sem Next.
 *
 * Mesma razão de `projeto-validacao.ts`: a regra de negócio (descrição
 * obrigatória, status dentro do enum, datas coerentes) fica coberta por teste
 * unitário sem precisar de banco nem de runtime do servidor.
 */

/** Valores do enum `StatusAcao` do SCHEMA.md, na ordem de progresso. */
export const STATUS_ACAO = [
  'NAO_INICIADO',
  'EM_CURSO_25',
  'EM_CURSO_50',
  'EM_CURSO_75',
  'CONCLUIDO',
] as const

export type StatusAcao = (typeof STATUS_ACAO)[number]

/** Rótulos em português para os `select` da UI. */
export const ROTULOS_STATUS: Record<StatusAcao, string> = {
  NAO_INICIADO: 'Não iniciado',
  EM_CURSO_25: 'Em curso — 25%',
  EM_CURSO_50: 'Em curso — 50%',
  EM_CURSO_75: 'Em curso — 75%',
  CONCLUIDO: 'Concluído',
}

/** Campos de data da Ação, na ordem do SCHEMA.md. */
export const CAMPOS_DATA = [
  'previstoInicio',
  'previstoTermino',
  'realizadoInicio',
  'realizadoTermino',
] as const

export type CampoData = (typeof CAMPOS_DATA)[number]

export type DadosAcao = {
  descricao: string
  status: StatusAcao
} & { [C in CampoData]: Date | null }

export type ErrosAcao = Partial<Record<keyof DadosAcao, string>>

export type ResultadoValidacaoAcao =
  | { ok: true; dados: DadosAcao }
  | { ok: false; erros: ErrosAcao }

export type EntradaAcao =
  | FormData
  | Record<string, FormDataEntryValue | null | undefined>

const TAMANHO_MAXIMO_DESCRICAO = 500

function lerCampo(entrada: EntradaAcao, campo: string): string {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get(campo)
      : (entrada as Record<string, FormDataEntryValue | null | undefined>)[campo]

  return typeof bruto === 'string' ? bruto.trim() : ''
}

/**
 * Converte o `aaaa-mm-dd` de um `<input type="date">` para meia-noite **UTC**.
 *
 * As datas de negócio são gravadas em UTC (ver `data-hoje.ts`); usar
 * `new Date('2026-03-01')` direto já devolve UTC, mas a construção explícita
 * deixa a intenção travada e rejeita datas inexistentes (ex.: 31/02).
 */
export function lerDataISO(valor: string): Date | null | undefined {
  if (valor === '') return null

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!partes) return undefined

  const [, ano, mes, dia] = partes
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)))
  // Rejeita 31/02 e afins: o `Date.UTC` normaliza em vez de falhar.
  if (data.getUTCMonth() !== Number(mes) - 1 || data.getUTCDate() !== Number(dia)) {
    return undefined
  }
  return data
}

function ehStatus(valor: string): valor is StatusAcao {
  return (STATUS_ACAO as readonly string[]).includes(valor)
}

export function validarDadosAcao(entrada: EntradaAcao): ResultadoValidacaoAcao {
  const erros: ErrosAcao = {}

  const descricao = lerCampo(entrada, 'descricao')
  if (descricao === '') {
    erros.descricao = 'Informe a descrição da ação.'
  } else if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
    erros.descricao = `A descrição deve ter no máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`
  }

  // Status ausente cai no padrão do schema; só valor fora do enum é erro.
  const statusBruto = lerCampo(entrada, 'status')
  let status: StatusAcao = 'NAO_INICIADO'
  if (statusBruto !== '') {
    if (ehStatus(statusBruto)) {
      status = statusBruto
    } else {
      erros.status = 'Status inválido.'
    }
  }

  const datas = {} as { [C in CampoData]: Date | null }
  for (const campo of CAMPOS_DATA) {
    const data = lerDataISO(lerCampo(entrada, campo))
    if (data === undefined) {
      erros[campo] = 'Data inválida.'
      datas[campo] = null
    } else {
      datas[campo] = data
    }
  }

  // Coerência de período: término antes do início é erro de digitação, não de banco.
  if (
    !erros.previstoTermino &&
    datas.previstoInicio &&
    datas.previstoTermino &&
    datas.previstoTermino < datas.previstoInicio
  ) {
    erros.previstoTermino = 'O término previsto não pode ser anterior ao início previsto.'
  }
  if (
    !erros.realizadoTermino &&
    datas.realizadoInicio &&
    datas.realizadoTermino &&
    datas.realizadoTermino < datas.realizadoInicio
  ) {
    erros.realizadoTermino =
      'O término realizado não pode ser anterior ao início realizado.'
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return { ok: true, dados: { descricao, status, ...datas } }
}

/**
 * Próximo `numero` sequencial dentro do projeto. A unicidade real é garantida
 * pela constraint `@@unique([projetoId, numero])`; esta função só calcula o
 * candidato a partir do maior número já existente.
 */
export function proximoNumero(maiorNumero: number | null | undefined): number {
  return maiorNumero && maiorNumero > 0 ? maiorNumero + 1 : 1
}

/**
 * Lê o `id` da Ação vindo do campo oculto do formulário de edição. Devolve
 * `null` quando ausente — a action trata isso como erro geral, não de campo.
 */
export function lerIdAcao(entrada: EntradaAcao): string | null {
  const id = lerCampo(entrada, 'id')
  return id === '' ? null : id
}
