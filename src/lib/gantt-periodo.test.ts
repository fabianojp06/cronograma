import { describe, expect, it } from 'vitest'

import {
  gerarJanelas,
  indiceDaJanela,
  janelaInicial,
  limitarIndice,
} from './gantt-periodo'

function data(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

describe('gerarJanelas por mês', () => {
  it('cobre do mês do início ao mês do término', () => {
    const janelas = gerarJanelas(
      { inicio: data('2026-09-17'), fim: data('2026-12-02') },
      'MES',
    )
    expect(janelas.map((j) => j.rotulo)).toEqual([
      'set/26',
      'out/26',
      'nov/26',
      'dez/26',
    ])
  })

  it('usa o mês inteiro como limites da janela', () => {
    const [janela] = gerarJanelas(
      { inicio: data('2026-02-10'), fim: data('2026-02-11') },
      'MES',
    )
    expect(iso(janela.inicio)).toBe('2026-02-01')
    expect(iso(janela.fim)).toBe('2026-02-28')
    expect(janela.chave).toBe('2026-02')
  })

  it('atravessa a virada de ano', () => {
    const janelas = gerarJanelas(
      { inicio: data('2026-12-15'), fim: data('2027-01-10') },
      'MES',
    )
    expect(janelas.map((j) => j.chave)).toEqual(['2026-12', '2027-01'])
  })

  it('fatia os ~13 meses da planilha original', () => {
    const janelas = gerarJanelas(
      { inicio: data('2026-01-05'), fim: data('2027-01-31') },
      'MES',
    )
    expect(janelas).toHaveLength(13)
  })
})

describe('gerarJanelas por trimestre', () => {
  it('alinha a janela ao trimestre de calendário', () => {
    const [janela] = gerarJanelas(
      { inicio: data('2026-08-20'), fim: data('2026-08-21') },
      'TRIMESTRE',
    )
    expect(janela.rotulo).toBe('3º tri/26')
    expect(janela.chave).toBe('2026-T3')
    expect(iso(janela.inicio)).toBe('2026-07-01')
    expect(iso(janela.fim)).toBe('2026-09-30')
  })

  it('cobre do trimestre do início ao do término', () => {
    const janelas = gerarJanelas(
      { inicio: data('2026-02-10'), fim: data('2027-01-05') },
      'TRIMESTRE',
    )
    expect(janelas.map((j) => j.rotulo)).toEqual([
      '1º tri/26',
      '2º tri/26',
      '3º tri/26',
      '4º tri/26',
      '1º tri/27',
    ])
  })
})

describe('gerarJanelas — casos de borda', () => {
  it('devolve uma janela para período de um único dia', () => {
    expect(
      gerarJanelas({ inicio: data('2026-09-17'), fim: data('2026-09-17') }, 'MES'),
    ).toHaveLength(1)
  })

  it('nunca devolve lista vazia quando o término é anterior ao início', () => {
    const janelas = gerarJanelas(
      { inicio: data('2026-09-17'), fim: data('2026-01-05') },
      'TRIMESTRE',
    )
    expect(janelas.map((j) => j.rotulo)).toEqual(['3º tri/26'])
  })
})

describe('indiceDaJanela', () => {
  const janelas = gerarJanelas(
    { inicio: data('2026-07-01'), fim: data('2026-10-31') },
    'MES',
  )

  it('acha a janela que contém a data', () => {
    expect(indiceDaJanela(janelas, data('2026-09-17'))).toBe(2)
  })

  it('inclui o primeiro e o último dia da janela', () => {
    expect(indiceDaJanela(janelas, data('2026-07-01'))).toBe(0)
    expect(indiceDaJanela(janelas, data('2026-10-31'))).toBe(3)
  })

  it('ignora a hora gravada na data', () => {
    expect(indiceDaJanela(janelas, new Date('2026-08-31T23:59:00.000Z'))).toBe(1)
  })

  it('devolve null para data fora de todas as janelas', () => {
    expect(indiceDaJanela(janelas, data('2026-06-30'))).toBeNull()
    expect(indiceDaJanela(janelas, data('2026-11-01'))).toBeNull()
    expect(indiceDaJanela([], data('2026-09-17'))).toBeNull()
  })
})

describe('janelaInicial', () => {
  const janelas = gerarJanelas(
    { inicio: data('2026-07-01'), fim: data('2026-10-31') },
    'MES',
  )

  it('abre na janela de hoje quando o período a cobre', () => {
    expect(janelaInicial(janelas, data('2026-09-17'))).toBe(2)
  })

  it('abre na primeira janela quando hoje está fora do período', () => {
    expect(janelaInicial(janelas, data('2027-05-01'))).toBe(0)
  })
})

describe('limitarIndice', () => {
  it('mantém o índice dentro da faixa', () => {
    expect(limitarIndice(-3, 4)).toBe(0)
    expect(limitarIndice(9, 4)).toBe(3)
    expect(limitarIndice(2, 4)).toBe(2)
  })

  it('devolve 0 quando não há janelas', () => {
    expect(limitarIndice(5, 0)).toBe(0)
  })
})
