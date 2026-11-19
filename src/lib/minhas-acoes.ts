/**
 * Organiza as ações de uma pessoa para a tela "Minhas ações" — módulo puro.
 *
 * A regra de atraso é a do painel (`acaoEstaAtrasada`). Os grupos não se
 * sobrepõem: cada ação cai em exatamente um, na ordem Atrasadas → Em aberto →
 * Concluídas, que é a ordem em que a pessoa precisa olhar.
 */

import { StatusAcao } from '../generated/prisma/enums'
import { acaoEstaAtrasada } from './projeto-resumo'

export type AcaoDaPessoa = {
  id: string
  projetoId: string
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoTermino: Date | null
  projeto: { nome: string; referencia: string | null }
}

export type AcaoClassificada = AcaoDaPessoa & { diasDeAtraso: number }

export type GruposMinhasAcoes = {
  atrasadas: AcaoClassificada[]
  emAberto: AcaoClassificada[]
  concluidas: AcaoClassificada[]
}

const DIA_MS = 86_400_000

/** Sem prazo vai para o fim: é o que menos pede ação agora. */
function porPrazo(a: AcaoClassificada, b: AcaoClassificada): number {
  const ta = a.previstoTermino?.getTime() ?? Infinity
  const tb = b.previstoTermino?.getTime() ?? Infinity
  return ta - tb || a.projeto.nome.localeCompare(b.projeto.nome) || a.numero - b.numero
}

export function classificarMinhasAcoes(
  acoes: readonly AcaoDaPessoa[],
  hoje: Date,
): GruposMinhasAcoes {
  const grupos: GruposMinhasAcoes = { atrasadas: [], emAberto: [], concluidas: [] }

  for (const acao of acoes) {
    const atrasada = acaoEstaAtrasada(acao, hoje)
    const diasDeAtraso =
      atrasada && acao.previstoTermino
        ? Math.round((hoje.getTime() - acao.previstoTermino.getTime()) / DIA_MS)
        : 0
    const item = { ...acao, diasDeAtraso }

    if (atrasada) grupos.atrasadas.push(item)
    else if (acao.status === StatusAcao.CONCLUIDO || acao.realizadoTermino !== null)
      grupos.concluidas.push(item)
    else grupos.emAberto.push(item)
  }

  // Atrasadas: a mais antiga primeiro (é a que está há mais tempo esperando).
  grupos.atrasadas.sort(porPrazo)
  grupos.emAberto.sort(porPrazo)
  // Concluídas: a mais recente primeiro.
  grupos.concluidas.sort((a, b) => porPrazo(b, a))
  return grupos
}
