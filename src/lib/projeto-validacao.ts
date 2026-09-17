/**
 * Validação dos dados de um Projeto — módulo puro, sem Prisma e sem Next.
 *
 * Fica separado da Server Action de propósito: a regra de negócio (nome
 * obrigatório, demais campos opcionais, prioridade inteira positiva) pode ser
 * coberta por teste unitário sem precisar de banco nem de runtime do servidor.
 */

/** Campos de texto opcionais do Projeto, na ordem do SCHEMA.md. */
export const CAMPOS_TEXTO_OPCIONAIS = [
  'referencia',
  'equipe',
  'natureza',
  'categoria',
  'responsavel',
  'apoio',
  'setorEnvolvido',
  'comentario',
] as const

export type CampoTextoOpcional = (typeof CAMPOS_TEXTO_OPCIONAIS)[number]

export type DadosProjeto = {
  nome: string
  prioridade: number | null
} & { [C in CampoTextoOpcional]: string | null }

/** Erros indexados pelo nome do campo — a UI exibe a mensagem junto ao input. */
export type ErrosProjeto = Partial<Record<keyof DadosProjeto, string>>

export type ResultadoValidacao =
  | { ok: true; dados: DadosProjeto }
  | { ok: false; erros: ErrosProjeto }

/** Fonte aceita: `FormData` ou um objeto simples (útil em teste). */
export type EntradaProjeto =
  | FormData
  | Record<string, FormDataEntryValue | null | undefined>

const TAMANHO_MAXIMO_NOME = 200
const TAMANHO_MAXIMO_TEXTO = 500
const TAMANHO_MAXIMO_COMENTARIO = 2000

function lerCampo(entrada: EntradaProjeto, campo: string): string {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get(campo)
      : (entrada as Record<string, FormDataEntryValue | null | undefined>)[campo]

  return typeof bruto === 'string' ? bruto.trim() : ''
}

function limiteDoCampo(campo: CampoTextoOpcional): number {
  return campo === 'comentario' ? TAMANHO_MAXIMO_COMENTARIO : TAMANHO_MAXIMO_TEXTO
}

export function validarDadosProjeto(entrada: EntradaProjeto): ResultadoValidacao {
  const erros: ErrosProjeto = {}

  const nome = lerCampo(entrada, 'nome')
  if (nome === '') {
    erros.nome = 'Informe o nome do projeto.'
  } else if (nome.length > TAMANHO_MAXIMO_NOME) {
    erros.nome = `O nome deve ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`
  }

  const textos = {} as { [C in CampoTextoOpcional]: string | null }
  for (const campo of CAMPOS_TEXTO_OPCIONAIS) {
    const valor = lerCampo(entrada, campo)
    if (valor.length > limiteDoCampo(campo)) {
      erros[campo] = `Este campo deve ter no máximo ${limiteDoCampo(campo)} caracteres.`
    }
    // String vazia vira null: o banco guarda "sem valor", não "texto vazio".
    textos[campo] = valor === '' ? null : valor
  }

  let prioridade: number | null = null
  const prioridadeBruta = lerCampo(entrada, 'prioridade')
  if (prioridadeBruta !== '') {
    const numero = Number(prioridadeBruta)
    if (!Number.isInteger(numero) || numero < 1) {
      erros.prioridade = 'A prioridade deve ser um número inteiro maior ou igual a 1.'
    } else {
      prioridade = numero
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return { ok: true, dados: { nome, prioridade, ...textos } }
}
