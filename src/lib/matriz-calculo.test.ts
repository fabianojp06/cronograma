import { describe, expect, it } from 'vitest'

import {
  PESOS_PADRAO,
  calcularAvaliacao,
  formatarTotal,
  ordenarPorPrioridade,
  prioridadeRecomendada,
  quadranteDe,
  totalGut,
  totalPonderado,
  type Avaliacao,
  type PesosCriterios,
} from './matriz-calculo'
import { LIMIAR_BENEFICIO, LIMIAR_ESFORCO } from './matriz-criterios'

/** Avaliação a partir das notas na ordem da planilha. */
function avaliar(
  beneficio: [number, number, number, number, number],
  esforco: [number, number, number, number, number],
  gut: [number, number, number],
): Avaliacao {
  return {
    beneficioCompromissos: beneficio[0],
    beneficioValorTecnologico: beneficio[1],
    beneficioClima: beneficio[2],
    beneficioGovernanca: beneficio[3],
    beneficioEficiencia: beneficio[4],
    esforcoOrcamento: esforco[0],
    esforcoDuracao: esforco[1],
    esforcoCapacidadeEquipe: esforco[2],
    esforcoResistencia: esforco[3],
    esforcoComplexidade: esforco[4],
    gravidade: gut[0],
    urgencia: gut[1],
    tendencia: gut[2],
  }
}

/**
 * As três linhas preenchidas da planilha original, com os totais que ela
 * mostra. São o contrato: se um destes quebrar, o cálculo deixou de ser o
 * modelo aprovado pela CTCEA.
 */
describe('paridade com a planilha da CTCEA', () => {
  it('linha 1 — "Simulação Projeto 1"', () => {
    const r = calcularAvaliacao(avaliar([9, 9, 3, 3, 3], [6, 3, 9, 0, 6], [5, 5, 5]))
    expect(r.beneficio).toBe(5.4)
    expect(r.esforco).toBe(4.8)
    expect(r.gut).toBe(125)
    expect(r.prioridade).toBeCloseTo(140.625, 3)
  })

  it('linha 2 — "Projeto Gráfico Bolhas"', () => {
    const r = calcularAvaliacao(avaliar([3, 3, 6, 3, 3], [3, 6, 0, 0, 0], [3, 5, 5]))
    expect(r.beneficio).toBe(3.6)
    expect(r.esforco).toBe(1.8)
    expect(r.gut).toBe(75)
    expect(r.prioridade).toBe(150)
  })

  it('linha 3 — "Priorização"', () => {
    const r = calcularAvaliacao(avaliar([9, 3, 9, 9, 6], [6, 3, 3, 0, 0], [3, 3, 3]))
    expect(r.beneficio).toBe(7.2)
    expect(r.esforco).toBe(2.4)
    expect(r.gut).toBe(27)
    expect(r.prioridade).toBe(81)
  })

  it('soma em inteiros: 5.4 é exato, não 5.400000000000001', () => {
    // A planilha guarda o erro de ponto flutuante; aqui a soma é feita em
    // inteiros e só depois dividida por 100.
    const r = calcularAvaliacao(avaliar([9, 9, 3, 3, 3], [0, 0, 0, 0, 0], [1, 1, 1]))
    expect(r.beneficio).toBe(5.4)
    expect(String(r.beneficio)).toBe('5.4')
  })
})

describe('totalPonderado', () => {
  it('é zero quando todas as notas são zero', () => {
    const zerada = avaliar([0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [1, 1, 1])
    expect(totalPonderado(zerada, PESOS_PADRAO, 'BENEFICIO')).toBe(0)
    expect(totalPonderado(zerada, PESOS_PADRAO, 'ESFORCO')).toBe(0)
  })

  it('chega ao máximo da escala com todas as notas em 9', () => {
    const cheia = avaliar([9, 9, 9, 9, 9], [9, 9, 9, 9, 9], [1, 1, 1])
    expect(totalPonderado(cheia, PESOS_PADRAO, 'BENEFICIO')).toBe(9)
    expect(totalPonderado(cheia, PESOS_PADRAO, 'ESFORCO')).toBe(9)
  })

  it('separa os grupos — nota de esforço não entra no benefício', () => {
    const so = avaliar([0, 0, 0, 0, 0], [9, 9, 9, 9, 9], [1, 1, 1])
    expect(totalPonderado(so, PESOS_PADRAO, 'BENEFICIO')).toBe(0)
    expect(totalPonderado(so, PESOS_PADRAO, 'ESFORCO')).toBe(9)
  })

  it('respeita pesos diferentes do padrão', () => {
    const pesos: PesosCriterios = {
      ...PESOS_PADRAO,
      beneficioCompromissos: 60,
      beneficioValorTecnologico: 10,
      beneficioClima: 10,
      beneficioGovernanca: 10,
      beneficioEficiencia: 10,
    }
    // Só o critério de peso 60 tem nota: 9 × 60 / 100 = 5.4
    const notas = avaliar([9, 0, 0, 0, 0], [0, 0, 0, 0, 0], [1, 1, 1])
    expect(totalPonderado(notas, pesos, 'BENEFICIO')).toBe(5.4)
    // Com os pesos padrão o mesmo projeto valeria bem menos.
    expect(totalPonderado(notas, PESOS_PADRAO, 'BENEFICIO')).toBe(1.8)
  })

  it('trata critério ausente como nota e peso zero, sem NaN', () => {
    const parcial = { beneficioCompromissos: 9 } as unknown as Avaliacao
    expect(totalPonderado(parcial, PESOS_PADRAO, 'BENEFICIO')).toBe(1.8)
    expect(Number.isNaN(totalPonderado(parcial, {} as PesosCriterios, 'BENEFICIO'))).toBe(
      false,
    )
  })
})

describe('totalGut', () => {
  it('multiplica os três fatores, não os soma', () => {
    expect(totalGut({ gravidade: 5, urgencia: 5, tendencia: 5 })).toBe(125)
    expect(totalGut({ gravidade: 3, urgencia: 3, tendencia: 3 })).toBe(27)
    expect(totalGut({ gravidade: 1, urgencia: 1, tendencia: 1 })).toBe(1)
  })

  it('zera se qualquer fator for zero', () => {
    expect(totalGut({ gravidade: 0, urgencia: 5, tendencia: 5 })).toBe(0)
  })

  it('é não-linear: dobrar cada fator multiplica o total por oito', () => {
    const baixo = totalGut({ gravidade: 2, urgencia: 2, tendencia: 2 })
    const alto = totalGut({ gravidade: 4, urgencia: 4, tendencia: 4 })
    expect(alto).toBe(baixo * 8)
  })
})

describe('prioridadeRecomendada', () => {
  it('divide o benefício ponderado pelo esforço', () => {
    expect(prioridadeRecomendada(6, 2, 10)).toBe(30)
  })

  it('quando o esforço é zero, não divide — devolve Benefício × GUT', () => {
    // A guarda da planilha: SE(Esforço = 0; Benefício × GUT; ...)
    expect(prioridadeRecomendada(5, 0, 8)).toBe(40)
    expect(Number.isFinite(prioridadeRecomendada(5, 0, 8))).toBe(true)
  })

  it('é zero quando o GUT é zero, mesmo com benefício alto', () => {
    expect(prioridadeRecomendada(9, 1, 0)).toBe(0)
  })

  it('premia menor esforço para o mesmo benefício e GUT', () => {
    expect(prioridadeRecomendada(6, 1, 10)).toBeGreaterThan(
      prioridadeRecomendada(6, 3, 10),
    )
  })
})

describe('quadranteDe', () => {
  it('classifica os quatro cantos', () => {
    expect(quadranteDe(8, 1)).toBe('QUICK_WINS')
    expect(quadranteDe(8, 7)).toBe('ESTRATEGICOS')
    expect(quadranteDe(1, 1)).toBe('VIAVEIS')
    expect(quadranteDe(1, 7)).toBe('DESCARTAR')
  })

  it('o limiar pertence ao lado alto', () => {
    expect(quadranteDe(LIMIAR_BENEFICIO, LIMIAR_ESFORCO)).toBe('ESTRATEGICOS')
    expect(quadranteDe(LIMIAR_BENEFICIO - 0.01, LIMIAR_ESFORCO - 0.01)).toBe('VIAVEIS')
  })

  it('classifica o topo da escala, que a planilha deixava sem quadrante', () => {
    // A tabela da planilha vai só até 6 de esforço e 8 de benefício.
    expect(quadranteDe(9, 9)).toBe('ESTRATEGICOS')
    expect(quadranteDe(0, 9)).toBe('DESCARTAR')
  })
})

describe('ordenarPorPrioridade', () => {
  const linha = (prioridade: number, beneficio = 0, esforco = 0) => ({
    resultado: {
      prioridade,
      beneficio,
      esforco,
      gut: 1,
      quadrante: 'VIAVEIS' as const,
    },
  })

  it('ordena da maior prioridade para a menor', () => {
    const ordenadas = ordenarPorPrioridade([linha(10), linha(90), linha(50)])
    expect(ordenadas.map((l) => l.resultado.prioridade)).toEqual([90, 50, 10])
  })

  it('desempata por maior benefício e depois por menor esforço', () => {
    const ordenadas = ordenarPorPrioridade([
      linha(50, 4, 1),
      linha(50, 8, 3),
      linha(50, 8, 2),
    ])
    expect(ordenadas.map((l) => [l.resultado.beneficio, l.resultado.esforco])).toEqual([
      [8, 2],
      [8, 3],
      [4, 1],
    ])
  })

  it('não altera o array recebido', () => {
    const original = [linha(1), linha(2)]
    ordenarPorPrioridade(original)
    expect(original.map((l) => l.resultado.prioridade)).toEqual([1, 2])
  })
})

describe('formatarTotal', () => {
  it('usa duas casas e vírgula decimal', () => {
    expect(formatarTotal(5.4)).toBe('5,40')
    expect(formatarTotal(140.625)).toBe('140,63')
    expect(formatarTotal(0)).toBe('0,00')
  })
})
