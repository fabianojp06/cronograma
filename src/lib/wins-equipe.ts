/**
 * Visão de equipe do Card WIN — o "Compartilhamento dos Cards" da aba Agenda
 * da planilha, que é o momento da daily.
 *
 * Módulo puro: monta a leitura de uma semana para todos de uma vez. A tela
 * individual (`/wins`) e esta partem das MESMAS funções de contagem
 * (`contarAparicoesAte`, `situacaoDoWin`) — divergir entre as duas é
 * exatamente o defeito que a planilha tinha entre as abas S36 e S37.
 */

import { contarAparicoesAte, deveSerPromovido, situacaoDoWin, type SituacaoWin } from './win-promocao'
import type { SemanaCtcea } from './semana-ctcea'

export type StatusDoWin = 'PENDENTE' | 'EM_ANDAMENTO' | 'FEITO' | 'NAO_FEITO'

/** O que a consulta entrega, por registro do card. */
export type RegistroLido = {
  ordem: number
  prazo: Date | null
  status: StatusDoWin
  win: {
    id: string
    descricao: string
    suporte: string | null
    aparicoesAnteriores: number
    promovidoEm: Date | null
    encerradoEm: Date | null
    registros: { card: { ano: number; semana: number } }[]
  }
}

export type CardLido = {
  area: string | null
  atividade: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
  colaborador: { id: string; nome: string; ativo: boolean }
  registros: RegistroLido[]
}

export type WinDaEquipe = {
  winId: string
  ordem: number
  descricao: string
  suporte: string | null
  prazo: Date | null
  status: StatusDoWin
  aparicoes: number
  situacao: SituacaoWin
  deveSerPromovido: boolean
}

export type CardDaEquipe = {
  colaborador: { id: string; nome: string; ativo: boolean }
  area: string | null
  atividade: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
  wins: WinDaEquipe[]
}

/**
 * Monta a semana da equipe, com a contagem congelada na semana exibida.
 *
 * O `aparicoesAnteriores: 0` no contável não é descuido: `contarAparicoesAte`
 * JÁ soma as aparições anteriores, e `situacaoDoWin` somaria de novo por dentro
 * de `totalDeAparicoes`. Passar o valor real aqui contaria em dobro justamente
 * os WINs importados — os que mais se repetem. A tela individual faz o mesmo.
 */
export function montarEquipe(cards: CardLido[], semana: SemanaCtcea): CardDaEquipe[] {
  return cards.map((card) => ({
    colaborador: card.colaborador,
    area: card.area,
    atividade: card.atividade,
    alertaRiscos: card.alertaRiscos,
    pedidoAjuda: card.pedidoAjuda,
    wins: card.registros.map((registro) => {
      const aparicoes = contarAparicoesAte(
        registro.win.aparicoesAnteriores,
        registro.win.registros.map((r) => r.card),
        semana,
      )
      const contavel = {
        aparicoesAnteriores: 0,
        registros: aparicoes,
        promovidoEm: registro.win.promovidoEm,
        encerradoEm: registro.win.encerradoEm,
      }
      return {
        winId: registro.win.id,
        ordem: registro.ordem,
        descricao: registro.win.descricao,
        suporte: registro.win.suporte,
        prazo: registro.prazo,
        status: registro.status,
        aparicoes,
        situacao: situacaoDoWin(contavel),
        deveSerPromovido: deveSerPromovido(contavel),
      }
    }),
  }))
}

/**
 * Quem ainda não tem nenhum WIN na semana — numa daily, o dado mais acionável
 * da tela.
 *
 * O critério é **não ter WIN**, e não "não ter `CardSemanal`". Salvar só o
 * cabeçalho (área, atividade) já cria a linha do card, e ela sobrevive à
 * remoção dos WINs: quem digitou a área e mais nada tem card, zero WINs, e
 * sumiria desta lista — justamente quem a reunião precisa ver.
 *
 * Só considera colaboradores ativos: cobrar card de quem saiu da equipe não faz
 * sentido, ainda que o card antigo dessa pessoa continue visível no histórico.
 */
export function semWins(
  ativos: readonly { id: string; nome: string }[],
  cards: readonly CardDaEquipe[],
): { id: string; nome: string }[] {
  const comWins = new Set(
    cards.filter((c) => c.wins.length > 0).map((c) => c.colaborador.id),
  )
  return ativos.filter((a) => !comWins.has(a.id)).map(({ id, nome }) => ({ id, nome }))
}

/** Números do topo da tela — o resumo que a reunião lê primeiro. */
export function resumoDaEquipe(cards: readonly CardDaEquipe[]) {
  const wins = cards.flatMap((c) => c.wins)
  return {
    /** Quem de fato comprometeu algo — ter card só de cabeçalho não conta. */
    comWins: cards.filter((c) => c.wins.length > 0).length,
    totalWins: wins.length,
    concluidos: wins.filter((w) => w.status === 'FEITO').length,
    aPromover: wins.filter((w) => w.deveSerPromovido).length,
  }
}
