import { describe, expect, it } from 'vitest'

import {
  agruparPorMes,
  colunaDeHoje,
  faixaDaBarra,
  gerarSemanas,
  inicioDaSemanaUTC,
  periodoDaGrade,
  periodoDasAcoes,
  previstoEmAtraso,
  type AcaoNaGrade,
} from './gantt'

/** Meia-noite UTC — mesma convenção do seed e de `acao-validacao.ts`. */
function data(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Ação sem nenhuma data; cada teste sobrescreve só os campos que usa. */
function acao(campos: Partial<AcaoNaGrade> = {}): AcaoNaGrade {
  return {
    previstoInicio: null,
    previstoTermino: null,
    realizadoInicio: null,
    realizadoTermino: null,
    ...campos,
  }
}

describe('inicioDaSemanaUTC', () => {
  it('recua até a segunda-feira da semana', () => {
    // 2026-09-17 é uma quinta-feira; a segunda é 2026-09-14.
    expect(iso(inicioDaSemanaUTC(data('2026-09-17')))).toBe('2026-09-14')
  })

  it('mantém a própria segunda-feira', () => {
    expect(iso(inicioDaSemanaUTC(data('2026-09-14')))).toBe('2026-09-14')
  })

  it('trata domingo como fim da semana que começou na segunda anterior', () => {
    expect(iso(inicioDaSemanaUTC(data('2026-09-20')))).toBe('2026-09-14')
  })

  it('descarta a hora sem escorregar de semana', () => {
    expect(iso(inicioDaSemanaUTC(new Date('2026-09-20T23:59:00.000Z')))).toBe(
      '2026-09-14',
    )
  })
})

describe('gerarSemanas', () => {
  it('cobre o intervalo da semana do início até a do término', () => {
    const semanas = gerarSemanas(data('2026-09-17'), data('2026-10-05'))
    expect(semanas.map((s) => s.chave)).toEqual([
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
    ])
  })

  it('devolve uma única semana quando as datas caem na mesma', () => {
    const semanas = gerarSemanas(data('2026-09-15'), data('2026-09-18'))
    expect(semanas).toHaveLength(1)
    expect(iso(semanas[0].fim)).toBe('2026-09-20')
  })

  it('não devolve grade vazia quando o término é anterior ao início', () => {
    const semanas = gerarSemanas(data('2026-10-05'), data('2026-09-17'))
    expect(semanas.map((s) => s.chave)).toEqual(['2026-10-05'])
  })

  it('cobre os ~13 meses da planilha original', () => {
    const semanas = gerarSemanas(data('2026-01-05'), data('2027-01-31'))
    expect(semanas.length).toBeGreaterThan(55)
    expect(semanas[0].chave).toBe('2026-01-05')
  })
})

describe('periodoDasAcoes', () => {
  it('pega a menor e a maior data entre os quatro campos', () => {
    const periodo = periodoDasAcoes([
      acao({ previstoInicio: data('2026-03-02'), previstoTermino: data('2026-03-20') }),
      acao({ realizadoInicio: data('2026-02-10'), realizadoTermino: data('2026-05-01') }),
    ])
    expect(periodo).not.toBeNull()
    expect(iso(periodo!.inicio)).toBe('2026-02-10')
    expect(iso(periodo!.fim)).toBe('2026-05-01')
  })

  it('devolve null quando nenhuma ação tem data', () => {
    expect(periodoDasAcoes([acao(), acao()])).toBeNull()
    expect(periodoDasAcoes([])).toBeNull()
  })
})

describe('periodoDaGrade', () => {
  it('alarga o período para incluir hoje', () => {
    const periodo = periodoDaGrade(
      [acao({ previstoInicio: data('2026-03-02'), previstoTermino: data('2026-03-20') })],
      data('2026-09-17'),
    )
    expect(iso(periodo.inicio)).toBe('2026-03-02')
    expect(iso(periodo.fim)).toBe('2026-09-17')
  })

  it('usa o dia de hoje quando não há data apontada', () => {
    const periodo = periodoDaGrade([acao()], data('2026-09-17'))
    expect(iso(periodo.inicio)).toBe('2026-09-17')
    expect(iso(periodo.fim)).toBe('2026-09-17')
  })
})

describe('faixaDaBarra', () => {
  const semanas = gerarSemanas(data('2026-09-14'), data('2026-10-12'))

  it('posiciona a barra da semana do início até a do término', () => {
    expect(faixaDaBarra(data('2026-09-16'), data('2026-10-02'), semanas)).toEqual({
      coluna: 0,
      colunas: 3,
    })
  })

  it('ocupa uma única coluna quando início e término estão na mesma semana', () => {
    expect(faixaDaBarra(data('2026-09-28'), data('2026-10-02'), semanas)).toEqual({
      coluna: 2,
      colunas: 1,
    })
  })

  it('desenha uma semana quando só uma das pontas foi apontada', () => {
    expect(faixaDaBarra(data('2026-09-28'), null, semanas)).toEqual({
      coluna: 2,
      colunas: 1,
    })
    expect(faixaDaBarra(null, data('2026-09-28'), semanas)).toEqual({
      coluna: 2,
      colunas: 1,
    })
  })

  it('não desenha barra sem nenhuma data', () => {
    expect(faixaDaBarra(null, null, semanas)).toBeNull()
  })

  it('recorta a barra que começa antes da grade', () => {
    expect(faixaDaBarra(data('2026-08-10'), data('2026-09-22'), semanas)).toEqual({
      coluna: 0,
      colunas: 2,
    })
  })

  it('recorta a barra que termina depois da grade', () => {
    expect(faixaDaBarra(data('2026-10-05'), data('2026-12-01'), semanas)).toEqual({
      coluna: 3,
      colunas: 2,
    })
  })

  it('descarta a barra inteiramente fora da grade', () => {
    expect(faixaDaBarra(data('2026-01-05'), data('2026-02-01'), semanas)).toBeNull()
    expect(faixaDaBarra(data('2027-01-04'), data('2027-02-01'), semanas)).toBeNull()
  })

  it('não gera faixa negativa quando o término é anterior ao início', () => {
    expect(faixaDaBarra(data('2026-10-05'), data('2026-09-16'), semanas)).toEqual({
      coluna: 3,
      colunas: 1,
    })
  })
})

describe('colunaDeHoje', () => {
  const semanas = gerarSemanas(data('2026-09-14'), data('2026-10-12'))

  it('aponta a coluna da semana corrente', () => {
    expect(colunaDeHoje(semanas, data('2026-09-30'))).toBe(2)
  })

  it('devolve null quando hoje está fora da grade', () => {
    expect(colunaDeHoje(semanas, data('2026-08-01'))).toBeNull()
    expect(colunaDeHoje(semanas, data('2026-11-01'))).toBeNull()
  })
})

describe('agruparPorMes', () => {
  it('soma as colunas de cada mês na ordem da grade', () => {
    const grupos = agruparPorMes(gerarSemanas(data('2026-09-14'), data('2026-10-12')))
    expect(grupos).toEqual([
      { chave: '2026-09', rotulo: 'set/26', colunas: 3 },
      { chave: '2026-10', rotulo: 'out/26', colunas: 2 },
    ])
  })

  it('devolve lista vazia para grade vazia', () => {
    expect(agruparPorMes([])).toEqual([])
  })

  it('separa meses de anos diferentes', () => {
    const grupos = agruparPorMes(gerarSemanas(data('2026-12-28'), data('2027-01-04')))
    expect(grupos.map((g) => g.rotulo)).toEqual(['dez/26', 'jan/27'])
  })
})

describe('previstoEmAtraso', () => {
  const hoje = data('2026-09-17')
  const base = {
    previstoInicio: data('2026-09-01'),
    previstoTermino: data('2026-09-10'),
    realizadoInicio: null,
    realizadoTermino: null,
    status: 'EM_CURSO_50' as const,
  }

  it('acusa atraso com previstoTermino no passado, sem realizado e não concluída', () => {
    expect(previstoEmAtraso(base, hoje)).toBe(true)
  })

  it('não acusa atraso quando previstoTermino é hoje ou futuro', () => {
    expect(previstoEmAtraso({ ...base, previstoTermino: hoje }, hoje)).toBe(false)
    expect(
      previstoEmAtraso({ ...base, previstoTermino: data('2026-09-30') }, hoje),
    ).toBe(false)
  })

  it('não acusa atraso quando a ação está concluída', () => {
    expect(previstoEmAtraso({ ...base, status: 'CONCLUIDO' }, hoje)).toBe(false)
  })

  it('não acusa atraso quando já há realizadoTermino apontado', () => {
    expect(
      previstoEmAtraso({ ...base, realizadoTermino: data('2026-09-12') }, hoje),
    ).toBe(false)
  })

  it('não acusa atraso sem previstoTermino', () => {
    expect(previstoEmAtraso({ ...base, previstoTermino: null }, hoje)).toBe(false)
  })

  it('compara por dia, ignorando a hora gravada na data', () => {
    const terminoHojeComHora = new Date('2026-09-17T23:59:00.000Z')
    expect(
      previstoEmAtraso({ ...base, previstoTermino: terminoHojeComHora }, hoje),
    ).toBe(false)
  })
})
