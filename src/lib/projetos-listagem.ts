/**
 * Montagem das linhas da listagem de Projetos — módulo puro (recebe os
 * registros já lidos do banco). A parte que toca o Prisma fica na página;
 * aqui fica a composição projeto + resumo das ações, que é o que precisa de
 * teste.
 */

import { resumirAcoes, type AcaoResumivel } from './projeto-resumo'
import type { LinhaProjeto } from '@/components/lista-projetos'

export type ProjetoComAcoes = Omit<LinhaProjeto, 'resumo'> & {
  acoes: AcaoResumivel[]
}

export function montarLinhas(
  projetos: ProjetoComAcoes[],
  hoje: Date,
): LinhaProjeto[] {
  return projetos.map(({ acoes, ...projeto }) => ({
    ...projeto,
    resumo: resumirAcoes(acoes, hoje),
  }))
}

/**
 * Valores distintos, sem nulos, ordenados — alimenta os `select` de equipe e
 * categoria, que são texto livre no schema.
 */
export function opcoesDistintas(valores: (string | null)[]): string[] {
  const unicos = new Set(
    valores.filter((v): v is string => typeof v === 'string' && v.trim() !== ''),
  )
  return [...unicos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
