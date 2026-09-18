import { describe, expect, it } from 'vitest'

import {
  algumFiltroAtivo,
  filtrarPorStatus,
  FILTROS_VAZIOS,
  lerFiltros,
  whereProjetoAtivo,
} from './projeto-filtros'
import type { StatusAgregado } from './projeto-resumo'

describe('lerFiltros', () => {
  it('lê equipe, responsável, categoria e status de URLSearchParams', () => {
    expect(
      lerFiltros(
        new URLSearchParams(
          'equipe=STI&responsavel=Ana&categoria=Rede&status=ATRASADO',
        ),
      ),
    ).toEqual({
      equipe: 'STI',
      responsavel: 'Ana',
      categoria: 'Rede',
      status: 'ATRASADO',
    })
  })

  it('lê do objeto searchParams do Next e usa o primeiro valor repetido', () => {
    expect(lerFiltros({ equipe: ['GRH', 'STI'] }).equipe).toBe('GRH')
  })

  it('normaliza ausência e string vazia/espaços para null', () => {
    expect(lerFiltros({})).toEqual(FILTROS_VAZIOS)
    expect(
      lerFiltros({ equipe: '', responsavel: ' ', categoria: '   ' }),
    ).toEqual(FILTROS_VAZIOS)
  })

  it('ignora status desconhecido em vez de quebrar a listagem', () => {
    expect(lerFiltros({ status: 'INVENTADO' }).status).toBeNull()
  })
})

describe('algumFiltroAtivo', () => {
  it('é falso sem filtros e verdadeiro com qualquer um deles', () => {
    expect(algumFiltroAtivo(FILTROS_VAZIOS)).toBe(false)
    expect(algumFiltroAtivo({ ...FILTROS_VAZIOS, categoria: 'Rede' })).toBe(true)
    expect(algumFiltroAtivo({ ...FILTROS_VAZIOS, responsavel: 'Ana' })).toBe(true)
  })
})

describe('whereProjetoAtivo', () => {
  it('sempre restringe a projetos ativos (exclusão lógica)', () => {
    expect(whereProjetoAtivo(FILTROS_VAZIOS)).toEqual({ ativo: true })
  })

  it('inclui apenas os filtros preenchidos', () => {
    expect(
      whereProjetoAtivo({
        equipe: 'STI',
        responsavel: null,
        categoria: null,
        status: 'CONCLUIDO',
      }),
    ).toEqual({ ativo: true, equipe: 'STI' })
  })

  it('filtra por responsável como coluna do banco', () => {
    expect(
      whereProjetoAtivo({ ...FILTROS_VAZIOS, responsavel: 'Ana' }),
    ).toEqual({ ativo: true, responsavel: 'Ana' })
  })
})

describe('filtrarPorStatus', () => {
  const linhas = (['ATRASADO', 'CONCLUIDO', 'ATRASADO'] as StatusAgregado[]).map(
    (status, i) => ({ id: String(i), resumo: { status } }),
  )

  it('devolve todas as linhas quando não há filtro de status', () => {
    expect(filtrarPorStatus(linhas, FILTROS_VAZIOS)).toHaveLength(3)
  })

  it('mantém só as linhas do status pedido', () => {
    const filtradas = filtrarPorStatus(linhas, { ...FILTROS_VAZIOS, status: 'ATRASADO' })
    expect(filtradas.map((l) => l.id)).toEqual(['0', '2'])
  })
})
