/**
 * Agrupamento da carteira por dimensão do Projeto (equipe, responsável,
 * natureza, categoria, prioridade) — módulo puro, sem Prisma e sem Next.
 *
 * Recebe as linhas já resumidas por `montarLinhas`, exatamente como o painel
 * consolidado: os relatórios de dashboard e a tabela do painel precisam somar
 * o mesmo, e a única forma de garantir isso é partirem da mesma origem.
 */

import type { ResumoProjeto } from './projeto-resumo'

export const DIMENSOES = [
  'equipe',
  'responsavel',
  'natureza',
  'categoria',
  'prioridade',
] as const

export type Dimensao = (typeof DIMENSOES)[number]

export const ROTULO_DIMENSAO: Record<Dimensao, string> = {
  equipe: 'Equipe',
  responsavel: 'Responsável',
  natureza: 'Natureza',
  categoria: 'Categoria',
  prioridade: 'Prioridade',
}

/** Rótulo do grupo que junta os registros sem valor na dimensão. */
export const SEM_VALOR = 'Não informado'

/**
 * Recorte de Projeto necessário para agrupar. `prioridade` é número no schema
 * e vira texto aqui ("1", "2"...) para que todas as dimensões tenham a mesma
 * forma — o relatório só precisa da chave e do rótulo.
 */
export type ProjetoAgrupavel = {
  equipe: string | null
  responsavel: string | null
  natureza: string | null
  categoria: string | null
  prioridade: number | null
  resumo: ResumoProjeto
}

export type LinhaDimensao = {
  chave: string
  projetos: number
  projetosAtrasados: number
  acoes: number
  acoesConcluidas: number
  acoesAtrasadas: number
  /** Inteiro de 0 a 100 sobre as ações do grupo. */
  percentualConcluido: number
}

function valorDaDimensao(projeto: ProjetoAgrupavel, dimensao: Dimensao): string {
  const bruto = projeto[dimensao]
  if (bruto === null) return SEM_VALOR
  const texto = String(bruto).trim()
  return texto === '' ? SEM_VALOR : texto
}

/**
 * Agrupa e ordena por volume de ações (desc) e, no empate, pelo rótulo —
 * o leitor procura primeiro onde está o maior esforço. "Não informado" é
 * sempre empurrado para o fim, porque é ruído de cadastro, não uma categoria
 * de negócio.
 */
export function agruparPorDimensao(
  projetos: ProjetoAgrupavel[],
  dimensao: Dimensao,
): LinhaDimensao[] {
  const grupos = new Map<string, LinhaDimensao>()

  for (const projeto of projetos) {
    const chave = valorDaDimensao(projeto, dimensao)
    const atual =
      grupos.get(chave) ??
      {
        chave,
        projetos: 0,
        projetosAtrasados: 0,
        acoes: 0,
        acoesConcluidas: 0,
        acoesAtrasadas: 0,
        percentualConcluido: 0,
      }

    atual.projetos += 1
    if (projeto.resumo.acoesAtrasadas > 0) atual.projetosAtrasados += 1
    atual.acoes += projeto.resumo.totalAcoes
    atual.acoesConcluidas += projeto.resumo.acoesConcluidas
    atual.acoesAtrasadas += projeto.resumo.acoesAtrasadas

    grupos.set(chave, atual)
  }

  return [...grupos.values()]
    .map((linha) => ({
      ...linha,
      percentualConcluido:
        linha.acoes === 0 ? 0 : Math.round((linha.acoesConcluidas / linha.acoes) * 100),
    }))
    .sort((a, b) => {
      if (a.chave === SEM_VALOR) return 1
      if (b.chave === SEM_VALOR) return -1
      if (b.acoes !== a.acoes) return b.acoes - a.acoes
      return a.chave.localeCompare(b.chave, 'pt-BR')
    })
}

/** Maior valor de ações entre as linhas — escala das barras de magnitude. */
export function maiorVolume(linhas: LinhaDimensao[]): number {
  return linhas.reduce((maior, linha) => Math.max(maior, linha.acoes), 0)
}
