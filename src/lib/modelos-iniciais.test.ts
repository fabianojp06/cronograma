import { describe, expect, it } from 'vitest'

import { LIMITE_ACOES_MODELO, instanciarModelo } from './modelo-projeto'
import { ehDiaUtil } from './dias-uteis'
import { MODELOS_INICIAIS, diasUteisDoModelo } from './modelos-iniciais'

describe('modelos iniciais', () => {
  it('são os quatro aprovados, com nomes únicos', () => {
    expect(MODELOS_INICIAIS).toHaveLength(4)
    const nomes = MODELOS_INICIAIS.map((m) => m.nome.toLowerCase())
    expect(new Set(nomes).size).toBe(4)
    for (const m of MODELOS_INICIAIS) {
      expect(m.nome.length).toBeLessThanOrEqual(120)
      expect(m.descricao.length).toBeLessThanOrEqual(1000)
    }
  })

  it('itens numerados em sequência, com início e duração válidos', () => {
    for (const m of MODELOS_INICIAIS) {
      expect(m.itens.length, m.nome).toBeLessThanOrEqual(LIMITE_ACOES_MODELO)
      m.itens.forEach((item, i) => {
        expect(item.ordem, m.nome).toBe(i + 1)
        expect(item.descricao.trim().length).toBeGreaterThan(5)
        expect(item.inicioDiasUteis).toBeGreaterThanOrEqual(0)
        expect(item.duracaoDiasUteis).toBeGreaterThanOrEqual(1)
      })
    }
  })

  it('a primeira ação começa no dia 0 e o total bate com o aprovado', () => {
    for (const m of MODELOS_INICIAIS) {
      expect(Math.min(...m.itens.map((i) => i.inicioDiasUteis!)), m.nome).toBe(0)
      expect(diasUteisDoModelo(m), m.nome).toBe(m.diasUteisTotais)
    }
    expect(MODELOS_INICIAIS.map((m) => m.diasUteisTotais)).toEqual([41, 46, 74, 65])
  })

  it('criar a partir deles dá datas em dias úteis, na ordem das ações', () => {
    // 2026-12-07 é uma segunda-feira.
    for (const m of MODELOS_INICIAIS) {
      const acoes = instanciarModelo(m.itens, new Date('2026-12-07T00:00:00Z'))
      expect(acoes).toHaveLength(m.itens.length)
      for (const a of acoes) {
        expect(ehDiaUtil(a.previstoInicio!), `${m.nome} #${a.numero} início`).toBe(true)
        expect(a.previstoTermino!.getTime()).toBeGreaterThanOrEqual(a.previstoInicio!.getTime())
      }
    }
  })
})
