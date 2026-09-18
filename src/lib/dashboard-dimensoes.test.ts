import { describe, expect, it } from 'vitest'

import {
  SEM_VALOR,
  agruparPorDimensao,
  maiorVolume,
  type ProjetoAgrupavel,
} from './dashboard-dimensoes'
import type { ResumoProjeto, StatusAgregado } from './projeto-resumo'

function resumo(
  totalAcoes: number,
  acoesConcluidas: number,
  acoesAtrasadas = 0,
  status: StatusAgregado = 'EM_ANDAMENTO',
): ResumoProjeto {
  return {
    totalAcoes,
    acoesConcluidas,
    acoesAtrasadas,
    percentualConcluido:
      totalAcoes === 0 ? 0 : Math.round((acoesConcluidas / totalAcoes) * 100),
    status,
  }
}

function projeto(campos: Partial<ProjetoAgrupavel> = {}): ProjetoAgrupavel {
  return {
    equipe: null,
    responsavel: null,
    natureza: null,
    categoria: null,
    prioridade: null,
    resumo: resumo(0, 0),
    ...campos,
  }
}

describe('agruparPorDimensao', () => {
  it('devolve lista vazia sem projetos', () => {
    expect(agruparPorDimensao([], 'equipe')).toEqual([])
  })

  it('soma ações, concluídas e atrasadas por chave', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ equipe: 'STI', resumo: resumo(4, 2, 1) }),
        projeto({ equipe: 'STI', resumo: resumo(6, 3, 0) }),
      ],
      'equipe',
    )

    expect(linhas).toEqual([
      {
        chave: 'STI',
        projetos: 2,
        projetosAtrasados: 1,
        acoes: 10,
        acoesConcluidas: 5,
        acoesAtrasadas: 1,
        percentualConcluido: 50,
      },
    ])
  })

  it('ordena por volume de ações, decrescente', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ equipe: 'GIA', resumo: resumo(2, 0) }),
        projeto({ equipe: 'STI', resumo: resumo(9, 0) }),
        projeto({ equipe: 'GRH', resumo: resumo(5, 0) }),
      ],
      'equipe',
    )

    expect(linhas.map((l) => l.chave)).toEqual(['STI', 'GRH', 'GIA'])
  })

  it('desempata pelo rótulo em pt-BR', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ equipe: 'Órgão', resumo: resumo(3, 0) }),
        projeto({ equipe: 'Alfa', resumo: resumo(3, 0) }),
      ],
      'equipe',
    )

    expect(linhas.map((l) => l.chave)).toEqual(['Alfa', 'Órgão'])
  })

  it('agrupa nulo e string vazia em "Não informado" e joga para o fim', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ equipe: null, resumo: resumo(50, 0) }),
        projeto({ equipe: '   ', resumo: resumo(1, 0) }),
        projeto({ equipe: 'STI', resumo: resumo(2, 0) }),
      ],
      'equipe',
    )

    expect(linhas.map((l) => l.chave)).toEqual(['STI', SEM_VALOR])
    // Volume maior não promove o grupo de ruído de cadastro.
    expect(linhas[1].acoes).toBe(51)
    expect(linhas[1].projetos).toBe(2)
  })

  it('converte prioridade numérica em chave de texto', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ prioridade: 1, resumo: resumo(3, 0) }),
        projeto({ prioridade: 2, resumo: resumo(1, 0) }),
      ],
      'prioridade',
    )

    expect(linhas.map((l) => l.chave)).toEqual(['1', '2'])
  })

  it('trata prioridade 0 como valor, não como ausência', () => {
    const linhas = agruparPorDimensao([projeto({ prioridade: 0 })], 'prioridade')
    expect(linhas.map((l) => l.chave)).toEqual(['0'])
  })

  it('não divide por zero quando o grupo não tem ações', () => {
    const linhas = agruparPorDimensao([projeto({ equipe: 'STI' })], 'equipe')
    expect(linhas[0].percentualConcluido).toBe(0)
  })
})

describe('maiorVolume', () => {
  it('é zero sem linhas', () => {
    expect(maiorVolume([])).toBe(0)
  })

  it('devolve o maior número de ações entre as linhas', () => {
    const linhas = agruparPorDimensao(
      [
        projeto({ equipe: 'STI', resumo: resumo(9, 0) }),
        projeto({ equipe: 'GIA', resumo: resumo(2, 0) }),
      ],
      'equipe',
    )
    expect(maiorVolume(linhas)).toBe(9)
  })
})
