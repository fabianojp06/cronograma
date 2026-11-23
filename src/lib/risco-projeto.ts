/**
 * Riscos e bloqueios de um projeto — módulo puro.
 *
 * RISCO é o que pode acontecer; BLOQUEIO é o que já está travando. Os dois
 * usam os mesmos campos (tipo, título, impacto, status, responsável, prazo e
 * plano). Sem "probabilidade" de propósito: duas notas complicam o
 * preenchimento, e para a daily basta o impacto.
 */

export const TIPOS_RISCO = ['RISCO', 'BLOQUEIO'] as const
export const IMPACTOS_RISCO = ['BAIXO', 'MEDIO', 'ALTO'] as const
export const STATUS_RISCO = ['ABERTO', 'EM_TRATAMENTO', 'RESOLVIDO', 'ACONTECEU'] as const

/** Motivo da `Notificacao` quando alguém é definido como responsável por um risco. */
export const MOTIVO_RISCO_RESPONSAVEL = 'RISCO_RESPONSAVEL'

export type TipoRisco = (typeof TIPOS_RISCO)[number]
export type ImpactoRisco = (typeof IMPACTOS_RISCO)[number]
export type StatusRisco = (typeof STATUS_RISCO)[number]

export const ROTULO_TIPO: Record<TipoRisco, string> = { RISCO: 'Risco', BLOQUEIO: 'Bloqueio' }
export const ROTULO_IMPACTO: Record<ImpactoRisco, string> = { BAIXO: 'Baixo', MEDIO: 'Médio', ALTO: 'Alto' }
export const ROTULO_STATUS_RISCO: Record<StatusRisco, string> = {
  ABERTO: 'Aberto',
  EM_TRATAMENTO: 'Em tratamento',
  RESOLVIDO: 'Resolvido',
  ACONTECEU: 'Aconteceu',
}

const TAMANHO_TITULO = 200
const TAMANHO_TEXTO = 2000

/** Aberto = ainda pede atenção (aberto ou em tratamento). */
export function riscoAberto(status: string): boolean {
  return status === 'ABERTO' || status === 'EM_TRATAMENTO'
}

export type DadosRisco = {
  tipo: TipoRisco
  titulo: string
  descricao: string | null
  impacto: ImpactoRisco
  status: StatusRisco
  acaoId: string | null
  responsavelId: string | null
  prazo: Date | null
  plano: string | null
  /**
   * Precisa de decisão da diretoria. Ausente (`undefined`) = o formulário não
   * trouxe o campo: não mexer. O formulário sinaliza que trouxe com
   * `pedeAjudaCampo`, porque caixa desmarcada não envia nada.
   */
  pedeAjuda?: boolean
}

export type ErrosRisco = Partial<Record<keyof DadosRisco, string>>

export type ResultadoRisco = { ok: true; dados: DadosRisco } | { ok: false; erros: ErrosRisco }

const texto = (f: FormData, campo: string) => {
  const v = f.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

function lerData(bruto: string): Date | null | undefined {
  if (bruto === '') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto)
  if (!m) return undefined
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : undefined
}

/** Valida o formulário do risco. Status padrão: ABERTO. */
export function validarRisco(formData: FormData): ResultadoRisco {
  const erros: ErrosRisco = {}

  const tipo = texto(formData, 'tipo')
  if (!(TIPOS_RISCO as readonly string[]).includes(tipo)) erros.tipo = 'Escolha se é risco ou bloqueio.'

  const titulo = texto(formData, 'titulo').replace(/\s+/g, ' ')
  if (titulo === '') erros.titulo = 'Dê um título.'
  else if (titulo.length > TAMANHO_TITULO) erros.titulo = `O título pode ter no máximo ${TAMANHO_TITULO} caracteres.`

  const impacto = texto(formData, 'impacto')
  if (!(IMPACTOS_RISCO as readonly string[]).includes(impacto)) erros.impacto = 'Escolha o impacto.'

  const statusBruto = texto(formData, 'status') || 'ABERTO'
  if (!(STATUS_RISCO as readonly string[]).includes(statusBruto)) erros.status = 'Status inválido.'

  const descricao = texto(formData, 'descricao')
  if (descricao.length > TAMANHO_TEXTO) erros.descricao = `Use no máximo ${TAMANHO_TEXTO} caracteres.`
  const plano = texto(formData, 'plano')
  if (plano.length > TAMANHO_TEXTO) erros.plano = `Use no máximo ${TAMANHO_TEXTO} caracteres.`

  const prazo = lerData(texto(formData, 'prazo'))
  if (prazo === undefined) erros.prazo = 'Data inválida.'

  if (Object.keys(erros).length > 0) return { ok: false, erros }
  return {
    ok: true,
    dados: {
      tipo: tipo as TipoRisco,
      titulo,
      descricao: descricao === '' ? null : descricao,
      impacto: impacto as ImpactoRisco,
      status: statusBruto as StatusRisco,
      acaoId: texto(formData, 'acaoId') || null,
      responsavelId: texto(formData, 'responsavelId') || null,
      prazo: prazo ?? null,
      plano: plano === '' ? null : plano,
      ...(formData.has('pedeAjudaCampo') ? { pedeAjuda: formData.has('pedeAjuda') } : {}),
    },
  }
}

export type LinhaHistoricoRisco = { campo: string; valorAntigo: string | null; valorNovo: string | null }

type EstadoAuditadoRisco = {
  tipo: string
  impacto: string
  status: string
  /** Nome do responsável (o histórico guarda o nome, não o id). */
  responsavel: string | null
  prazo: Date | null
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** O que mudou entre o estado atual e o novo, nos campos auditados. */
export function alteracoesDeRisco(atual: EstadoAuditadoRisco, novo: EstadoAuditadoRisco): LinhaHistoricoRisco[] {
  const pares: [string, string | null, string | null][] = [
    ['tipo', atual.tipo, novo.tipo],
    ['impacto', atual.impacto, novo.impacto],
    ['status', atual.status, novo.status],
    ['responsavel', atual.responsavel, novo.responsavel],
    ['prazo', iso(atual.prazo), iso(novo.prazo)],
  ]
  return pares
    .filter(([, antigo, atualNovo]) => antigo !== atualNovo)
    .map(([campo, valorAntigo, valorNovo]) => ({ campo, valorAntigo, valorNovo }))
}

const PESO_IMPACTO: Record<string, number> = { ALTO: 0, MEDIO: 1, BAIXO: 2 }

/** Ordem de atenção: impacto alto antes; bloqueio antes de risco; prazo mais próximo; mais antigo. */
export function ordenarPorAtencao<T extends { impacto: string; tipo: string; prazo: Date | null; criadoEm: Date }>(
  riscos: readonly T[],
): T[] {
  return [...riscos].sort((a, b) => {
    const porImpacto = (PESO_IMPACTO[a.impacto] ?? 9) - (PESO_IMPACTO[b.impacto] ?? 9)
    if (porImpacto !== 0) return porImpacto
    if (a.tipo !== b.tipo) return a.tipo === 'BLOQUEIO' ? -1 : 1
    const pa = a.prazo?.getTime() ?? Infinity
    const pb = b.prazo?.getTime() ?? Infinity
    if (pa !== pb) return pa - pb
    return a.criadoEm.getTime() - b.criadoEm.getTime()
  })
}

/** O prazo para tratar já passou e o risco segue aberto. */
export function prazoVencido(r: { status: string; prazo: Date | null }, hoje: Date): boolean {
  return riscoAberto(r.status) && r.prazo !== null && r.prazo.getTime() < hoje.getTime()
}

/** Quem exclui: quem registrou ou um administrador. */
export function podeExcluirRisco(criadoPor: string, usuario: string, administrador: boolean): boolean {
  return administrador || criadoPor === usuario
}

export const ROTULO_CAMPO_RISCO: Record<string, string> = {
  tipo: 'Tipo',
  impacto: 'Impacto',
  status: 'Status',
  responsavel: 'Responsável',
  prazo: 'Prazo',
}

/** Valor legível de uma linha de histórico. */
export function valorDoHistoricoRisco(campo: string, valor: string | null): string {
  if (valor === null) return '—'
  if (campo === 'tipo') return ROTULO_TIPO[valor as TipoRisco] ?? valor
  if (campo === 'impacto') return ROTULO_IMPACTO[valor as ImpactoRisco] ?? valor
  if (campo === 'status') return ROTULO_STATUS_RISCO[valor as StatusRisco] ?? valor
  if (campo === 'prazo') return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`
  return valor
}
