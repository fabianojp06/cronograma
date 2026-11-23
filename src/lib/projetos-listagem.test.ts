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
    responsavel: 'Fabiano',
    prioridade: 1,
    acoes: [],
    riscos: [],
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

describe('sinal do projeto em montarLinhas', () => {
  const d = (t: string) => new Date(`${t}T00:00:00.000Z`)
  // 9 ações no mesmo intervalo (previsto de 40% em HOJE): 4 a 50% e 5 a 25%
  // dão realizado de ~36% (desvio de -3,9 p.p.). A décima não tem início
  // previsto (sem peso no avanço) mas vence no passado: o status agregado
  // do projeto é ATRASADO.
  const base = { previstoInicio: d('2026-09-14'), previstoTermino: d('2026-09-25'), realizadoTermino: null }
  const acoes = [
    ...Array.from({ length: 4 }, () => ({ ...base, status: StatusAcao.EM_CURSO_50 })),
    ...Array.from({ length: 5 }, () => ({ ...base, status: StatusAcao.EM_CURSO_25 })),
    { status: StatusAcao.NAO_INICIADO, previstoInicio: null, previstoTermino: PASSADO, realizadoTermino: null },
  ]

  it('convive com o status agregado: ATENCAO no sinal e ATRASADO no status', () => {
    const [linha] = montarLinhas([projeto({ acoes })], HOJE)
    expect(linha.resumo.status).toBe('ATRASADO')
    expect(linha.sinal.sinal).toBe('ATENCAO')
    expect(linha.sinal.desvio).toBe(-3.9)
    expect('riscos' in linha).toBe(false)
  })

  it('usa os riscos abertos recebidos: risco alto vencido sobe um nível', () => {
    const [linha] = montarLinhas(
      [projeto({ acoes, riscos: [{ impacto: 'ALTO', status: 'ABERTO', prazo: PASSADO }] })],
      HOJE,
    )
    expect(linha.sinal.sinal).toBe('ATRASADO')
    expect(linha.sinal.subiuPorRisco).toBe(true)
  })

  it('projeto sem ações com datas fica SEM_DADOS', () => {
    const [linha] = montarLinhas([projeto()], HOJE)
    expect(linha.sinal.sinal).toBe('SEM_DADOS')
  })

  it('quem não informa riscos nem início previsto não quebra', () => {
    const [linha] = montarLinhas(
      [{ ...projeto(), riscos: undefined, acoes: [{ status: StatusAcao.NAO_INICIADO, previstoTermino: PASSADO, realizadoTermino: null }] }],
      HOJE,
    )
    expect(linha.sinal.sinal).toBe('SEM_DADOS')
  })
})
