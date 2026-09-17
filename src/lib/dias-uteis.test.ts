import { describe, expect, it } from 'vitest'

import {
  diasUteisEntre,
  ehDiaUtil,
  ehFimDeSemana,
  feriadoNacionalFixo,
  FERIADOS_NACIONAIS_FIXOS,
  somarDiasUteis,
} from './dias-uteis'

/** Meia-noite UTC — mesma convenção do seed e de `acao-validacao.ts`. */
function data(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

describe('feriadoNacionalFixo', () => {
  it('reconhece os 9 feriados nacionais de data fixa', () => {
    expect(FERIADOS_NACIONAIS_FIXOS.size).toBe(9)
    expect(feriadoNacionalFixo(data('2026-04-21'))).toBe('Tiradentes')
    expect(feriadoNacionalFixo(data('2026-11-20'))).toBe('Consciência Negra')
    expect(feriadoNacionalFixo(data('2026-12-25'))).toBe('Natal')
  })

  it('ignora feriados móveis — fora do escopo do MVP', () => {
    // Carnaval de 2026 (17/02) e Corpus Christi (04/06) são dias úteis aqui.
    expect(feriadoNacionalFixo(data('2026-02-17'))).toBeNull()
    expect(ehDiaUtil(data('2026-06-04'))).toBe(true)
  })
})

describe('ehDiaUtil', () => {
  it('exclui sábado e domingo', () => {
    expect(ehFimDeSemana(data('2026-03-07'))).toBe(true) // sábado
    expect(ehFimDeSemana(data('2026-03-08'))).toBe(true) // domingo
    expect(ehDiaUtil(data('2026-03-07'))).toBe(false)
    expect(ehDiaUtil(data('2026-03-08'))).toBe(false)
  })

  it('exclui feriado fixo que cai em dia de semana', () => {
    expect(data('2026-09-07').getUTCDay()).toBe(1) // segunda
    expect(ehDiaUtil(data('2026-09-07'))).toBe(false)
  })

  it('aceita dia de semana comum', () => {
    expect(ehDiaUtil(data('2026-03-02'))).toBe(true)
  })
})

describe('diasUteisEntre', () => {
  it('conta uma semana cheia sem feriado (mesma semana)', () => {
    expect(diasUteisEntre(data('2026-03-02'), data('2026-03-06'))).toBe(5)
  })

  it('desconta o feriado ao atravessar 21/04 (Tiradentes, terça)', () => {
    expect(diasUteisEntre(data('2026-04-20'), data('2026-04-24'))).toBe(4)
  })

  it('conta um mês inteiro com feriado — setembro/2026 tem 21 dias úteis', () => {
    expect(diasUteisEntre(data('2026-09-01'), data('2026-09-30'))).toBe(21)
  })

  it('conta as duas pontas: ação de um dia só dura 1 dia útil', () => {
    expect(diasUteisEntre(data('2026-03-02'), data('2026-03-02'))).toBe(1)
  })

  it('devolve 0 quando o intervalo só tem fim de semana e feriado', () => {
    expect(diasUteisEntre(data('2026-03-07'), data('2026-03-08'))).toBe(0)
    expect(diasUteisEntre(data('2026-12-25'), data('2026-12-25'))).toBe(0)
  })

  it('devolve 0 (não negativo) quando o fim é anterior ao início', () => {
    expect(diasUteisEntre(data('2026-03-06'), data('2026-03-02'))).toBe(0)
  })

  it('ignora a hora do dia — só a data conta', () => {
    const inicio = new Date('2026-03-02T23:30:00.000Z')
    const fim = new Date('2026-03-06T00:10:00.000Z')
    expect(diasUteisEntre(inicio, fim)).toBe(5)
  })
})

describe('somarDiasUteis', () => {
  it('conta o próprio dia como dia 1 quando ele é útil', () => {
    expect(somarDiasUteis(data('2026-03-02'), 1)).toEqual(data('2026-03-02'))
    expect(somarDiasUteis(data('2026-03-02'), 5)).toEqual(data('2026-03-06'))
  })

  it('pula o fim de semana', () => {
    expect(somarDiasUteis(data('2026-03-02'), 6)).toEqual(data('2026-03-09'))
  })

  it('pula o feriado', () => {
    // 20/04 (seg) + 2 dias úteis: 21/04 é Tiradentes, então cai em 22/04.
    expect(somarDiasUteis(data('2026-04-20'), 2)).toEqual(data('2026-04-22'))
  })

  it('anda até o próximo dia útil quando o início não é útil', () => {
    expect(somarDiasUteis(data('2026-03-07'), 1)).toEqual(data('2026-03-09'))
  })

  it('é o inverso de diasUteisEntre', () => {
    const inicio = data('2026-09-01')
    const fim = somarDiasUteis(inicio, 21)
    expect(diasUteisEntre(inicio, fim)).toBe(21)
  })

  it('devolve o próprio dia (meia-noite UTC) para quantidade menor que 1', () => {
    expect(somarDiasUteis(new Date('2026-03-02T18:00:00.000Z'), 0)).toEqual(
      data('2026-03-02'),
    )
  })
})
