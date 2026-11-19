/**
 * Regras do papel de administrador — módulo puro.
 *
 * O administrador exclui projeto, edita os pesos da matriz e gerencia
 * colaboradores (inclusive quem é administrador). Todo o resto continua aberto
 * a qualquer conta autenticada, EXCETO o perfil Leitor (`somenteLeitura`), que
 * só consulta e exporta.
 *
 * Perfis: Administrador > Colaborador (padrão) > Leitor. Administrador nunca é
 * Leitor, e um Leitor só vira administrador depois de voltar a Colaborador —
 * duas permissões contraditórias na mesma pessoa não deixariam claro quem manda.
 *
 * **Enquanto não existir nenhum administrador ativo, todos podem.** É o estado
 * em que o sistema estava antes do papel existir, e é o que evita o sistema
 * nascer trancado: ninguém seria administrador para promover o primeiro. A
 * restrição liga sozinha quando a primeira pessoa é promovida.
 */

export const MENSAGEM_SEM_PERMISSAO = 'Apenas administradores podem fazer isso.'

export const MENSAGEM_SOMENTE_LEITURA =
  'Seu perfil é somente leitura: você pode consultar e exportar, mas não alterar. Peça a um administrador para mudar o seu perfil.'

/** Perfil Leitor: a conta está ligada a um colaborador marcado como somente leitura. */
export function podeEditar(perfil: { somenteLeitura: boolean }): boolean {
  return !perfil.somenteLeitura
}

export type ErroPerfil = 'ADMINISTRADOR_NAO_E_LEITOR' | 'LEITOR_NAO_E_ADMINISTRADOR'

export const MENSAGEM_ERRO_PERFIL: Record<ErroPerfil, string> = {
  ADMINISTRADOR_NAO_E_LEITOR:
    'Este colaborador é administrador. Remova o papel de administrador antes de torná-lo leitor.',
  LEITOR_NAO_E_ADMINISTRADOR:
    'Este colaborador é leitor. Torne-o colaborador antes de promovê-lo a administrador.',
}

/** Torna leitor: bloqueia quem é administrador. */
export function podeTornarLeitor(alvo: { administrador: boolean }): { ok: true } | { ok: false; erro: ErroPerfil } {
  return alvo.administrador ? { ok: false, erro: 'ADMINISTRADOR_NAO_E_LEITOR' } : { ok: true }
}

/** Promove a administrador: bloqueia quem é leitor. */
export function podePromoverAAdministrador(alvo: {
  somenteLeitura: boolean
}): { ok: true } | { ok: false; erro: ErroPerfil } {
  return alvo.somenteLeitura ? { ok: false, erro: 'LEITOR_NAO_E_ADMINISTRADOR' } : { ok: true }
}

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
