/**
 * Tabelas dos relatórios exportáveis — módulo puro. Cada relatório vira
 * `{ titulo, colunas, linhas }`, e o formato (Excel) é problema de quem escreve:
 * o conteúdo é decidido e testado aqui.
 *
 * Datas saem como `Date` (a planilha formata e ainda ordena/filtra por data),
 * nunca como texto "dd/mm/aaaa". Números saem como número, pelo mesmo motivo.
 *
 * Os relatórios partem das MESMAS regras do painel (`resumirAcoes`,
 * `acaoEstaAtrasada`): a planilha que sai numa reunião não pode contradizer a tela.
 */

import { ROTULOS_STATUS, type StatusAcao } from './acao-validacao'
import type { LinhaProjeto } from '@/components/lista-projetos'
import { ROTULO_SINAL } from './farol-projeto'
import { acaoEstaAtrasada, ROTULO_STATUS_AGREGADO } from './projeto-resumo'

export const RELATORIOS_EXPORTAVEIS = ['projetos', 'acoes', 'atrasadas'] as const
export type RelatorioExportavel = (typeof RELATORIOS_EXPORTAVEIS)[number]

export function ehRelatorioExportavel(valor: string): valor is RelatorioExportavel {
  return (RELATORIOS_EXPORTAVEIS as readonly string[]).includes(valor)
}

export type Celula = string | number | Date | null

export type Coluna = {
  titulo: string
  /** Largura em caracteres. */
  largura: number
  tipo?: 'data' | 'inteiro' | 'percentual' | 'decimal'
}

export type TabelaExportacao = {
  /** Nome da aba e do arquivo. */
  titulo: string
  colunas: Coluna[]
  linhas: Celula[][]
}

export function tabelaDeProjetos(linhas: readonly LinhaProjeto[]): TabelaExportacao {
  return {
    titulo: 'Projetos',
    colunas: [
      { titulo: 'Referência', largura: 20 },
      { titulo: 'Projeto', largura: 44 },
      { titulo: 'Equipe', largura: 12 },
      { titulo: 'Categoria', largura: 18 },
      { titulo: 'Responsável', largura: 24 },
      { titulo: 'Prioridade', largura: 11, tipo: 'inteiro' },
      { titulo: 'Ações', largura: 8, tipo: 'inteiro' },
      { titulo: 'Concluídas', largura: 11, tipo: 'inteiro' },
      { titulo: 'Atrasadas', largura: 10, tipo: 'inteiro' },
      { titulo: '% concluído', largura: 12, tipo: 'percentual' },
      { titulo: 'Situação', largura: 14 },
      { titulo: 'Sinal', largura: 12 },
      { titulo: 'Desvio (p.p.)', largura: 14, tipo: 'decimal' },
    ],
    linhas: linhas.map((l) => [
      l.referencia,
      l.nome,
      l.equipe,
      l.categoria,
      l.responsavel,
      l.prioridade,
      l.resumo.totalAcoes,
      l.resumo.acoesConcluidas,
      l.resumo.acoesAtrasadas,
      // Guardado como fração (0–1) para o formato % da planilha.
      l.resumo.percentualConcluido / 100,
      ROTULO_STATUS_AGREGADO[l.resumo.status],
      ROTULO_SINAL[l.sinal.sinal],
      l.sinal.desvio,
    ]),
  }
}

export type AcaoParaExportar = {
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
  projeto: { nome: string; referencia: string | null; equipe: string | null }
  responsavel: { nome: string } | null
}

const DIA_MS = 86_400_000

const COLUNAS_ACAO: Coluna[] = [
  { titulo: 'Referência', largura: 20 },
  { titulo: 'Projeto', largura: 36 },
  { titulo: 'Equipe', largura: 12 },
  { titulo: 'Ação', largura: 7, tipo: 'inteiro' },
  { titulo: 'Descrição', largura: 52 },
  { titulo: 'Responsável', largura: 24 },
  { titulo: 'Status', largura: 16 },
  { titulo: 'Previsto — início', largura: 17, tipo: 'data' },
  { titulo: 'Previsto — término', largura: 18, tipo: 'data' },
  { titulo: 'Realizado — início', largura: 18, tipo: 'data' },
  { titulo: 'Realizado — término', largura: 19, tipo: 'data' },
  { titulo: 'Dias de atraso', largura: 14, tipo: 'inteiro' },
]

/**
 * `somenteAtrasadas` aplica a regra do painel. A coluna "Dias de atraso" fica
 * vazia (não zero) para quem não está atrasado: zero leria como "atrasou 0 dias".
 */
export function tabelaDeAcoes(
  acoes: readonly AcaoParaExportar[],
  hoje: Date,
  somenteAtrasadas = false,
): TabelaExportacao {
  const linhas: Celula[][] = []
  for (const a of acoes) {
    const atrasada = acaoEstaAtrasada(a, hoje)
    if (somenteAtrasadas && !atrasada) continue
    linhas.push([
      a.projeto.referencia,
      a.projeto.nome,
      a.projeto.equipe,
      a.numero,
      a.descricao,
      a.responsavel?.nome ?? null,
      ROTULOS_STATUS[a.status],
      a.previstoInicio,
      a.previstoTermino,
      a.realizadoInicio,
      a.realizadoTermino,
      atrasada && a.previstoTermino
        ? Math.round((hoje.getTime() - a.previstoTermino.getTime()) / DIA_MS)
        : null,
    ])
  }

  if (somenteAtrasadas) {
    // Mais atrasada primeiro: é a ordem em que a reunião vai discutir.
    linhas.sort((x, y) => (y[11] as number) - (x[11] as number))
  }
  return {
    titulo: somenteAtrasadas ? 'Ações atrasadas' : 'Ações',
    colunas: COLUNAS_ACAO,
    linhas,
  }
}

/** Nome do arquivo: sem acento nem espaço, com a data do dia. */
export function nomeDoArquivo(tabela: TabelaExportacao, hoje: Date): string {
  const base = tabela.titulo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}-${hoje.toISOString().slice(0, 10)}.xlsx`
}
