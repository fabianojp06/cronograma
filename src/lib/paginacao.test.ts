import { describe, expect, it } from 'vitest'

import { correspondeABusca, lerPagina, paginar } from './paginacao'

const lista = Array.from({ length: 53 }, (_, i) => i + 1)

describe('lerPagina', () => {
  it('lê o número, e cai na primeira quando falta ou é inválido', () => {
    expect(lerPagina({ pagina: '3' })).toBe(3)
    expect(lerPagina({})).toBe(1)
    expect(lerPagina({ pagina: '0' })).toBe(1)
    expect(lerPagina({ pagina: '-2' })).toBe(1)
    expect(lerPagina({ pagina: 'abc' })).toBe(1)
    expect(lerPagina({ pagina: '2.5' })).toBe(1)
  })
  it('aceita "todas" e URLSearchParams', () => {
    expect(lerPagina({ pagina: 'todas' })).toBe('todas')
    expect(lerPagina(new URLSearchParams('pagina=4'))).toBe(4)
  })
})

describe('paginar', () => {
  it('fatia e informa a posição', () => {
    const p = paginar(lista, 2, 25)
    expect(p.itens[0]).toBe(26)
    expect(p.itens).toHaveLength(25)
    expect([p.de, p.ate, p.total, p.totalPaginas]).toEqual([26, 50, 53, 3])
  })
  it('a última página traz o resto', () => {
    const p = paginar(lista, 3, 25)
    expect(p.itens).toHaveLength(3)
    expect([p.de, p.ate]).toEqual([51, 53])
  })
  it('página além do fim vira a última', () => {
    expect(paginar(lista, 99, 25).pagina).toBe(3)
  })
  it('lista vazia tem uma página e posição zero', () => {
    const p = paginar([], 1, 25)
    expect([p.pagina, p.totalPaginas, p.de, p.ate, p.total]).toEqual([1, 1, 0, 0, 0])
  })
  it('"todas" devolve tudo', () => {
    const p = paginar(lista, 'todas', 25)
    expect(p.itens).toHaveLength(53)
    expect(p.todas).toBe(true)
  })
})

describe('correspondeABusca', () => {
  it('sem busca, tudo corresponde', () => {
    expect(correspondeABusca(null, ['x'])).toBe(true)
    expect(correspondeABusca('   ', ['x'])).toBe(true)
  })
  it('ignora acento e caixa', () => {
    expect(correspondeABusca('relatorio', ['Relatório mensal'])).toBe(true)
    expect(correspondeABusca('JOSÉ', ['jose silva'])).toBe(true)
  })
  it('exige todas as palavras, em qualquer campo', () => {
    expect(correspondeABusca('ana relatorio', ['Relatório mensal', 'Ana Souza'])).toBe(true)
    expect(correspondeABusca('ana contrato', ['Relatório mensal', 'Ana Souza'])).toBe(false)
  })
  it('ignora campos nulos e aceita número', () => {
    expect(correspondeABusca('12', [null, undefined, 12, 'x'])).toBe(true)
  })
})
