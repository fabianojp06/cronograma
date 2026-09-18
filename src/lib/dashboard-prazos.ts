/**
 * Relatórios de prazo — aderência (Previsto x Realizado), ranking de atrasos e
 * radar de vencimentos. Módulo puro; a aritmética de calendário reaproveita
 * `diasUteisEntre` para que "atraso de 5 dias" signifique 5 dias **úteis**,
 * igual ao resto do sistema (CLAUDE.md).
 *
 * Todas as datas em UTC, como em `data-hoje.ts` e `gantt.ts`.
 */

import { diasUteisEntre } from './dias-uteis'
import { acaoEstaAtrasada } from './projeto-resumo'
import { StatusAcao } from '../generated/prisma/enums'

/** Recorte de Ação necessário para os relatórios de prazo, com o projeto junto. */
export type AcaoComPrazo = {
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
  equipe: string | null
  responsavel: string | null
}

export const CLASSIFICACOES_ENTREGA = [
  'NO_PRAZO',
  'COM_ATRASO',
  'NAO_AVALIAVEL',
] as const

export type ClassificacaoEntrega = (typeof CLASSIFICACOES_ENTREGA)[number]

/**
 * Só entra na aderência a ação que já terminou **e** tinha prazo previsto —
 * sem os dois lados da comparação o caso não é "no prazo" nem "atrasado", é
 * não avaliável, e misturá-lo inflaria artificialmente qualquer um dos lados.
 */
export function classificarEntrega(acao: AcaoComPrazo): ClassificacaoEntrega {
  if (acao.realizadoTermino === null || acao.previstoTermino === null) {
    return 'NAO_AVALIAVEL'
  }
  return acao.realizadoTermino.getTime() <= acao.previstoTermino.getTime()
    ? 'NO_PRAZO'
    : 'COM_ATRASO'
}

export type ResumoAderencia = {
  /** Ações concluídas com prazo previsto — base de cálculo do percentual. */
  avaliaveis: number
  noPrazo: number
  comAtraso: number
  naoAvaliaveis: number
  /** Inteiro de 0 a 100 sobre `avaliaveis`; 0 quando não há base. */
  percentualNoPrazo: number
  /** Média de dias úteis de estouro, só entre as entregues com atraso. */
  atrasoMedioDiasUteis: number
}

export function resumirAderencia(acoes: AcaoComPrazo[]): ResumoAderencia {
  let noPrazo = 0
  let comAtraso = 0
  let naoAvaliaveis = 0
  let somaAtraso = 0

  for (const acao of acoes) {
    const classificacao = classificarEntrega(acao)
    if (classificacao === 'NO_PRAZO') {
      noPrazo += 1
    } else if (classificacao === 'COM_ATRASO') {
      comAtraso += 1
      // `diasUteisEntre` é inclusivo nas pontas; o dia do prazo não conta como
      // atraso, então descontamos 1.
      somaAtraso += Math.max(
        0,
        diasUteisEntre(acao.previstoTermino!, acao.realizadoTermino!) - 1,
      )
    } else {
      naoAvaliaveis += 1
    }
  }

  const avaliaveis = noPrazo + comAtraso

  return {
    avaliaveis,
    noPrazo,
    comAtraso,
    naoAvaliaveis,
    percentualNoPrazo: avaliaveis === 0 ? 0 : Math.round((noPrazo / avaliaveis) * 100),
    atrasoMedioDiasUteis: comAtraso === 0 ? 0 : Math.round(somaAtraso / comAtraso),
  }
}

export type LinhaAtraso = AcaoComPrazo & { diasUteisDeAtraso: number }

/**
 * Ações em atraso **aberto** (regra do CLAUDE.md, via `acaoEstaAtrasada`),
 * ordenadas do atraso maior para o menor. Não inclui ação já entregue com
 * atraso: aquela é história, e o que precisa de ação é o que ainda está parado.
 */
export function rankingAtrasos(
  acoes: AcaoComPrazo[],
  hoje: Date,
  limite = 10,
): LinhaAtraso[] {
  return acoes
    .filter((acao) => acaoEstaAtrasada(acao, hoje))
    .map((acao) => ({
      ...acao,
      diasUteisDeAtraso: Math.max(0, diasUteisEntre(acao.previstoTermino!, hoje) - 1),
    }))
    .sort((a, b) => {
      if (b.diasUteisDeAtraso !== a.diasUteisDeAtraso) {
        return b.diasUteisDeAtraso - a.diasUteisDeAtraso
      }
      return a.projetoNome.localeCompare(b.projetoNome, 'pt-BR')
    })
    .slice(0, limite)
}

/** Janelas do radar de vencimentos, em dias corridos a partir de hoje. */
export const JANELAS_VENCIMENTO = [7, 15, 30] as const

export type JanelaVencimento = {
  dias: number
  rotulo: string
  acoes: AcaoComPrazo[]
}

/**
 * Ações ainda abertas cujo `previstoTermino` cai entre hoje (inclusive) e
 * hoje + N dias (inclusive). As janelas são **cumulativas** — a de 30 contém a
 * de 7 —, porque a pergunta do gestor é "o que vence até lá", não "o que vence
 * exatamente naquela faixa".
 */
export function proximosVencimentos(
  acoes: AcaoComPrazo[],
  hoje: Date,
  janelas: readonly number[] = JANELAS_VENCIMENTO,
): JanelaVencimento[] {
  const abertas = acoes.filter(
    (acao) =>
      acao.status !== StatusAcao.CONCLUIDO &&
      acao.realizadoTermino === null &&
      acao.previstoTermino !== null &&
      acao.previstoTermino.getTime() >= hoje.getTime(),
  )

  return janelas.map((dias) => {
    const limite = new Date(hoje.getTime())
    limite.setUTCDate(limite.getUTCDate() + dias)

    return {
      dias,
      rotulo: `Próximos ${dias} dias`,
      acoes: abertas
        .filter((acao) => acao.previstoTermino!.getTime() <= limite.getTime())
        .sort(
          (a, b) => a.previstoTermino!.getTime() - b.previstoTermino!.getTime(),
        ),
    }
  })
}
