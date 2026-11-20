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

import {
  diaDeTerminoDoItem,
  lerClassificacaoDoModelo,
  lerItensDoFormulario,
  podeAlterarModelo,
} from './modelo-projeto'

function formulario(linhas: [string, string, string][], extras: Record<string, string> = {}) {
  const f = new FormData()
  for (const [d, i, u] of linhas) {
    f.append('acaoDescricao', d)
    f.append('acaoInicio', i)
    f.append('acaoDuracao', u)
  }
  for (const [k, v] of Object.entries(extras)) f.set(k, v)
  return f
}

describe('lerItensDoFormulario', () => {
  it('numera as ações em ordem e aceita ação sem datas', () => {
    const r = lerItensDoFormulario(formulario([['A', '0', '3'], ['B', '', '']]))
    expect(r).toEqual({
      ok: true,
      itens: [
        { ordem: 1, descricao: 'A', inicioDiasUteis: 0, duracaoDiasUteis: 3 },
        { ordem: 2, descricao: 'B', inicioDiasUteis: null, duracaoDiasUteis: null },
      ],
    })
  })

  it('ignora linha totalmente vazia e conta a linha da tela nos erros', () => {
    const r = lerItensDoFormulario(formulario([['A', '0', '3'], ['', '', ''], ['C', '2', '']]))
    expect(r).toMatchObject({ ok: false, erros: [{ linha: 3 }] })
  })

  it('valida descrição, inteiros, duração mínima e limite de dias', () => {
    const erro = (l: [string, string, string]) => {
      const r = lerItensDoFormulario(formulario([l]))
      return r.ok ? null : r.erros[0]?.erro
    }
    expect(erro(['', '1', '2'])).toBe('Descreva a ação.')
    expect(erro(['A', 'x', '2'])).toBe('Use números inteiros em dias úteis.')
    expect(erro(['A', '-1', '2'])).toBe('Use números inteiros em dias úteis.')
    expect(erro(['A', '1,5', '2'])).toBe('Use números inteiros em dias úteis.')
    expect(erro(['A', '0', '0'])).toBe('A duração mínima é 1 dia útil.')
    expect(erro(['A', '1001', '2'])).toContain('no máximo 1000')
    expect(erro(['A', '', '3'])).toBe('Informe o início e a duração, ou deixe os dois em branco.')
    expect(erro(['x'.repeat(501), '0', '1'])).toContain('no máximo 500')
  })

  it('exige pelo menos uma ação e respeita o limite', () => {
    expect(lerItensDoFormulario(formulario([]))).toMatchObject({ ok: false, erroGeral: expect.stringContaining('pelo menos uma') })
    const muitas = Array.from({ length: 201 }, (_, i): [string, string, string] => [`Ação ${i}`, '0', '1'])
    expect(lerItensDoFormulario(formulario(muitas))).toMatchObject({ ok: false, erroGeral: expect.stringContaining('200') })
  })

  it('apara e junta espaços da descrição', () => {
    const r = lerItensDoFormulario(formulario([['  Preparar   o   ambiente ', '0', '1']]))
    expect(r.ok && r.itens[0].descricao).toBe('Preparar o ambiente')
  })
})

describe('lerClassificacaoDoModelo', () => {
  it('apara, vazio vira null e recusa texto longo demais', () => {
    const f = new FormData()
    f.set('equipe', '  STI ')
    f.set('categoria', '')
    expect(lerClassificacaoDoModelo(f)).toEqual({
      ok: true,
      classificacao: { equipe: 'STI', natureza: null, categoria: null, apoio: null, setorEnvolvido: null },
    })
    f.set('natureza', 'x'.repeat(501))
    expect(lerClassificacaoDoModelo(f)).toMatchObject({ ok: false })
  })
})

describe('podeAlterarModelo e diaDeTerminoDoItem', () => {
  it('edita quem criou ou o administrador; modelo do sistema, só administrador', () => {
    expect(podeAlterarModelo('u1', 'u1', false)).toBe(true)
    expect(podeAlterarModelo('u1', 'u2', false)).toBe(false)
    expect(podeAlterarModelo('u1', 'u2', true)).toBe(true)
    expect(podeAlterarModelo('sistema', 'u2', false)).toBe(false)
    expect(podeAlterarModelo('sistema', 'u2', true)).toBe(true)
  })
  it('o término é início + duração - 1; sem datas, nulo', () => {
    expect(diaDeTerminoDoItem({ inicioDiasUteis: 3, duracaoDiasUteis: 5 })).toBe(7)
    expect(diaDeTerminoDoItem({ inicioDiasUteis: 0, duracaoDiasUteis: 1 })).toBe(0)
    expect(diaDeTerminoDoItem({ inicioDiasUteis: null, duracaoDiasUteis: null })).toBeNull()
  })
})
