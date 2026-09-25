import { describe, expect, it } from 'vitest'

import {
  chaveSemana,
  distanciaEmSemanas,
  ehSemanaValida,
  inicioDaSemana1,
  periodoDaSemana,
  rotuloSemana,
  semanaAnterior,
  semanaDe,
  semanaSeguinte,
  totalDeSemanas,
} from './semana-ctcea'

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/**
 * As 52 semanas da aba `Referências` do Card WIN, transcritas do arquivo.
 * É o contrato com a equipe: se uma linha divergir, o número da semana que o
 * sistema mostra deixou de ser o número que a GIA usa nas reuniões.
 *
 * A planilha tem uma 53ª linha (27/12/2026 a 02/01/2027), mas o próprio
 * XLOOKUP dela só varre as linhas 5 a 56 — as semanas 1 a 52. Aquela linha é
 * sobra da fórmula e, por esta regra, já é a semana 1 de 2027.
 */
const CALENDARIO_DA_PLANILHA: [number, string, string][] = [
  [1, '2025-12-28', '2026-01-03'],
  [2, '2026-01-04', '2026-01-10'],
  [3, '2026-01-11', '2026-01-17'],
  [4, '2026-01-18', '2026-01-24'],
  [5, '2026-01-25', '2026-01-31'],
  [6, '2026-02-01', '2026-02-07'],
  [7, '2026-02-08', '2026-02-14'],
  [8, '2026-02-15', '2026-02-21'],
  [9, '2026-02-22', '2026-02-28'],
  [10, '2026-03-01', '2026-03-07'],
  [11, '2026-03-08', '2026-03-14'],
  [12, '2026-03-15', '2026-03-21'],
  [13, '2026-03-22', '2026-03-28'],
  [14, '2026-03-29', '2026-04-04'],
  [15, '2026-04-05', '2026-04-11'],
  [16, '2026-04-12', '2026-04-18'],
  [17, '2026-04-19', '2026-04-25'],
  [18, '2026-04-26', '2026-05-02'],
  [19, '2026-05-03', '2026-05-09'],
  [20, '2026-05-10', '2026-05-16'],
  [21, '2026-05-17', '2026-05-23'],
  [22, '2026-05-24', '2026-05-30'],
  [23, '2026-05-31', '2026-06-06'],
  [24, '2026-06-07', '2026-06-13'],
  [25, '2026-06-14', '2026-06-20'],
  [26, '2026-06-21', '2026-06-27'],
  [27, '2026-06-28', '2026-07-04'],
  [28, '2026-07-05', '2026-07-11'],
  [29, '2026-07-12', '2026-07-18'],
  [30, '2026-07-19', '2026-07-25'],
  [31, '2026-07-26', '2026-08-01'],
  [32, '2026-08-02', '2026-08-08'],
  [33, '2026-08-09', '2026-08-15'],
  [34, '2026-08-16', '2026-08-22'],
  [35, '2026-08-23', '2026-08-29'],
  [36, '2026-08-30', '2026-09-05'],
  [37, '2026-09-06', '2026-09-12'],
  [38, '2026-09-13', '2026-09-19'],
  [39, '2026-09-20', '2026-09-26'],
  [40, '2026-09-27', '2026-10-03'],
  [41, '2026-10-04', '2026-10-10'],
  [42, '2026-10-11', '2026-10-17'],
  [43, '2026-10-18', '2026-10-24'],
  [44, '2026-10-25', '2026-10-31'],
  [45, '2026-11-01', '2026-11-07'],
  [46, '2026-11-08', '2026-11-14'],
  [47, '2026-11-15', '2026-11-21'],
  [48, '2026-11-22', '2026-11-28'],
  [49, '2026-11-29', '2026-12-05'],
  [50, '2026-12-06', '2026-12-12'],
  [51, '2026-12-13', '2026-12-19'],
  [52, '2026-12-20', '2026-12-26'],
]

describe('paridade com a aba Referências do Card WIN', () => {
  it('reproduz as 52 semanas, início e fim, uma a uma', () => {
    for (const [semana, inicio, fim] of CALENDARIO_DA_PLANILHA) {
      const periodo = periodoDaSemana({ ano: 2026, semana })
      expect([semana, periodo.inicio.toISOString().slice(0, 10)]).toEqual([semana, inicio])
      expect([semana, periodo.fim.toISOString().slice(0, 10)]).toEqual([semana, fim])
    }
  })

  it('devolve o número de semana que a planilha devolveria para cada início', () => {
    for (const [semana, inicio] of CALENDARIO_DA_PLANILHA) {
      expect(semanaDe(d(inicio))).toEqual({ ano: 2026, semana })
    }
  })

  it('toda semana começa num domingo e dura 7 dias', () => {
    for (const [semana] of CALENDARIO_DA_PLANILHA) {
      const { inicio, fim } = periodoDaSemana({ ano: 2026, semana })
      expect(inicio.getUTCDay()).toBe(0)
      expect(fim.getUTCDay()).toBe(6)
      expect((fim.getTime() - inicio.getTime()) / 86400000).toBe(6)
    }
  })

  it('as semanas são contínuas — o fim de uma emenda no início da seguinte', () => {
    for (let semana = 1; semana < CALENDARIO_DA_PLANILHA.length; semana += 1) {
      const atual = periodoDaSemana({ ano: 2026, semana })
      const proxima = periodoDaSemana({ ano: 2026, semana: semana + 1 })
      expect(proxima.inicio.getTime() - atual.fim.getTime()).toBe(86400000)
    }
  })

  it('a semana 39 é a do Card analisado (20 a 26/09/2026)', () => {
    const { inicio, fim } = periodoDaSemana({ ano: 2026, semana: 39 })
    expect(inicio.toISOString().slice(0, 10)).toBe('2026-09-20')
    expect(fim.toISOString().slice(0, 10)).toBe('2026-09-26')
  })
})

describe('NÃO é a semana ISO', () => {
  it('01/01/2026 cai na semana 1 aqui, e não na 53 de 2025 como no ISO', () => {
    expect(semanaDe(d('2026-01-01'))).toEqual({ ano: 2026, semana: 1 })
  })

  it('a semana começa no domingo, não na segunda', () => {
    // 2026-09-20 é domingo. No ISO ele ainda pertenceria à semana anterior.
    expect(semanaDe(d('2026-09-20'))).toEqual({ ano: 2026, semana: 39 })
    expect(semanaDe(d('2026-09-19'))).toEqual({ ano: 2026, semana: 38 })
  })
})

describe('inicioDaSemana1', () => {
  it('é o domingo igual ou anterior a 1º de janeiro', () => {
    expect(inicioDaSemana1(2026).toISOString().slice(0, 10)).toBe('2025-12-28')
    expect(inicioDaSemana1(2027).toISOString().slice(0, 10)).toBe('2026-12-27')
  })

  it('quando 1º de janeiro já é domingo, ele mesmo abre a semana 1', () => {
    // 01/01/2023 foi domingo.
    expect(inicioDaSemana1(2023).toISOString().slice(0, 10)).toBe('2023-01-01')
  })
})

describe('totalDeSemanas', () => {
  it('2026 tem 52 semanas — a 53ª linha da planilha já é de 2027', () => {
    expect(totalDeSemanas(2026)).toBe(52)
  })

  it('é sempre 52 ou 53, nunca outro valor', () => {
    for (let ano = 2020; ano <= 2040; ano += 1) {
      expect([52, 53]).toContain(totalDeSemanas(ano))
    }
  })

  it('existe ano com 53 semanas, então o número não pode ser constante', () => {
    const anos = []
    for (let ano = 2020; ano <= 2040; ano += 1) {
      if (totalDeSemanas(ano) === 53) anos.push(ano)
    }
    expect(anos.length).toBeGreaterThan(0)
  })
})

describe('semanaDe na virada de ano', () => {
  it('30/12/2025 pertence à semana 1 de 2026, não a 2025', () => {
    expect(semanaDe(d('2025-12-30'))).toEqual({ ano: 2026, semana: 1 })
  })

  it('01/01/2027 pertence à semana 1 de 2027', () => {
    // A semana 1 de 2027 começa em 27/12/2026.
    expect(semanaDe(d('2027-01-01'))).toEqual({ ano: 2027, semana: 1 })
  })

  it('26/12/2026 é a última semana de 2026', () => {
    expect(semanaDe(d('2026-12-26'))).toEqual({ ano: 2026, semana: 52 })
  })

  it('ignora a hora do dia', () => {
    const cedo = new Date('2026-09-23T00:30:00.000Z')
    const tarde = new Date('2026-09-23T23:45:00.000Z')
    expect(semanaDe(cedo)).toEqual(semanaDe(tarde))
  })
})

describe('semanaAnterior / semanaSeguinte', () => {
  it('andam dentro do ano', () => {
    expect(semanaAnterior({ ano: 2026, semana: 39 })).toEqual({ ano: 2026, semana: 38 })
    expect(semanaSeguinte({ ano: 2026, semana: 39 })).toEqual({ ano: 2026, semana: 40 })
  })

  it('atravessam a virada de ano nos dois sentidos', () => {
    expect(semanaAnterior({ ano: 2026, semana: 1 })).toEqual({ ano: 2025, semana: 52 })
    expect(semanaSeguinte({ ano: 2026, semana: 52 })).toEqual({ ano: 2027, semana: 1 })
  })

  it('ida e volta devolve a mesma semana', () => {
    for (const semana of [1, 2, 26, 51, 52]) {
      const original = { ano: 2026, semana }
      expect(semanaAnterior(semanaSeguinte(original))).toEqual(original)
    }
  })
})

describe('ehSemanaValida', () => {
  it('aceita de 1 até o total do ano', () => {
    expect(ehSemanaValida({ ano: 2026, semana: 1 })).toBe(true)
    expect(ehSemanaValida({ ano: 2026, semana: 52 })).toBe(true)
  })

  it('recusa zero, negativo, fracionário e acima do total', () => {
    for (const semana of [0, -1, 1.5, 53, 99]) {
      expect(ehSemanaValida({ ano: 2026, semana })).toBe(false)
    }
  })
})

describe('rotuloSemana / chaveSemana', () => {
  it('o rótulo usa a mesma notação das abas da planilha', () => {
    expect(rotuloSemana({ ano: 2026, semana: 39 })).toBe('S39/2026')
  })

  it('a chave ordena corretamente como texto', () => {
    const chaves = [
      chaveSemana({ ano: 2026, semana: 9 }),
      chaveSemana({ ano: 2026, semana: 10 }),
      chaveSemana({ ano: 2027, semana: 1 }),
    ]
    expect([...chaves].sort()).toEqual(chaves)
    expect(chaves[0]).toBe('2026-09')
  })
})

describe('distanciaEmSemanas', () => {
  it('conta a diferença dentro do ano', () => {
    expect(
      distanciaEmSemanas({ ano: 2026, semana: 37 }, { ano: 2026, semana: 39 }),
    ).toBe(2)
  })

  it('é negativa quando a segunda semana vem antes', () => {
    expect(
      distanciaEmSemanas({ ano: 2026, semana: 39 }, { ano: 2026, semana: 37 }),
    ).toBe(-2)
  })

  it('atravessa a virada de ano', () => {
    expect(
      distanciaEmSemanas({ ano: 2026, semana: 52 }, { ano: 2027, semana: 1 }),
    ).toBe(1)
  })

  it('é zero para a mesma semana', () => {
    expect(
      distanciaEmSemanas({ ano: 2026, semana: 39 }, { ano: 2026, semana: 39 }),
    ).toBe(0)
  })
})
