/**
 * Filtros da listagem de Projetos — módulo puro. Lê/escreve os filtros na query
 * string (`?equipe=STI&categoria=...&status=ATRASADO`) para que a tela seja
 * linkável e funcione sem JavaScript (form com method GET).
 *
 * Equipe e categoria são texto livre no schema, então são filtradas por
 * igualdade exata contra a lista de valores que existem no banco.
 */

import { STATUS_AGREGADOS, type StatusAgregado } from './projeto-resumo'

export type FiltrosProjeto = {
  equipe: string | null
  categoria: string | null
  status: StatusAgregado | null
}

export const FILTROS_VAZIOS: FiltrosProjeto = {
  equipe: null,
  categoria: null,
  status: null,
}

/** Fonte aceita: `URLSearchParams` ou o objeto `searchParams` do Next. */
export type EntradaFiltros =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function lerParametro(entrada: EntradaFiltros, chave: string): string | null {
  const bruto =
    entrada instanceof URLSearchParams
      ? entrada.get(chave)
      : (entrada as Record<string, string | string[] | undefined>)[chave]

  const valor = Array.isArray(bruto) ? bruto[0] : bruto
  if (typeof valor !== 'string') return null

  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

function ehStatusAgregado(valor: string): valor is StatusAgregado {
  return (STATUS_AGREGADOS as readonly string[]).includes(valor)
}

export function lerFiltros(entrada: EntradaFiltros): FiltrosProjeto {
  const status = lerParametro(entrada, 'status')

  return {
    equipe: lerParametro(entrada, 'equipe'),
    categoria: lerParametro(entrada, 'categoria'),
    // Status desconhecido é ignorado em vez de virar erro: a query string vem
    // do usuário e um valor inválido não deve quebrar a listagem.
    status: status !== null && ehStatusAgregado(status) ? status : null,
  }
}

export function algumFiltroAtivo(filtros: FiltrosProjeto): boolean {
  return filtros.equipe !== null || filtros.categoria !== null || filtros.status !== null
}

/** Filtros que o Prisma resolve no banco (equipe e categoria são colunas). */
export function whereProjetoAtivo(filtros: FiltrosProjeto) {
  return {
    ativo: true,
    ...(filtros.equipe !== null ? { equipe: filtros.equipe } : {}),
    ...(filtros.categoria !== null ? { categoria: filtros.categoria } : {}),
  }
}

/**
 * Filtro por status agregado — aplicado em memória, porque o status não existe
 * no banco: ele é derivado das Ações (ver `resumirAcoes`).
 */
export function filtrarPorStatus<T extends { resumo: { status: StatusAgregado } }>(
  linhas: T[],
  filtros: FiltrosProjeto,
): T[] {
  if (filtros.status === null) return linhas
  return linhas.filter((linha) => linha.resumo.status === filtros.status)
}
