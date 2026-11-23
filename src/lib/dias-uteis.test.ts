import { describe, expect, it } from 'vitest'

import {
  deslocarDiasUteis,
  diasUteisEntre,
  ehDiaUtil,
  ehFimDeSemana,
  feriadoDoDia,
  feriadoMovel,
  feriadoNacionalFixo,
  FERIADOS_NACIONAIS_FIXOS,
  feriadosMoveis,
  pascoa,
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

  it('não inclui os móveis: quem pergunta pelos fixos só recebe os fixos', () => {
    expect(feriadoNacionalFixo(data('2026-02-17'))).toBeNull() // Carnaval
    expect(feriadoNacionalFixo(data('2026-06-04'))).toBeNull() // Corpus Christi
  })
})

describe('pascoa', () => {
  it('calcula o domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC', () => {
    const esperado: Record<number, string> = {
      2024: '2024-03-31',
      2025: '2025-04-20',
      2026: '2026-04-05',
      2027: '2027-03-28',
      2028: '2028-04-16', // bissexto
      2029: '2029-04-01',
      2030: '2030-04-21',
    }
    for (const [ano, iso] of Object.entries(esperado)) {
      expect(pascoa(Number(ano)).toISOString().slice(0, 10)).toBe(iso)
    }
  })

  it('cai sempre num domingo', () => {
    for (let ano = 2020; ano <= 2060; ano += 1) {
      expect(pascoa(ano).getUTCDay()).toBe(0)
    }
  })
})

describe('feriadosMoveis', () => {
  const nomes = (ano: number) =>
    [...feriadosMoveis(ano).entries()].sort(([a], [b]) => a.localeCompare(b))

  it('2026: Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi', () => {
    expect(nomes(2026)).toEqual([
      ['02-16', 'Carnaval'],
      ['02-17', 'Carnaval'],
      ['04-03', 'Sexta-feira Santa'],
      ['06-04', 'Corpus Christi'],
    ])
  })

  it('2025 e 2027: as datas mudam com a Páscoa', () => {
    expect(nomes(2025).map(([k]) => k)).toEqual(['03-03', '03-04', '04-18', '06-19'])
    expect(nomes(2027).map(([k]) => k)).toEqual(['02-08', '02-09', '03-26', '05-27'])
  })

  it('2028 (bissexto): o Carnaval atravessa o 29 de fevereiro', () => {
    expect(nomes(2028).map(([k]) => k)).toEqual(['02-28', '02-29', '04-14', '06-15'])
  })
})

describe('feriadoMovel e feriadoDoDia', () => {
  it('reconhece o móvel pelo ano da própria data', () => {
    expect(feriadoMovel(data('2026-06-04'))).toBe('Corpus Christi')
    // 04/06 de 2027 não é feriado: a Páscoa de 2027 é outra.
    expect(feriadoMovel(data('2027-06-04'))).toBeNull()
  })

  it('a Quarta-feira de Cinzas não é feriado (meio expediente)', () => {
    expect(feriadoMovel(data('2026-02-18'))).toBeNull()
  })

  it('feriadoDoDia junta fixos e móveis; o fixo prevalece se coincidirem', () => {
    expect(feriadoDoDia(data('2026-04-21'))).toBe('Tiradentes')
    expect(feriadoDoDia(data('2026-04-03'))).toBe('Sexta-feira Santa')
    expect(feriadoDoDia(data('2026-04-22'))).toBeNull()
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

describe('feriados móveis contam como dia não útil', () => {
  it('exclui Carnaval, Sexta-feira Santa e Corpus Christi', () => {
    expect(ehDiaUtil(data('2026-02-16'))).toBe(false) // segunda de Carnaval
    expect(ehDiaUtil(data('2026-02-17'))).toBe(false) // terça de Carnaval
    expect(ehDiaUtil(data('2026-04-03'))).toBe(false) // Sexta-feira Santa
    expect(ehDiaUtil(data('2026-06-04'))).toBe(false) // Corpus Christi
    expect(ehDiaUtil(data('2026-02-18'))).toBe(true) // Quarta de Cinzas trabalha
  })

  it('diasUteisEntre desconta cada um na sua semana', () => {
    expect(diasUteisEntre(data('2026-02-16'), data('2026-02-20'))).toBe(3) // semana do Carnaval
    expect(diasUteisEntre(data('2026-03-30'), data('2026-04-03'))).toBe(4) // Semana Santa
    expect(diasUteisEntre(data('2026-06-01'), data('2026-06-05'))).toBe(4) // Corpus Christi
  })

  it('anda por cima do feriado móvel ao deslocar e ao somar', () => {
    // Quinta 02/04 + 1 dia útil: pula a Sexta-feira Santa e o fim de semana.
    expect(deslocarDiasUteis(data('2026-04-02'), 1).toISOString().slice(0, 10)).toBe('2026-04-06')
    expect(deslocarDiasUteis(data('2026-04-06'), -1).toISOString().slice(0, 10)).toBe('2026-04-02')
    // Quinta 12/02 é o dia 1, sexta 13/02 o dia 2; segunda 16 e terça 17 são Carnaval,
    // então o dia 3 é a quarta 18/02.
    expect(data('2026-02-12').getUTCDay()).toBe(4)
    expect(somarDiasUteis(data('2026-02-12'), 3).toISOString().slice(0, 10)).toBe('2026-02-18')
  })

  it('o ano de 2026 tem 249 dias úteis', () => {
    // 261 segundas a sextas. Fixos em dia útil: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11,
    // 20/11 e 25/12 = 8 (o 15/11 cai num domingo) → 253. Móveis em dia útil: 16/02, 17/02,
    // 03/04 e 04/06 = 4 → 249. Total conferido por cálculo independente.
    expect(diasUteisEntre(data('2026-01-01'), data('2026-12-31'))).toBe(249)
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

describe('deslocarDiasUteis', () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
  const iso = (x: Date) => x.toISOString().slice(0, 10)

  it('zero devolve a própria data', () => {
    expect(iso(deslocarDiasUteis(d('2026-03-04'), 0))).toBe('2026-03-04')
  })
  it('para frente pula o fim de semana', () => {
    // quinta + 2 úteis = segunda
    expect(iso(deslocarDiasUteis(d('2026-03-05'), 2))).toBe('2026-03-09')
  })
  it('para trás pula o fim de semana', () => {
    // segunda - 1 útil = sexta
    expect(iso(deslocarDiasUteis(d('2026-03-09'), -1))).toBe('2026-03-06')
  })
  it('pula feriado nacional fixo', () => {
    // 20/11/2026 (Consciência Negra, sexta): quinta 19 + 1 útil = segunda 23
    expect(iso(deslocarDiasUteis(d('2026-11-19'), 1))).toBe('2026-11-23')
  })
  it('partindo de um sábado, o primeiro útil andado é o 1', () => {
    expect(iso(deslocarDiasUteis(d('2026-03-07'), 1))).toBe('2026-03-09')
    expect(iso(deslocarDiasUteis(d('2026-03-07'), -1))).toBe('2026-03-06')
  })
  it('ir e voltar a mesma quantidade devolve a data útil original', () => {
    const origem = d('2026-03-11')
    expect(iso(deslocarDiasUteis(deslocarDiasUteis(origem, 17), -17))).toBe('2026-03-11')
  })
  it('mantém a ordem de duas datas deslocadas juntas', () => {
    const a = deslocarDiasUteis(d('2026-03-06'), 3)
    const b = deslocarDiasUteis(d('2026-03-07'), 3)
    expect(a.getTime()).toBeLessThanOrEqual(b.getTime())
  })
})
