import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import { montarLinhas, opcoesDistintas, type ProjetoComAcoes } from './projetos-listagem'

const HOJE = new Date('2026-09-17T00:00:00.000Z')
const PASSADO = new Date('2026-09-01T00:00:00.000Z')

function projeto(parcial: Partial<ProjetoComAcoes> = {}): ProjetoComAcoes {
  return {
    id: 'p1',
    referencia: 'PLA-DEP-2026-014',
    nome: 'Modernização da rede',
    equipe: 'STI',
    categoria: 'Infraestrutura',
    responsavel: 'Mariana',
    prioridade: 1,
    acoes: [],
    ...parcial,
  }
}

describe('montarLinhas', () => {
  it('anexa o resumo agregado e preserva os campos do projeto', () => {
    const [linha] = montarLinhas(
      [
        projeto({
          acoes: [
            { status: StatusAcao.CONCLUIDO, previstoTermino: PASSADO, realizadoTermino: PASSADO },
            { status: StatusAcao.NAO_INICIADO, previstoTermino: PASSADO, realizadoTermino: null },
          ],
        }),
      ],
      HOJE,
    )

    expect(linha.nome).toBe('Modernização da rede')
    expect(linha.equipe).toBe('STI')
    expect(linha.resumo.status).toBe('ATRASADO')
    expect(linha.resumo.percentualConcluido).toBe(50)
    // `acoes` não vaza para a linha — a tabela só precisa do resumo.
    expect('acoes' in linha).toBe(false)
  })

  it('devolve uma linha por projeto, inclusive projeto sem ações', () => {
    const linhas = montarLinhas([projeto(), projeto({ id: 'p2' })], HOJE)
    expect(linhas).toHaveLength(2)
    expect(linhas[1].resumo.status).toBe('SEM_ACOES')
  })
})

describe('opcoesDistintas', () => {
  it('remove nulos, vazios e duplicatas, e ordena em pt-BR', () => {
    expect(opcoesDistintas(['STI', null, 'GRH', 'STI', '  ', 'Administração'])).toEqual([
      'Administração',
      'GRH',
      'STI',
    ])
  })

  it('devolve lista vazia quando não há valor útil', () => {
    expect(opcoesDistintas([null, ''])).toEqual([])
  })
})
