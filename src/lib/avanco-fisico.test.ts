import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import {
  PERCENTUAL_DO_STATUS,
  avancoEm,
  umaCasa,
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

describe('previstoDaAcaoEm: bordas', () => {
  it('no dia de início vale 1/peso', () => {
    expect(previstoDaAcaoEm(semana, d(6, 1))).toBe(20)
  })
  it('exatamente no término vale 100', () => {
    expect(previstoDaAcaoEm(semana, d(6, 5))).toBe(100)
  })
  it('início == término (peso 1) vale 100 no próprio dia e 0 antes', () => {
    const um: AcaoParaAvanco = {
      ...semana,
      previstoInicio: d(6, 3),
      previstoTermino: d(6, 3),
    }
    expect(pesoDaAcao(um)).toBe(1)
    expect(previstoDaAcaoEm(um, d(6, 3))).toBe(100)
    expect(previstoDaAcaoEm(um, d(6, 2))).toBe(0)
  })
  it('fim de semana entre início e término não soma dias úteis', () => {
    const duas: AcaoParaAvanco = {
      ...semana,
      previstoInicio: d(6, 4),
      previstoTermino: d(6, 9),
    }
    expect(pesoDaAcao(duas)).toBe(4)
    expect(previstoDaAcaoEm(duas, d(6, 6))).toBe(50)
    expect(previstoDaAcaoEm(duas, d(6, 7))).toBe(50)
  })
  it('início no sábado e término no domingo não têm peso', () => {
    const fds: AcaoParaAvanco = {
      ...semana,
      previstoInicio: d(6, 6),
      previstoTermino: d(6, 7),
    }
    expect(pesoDaAcao(fds)).toBe(0)
    expect(previstoDaAcaoEm(fds, d(6, 7))).toBe(0)
  })
  it('início em feriado conta só os dias úteis seguintes', () => {
    // 07/09/2026 (segunda) é feriado: 7 a 11 de setembro = 4 dias úteis.
    const feriado: AcaoParaAvanco = {
      ...semana,
      previstoInicio: d(9, 7),
      previstoTermino: d(9, 11),
    }
    expect(pesoDaAcao(feriado)).toBe(4)
    expect(previstoDaAcaoEm(feriado, d(9, 8))).toBe(25)
  })
  it('término em feriado não conta o feriado', () => {
    // 3 (qui) a 7 (seg, feriado) de setembro de 2026: só quinta e sexta.
    const f: AcaoParaAvanco = {
      ...semana,
      previstoInicio: d(9, 3),
      previstoTermino: d(9, 7),
    }
    expect(pesoDaAcao(f)).toBe(2)
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
  it('calcula o desvio antes de arredondar', () => {
    // Pesos 3 e 11, ambas no 1º dia útil: previsto = 14,2857 (14,3) e
    // realizado = 19,6428 (19,6). Desvio sem arredondar antes: 5,357 -> 5,4;
    // arredondando antes de subtrair daria 19,6 - 14,3 = 5,3.
    const a: AcaoParaAvanco = {
      status: StatusAcao.NAO_INICIADO,
      previstoInicio: d(6, 1),
      previstoTermino: d(6, 3),
    }
    const b: AcaoParaAvanco = {
      status: StatusAcao.EM_CURSO_25,
      previstoInicio: d(6, 1),
      previstoTermino: d(6, 15),
    }
    expect(pesoDaAcao(a)).toBe(3)
    expect(pesoDaAcao(b)).toBe(11)
    const r = avancoEm([a, b], d(6, 1))
    expect(r?.previsto).toBe(14.3)
    expect(r?.realizado).toBe(19.6)
    expect(r?.desvio).toBe(5.4)
  })
  it('nunca devolve -0 (ruído de ponto flutuante abaixo de zero)', () => {
    // Pesos 9 e 11, a 1ª no 1º dia e a 2ª no 4º dia útil, ambas em 25%:
    // previsto e realizado valem 25, mas a conta em ponto flutuante deixa
    // realizado - previsto levemente negativo.
    const a: AcaoParaAvanco = {
      status: StatusAcao.EM_CURSO_25,
      previstoInicio: d(6, 4),
      previstoTermino: d(6, 16),
    }
    const b: AcaoParaAvanco = {
      status: StatusAcao.EM_CURSO_25,
      previstoInicio: d(6, 1),
      previstoTermino: d(6, 15),
    }
    expect(pesoDaAcao(a)).toBe(9)
    expect(pesoDaAcao(b)).toBe(11)
    const r = avancoEm([a, b], d(6, 4))
    expect(r?.previsto).toBe(25)
    expect(Object.is(r?.desvio, 0)).toBe(true)
  })
  it('umaCasa não devolve -0', () => {
    expect(Object.is(umaCasa(-0.04), 0)).toBe(true)
    expect(umaCasa(-0.06)).toBe(-0.1)
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
