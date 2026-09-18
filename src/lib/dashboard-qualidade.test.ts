import { describe, expect, it } from 'vitest'

import {
  PENDENCIAS,
  apurarPendencias,
  totalPendencias,
  type AcaoAuditavel,
  type ProjetoAuditavel,
} from './dashboard-qualidade'
import { StatusAcao } from '../generated/prisma/enums'

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

let sequencia = 0

function acao(campos: Partial<AcaoAuditavel> = {}): AcaoAuditavel {
  sequencia += 1
  return {
    id: `acao-${sequencia}`,
    numero: sequencia,
    descricao: `Ação ${sequencia}`,
    status: StatusAcao.NAO_INICIADO,
    previstoInicio: d('2026-01-05'),
    previstoTermino: d('2026-01-20'),
    realizadoInicio: null,
    realizadoTermino: null,
    projetoId: 'projeto-1',
    projetoNome: 'Projeto 1',
    ...campos,
  }
}

function projeto(campos: Partial<ProjetoAuditavel> = {}): ProjetoAuditavel {
  sequencia += 1
  return {
    id: `projeto-${sequencia}`,
    nome: `Projeto ${sequencia}`,
    equipe: 'STI',
    responsavel: 'Ana',
    totalAcoes: 3,
    ...campos,
  }
}

function quantidadeDe(
  linhas: ReturnType<typeof apurarPendencias>,
  pendencia: (typeof PENDENCIAS)[number],
): number {
  return linhas.find((linha) => linha.pendencia === pendencia)!.quantidade
}

describe('apurarPendencias', () => {
  it('lista todas as pendências conhecidas, mesmo zeradas', () => {
    const linhas = apurarPendencias([projeto()], [acao()])
    expect(linhas.length).toBe(PENDENCIAS.length)
    expect(totalPendencias(linhas)).toBe(0)
  })

  it('conta projeto sem ação, sem equipe e sem responsável', () => {
    const linhas = apurarPendencias(
      [
        projeto({ totalAcoes: 0 }),
        projeto({ equipe: null }),
        projeto({ responsavel: '   ' }),
      ],
      [],
    )

    expect(quantidadeDe(linhas, 'PROJETO_SEM_ACAO')).toBe(1)
    expect(quantidadeDe(linhas, 'PROJETO_SEM_EQUIPE')).toBe(1)
    // String só com espaço conta como ausente.
    expect(quantidadeDe(linhas, 'PROJETO_SEM_RESPONSAVEL')).toBe(1)
  })

  it('conta ação sem término previsto', () => {
    const linhas = apurarPendencias([], [acao({ previstoTermino: null }), acao()])
    expect(quantidadeDe(linhas, 'ACAO_SEM_PREVISTO')).toBe(1)
  })

  it('conta datas invertidas, previstas e realizadas', () => {
    const linhas = apurarPendencias(
      [],
      [
        acao({ previstoInicio: d('2026-02-10'), previstoTermino: d('2026-02-01') }),
        acao({ realizadoInicio: d('2026-02-10'), realizadoTermino: d('2026-02-01') }),
      ],
    )

    expect(quantidadeDe(linhas, 'ACAO_PREVISTO_INVERTIDO')).toBe(1)
    expect(quantidadeDe(linhas, 'ACAO_REALIZADO_INVERTIDO')).toBe(1)
  })

  it('não acusa inversão quando início e término são o mesmo dia', () => {
    const linhas = apurarPendencias(
      [],
      [acao({ previstoInicio: d('2026-02-01'), previstoTermino: d('2026-02-01') })],
    )
    expect(quantidadeDe(linhas, 'ACAO_PREVISTO_INVERTIDO')).toBe(0)
  })

  it('cruza status e realizado nos dois sentidos', () => {
    const linhas = apurarPendencias(
      [],
      [
        acao({ status: StatusAcao.CONCLUIDO, realizadoTermino: null }),
        acao({ status: StatusAcao.EM_CURSO_75, realizadoTermino: d('2026-02-01') }),
      ],
    )

    expect(quantidadeDe(linhas, 'ACAO_CONCLUIDA_SEM_REALIZADO')).toBe(1)
    expect(quantidadeDe(linhas, 'ACAO_REALIZADA_NAO_CONCLUIDA')).toBe(1)
  })

  it('ordena da maior incidência para a menor', () => {
    const linhas = apurarPendencias(
      [projeto({ equipe: null }), projeto({ equipe: null }), projeto({ totalAcoes: 0 })],
      [],
    )
    expect(linhas[0].pendencia).toBe('PROJETO_SEM_EQUIPE')
    expect(linhas[0].quantidade).toBe(2)
  })

  it('traz rótulo e efeito preenchidos em toda linha', () => {
    for (const linha of apurarPendencias([], [])) {
      expect(linha.rotulo.trim()).not.toBe('')
      expect(linha.efeito.trim()).not.toBe('')
    }
  })
})

describe('totalPendencias', () => {
  it('soma todas as ocorrências', () => {
    const linhas = apurarPendencias(
      [projeto({ totalAcoes: 0, equipe: null })],
      [acao({ previstoTermino: null })],
    )
    expect(totalPendencias(linhas)).toBe(3)
  })
})
