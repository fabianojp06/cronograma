import { describe, expect, it } from 'vitest'

import {
  classificarEntrega,
  proximosVencimentos,
  rankingAtrasos,
  resumirAderencia,
  type AcaoComPrazo,
} from './dashboard-prazos'
import { StatusAcao } from '../generated/prisma/enums'

/** Data à meia-noite UTC — mesma convenção do resto do sistema. */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

let sequencia = 0

function acao(campos: Partial<AcaoComPrazo> = {}): AcaoComPrazo {
  sequencia += 1
  return {
    id: `acao-${sequencia}`,
    numero: sequencia,
    descricao: `Ação ${sequencia}`,
    status: StatusAcao.NAO_INICIADO,
    previstoInicio: null,
    previstoTermino: null,
    realizadoInicio: null,
    realizadoTermino: null,
    projetoId: 'projeto-1',
    projetoNome: 'Projeto 1',
    equipe: 'STI',
    responsavel: 'Ana',
    ...campos,
  }
}

describe('classificarEntrega', () => {
  it('é NO_PRAZO quando o realizado termina antes do previsto', () => {
    const entrega = acao({
      previstoTermino: d('2026-03-20'),
      realizadoTermino: d('2026-03-18'),
    })
    expect(classificarEntrega(entrega)).toBe('NO_PRAZO')
  })

  it('é NO_PRAZO quando termina exatamente no dia previsto', () => {
    const entrega = acao({
      previstoTermino: d('2026-03-20'),
      realizadoTermino: d('2026-03-20'),
    })
    expect(classificarEntrega(entrega)).toBe('NO_PRAZO')
  })

  it('é COM_ATRASO quando o realizado passa do previsto', () => {
    const entrega = acao({
      previstoTermino: d('2026-03-20'),
      realizadoTermino: d('2026-03-25'),
    })
    expect(classificarEntrega(entrega)).toBe('COM_ATRASO')
  })

  it('é NAO_AVALIAVEL sem uma das duas pontas', () => {
    expect(classificarEntrega(acao({ previstoTermino: d('2026-03-20') }))).toBe(
      'NAO_AVALIAVEL',
    )
    expect(classificarEntrega(acao({ realizadoTermino: d('2026-03-20') }))).toBe(
      'NAO_AVALIAVEL',
    )
    expect(classificarEntrega(acao())).toBe('NAO_AVALIAVEL')
  })
})

describe('resumirAderencia', () => {
  it('devolve zeros sem ações', () => {
    expect(resumirAderencia([])).toEqual({
      avaliaveis: 0,
      noPrazo: 0,
      comAtraso: 0,
      naoAvaliaveis: 0,
      percentualNoPrazo: 0,
      atrasoMedioDiasUteis: 0,
    })
  })

  it('calcula o percentual só sobre as avaliáveis', () => {
    const resumo = resumirAderencia([
      acao({ previstoTermino: d('2026-03-20'), realizadoTermino: d('2026-03-19') }),
      acao({ previstoTermino: d('2026-03-20'), realizadoTermino: d('2026-03-20') }),
      acao({ previstoTermino: d('2026-03-20'), realizadoTermino: d('2026-03-24') }),
      // Sem realizado: não pode empurrar o percentual para baixo.
      acao({ previstoTermino: d('2026-03-20') }),
    ])

    expect(resumo.avaliaveis).toBe(3)
    expect(resumo.noPrazo).toBe(2)
    expect(resumo.comAtraso).toBe(1)
    expect(resumo.naoAvaliaveis).toBe(1)
    expect(resumo.percentualNoPrazo).toBe(67)
  })

  it('mede o atraso médio em dias úteis, sem contar o dia do prazo', () => {
    // 20/03/2026 é sexta; 23 (seg) e 24 (ter) são os dois dias úteis de estouro.
    const resumo = resumirAderencia([
      acao({ previstoTermino: d('2026-03-20'), realizadoTermino: d('2026-03-24') }),
    ])
    expect(resumo.atrasoMedioDiasUteis).toBe(2)
  })

  it('não conta dias úteis de atraso para quem entregou no prazo', () => {
    const resumo = resumirAderencia([
      acao({ previstoTermino: d('2026-03-20'), realizadoTermino: d('2026-03-10') }),
    ])
    expect(resumo.atrasoMedioDiasUteis).toBe(0)
  })
})

describe('rankingAtrasos', () => {
  const hoje = d('2026-03-25')

  it('ignora ação concluída, ação já entregue e ação sem previsto', () => {
    const ranking = rankingAtrasos(
      [
        acao({ status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-03-01') }),
        acao({ previstoTermino: d('2026-03-01'), realizadoTermino: d('2026-03-05') }),
        acao({ previstoTermino: null }),
        acao({ previstoTermino: d('2026-04-30') }),
      ],
      hoje,
    )
    expect(ranking).toEqual([])
  })

  it('ordena do maior atraso para o menor', () => {
    const ranking = rankingAtrasos(
      [
        acao({ descricao: 'recente', previstoTermino: d('2026-03-23') }),
        acao({ descricao: 'antiga', previstoTermino: d('2026-03-02') }),
      ],
      hoje,
    )
    expect(ranking.map((l) => l.descricao)).toEqual(['antiga', 'recente'])
    expect(ranking[0].diasUteisDeAtraso).toBeGreaterThan(ranking[1].diasUteisDeAtraso)
  })

  it('conta o atraso em dias úteis a partir do dia seguinte ao prazo', () => {
    // Previsto 20/03 (sexta), hoje 25/03 (quarta): 23, 24 e 25 = 3 dias úteis.
    const [linha] = rankingAtrasos([acao({ previstoTermino: d('2026-03-20') })], hoje)
    expect(linha.diasUteisDeAtraso).toBe(3)
  })

  it('respeita o limite', () => {
    const acoes = Array.from({ length: 12 }, () =>
      acao({ previstoTermino: d('2026-03-02') }),
    )
    expect(rankingAtrasos(acoes, hoje).length).toBe(10)
    expect(rankingAtrasos(acoes, hoje, 3).length).toBe(3)
  })
})

describe('proximosVencimentos', () => {
  const hoje = d('2026-03-02')

  it('monta uma janela por prazo pedido, cumulativa', () => {
    const acoes = [
      acao({ descricao: 'em 5 dias', previstoTermino: d('2026-03-07') }),
      acao({ descricao: 'em 12 dias', previstoTermino: d('2026-03-14') }),
      acao({ descricao: 'em 25 dias', previstoTermino: d('2026-03-27') }),
      acao({ descricao: 'em 60 dias', previstoTermino: d('2026-05-01') }),
    ]

    const janelas = proximosVencimentos(acoes, hoje)

    expect(janelas.map((j) => j.dias)).toEqual([7, 15, 30])
    expect(janelas[0].acoes.map((a) => a.descricao)).toEqual(['em 5 dias'])
    expect(janelas[1].acoes.map((a) => a.descricao)).toEqual(['em 5 dias', 'em 12 dias'])
    expect(janelas[2].acoes.length).toBe(3)
  })

  it('inclui o que vence hoje e exclui o que já venceu', () => {
    const janelas = proximosVencimentos(
      [
        acao({ descricao: 'hoje', previstoTermino: hoje }),
        acao({ descricao: 'ontem', previstoTermino: d('2026-03-01') }),
      ],
      hoje,
    )
    expect(janelas[0].acoes.map((a) => a.descricao)).toEqual(['hoje'])
  })

  it('exclui ação já concluída ou já entregue', () => {
    const janelas = proximosVencimentos(
      [
        acao({ status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-03-05') }),
        acao({ previstoTermino: d('2026-03-05'), realizadoTermino: d('2026-03-03') }),
      ],
      hoje,
    )
    expect(janelas[0].acoes).toEqual([])
  })

  it('ordena cada janela pelo prazo mais próximo', () => {
    const janelas = proximosVencimentos(
      [
        acao({ descricao: 'depois', previstoTermino: d('2026-03-06') }),
        acao({ descricao: 'antes', previstoTermino: d('2026-03-03') }),
      ],
      hoje,
    )
    expect(janelas[0].acoes.map((a) => a.descricao)).toEqual(['antes', 'depois'])
  })

  it('aceita janelas customizadas', () => {
    const janelas = proximosVencimentos([], hoje, [1])
    expect(janelas.map((j) => j.rotulo)).toEqual(['Próximos 1 dias'])
  })
})
