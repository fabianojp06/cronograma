/**
 * Filtros da listagem de Projetos — módulo puro. Lê/escreve os filtros na query
 * string (`?equipe=STI&responsavel=...&categoria=...&status=ATRASADO`) para que
 * a tela seja linkável e funcione sem JavaScript (form com method GET).
 *
 * Equipe, responsável e categoria são texto livre no schema, então são
 * filtrados por igualdade exata contra a lista de valores que existem no banco.
 */

import { ORDEM_SINAL, type Farol, type SinalProjeto } from './farol-projeto'
import { correspondeABusca } from './paginacao'
import { STATUS_AGREGADOS, type StatusAgregado } from './projeto-resumo'

export type FiltrosProjeto = {
  equipe: string | null
  responsavel: string | null
  categoria: string | null
  status: StatusAgregado | null
  /** Texto livre: nome, referência, equipe, categoria ou responsável. */
  busca: string | null
  /** Sinal (farol) do Flash Report. */
  sinal: SinalProjeto | null
  /** `sinal` = pior sinal primeiro; nulo = a ordem padrão da consulta. */
  ordem: 'sinal' | null
}

export const FILTROS_VAZIOS: FiltrosProjeto = {
  equipe: null,
  responsavel: null,
  categoria: null,
  status: null,
  busca: null,
  sinal: null,
  ordem: null,
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

function ehSinal(valor: string): valor is SinalProjeto {
  return (ORDEM_SINAL as readonly string[]).includes(valor)
}

export function lerFiltros(entrada: EntradaFiltros): FiltrosProjeto {
  const status = lerParametro(entrada, 'status')
  const sinal = lerParametro(entrada, 'sinal')

  return {
    equipe: lerParametro(entrada, 'equipe'),
    responsavel: lerParametro(entrada, 'responsavel'),
    categoria: lerParametro(entrada, 'categoria'),
    // Status desconhecido é ignorado em vez de virar erro: a query string vem
    // do usuário e um valor inválido não deve quebrar a listagem.
    status: status !== null && ehStatusAgregado(status) ? status : null,
    busca: lerParametro(entrada, 'busca'),
    sinal: sinal !== null && ehSinal(sinal) ? sinal : null,
    ordem: lerParametro(entrada, 'ordem') === 'sinal' ? 'sinal' : null,
  }
}

export function algumFiltroAtivo(filtros: FiltrosProjeto): boolean {
  return (
    filtros.equipe !== null ||
    filtros.responsavel !== null ||
    filtros.categoria !== null ||
    filtros.status !== null ||
    filtros.sinal !== null ||
    filtros.busca !== null
  )
}

/** Filtros que o Prisma resolve no banco (equipe, responsável e categoria são colunas). */
export function whereProjetoAtivo(filtros: FiltrosProjeto) {
  return {
    ativo: true,
    ...(filtros.equipe !== null ? { equipe: filtros.equipe } : {}),
    ...(filtros.responsavel !== null ? { responsavel: filtros.responsavel } : {}),
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

/** Filtro por sinal (farol): derivado das ações e dos riscos, então também em memória. */
export function filtrarPorSinal<T extends { sinal: Farol }>(
  linhas: T[],
  filtros: FiltrosProjeto,
): T[] {
  if (filtros.sinal === null) return linhas
  return linhas.filter((linha) => linha.sinal.sinal === filtros.sinal)
}

/**
 * Ordem padrão de toda lista de projetos: prioridade CRESCENTE (1 é a mais alta),
 * quem não tem prioridade por último (explícito, para não depender do padrão do
 * banco), e o nome desempata. Painel, `/projetos`, Dashboards e Excel usam esta.
 */
export const ORDEM_PADRAO_PROJETOS: (
  | { prioridade: { sort: 'asc'; nulls: 'last' } }
  | { nome: 'asc' }
)[] = [{ prioridade: { sort: 'asc', nulls: 'last' } }, { nome: 'asc' }]

/** "Pior sinal primeiro": ordem estável, o empate segue a ordem em que as linhas chegaram. */
export function ordenarLinhas<T extends { sinal: Farol }>(
  linhas: T[],
  filtros: FiltrosProjeto,
): T[] {
  if (filtros.ordem !== 'sinal') return linhas
  const posicao = (l: T) => ORDEM_SINAL.indexOf(l.sinal.sinal)
  return [...linhas].sort((a, b) => posicao(a) - posicao(b))
}

/** Busca por texto, em memória: junto com o status, é derivada do que já veio do banco. */
export function filtrarPorBusca<
  T extends {
    nome: string
    referencia: string | null
    equipe: string | null
    categoria: string | null
    responsavel: string | null
  },
>(linhas: T[], filtros: FiltrosProjeto): T[] {
  if (filtros.busca === null) return linhas
  return linhas.filter((l) =>
    correspondeABusca(filtros.busca, [l.nome, l.referencia, l.equipe, l.categoria, l.responsavel]),
  )
}

/** Só os filtros preenchidos, como parâmetros de URL (links de paginação, Excel). */
export function filtrosComoParametros(filtros: FiltrosProjeto): Record<string, string> {
  const saida: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(filtros)) if (valor) saida[chave] = valor
  return saida
}
