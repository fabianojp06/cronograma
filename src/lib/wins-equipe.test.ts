import { describe, expect, it } from 'vitest'

import {
  montarEquipe,
  resumoDaEquipe,
  semWins,
  type CardLido,
  type RegistroLido,
} from './wins-equipe'

const S = (semana: number) => ({ ano: 2026, semana })

function registro(extra: Partial<RegistroLido> & { semanas?: number[] } = {}): RegistroLido {
  const { semanas = [39], ...resto } = extra
  return {
    ordem: 1,
    prazo: null,
    status: 'PENDENTE',
    ...resto,
    win: {
      id: 'w1',
      descricao: 'Fechar o relatório',
      suporte: null,
      aparicoesAnteriores: 0,
      promovidoEm: null,
      encerradoEm: null,
      registros: semanas.map((s) => ({ card: { ano: 2026, semana: s } })),
      ...(resto.win ?? {}),
    },
  }
}

function card(nome: string, registros: RegistroLido[], ativo = true): CardLido {
  return {
    area: 'AGP',
    atividade: null,
    alertaRiscos: null,
    pedidoAjuda: null,
    colaborador: { id: nome.toLowerCase(), nome, ativo },
    registros,
  }
}

describe('montarEquipe', () => {
  it('conta as aparições congeladas na semana exibida', () => {
    const [c] = montarEquipe([card('Ana', [registro({ semanas: [37, 38, 39] })])], S(38))
    // Olhando a S38, a aparição da S39 ainda não aconteceu.
    expect(c.wins[0].aparicoes).toBe(2)
  })

  it('dispara o alerta na terceira aparição', () => {
    const [c] = montarEquipe([card('Ana', [registro({ semanas: [37, 38, 39] })])], S(39))
    expect(c.wins[0].aparicoes).toBe(3)
    expect(c.wins[0].deveSerPromovido).toBe(true)
  })

  it('NÃO conta aparicoesAnteriores em dobro', () => {
    // `contarAparicoesAte` já soma o campo, e `situacaoDoWin` somaria de novo
    // por dentro de `totalDeAparicoes`. É a armadilha que a tela individual
    // contorna passando zero — se este teste quebrar, alguém a reintroduziu.
    const r = registro({ semanas: [39] })
    r.win.aparicoesAnteriores = 2
    const [c] = montarEquipe([card('Ana', [r])], S(39))
    expect(c.wins[0].aparicoes).toBe(3)
    expect(c.wins[0].deveSerPromovido).toBe(true)
  })

  it('um WIN encerrado não é marcado para promover', () => {
    // Sem `encerradoEm` na consulta, `situacaoDoWin` trataria como ativo e a
    // tela carimbaria "deve ser promovido" em algo que a pessoa já encerrou.
    const r = registro({ semanas: [37, 38, 39] })
    r.win.encerradoEm = new Date('2026-09-25')
    const [c] = montarEquipe([card('Ana', [r])], S(39))
    expect(c.wins[0].situacao).toBe('ENCERRADO')
    expect(c.wins[0].deveSerPromovido).toBe(false)
  })

  it('um WIN promovido aparece como promovido, não como pendente de promoção', () => {
    const r = registro({ semanas: [37, 38, 39] })
    r.win.promovidoEm = new Date('2026-09-25')
    const [c] = montarEquipe([card('Ana', [r])], S(39))
    expect(c.wins[0].situacao).toBe('PROMOVIDO')
    expect(c.wins[0].deveSerPromovido).toBe(false)
  })

  it('preserva o card de quem já saiu da equipe', () => {
    // A tela navega por semanas passadas: esconder o card de quem saiu
    // reescreveria o que aconteceu naquela semana.
    const [c] = montarEquipe([card('Saiu', [registro()], false)], S(39))
    expect(c.colaborador.ativo).toBe(false)
    expect(c.wins).toHaveLength(1)
  })
})

describe('semWins', () => {
  const ativos = [
    { id: 'ana', nome: 'Ana' },
    { id: 'bruno', nome: 'Bruno' },
    { id: 'clara', nome: 'Clara' },
  ]

  it('lista quem não tem WIN nenhum', () => {
    const cards = montarEquipe([card('Ana', [registro()])], S(39))
    expect(semWins(ativos, cards).map((p) => p.nome)).toEqual(['Bruno', 'Clara'])
  })

  it('inclui quem tem card só de cabeçalho', () => {
    // `salvarCard` cria a linha do card ao salvar a área, sem nenhum WIN. Se o
    // critério fosse "tem CardSemanal", essa pessoa sumiria da lista de quem
    // falta — justamente quem a daily precisa ver.
    const cards = montarEquipe([card('Ana', []), card('Bruno', [registro()])], S(39))
    expect(semWins(ativos, cards).map((p) => p.nome)).toEqual(['Ana', 'Clara'])
  })

  it('não cobra card de quem foi desativado', () => {
    const cards = montarEquipe([card('Saiu', [], false)], S(39))
    expect(semWins(ativos, cards).map((p) => p.nome)).toEqual(['Ana', 'Bruno', 'Clara'])
  })

  it('devolve vazio quando todos preencheram', () => {
    const cards = montarEquipe(
      ativos.map((a) => card(a.nome, [registro()])),
      S(39),
    )
    expect(semWins(ativos, cards)).toEqual([])
  })
})

describe('resumoDaEquipe', () => {
  it('conta pessoas com WIN, total, concluídos e a promover', () => {
    const cards = montarEquipe(
      [
        card('Ana', [
          registro({ status: 'FEITO' }),
          registro({ ordem: 2, semanas: [37, 38, 39] }),
        ]),
        card('Bruno', []),
      ],
      S(39),
    )
    expect(resumoDaEquipe(cards)).toEqual({
      pessoas: 1,
      totalWins: 2,
      concluidos: 1,
      aPromover: 1,
    })
  })
})
