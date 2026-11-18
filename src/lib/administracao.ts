/**
 * Regras do papel de administrador — módulo puro.
 *
 * O administrador exclui projeto, edita os pesos da matriz e gerencia
 * colaboradores (inclusive quem é administrador). Todo o resto continua aberto
 * a qualquer conta autenticada.
 *
 * **Enquanto não existir nenhum administrador ativo, todos podem.** É o estado
 * em que o sistema estava antes do papel existir, e é o que evita o sistema
 * nascer trancado: ninguém seria administrador para promover o primeiro. A
 * restrição liga sozinha quando a primeira pessoa é promovida.
 */

export const MENSAGEM_SEM_PERMISSAO = 'Apenas administradores podem fazer isso.'

export type SituacaoAdmin = {
  /** Administradores ATIVOS. Quem foi desativado não conta. */
  totalAdministradores: number
  /** A conta de quem pede é de um administrador ativo. */
  eAdministrador: boolean
}

export function podeAdministrar(situacao: SituacaoAdmin): boolean {
  return situacao.totalAdministradores === 0 || situacao.eAdministrador
}

/** Nenhum administrador definido: a restrição ainda está desligada. */
export function semAdministradores(situacao: SituacaoAdmin): boolean {
  return situacao.totalAdministradores === 0
}

export type ErroAdministrador = 'ULTIMO_ADMINISTRADOR'

export const MENSAGEM_ERRO_ADMINISTRADOR: Record<ErroAdministrador, string> = {
  ULTIMO_ADMINISTRADOR:
    'Este é o único administrador. Promova outra pessoa antes de remover ou desativar este.',
}

/**
 * Tirar o papel (ou desativar) o ÚLTIMO administrador devolveria o sistema ao
 * estado "todos podem" sem ninguém ter decidido isso — bloqueia.
 */
export function podeDeixarDeSerAdministrador(
  alvo: { administrador: boolean; ativo: boolean },
  totalAdministradores: number,
): { ok: true } | { ok: false; erro: ErroAdministrador } {
  const contaComoAdministrador = alvo.administrador && alvo.ativo
  if (contaComoAdministrador && totalAdministradores <= 1) {
    return { ok: false, erro: 'ULTIMO_ADMINISTRADOR' }
  }
  return { ok: true }
}
