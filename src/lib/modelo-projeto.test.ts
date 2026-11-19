import { describe, expect, it } from 'vitest'

import {
  construirItensDoModelo,
  descreverItem,
  instanciarModelo,
  lerDadosDoModelo,
  podeExcluirModelo,
  primeiroDiaUtilApartirDe,
  type AcaoDeOrigem,
} from './modelo-projeto'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (x: Date | null) => x?.toISOString().slice(0, 10) ?? null
const acao = (numero: number, ini: string | null, fim: string | null, descricao = `Ação ${numero}`): AcaoDeOrigem => ({
  numero,
  descricao,
  previstoInicio: ini ? d(ini) : null,
  previstoTermino: fim ? d(fim) : null,
})

describe('construirItensDoModelo', () => {
  it('ancora no menor início e conta dias úteis, com a duração das duas pontas', () => {
    const itens = construirItensDoModelo([
      acao(1, '2026-03-02', '2026-03-06'), // seg a sex: 5 dias
      acao(2, '2026-03-09', '2026-03-13'), // semana seguinte: começa 5 úteis depois
      acao(3, '2026-03-04', '2026-03-04'), // 1 dia, 2 úteis depois da âncora
    ])
    expect(itens.map((i) => [i.ordem, i.inicioDiasUteis, i.duracaoDiasUteis])).toEqual([
      [1, 0, 5],
      [2, 5, 5],
      [3, 2, 1],
    ])
  })
  it('ordena por número da ação e renumera a ordem a partir de 1', () => {
    const itens = construirItensDoModelo([acao(7, '2026-03-02', '2026-03-03', 'B'), acao(3, '2026-03-02', '2026-03-02', 'A')])
    expect(itens.map((i) => [i.ordem, i.descricao])).toEqual([[1, 'A'], [2, 'B']])
  })
  it('ação sem data vira item sem datas; sem nenhuma data, todos sem datas', () => {
    const [a, b] = construirItensDoModelo([acao(1, '2026-03-02', '2026-03-04'), acao(2, null, null)])
    expect(a.inicioDiasUteis).toBe(0)
    expect(b).toMatchObject({ inicioDiasUteis: null, duracaoDiasUteis: null })
    expect(construirItensDoModelo([acao(1, null, null)])[0].inicioDiasUteis).toBeNull()
  })
  it('só início, sem término: guarda o início e deixa a duração em aberto', () => {
    const [i] = construirItensDoModelo([acao(1, '2026-03-02', null)])
    expect(i).toMatchObject({ inicioDiasUteis: 0, duracaoDiasUteis: null })
  })
  it('atravessa fim de semana e feriado nacional (20/11) sem se perder', () => {
    const itens = construirItensDoModelo([acao(1, '2026-11-18', '2026-11-19'), acao(2, '2026-11-23', '2026-11-24')])
    // 18 (qua), 19 (qui), [20 feriado, 21-22 fim de semana], 23 (seg): 19 e 23 são os 2 úteis depois da âncora
    expect(itens[1].inicioDiasUteis).toBe(2)
    const volta = instanciarModelo(itens, d('2026-11-18'))
    expect(iso(volta[1].previstoInicio)).toBe('2026-11-23')
  })
})

describe('instanciarModelo', () => {
  const itens = construirItensDoModelo([
    acao(1, '2026-03-02', '2026-03-06'),
    acao(2, '2026-03-09', '2026-03-13'),
    acao(3, null, null),
  ])
  it('no mesmo início devolve as datas originais (ida e volta)', () => {
    const r = instanciarModelo(itens, d('2026-03-02'))
    expect(r.map((a) => [a.numero, iso(a.previstoInicio), iso(a.previstoTermino)])).toEqual([
      [1, '2026-03-02', '2026-03-06'],
      [2, '2026-03-09', '2026-03-13'],
      [3, null, null],
    ])
  })
  it('em outro início, desloca tudo junto', () => {
    const r = instanciarModelo(itens, d('2027-01-04')) // segunda
    expect(iso(r[0].previstoInicio)).toBe('2027-01-04')
    expect(iso(r[0].previstoTermino)).toBe('2027-01-08')
    expect(iso(r[1].previstoInicio)).toBe('2027-01-11')
  })
  it('início em fim de semana vale o próximo dia útil', () => {
    const r = instanciarModelo(itens, d('2026-03-07')) // sábado
    expect(iso(r[0].previstoInicio)).toBe('2026-03-09')
    expect(primeiroDiaUtilApartirDe(d('2026-11-20'))).toEqual(d('2026-11-23')) // feriado + fim de semana
  })
  it('o término nunca fica antes do início', () => {
    for (const inicio of ['2026-03-02', '2026-11-18', '2026-12-23', '2027-02-05']) {
      for (const a of instanciarModelo(itens, d(inicio))) {
        if (a.previstoInicio && a.previstoTermino) {
          expect(a.previstoTermino.getTime()).toBeGreaterThanOrEqual(a.previstoInicio.getTime())
        }
      }
    }
  })
  it('numera de 1 em diante pela ordem', () => {
    const r = instanciarModelo([{ ordem: 5, descricao: 'B', inicioDiasUteis: 0, duracaoDiasUteis: 1 }, { ordem: 2, descricao: 'A', inicioDiasUteis: null, duracaoDiasUteis: null }], d('2026-03-02'))
    expect(r.map((a) => [a.numero, a.descricao])).toEqual([[1, 'A'], [2, 'B']])
  })
})

describe('descreverItem', () => {
  it('conta em palavras', () => {
    expect(descreverItem({ ordem: 1, descricao: 'x', inicioDiasUteis: null, duracaoDiasUteis: null })).toBe('sem datas')
    expect(descreverItem({ ordem: 1, descricao: 'x', inicioDiasUteis: 0, duracaoDiasUteis: 5 })).toContain('no dia do início')
    expect(descreverItem({ ordem: 1, descricao: 'x', inicioDiasUteis: 3, duracaoDiasUteis: null })).toContain('3 dia(s) útil')
  })
})

describe('lerDadosDoModelo', () => {
  const f = (campos: Record<string, string>) => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(campos)) fd.set(k, v)
    return fd
  }
  it('aparar e normalizar espaços; descrição opcional', () => {
    expect(lerDadosDoModelo(f({ nome: '  Fechamento   mensal ', descricao: '' }))).toEqual({
      ok: true, nome: 'Fechamento mensal', descricao: null,
    })
  })
  it('recusa nome vazio ou longo demais', () => {
    expect(lerDadosDoModelo(f({ nome: '  ' })).ok).toBe(false)
    expect(lerDadosDoModelo(f({ nome: 'a'.repeat(121) })).ok).toBe(false)
  })
})

describe('podeExcluirModelo', () => {
  it('quem salvou ou administrador', () => {
    expect(podeExcluirModelo('u1', 'u1', false)).toBe(true)
    expect(podeExcluirModelo('u1', 'u2', false)).toBe(false)
    expect(podeExcluirModelo('u1', 'u2', true)).toBe(true)
  })
})
