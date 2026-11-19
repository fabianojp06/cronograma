/** Regras da cópia de uma ação — módulo puro. */

import { TAMANHO_MAXIMO_DESCRICAO } from './acao-validacao'

const SUFIXO = ' (cópia)'

/**
 * "X" vira "X (cópia)". Copiar a cópia não empilha sufixos ("X (cópia) (cópia)"):
 * o que importa é saber que é uma cópia, não quantas vezes. Respeita o teto da
 * descrição cortando o texto, nunca o sufixo.
 */
export function descricaoDaCopia(descricao: string): string {
  const base = descricao.endsWith(SUFIXO) ? descricao.slice(0, -SUFIXO.length) : descricao
  const cabe = TAMANHO_MAXIMO_DESCRICAO - SUFIXO.length
  return `${base.length > cabe ? base.slice(0, cabe).trimEnd() : base}${SUFIXO}`
}
