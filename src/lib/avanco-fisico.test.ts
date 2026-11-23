import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import {
  PERCENTUAL_DO_STATUS,
  avancoEm,
  pesoDaAcao,
  previstoDaAcaoEm,
  realizadoDaAcao,
  type AcaoParaAvanco,
} from './avanco-fisico'

const d = (mes: number, dia: number) => new Date(Date.UTC(2026, mes - 1, dia))

// 1 a 5 de junho de 2026: segunda a sexta, sem feriado nacional fixo.
const semana: AcaoParaAvanco = {
  status: StatusAcao.NAO_INICIADO,
  previstoInicio: d(6, 1),
  previstoTermino: d(6, 5),
}

describe('PERCENTUAL_DO_STATUS', () => {
  it('mapeia os status para 0, 25, 50, 75 e 100', () => {
    expect(Object.values(PERCENTUAL_DO_STATUS).sort((a, b) => a - b)).toEqual([
      0, 25, 50, 75, 100,
    ])
    expect(PERCENTUAL_DO_STATUS[StatusAcao.CONCLUIDO]).toBe(100)
    expect(PERCENTUAL_DO_STATUS[StatusAcao.NAO_INICIADO]).toBe(0)
  })
})

describe('pesoDaAcao', () => {
  it('conta os dias úteis do previsto', () => {
    expect(pesoDaAcao(semana)).toBe(5)
  })
  it('é 0 sem data', () => {
    expect(pesoDaAcao({ ...semana, previstoInicio: null })).toBe(0)
    expect(pesoDaAcao({ ...semana, previstoTermino: null })).toBe(0)
  })
  it('é 0 se o término vem antes do início', () => {
    expect(
      pesoDaAcao({ ...semana, previstoInicio: d(6, 5), previstoTermino: d(6, 1) }),
    ).toBe(0)
  })
})

describe('previstoDaAcaoEm', () => {
  it('é 0 antes do início', () => {
    expect(previstoDaAcaoEm(semana, d(5, 29))).toBe(0)
  })
  it('é 100 depois do término', () => {
    expect(previstoDaAcaoEm(semana, d(6, 10))).toBe(100)
  })
  it('é 60 no 3º dos 5 dias úteis', () => {
    expect(previstoDaAcaoEm(semana, d(6, 3))).toBe(60)
  })
  it('é 0 sem peso', () => {
    expect(previstoDaAcaoEm({ ...semana, previstoInicio: null }, d(6, 3))).toBe(0)
  })
})

describe('realizadoDaAcao', () => {
  it('segue o percentual do status', () => {
    expect(realizadoDaAcao({ ...semana, status: StatusAcao.CONCLUIDO })).toBe(100)
    expect(realizadoDaAcao(semana)).toBe(0)
  })
})

describe('avancoEm', () => {
  const curta: AcaoParaAvanco = { ...semana, status: StatusAcao.CONCLUIDO }
  const longa: AcaoParaAvanco = {
    status: StatusAcao.NAO_INICIADO,
    previstoInicio: d(6, 8),
    previstoTermino: d(6, 26),
  }

  it('pondera pelo peso (5 e 15 dias úteis)', () => {
    expect(pesoDaAcao(longa)).toBe(15)
    const r = avancoEm([curta, longa], d(6, 7))
    expect(r).toEqual({
      previsto: 25,
      realizado: 25,
      desvio: 0,
      peso: 20,
      acoesSemPeso: 0,
    })
  })
  it('desvio negativo quando o realizado fica atrás', () => {
    const r = avancoEm([{ ...curta, status: StatusAcao.NAO_INICIADO }, longa], d(6, 7))
    expect(r?.desvio).toBe(-25)
  })
  it('arredonda a 1 casa e calcula o desvio antes de arredondar', () => {
    const tres: AcaoParaAvanco = {
      status: StatusAcao.CONCLUIDO,
      previstoInicio: d(6, 1),
      previstoTermino: d(6, 3),
    }
    const r = avancoEm([tres, longa], d(6, 7))
    // realizado = 3*100/18 = 16,666...; previsto = 3*100/18
    expect(r?.realizado).toBe(16.7)
    expect(r?.desvio).toBe(0)
  })
  it('devolve null sem ações ou sem peso', () => {
    expect(avancoEm([], d(6, 7))).toBeNull()
    expect(
      avancoEm([{ ...semana, previstoInicio: null }], d(6, 7)),
    ).toBeNull()
  })
  it('conta ações sem peso quando há ao menos uma com peso', () => {
    const r = avancoEm([curta, { ...semana, previstoTermino: null }], d(6, 7))
    expect(r?.acoesSemPeso).toBe(1)
    expect(r?.peso).toBe(5)
  })
})
