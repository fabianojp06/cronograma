import { describe, expect, it } from 'vitest'

import {
  cargaMensal,
  chaveDoMes,
  evolucaoMensal,
  fimDoMesUTC,
  mesesDoPeriodo,
  rotuloDoMes,
  type AcaoNoTempo,
} from './dashboard-temporal'

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function acao(campos: Partial<AcaoNoTempo> = {}): AcaoNoTempo {
  return {
    previstoInicio: null,
    previstoTermino: null,
    realizadoInicio: null,
    realizadoTermino: null,
    ...campos,
  }
}

describe('chaveDoMes / rotuloDoMes / fimDoMesUTC', () => {
  it('formata a chave com mês 1-based e dois dígitos', () => {
    expect(chaveDoMes({ ano: 2026, mes: 0 })).toBe('2026-01')
    expect(chaveDoMes({ ano: 2026, mes: 11 })).toBe('2026-12')
  })

  it('formata o rótulo em pt-BR abreviado', () => {
    expect(rotuloDoMes({ ano: 2026, mes: 8 })).toBe('set/26')
  })

  it('devolve o último instante do mês, inclusive em fevereiro bissexto', () => {
    expect(fimDoMesUTC({ ano: 2026, mes: 1 }).toISOString()).toBe(
      '2026-02-28T23:59:59.999Z',
    )
    expect(fimDoMesUTC({ ano: 2028, mes: 1 }).toISOString()).toBe(
      '2028-02-29T23:59:59.999Z',
    )
  })
})

describe('mesesDoPeriodo', () => {
  it('é vazio quando nenhuma ação tem data', () => {
    expect(mesesDoPeriodo([acao()])).toEqual([])
    expect(mesesDoPeriodo([])).toEqual([])
  })

  it('cobre meses contínuos, inclusive os sem dado no meio', () => {
    const meses = mesesDoPeriodo([
      acao({ previstoInicio: d('2026-01-15') }),
      acao({ realizadoTermino: d('2026-04-02') }),
    ])
    expect(meses.map(chaveDoMes)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
  })

  it('atravessa a virada de ano', () => {
    const meses = mesesDoPeriodo([
      acao({ previstoInicio: d('2026-11-20') }),
      acao({ previstoTermino: d('2027-02-10') }),
    ])
    expect(meses.map(chaveDoMes)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('evolucaoMensal', () => {
  it('acumula previsto e realizado mês a mês', () => {
    const acoes = [
      acao({ previstoTermino: d('2026-01-20'), realizadoTermino: d('2026-01-18') }),
      acao({ previstoTermino: d('2026-02-20'), realizadoTermino: d('2026-03-05') }),
      acao({ previstoTermino: d('2026-03-20') }),
    ]

    const pontos = evolucaoMensal(acoes, d('2026-03-25'))

    expect(pontos.map((p) => p.previstoAcumulado)).toEqual([1, 2, 3])
    expect(pontos.map((p) => p.realizadoAcumulado)).toEqual([1, 1, 2])
  })

  it('conta a ação que termina no último dia do mês', () => {
    const pontos = evolucaoMensal(
      [acao({ previstoTermino: d('2026-01-31') })],
      d('2026-01-31'),
    )
    expect(pontos[0].previstoAcumulado).toBe(1)
  })

  it('marca como passado só os meses até o mês corrente', () => {
    const pontos = evolucaoMensal(
      [acao({ previstoTermino: d('2026-01-10') }), acao({ previstoTermino: d('2026-03-10') })],
      d('2026-02-15'),
    )
    expect(pontos.map((p) => p.passado)).toEqual([true, true, false])
  })

  it('é vazio sem datas', () => {
    expect(evolucaoMensal([acao()], d('2026-03-01'))).toEqual([])
  })
})

describe('cargaMensal', () => {
  it('conta inícios e términos previstos no mês exato', () => {
    const pontos = cargaMensal([
      acao({ previstoInicio: d('2026-01-05'), previstoTermino: d('2026-02-10') }),
      acao({ previstoInicio: d('2026-01-25'), previstoTermino: d('2026-01-30') }),
    ])

    expect(pontos.map((p) => [p.rotulo, p.inicios, p.terminos])).toEqual([
      ['jan/26', 2, 1],
      ['fev/26', 0, 1],
    ])
  })

  it('não confunde o mesmo mês de anos diferentes', () => {
    const pontos = cargaMensal([
      acao({ previstoInicio: d('2026-01-05') }),
      acao({ previstoInicio: d('2027-01-05') }),
    ])
    expect(pontos[0].inicios).toBe(1)
    expect(pontos[pontos.length - 1].inicios).toBe(1)
  })
})
