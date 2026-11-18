import { describe, expect, it } from 'vitest'

import {
  acaoNoPeriodo,
  lerPeriodo,
  periodoAtivo,
  recortarPorPeriodo,
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
