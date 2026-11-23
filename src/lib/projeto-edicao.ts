/**
 * Apoio à edição de um Projeto — módulo puro, sem Prisma e sem Next, pelos
 * mesmos motivos de `projeto-validacao.ts`: a regra fica coberta por teste sem
 * banco nem runtime do servidor.
 */

import {
  CAMPOS_FLASH,
  CAMPOS_TEXTO_OPCIONAIS,
  type DadosProjeto,
  type EntradaProjeto,
} from './projeto-validacao'

/** Campos editáveis do Projeto, na ordem do SCHEMA.md. */
export const CAMPOS_PROJETO = [
  'nome',
  'prioridade',
  ...CAMPOS_TEXTO_OPCIONAIS,
  ...CAMPOS_FLASH,
] as const satisfies readonly (keyof DadosProjeto)[]

/** Valores que preenchem o formulário de edição (null vira string vazia). */
export type ValoresProjeto = Record<keyof DadosProjeto, string>

export function valoresIniciais(projeto: Partial<DadosProjeto>): ValoresProjeto {
  const valores = {} as ValoresProjeto
  for (const campo of CAMPOS_PROJETO) {
    const valor = projeto[campo]
    valores[campo] = valor === null || valor === undefined ? '' : String(valor)
  }
  return valores
}

/**
 * Lê o `id` do projeto vindo do campo oculto do formulário. Devolve `null`
 * quando ausente — a action trata isso como erro geral, não como erro de campo.
 */
export function lerIdProjeto(entrada: EntradaProjeto): string | null {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get('id')
      : (entrada as Record<string, FormDataEntryValue | null | undefined>).id

  if (typeof bruto !== 'string') return null
  const limpo = bruto.trim()
  return limpo === '' ? null : limpo
}

/**
 * Campos cujo valor mudou entre o que está no banco e o que veio do formulário.
 * A action usa isso para não gravar (nem revalidar) quando nada mudou.
 */
export function camposAlterados(
  atual: Partial<DadosProjeto>,
  novos: DadosProjeto,
): (keyof DadosProjeto)[] {
  // Campo ausente nos novos dados (`undefined`) é "não mexer", não alteração.
  return CAMPOS_PROJETO.filter(
    (campo) => novos[campo] !== undefined && (atual[campo] ?? null) !== novos[campo],
  )
}
