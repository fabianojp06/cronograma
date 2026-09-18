/**
 * Higiene do cadastro — módulo puro.
 *
 * Todo número de dashboard tem um rodapé implícito: "supondo que o cadastro
 * esteja completo". Depois da importação das planilhas reais esse pressuposto
 * não se sustenta sozinho (muitos itens vieram sem data e sem responsável), e
 * um projeto sem `previstoTermino` some silenciosamente do relatório de atraso.
 * Este relatório torna o buraco visível em vez de deixá-lo distorcer o resto.
 */

import { StatusAcao } from '../generated/prisma/enums'

export type AcaoAuditavel = {
  id: string
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
  projetoId: string
  projetoNome: string
}

export type ProjetoAuditavel = {
  id: string
  nome: string
  equipe: string | null
  responsavel: string | null
  totalAcoes: number
}

export const PENDENCIAS = [
  'PROJETO_SEM_ACAO',
  'PROJETO_SEM_RESPONSAVEL',
  'PROJETO_SEM_EQUIPE',
  'ACAO_SEM_PREVISTO',
  'ACAO_PREVISTO_INVERTIDO',
  'ACAO_REALIZADO_INVERTIDO',
  'ACAO_CONCLUIDA_SEM_REALIZADO',
  'ACAO_REALIZADA_NAO_CONCLUIDA',
] as const

export type Pendencia = (typeof PENDENCIAS)[number]

export const ROTULO_PENDENCIA: Record<Pendencia, string> = {
  PROJETO_SEM_ACAO: 'Projetos sem nenhuma ação',
  PROJETO_SEM_RESPONSAVEL: 'Projetos sem responsável',
  PROJETO_SEM_EQUIPE: 'Projetos sem equipe',
  ACAO_SEM_PREVISTO: 'Ações sem data prevista de término',
  ACAO_PREVISTO_INVERTIDO: 'Ações com término previsto antes do início',
  ACAO_REALIZADO_INVERTIDO: 'Ações com término realizado antes do início',
  ACAO_CONCLUIDA_SEM_REALIZADO: 'Ações concluídas sem data de término realizado',
  ACAO_REALIZADA_NAO_CONCLUIDA: 'Ações com término realizado mas status não concluído',
}

/** Por que a pendência importa — some no relatório junto do número. */
export const EFEITO_PENDENCIA: Record<Pendencia, string> = {
  PROJETO_SEM_ACAO: 'Entram na contagem de projetos mas não têm progresso a medir.',
  PROJETO_SEM_RESPONSAVEL: 'Ficam fora do relatório de carga por responsável.',
  PROJETO_SEM_EQUIPE: 'Ficam fora do relatório por equipe.',
  ACAO_SEM_PREVISTO: 'Nunca aparecem como atrasadas — a regra de atraso exige o previsto.',
  ACAO_PREVISTO_INVERTIDO: 'Geram barra de Gantt com duração negativa.',
  ACAO_REALIZADO_INVERTIDO: 'Geram barra de Gantt com duração negativa.',
  ACAO_CONCLUIDA_SEM_REALIZADO: 'Contam como entregues sem data para medir aderência.',
  ACAO_REALIZADA_NAO_CONCLUIDA: 'Somem do progresso, embora a entrega já tenha ocorrido.',
}

export type LinhaPendencia = {
  pendencia: Pendencia
  rotulo: string
  efeito: string
  quantidade: number
}

function inverteu(inicio: Date | null, termino: Date | null): boolean {
  return inicio !== null && termino !== null && termino.getTime() < inicio.getTime()
}

export function apurarPendencias(
  projetos: ProjetoAuditavel[],
  acoes: AcaoAuditavel[],
): LinhaPendencia[] {
  const semTexto = (valor: string | null) => valor === null || valor.trim() === ''

  const contagem: Record<Pendencia, number> = {
    PROJETO_SEM_ACAO: projetos.filter((p) => p.totalAcoes === 0).length,
    PROJETO_SEM_RESPONSAVEL: projetos.filter((p) => semTexto(p.responsavel)).length,
    PROJETO_SEM_EQUIPE: projetos.filter((p) => semTexto(p.equipe)).length,
    ACAO_SEM_PREVISTO: acoes.filter((a) => a.previstoTermino === null).length,
    ACAO_PREVISTO_INVERTIDO: acoes.filter((a) =>
      inverteu(a.previstoInicio, a.previstoTermino),
    ).length,
    ACAO_REALIZADO_INVERTIDO: acoes.filter((a) =>
      inverteu(a.realizadoInicio, a.realizadoTermino),
    ).length,
    ACAO_CONCLUIDA_SEM_REALIZADO: acoes.filter(
      (a) => a.status === StatusAcao.CONCLUIDO && a.realizadoTermino === null,
    ).length,
    ACAO_REALIZADA_NAO_CONCLUIDA: acoes.filter(
      (a) => a.realizadoTermino !== null && a.status !== StatusAcao.CONCLUIDO,
    ).length,
  }

  // Ordem: maior incidência primeiro; pendências zeradas continuam na lista
  // (com 0) porque "conferido e está limpo" é informação, não ausência dela.
  return PENDENCIAS.map((pendencia) => ({
    pendencia,
    rotulo: ROTULO_PENDENCIA[pendencia],
    efeito: EFEITO_PENDENCIA[pendencia],
    quantidade: contagem[pendencia],
  })).sort((a, b) => b.quantidade - a.quantidade)
}

/** Total de ocorrências — cabeçalho do relatório. */
export function totalPendencias(linhas: LinhaPendencia[]): number {
  return linhas.reduce((soma, linha) => soma + linha.quantidade, 0)
}
