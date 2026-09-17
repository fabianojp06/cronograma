/**
 * Apoio à exclusão lógica de um Projeto — módulo puro, sem Prisma e sem Next,
 * pelos mesmos motivos de `projeto-validacao.ts`: a regra fica coberta por
 * teste sem banco nem runtime do servidor.
 *
 * A exclusão é SEMPRE lógica (`ativo = false`). Nunca há DELETE físico: as
 * ações e o `HistoricoAlteracao` do projeto são a trilha de auditoria do
 * sistema e precisam sobreviver à exclusão.
 */

/** Palavra que o usuário digita para confirmar a exclusão. */
export const PALAVRA_CONFIRMACAO = 'EXCLUIR'

/** Dados gravados no Projeto ao excluir — a única mutação permitida aqui. */
export const DADOS_EXCLUSAO_LOGICA = { ativo: false } as const

/** Fonte aceita: `FormData` ou um objeto simples (útil em teste). */
export type EntradaExclusao =
  | FormData
  | Record<string, FormDataEntryValue | null | undefined>

function lerCampo(entrada: EntradaExclusao, campo: string): string | null {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get(campo)
      : (entrada as Record<string, FormDataEntryValue | null | undefined>)[campo]

  return typeof bruto === 'string' ? bruto : null
}

/**
 * A exclusão só prossegue quando o usuário digita `EXCLUIR` no campo de
 * confirmação. Espaços em volta e caixa são tolerados; qualquer outro texto
 * (ou campo ausente) barra a operação — é a proteção contra clique acidental,
 * já que a tela de edição fica a um link da listagem.
 */
export function confirmacaoValida(entrada: EntradaExclusao): boolean {
  const bruto = lerCampo(entrada, 'confirmacao')
  if (bruto === null) return false
  return bruto.trim().toUpperCase() === PALAVRA_CONFIRMACAO
}
