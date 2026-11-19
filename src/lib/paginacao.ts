/**
 * Paginação e busca de listas longas — módulo puro.
 *
 * A página é lida da query string (`?pagina=3`), então a tela continua linkável
 * e funciona sem JavaScript. `?pagina=todas` desliga a paginação: é o que a
 * impressão (PDF) precisa, e quem quer ver tudo numa tela só.
 */

import type { EntradaFiltros } from './projeto-filtros'

export const TAMANHO_PAGINA_PROJETOS = 25
export const TAMANHO_PAGINA_ACOES = 40

export type PaginaPedida = number | 'todas'

/** Sem a chave, ilegível, zero ou negativo: primeira página. */
export function lerPagina(entrada: EntradaFiltros): PaginaPedida {
  const bruto =
    entrada instanceof URLSearchParams
      ? entrada.get('pagina')
      : (entrada as Record<string, string | string[] | undefined>).pagina
  const valor = Array.isArray(bruto) ? bruto[0] : bruto
  if (valor === 'todas') return 'todas'
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 1 ? numero : 1
}

export type Pagina<T> = {
  itens: T[]
  /** Página efetivamente mostrada (a pedida, limitada ao que existe). */
  pagina: number
  totalPaginas: number
  total: number
  /** Posição, de 1 em diante, do primeiro e do último item mostrados; 0 se vazio. */
  de: number
  ate: number
  /** Verdadeiro quando `?pagina=todas` — a lista veio inteira. */
  todas: boolean
}

export function paginar<T>(itens: T[], pedida: PaginaPedida, tamanho: number): Pagina<T> {
  const total = itens.length
  if (pedida === 'todas') {
    return { itens, pagina: 1, totalPaginas: 1, total, de: total === 0 ? 0 : 1, ate: total, todas: true }
  }
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho))
  // Página além do fim (um link velho, uma busca que encolheu a lista) vira a última.
  const pagina = Math.min(pedida, totalPaginas)
  const inicio = (pagina - 1) * tamanho
  const fatia = itens.slice(inicio, inicio + tamanho)
  return {
    itens: fatia,
    pagina,
    totalPaginas,
    total,
    de: fatia.length === 0 ? 0 : inicio + 1,
    ate: inicio + fatia.length,
    todas: false,
  }
}

/**
 * Busca por texto, sem acento nem caixa, em que TODAS as palavras digitadas
 * precisam aparecer (em qualquer um dos campos): "ana relatório" acha a ação
 * de Ana cuja descrição cita relatório.
 */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function correspondeABusca(
  busca: string | null,
  campos: (string | number | null | undefined)[],
): boolean {
  if (busca === null) return true
  const palavras = normalizarBusca(busca).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return true
  const palheiro = normalizarBusca(
    campos.filter((c) => c !== null && c !== undefined).join(' '),
  )
  return palavras.every((palavra) => palheiro.includes(palavra))
}
