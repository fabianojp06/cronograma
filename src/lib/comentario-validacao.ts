/**
 * Regra do comentário de uma Ação — módulo puro.
 *
 * Texto aparado, não vazio e com teto: o campo é uma anotação ("aguardando o
 * fornecedor"), não um documento. O teto também protege a tela e o banco de um
 * colar acidental de uma planilha inteira.
 */

export const LIMITE_COMENTARIO = 2000

export type ResultadoComentario =
  | { ok: true; texto: string }
  | { ok: false; erro: string }

export function validarComentario(bruto: unknown): ResultadoComentario {
  if (typeof bruto !== 'string') return { ok: false, erro: 'Escreva o comentário.' }
  const texto = bruto.trim()
  if (texto === '') return { ok: false, erro: 'Escreva o comentário.' }
  if (texto.length > LIMITE_COMENTARIO) {
    return {
      ok: false,
      erro: `O comentário passa de ${LIMITE_COMENTARIO} caracteres (tem ${texto.length}). Resuma.`,
    }
  }
  return { ok: true, texto }
}

/** Quem pode apagar: o autor, ou um administrador. */
export function podeApagarComentario(
  autor: string,
  usuario: string,
  administrador: boolean,
): boolean {
  return administrador || autor === usuario
}
