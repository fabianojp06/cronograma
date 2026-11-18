import { describe, expect, it } from 'vitest'

import {
  acaoNoPeriodo,
  janelaDoPeriodo,
  lerPeriodo,
  limitesDoInstante,
  periodoAtivo,
  recortarPorPeriodo,
  semanaNoPeriodo,
} from './filtro-periodo'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const acao = (i: string | null, t: string | null) => ({
  previstoInicio: i ? d(i) : null,
  previstoTermino: t ? d(t) : null,
})

describe('lerPeriodo', () => {
  it('lê de e ate da query string', () => {
    expect(lerPeriodo(new URLSearchParams('de=2026-03-01&ate=2026-05-31'))).toEqual({
      de: '2026-03-01',
      ate: '2026-05-31',
    })
  })

  it('aceita só uma das pontas', () => {
    expect(lerPeriodo({ de: '2026-03-01' })).toEqual({ de: '2026-03-01', ate: null })
  })

  it('ignora data inválida ou inexistente', () => {
    expect(lerPeriodo({ de: 'ontem', ate: '2026-02-30' })).toEqual({ de: null, ate: null })
  })

  it('troca o intervalo escrito ao contrário', () => {
    expect(lerPeriodo({ de: '2026-06-01', ate: '2026-03-01' })).toEqual({
      de: '2026-03-01',
      ate: '2026-06-01',
    })
  })

  it('vazio não ativa o filtro', () => {
    expect(periodoAtivo(lerPeriodo({}))).toBe(false)
  })
})

describe('acaoNoPeriodo', () => {
  const marco = { de: '2026-03-01', ate: '2026-03-31' }

  it('inclui ação totalmente dentro', () => {
    expect(acaoNoPeriodo(acao('2026-03-10', '2026-03-20'), marco)).toBe(true)
  })

  it('inclui ação que cruza a borda', () => {
    expect(acaoNoPeriodo(acao('2026-02-15', '2026-04-15'), marco)).toBe(true)
    expect(acaoNoPeriodo(acao('2026-03-31', '2026-04-10'), marco)).toBe(true)
    expect(acaoNoPeriodo(acao('2026-02-01', '2026-03-01'), marco)).toBe(true)
  })

  it('exclui ação inteiramente fora', () => {
    expect(acaoNoPeriodo(acao('2026-01-01', '2026-02-28'), marco)).toBe(false)
    expect(acaoNoPeriodo(acao('2026-04-01', '2026-04-30'), marco)).toBe(false)
  })

  it('ação com uma só ponta vale como um dia', () => {
    expect(acaoNoPeriodo(acao(null, '2026-03-15'), marco)).toBe(true)
    expect(acaoNoPeriodo(acao('2026-05-15', null), marco)).toBe(false)
  })

  it('sem nenhuma data prevista fica de fora', () => {
    expect(acaoNoPeriodo(acao(null, null), marco)).toBe(false)
  })

  it('período aberto de um lado', () => {
    expect(acaoNoPeriodo(acao('2026-01-01', '2026-01-10'), { de: '2026-03-01', ate: null })).toBe(false)
    expect(acaoNoPeriodo(acao('2026-09-01', '2026-09-10'), { de: '2026-03-01', ate: null })).toBe(true)
    expect(acaoNoPeriodo(acao('2026-09-01', '2026-09-10'), { de: null, ate: '2026-03-01' })).toBe(false)
  })

  it('sem filtro, tudo entra — até ação sem data', () => {
    expect(acaoNoPeriodo(acao(null, null), { de: null, ate: null })).toBe(true)
  })
})

describe('recortarPorPeriodo', () => {
  const projetos = [
    { id: 'a', acoes: [acao('2026-03-05', '2026-03-10'), acao('2026-08-01', '2026-08-10')] },
    { id: 'b', acoes: [acao('2026-09-01', '2026-09-10'), acao(null, null)] },
    { id: 'c', acoes: [] },
  ]

  it('sem filtro devolve a mesma lista', () => {
    const r = recortarPorPeriodo(projetos, { de: null, ate: null })
    expect(r.projetos).toBe(projetos)
    expect(r.semDataPrevista).toBe(0)
  })

  it('recorta as ações e tira o projeto que ficou vazio', () => {
    const r = recortarPorPeriodo(projetos, { de: '2026-03-01', ate: '2026-03-31' })
    expect(r.projetos.map((p) => p.id)).toEqual(['a'])
    expect(r.projetos[0].acoes).toHaveLength(1)
  })

  it('conta as ações sem data prevista', () => {
    const r = recortarPorPeriodo(projetos, { de: '2026-03-01', ate: '2026-03-31' })
    expect(r.semDataPrevista).toBe(1)
  })

  it('não altera a entrada', () => {
    recortarPorPeriodo(projetos, { de: '2026-03-01', ate: '2026-03-31' })
    expect(projetos[0].acoes).toHaveLength(2)
  })
})

describe('limitesDoInstante', () => {
  it('usa o dia de Brasília: começa às 03:00Z e termina no começo do dia seguinte', () => {
    const l = limitesDoInstante({ de: '2026-03-01', ate: '2026-03-31' })
    expect(l.gte?.toISOString()).toBe('2026-03-01T03:00:00.000Z')
    expect(l.lt?.toISOString()).toBe('2026-04-01T03:00:00.000Z')
  })

  it('22h de 31/03 em Brasília (01:00Z de 01/04) ainda está dentro', () => {
    const l = limitesDoInstante({ de: null, ate: '2026-03-31' })
    expect(new Date('2026-04-01T01:00:00Z') < l.lt!).toBe(true)
  })

  it('período aberto devolve só o limite existente', () => {
    expect(limitesDoInstante({ de: '2026-03-01', ate: null })).not.toHaveProperty('lt')
    expect(limitesDoInstante({ de: null, ate: '2026-03-31' })).not.toHaveProperty('gte')
  })
})

describe('semanaNoPeriodo', () => {
  // Semana 10/2026: domingo 01/03 a sábado 07/03.
  const s10 = { ano: 2026, semana: 10 }
  it('inclui semana que toca o período, mesmo em parte', () => {
    expect(semanaNoPeriodo(s10, { de: '2026-03-07', ate: '2026-03-20' })).toBe(true)
    expect(semanaNoPeriodo(s10, { de: '2026-02-01', ate: '2026-03-01' })).toBe(true)
  })
  it('exclui semana fora', () => {
    expect(semanaNoPeriodo(s10, { de: '2026-03-08', ate: null })).toBe(false)
    expect(semanaNoPeriodo(s10, { de: null, ate: '2026-02-28' })).toBe(false)
  })
  it('sem filtro tudo entra', () => {
    expect(semanaNoPeriodo(s10, { de: null, ate: null })).toBe(true)
  })
})

describe('janelaDoPeriodo', () => {
  const atual = { ano: 2026, semana: 40 }
  const chaves = (j: { ano: number; semana: number }[]) => j.map((s) => `${s.ano}-${s.semana}`)

  it('sem filtro: as 12 últimas até a atual (como antes)', () => {
    const j = janelaDoPeriodo({ de: null, ate: null }, atual)
    expect(j).toHaveLength(12)
    expect(j[11]).toEqual(atual)
    expect(j[0]).toEqual({ ano: 2026, semana: 29 })
  })

  it('com de e ate: só as semanas do intervalo', () => {
    // 01/03/2026 é a semana 10; 22/03 a semana 13.
    expect(chaves(janelaDoPeriodo({ de: '2026-03-01', ate: '2026-03-22' }, atual))).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2026-13',
    ])
  })

  it('não passa da semana atual', () => {
    const j = janelaDoPeriodo({ de: '2026-09-20', ate: '2027-12-31' }, atual)
    expect(j[j.length - 1]).toEqual(atual)
  })

  it('só de: vai até a semana atual', () => {
    const j = janelaDoPeriodo({ de: '2026-09-13', ate: null }, atual)
    expect(j[j.length - 1]).toEqual(atual)
    expect(j.length).toBeGreaterThan(1)
  })

  it('período inteiramente no futuro: janela vazia', () => {
    expect(janelaDoPeriodo({ de: '2027-06-01', ate: '2027-07-01' }, atual)).toEqual([])
  })

  it('atravessa a virada de ano pelo calendário da CTCEA', () => {
    const j = janelaDoPeriodo({ de: '2025-12-20', ate: '2026-01-10' }, atual)
    expect(j.map((s) => `${s.ano}-${s.semana}`)).toContain('2026-1')
    expect(j[0].ano).toBe(2025)
  })

  it('limita ao máximo de semanas mais recentes', () => {
    expect(janelaDoPeriodo({ de: '2025-01-01', ate: null }, atual)).toHaveLength(52)
  })
})
