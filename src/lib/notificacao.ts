/**
 * Regras das notificações de comentário — módulo puro.
 *
 * Quem é avisado por um comentário: as pessoas marcadas em "Avisar" e o
 * responsável pela ação, sempre. Ninguém é avisado do próprio comentário, e só
 * colaborador ativo recebe. Quem é as duas coisas (marcado e responsável) tem
 * uma notificação só, com o motivo mais específico: MARCADO.
 */

export type MotivoNotificacao = 'MARCADO' | 'RESPONSAVEL'

export type DestinoNotificacao = { colaboradorId: string; motivo: MotivoNotificacao }

export function destinatariosDoComentario(entrada: {
  /** Colaborador de quem comentou; `null` se a conta não tem cadastro. */
  autorId: string | null
  responsavelId: string | null
  marcados: string[]
  /** Ids dos colaboradores ativos — só esses recebem. */
  ativos: ReadonlySet<string>
}): DestinoNotificacao[] {
  const { autorId, responsavelId, marcados, ativos } = entrada
  const porId = new Map<string, MotivoNotificacao>()

  if (responsavelId !== null) porId.set(responsavelId, 'RESPONSAVEL')
  // Marcar vence: a pessoa foi escolhida de propósito.
  for (const id of marcados) porId.set(id, 'MARCADO')

  return [...porId]
    .filter(([id]) => id !== autorId && ativos.has(id))
    .map(([colaboradorId, motivo]) => ({ colaboradorId, motivo }))
}

/** Ids marcados no formulário (`avisar`, repetido), sem vazios nem duplicatas. */
export function lerMarcados(formData: FormData): string[] {
  const ids = formData
    .getAll('avisar')
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => v.trim())
  return [...new Set(ids)]
}

export const ROTULO_MOTIVO: Record<MotivoNotificacao, string> = {
  MARCADO: 'marcou você',
  RESPONSAVEL: 'comentou uma ação sua',
}

/** Início do comentário para a lista, cortado em fronteira de palavra. */
export function trechoDoComentario(texto: string, max = 160): string {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const corte = limpo.slice(0, max)
  const espaco = corte.lastIndexOf(' ')
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`
}

export const DIAS_DE_RETENCAO_LIDAS = 30
