import { describe, expect, it } from 'vitest'

import { FASES_DMAIC } from './dmaic'
import { LIMITE_ACOES_MODELO, instanciarModelo, macroetapasDoModelo } from './modelo-projeto'
import { ehDiaUtil } from './dias-uteis'
import { MODELOS_INICIAIS, diasUteisDoModelo } from './modelos-iniciais'

describe('modelos iniciais', () => {
  it('são os cinco modelos iniciais, com nomes únicos', () => {
    expect(MODELOS_INICIAIS).toHaveLength(5)
    const nomes = MODELOS_INICIAIS.map((m) => m.nome.toLowerCase())
    expect(new Set(nomes).size).toBe(5)
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
    expect(MODELOS_INICIAIS.map((m) => m.diasUteisTotais)).toEqual([41, 46, 74, 65, 70])
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

  it('o modelo DMAIC tem as cinco fases na ordem, cada uma com ao menos duas ações, e cabe em 12 macroetapas', () => {
    const dmaic = MODELOS_INICIAIS.find((m) => m.nome.includes('DMAIC'))!
    const macros = macroetapasDoModelo(dmaic.itens)
    expect(macros.map((m) => m.nome)).toEqual(FASES_DMAIC.map((f) => f.nome))
    expect(macros.every((m) => (m.descricao ?? '').length > 40)).toBe(true)
    for (const f of FASES_DMAIC) {
      expect(dmaic.itens.filter((i) => i.macroetapa === f.nome).length, f.nome).toBeGreaterThanOrEqual(2)
    }
    // As ações de cada fase não começam antes da fase anterior ter começado.
    const inicios = FASES_DMAIC.map((f) => Math.min(...dmaic.itens.filter((i) => i.macroetapa === f.nome).map((i) => i.inicioDiasUteis!)))
    expect([...inicios].sort((a, b) => a - b)).toEqual(inicios)
  })
})
