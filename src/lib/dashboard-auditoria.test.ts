import { describe, expect, it } from 'vitest'

import {
  contarPorCampo,
  rankingReplanejamentos,
  resumirAuditoria,
  rotularCampo,
  type RegistroHistorico,
} from './dashboard-auditoria'

function t(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`)
}

let sequencia = 0

function registro(campos: Partial<RegistroHistorico> = {}): RegistroHistorico {
  sequencia += 1
  return {
    id: `hist-${sequencia}`,
    campo: 'status',
    valorAntigo: null,
    valorNovo: 'EM_CURSO_50',
    alteradoEm: t('2026-03-10'),
    alteradoPor: 'ana@ctcea.org.br',
    acaoId: 'acao-1',
    acaoNumero: 1,
    acaoDescricao: 'Ação 1',
    projetoId: 'projeto-1',
    projetoNome: 'Projeto 1',
    ...campos,
  }
}

describe('rotularCampo', () => {
  it('traduz os campos auditados para pt-BR', () => {
    expect(rotularCampo('previstoTermino')).toBe('Término previsto')
    expect(rotularCampo('status')).toBe('Status')
  })

  it('devolve o próprio nome para campo desconhecido', () => {
    expect(rotularCampo('campoNovoDoFuturo')).toBe('campoNovoDoFuturo')
  })
})

describe('contarPorCampo', () => {
  it('é vazio sem registros', () => {
    expect(contarPorCampo([])).toEqual([])
  })

  it('conta por campo e ordena do mais alterado para o menos', () => {
    const contagem = contarPorCampo([
      registro({ campo: 'previstoTermino' }),
      registro({ campo: 'previstoTermino' }),
      registro({ campo: 'status' }),
    ])

    expect(contagem).toEqual([
      { campo: 'previstoTermino', rotulo: 'Término previsto', quantidade: 2 },
      { campo: 'status', rotulo: 'Status', quantidade: 1 },
    ])
  })

  it('desempata pelo rótulo', () => {
    const contagem = contarPorCampo([
      registro({ campo: 'status' }),
      registro({ campo: 'previstoInicio' }),
    ])
    expect(contagem.map((c) => c.campo)).toEqual(['previstoInicio', 'status'])
  })
})

describe('rankingReplanejamentos', () => {
  it('ignora alterações que não são de data prevista', () => {
    const ranking = rankingReplanejamentos([
      registro({ campo: 'status' }),
      registro({ campo: 'realizadoTermino' }),
    ])
    expect(ranking).toEqual([])
  })

  it('agrupa por ação e conta as vezes', () => {
    const ranking = rankingReplanejamentos([
      registro({ acaoId: 'a1', campo: 'previstoTermino' }),
      registro({ acaoId: 'a1', campo: 'previstoInicio' }),
      registro({ acaoId: 'a2', campo: 'previstoTermino' }),
    ])

    expect(ranking.map((l) => [l.acaoId, l.vezes])).toEqual([
      ['a1', 2],
      ['a2', 1],
    ])
  })

  it('guarda a alteração mais recente, mesmo fora de ordem na entrada', () => {
    const [linha] = rankingReplanejamentos([
      registro({
        acaoId: 'a1',
        campo: 'previstoTermino',
        alteradoEm: t('2026-05-01'),
        valorNovo: '2026-06-30',
      }),
      registro({
        acaoId: 'a1',
        campo: 'previstoTermino',
        alteradoEm: t('2026-02-01'),
        valorNovo: '2026-03-31',
      }),
    ])

    expect(linha.vezes).toBe(2)
    expect(linha.ultimaEm).toEqual(t('2026-05-01'))
    expect(linha.ultimoValorNovo).toBe('2026-06-30')
  })

  it('desempata pela alteração mais recente', () => {
    const ranking = rankingReplanejamentos([
      registro({ acaoId: 'antiga', campo: 'previstoTermino', alteradoEm: t('2026-01-10') }),
      registro({ acaoId: 'nova', campo: 'previstoTermino', alteradoEm: t('2026-04-10') }),
    ])
    expect(ranking.map((l) => l.acaoId)).toEqual(['nova', 'antiga'])
  })

  it('respeita o limite', () => {
    const registros = Array.from({ length: 12 }, (_, i) =>
      registro({ acaoId: `a${i}`, campo: 'previstoTermino' }),
    )
    expect(rankingReplanejamentos(registros).length).toBe(10)
    expect(rankingReplanejamentos(registros, 4).length).toBe(4)
  })
})

describe('resumirAuditoria', () => {
  it('devolve zeros sem registros', () => {
    expect(resumirAuditoria([])).toEqual({
      totalAlteracoes: 0,
      totalReplanejamentos: 0,
      acoesReplanejadas: 0,
      autores: 0,
    })
  })

  it('separa total de alterações de total de replanejamentos', () => {
    const resumo = resumirAuditoria([
      registro({ acaoId: 'a1', campo: 'previstoTermino' }),
      registro({ acaoId: 'a1', campo: 'previstoInicio' }),
      registro({ acaoId: 'a2', campo: 'status' }),
    ])

    expect(resumo.totalAlteracoes).toBe(3)
    expect(resumo.totalReplanejamentos).toBe(2)
    expect(resumo.acoesReplanejadas).toBe(1)
  })

  it('agrupa registros sem autor em um único "não identificado"', () => {
    const resumo = resumirAuditoria([
      registro({ alteradoPor: null }),
      registro({ alteradoPor: null }),
      registro({ alteradoPor: 'ana@ctcea.org.br' }),
    ])
    expect(resumo.autores).toBe(2)
  })
})
