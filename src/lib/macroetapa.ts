/**
 * Macroetapas de um projeto (Flash Report) — módulo puro.
 * Agrupam as ações em etapas grandes; o nome é único por projeto, comparado
 * sem acento nem caixa (`chaveDoNome`).
 */

import { chaveDoNome } from '@/lib/colaborador-validacao'

export const MAXIMO_MACROETAPAS = 12
export const TAMANHO_NOME_MACROETAPA = 80

export type ResultadoNomeMacroetapa = { ok: true; nome: string } | { ok: false; erro: string }

export function podeCriarMais(quantidade: number): boolean {
  return quantidade < MAXIMO_MACROETAPAS
}

export function validarNomeMacroetapa(
  nome: string,
  existentes: readonly { id: string; nome: string }[],
  idAtual?: string,
): ResultadoNomeMacroetapa {
  const aparado = nome.trim().replace(/\s+/g, ' ')
  if (aparado === '') return { ok: false, erro: 'Dê um nome à macroetapa.' }
  if (aparado.length > TAMANHO_NOME_MACROETAPA) {
    return { ok: false, erro: `O nome pode ter no máximo ${TAMANHO_NOME_MACROETAPA} caracteres.` }
  }
  const chave = chaveDoNome(aparado)
  if (existentes.some((e) => e.id !== idAtual && chaveDoNome(e.nome) === chave)) {
    return { ok: false, erro: 'Já existe uma macroetapa com esse nome neste projeto.' }
  }
  return { ok: true, nome: aparado }
}

/**
 * O editor de nome fica aberto enquanto não houve resposta nova da ação, ou se
 * a resposta nova foi erro. `abertoCom` é o estado visto no instante da abertura
 * (`null` = fechado): um salvamento bem-sucedido troca o estado e fecha, e abrir
 * de novo recomeça a conta com o estado então vigente.
 */
export function editorAberto<E extends { ok?: boolean }>(abertoCom: E | null, atual: E): boolean {
  return abertoCom !== null && (atual === abertoCom || atual.ok !== true)
}
