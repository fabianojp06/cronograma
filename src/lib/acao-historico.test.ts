import { describe, expect, it, vi } from 'vitest'

import {
  CAMPOS_AUDITADOS,
  alteracoesDeAcao,
  gravarAcaoComHistorico,
  serializarValor,
  type ClienteGravacaoAcao,
  type ClienteTransacaoAcao,
  type EstadoAuditado,
} from './acao-historico'
import { CAMPOS_DATA, type DadosAcao } from './acao-validacao'

function dataUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

const ATUAL: EstadoAuditado = {
  status: 'NAO_INICIADO',
  previstoInicio: dataUTC('2026-03-02'),
  previstoTermino: dataUTC('2026-03-20'),
  realizadoInicio: null,
  realizadoTermino: null,
  responsavel: null,
}

const DADOS: DadosAcao = {
  descricao: 'Homologar o novo servidor de arquivos',
  status: 'NAO_INICIADO',
  previstoInicio: dataUTC('2026-03-02'),
  previstoTermino: dataUTC('2026-03-20'),
  realizadoInicio: null,
  realizadoTermino: null,
}

/** Cliente Prisma falso: registra as chamadas em vez de tocar no banco. */
function clienteFalso() {
  const update: ClienteTransacaoAcao['acao']['update'] = vi.fn(async () => ({}))
  const createMany: ClienteTransacaoAcao['historicoAlteracao']['createMany'] = vi.fn(
    async () => ({}),
  )
  const transacional: ClienteTransacaoAcao = {
    acao: { update },
    historicoAlteracao: { createMany },
  }
  const cliente: ClienteGravacaoAcao = {
    $transaction: async (fn) => fn(transacional),
  }
  return { cliente, update, createMany }
}

describe('CAMPOS_AUDITADOS', () => {
  it('cobre o status, as quatro datas e o responsável', () => {
    expect(CAMPOS_AUDITADOS).toEqual(['status', ...CAMPOS_DATA, 'responsavel'])
  })
})

describe('serializarValor', () => {
  it('grava datas como aaaa-mm-dd em UTC', () => {
    expect(serializarValor(dataUTC('2026-03-02'))).toBe('2026-03-02')
  })

  it('mantém texto e preserva ausência de valor', () => {
    expect(serializarValor('CONCLUIDO')).toBe('CONCLUIDO')
    expect(serializarValor(null)).toBeNull()
    expect(serializarValor(undefined)).toBeNull()
  })
})

describe('alteracoesDeAcao', () => {
  it('não gera linha quando nada auditável mudou', () => {
    expect(alteracoesDeAcao(ATUAL, { ...ATUAL })).toEqual([])
  })

  it('registra valor antigo e novo da mudança de status', () => {
    const linhas = alteracoesDeAcao(ATUAL, { ...ATUAL, status: 'EM_CURSO_50' }, 'ana')
    expect(linhas).toEqual([
      {
        campo: 'status',
        valorAntigo: 'NAO_INICIADO',
        valorNovo: 'EM_CURSO_50',
        alteradoPor: 'ana',
      },
    ])
  })

  it('registra o preenchimento de uma data realizada que estava vazia', () => {
    const linhas = alteracoesDeAcao(ATUAL, {
      ...ATUAL,
      realizadoInicio: dataUTC('2026-03-04'),
    })
    expect(linhas).toEqual([
      {
        campo: 'realizadoInicio',
        valorAntigo: null,
        valorNovo: '2026-03-04',
        alteradoPor: null,
      },
    ])
  })

  it('registra a limpeza de uma data previamente preenchida', () => {
    const linhas = alteracoesDeAcao(ATUAL, { ...ATUAL, previstoTermino: null })
    expect(linhas).toEqual([
      {
        campo: 'previstoTermino',
        valorAntigo: '2026-03-20',
        valorNovo: null,
        alteradoPor: null,
      },
    ])
  })

  it('gera uma linha por campo alterado, na ordem do SCHEMA.md', () => {
    const linhas = alteracoesDeAcao(ATUAL, {
      status: 'CONCLUIDO',
      previstoInicio: dataUTC('2026-03-02'),
      previstoTermino: dataUTC('2026-03-25'),
      realizadoInicio: dataUTC('2026-03-04'),
      realizadoTermino: dataUTC('2026-03-24'),
    })
    expect(linhas.map((linha) => linha.campo)).toEqual([
      'status',
      'previstoTermino',
      'realizadoInicio',
      'realizadoTermino',
    ])
  })

  it('ignora a descrição — só status e datas são auditados', () => {
    const linhas = alteracoesDeAcao(
      { ...ATUAL, descricao: 'Antiga' } as EstadoAuditado,
      { ...ATUAL, descricao: 'Nova' } as EstadoAuditado,
    )
    expect(linhas).toEqual([])
  })
})

describe('gravarAcaoComHistorico', () => {
  it('cria o histórico da alteração junto com a atualização da ação', async () => {
    const { cliente, update, createMany } = clienteFalso()

    const { alteracoes } = await gravarAcaoComHistorico(cliente, {
      acaoId: 'acao-1',
      atual: ATUAL,
      dados: { ...DADOS, status: 'CONCLUIDO', realizadoTermino: dataUTC('2026-03-24') },
      alteradoPor: 'ana',
    })

    expect(update).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'acao-1' } }),
    )

    expect(createMany).toHaveBeenCalledOnce()
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          acaoId: 'acao-1',
          campo: 'status',
          valorAntigo: 'NAO_INICIADO',
          valorNovo: 'CONCLUIDO',
          alteradoPor: 'ana',
        },
        {
          acaoId: 'acao-1',
          campo: 'realizadoTermino',
          valorAntigo: null,
          valorNovo: '2026-03-24',
          alteradoPor: 'ana',
        },
      ],
    })
    expect(alteracoes).toHaveLength(2)
  })

  it('não cria histórico quando só a descrição mudou', async () => {
    const { cliente, update, createMany } = clienteFalso()

    const { alteracoes } = await gravarAcaoComHistorico(cliente, {
      acaoId: 'acao-1',
      atual: ATUAL,
      dados: { ...DADOS, descricao: 'Nova descrição' },
    })

    expect(update).toHaveBeenCalledOnce()
    expect(createMany).not.toHaveBeenCalled()
    expect(alteracoes).toEqual([])
  })

  it('grava ação e histórico dentro da mesma transação', async () => {
    const { cliente, update, createMany } = clienteFalso()
    const transacao = vi.spyOn(cliente, '$transaction')

    await gravarAcaoComHistorico(cliente, {
      acaoId: 'acao-1',
      atual: ATUAL,
      dados: { ...DADOS, status: 'EM_CURSO_25' },
    })

    expect(transacao).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
    expect(createMany).toHaveBeenCalledOnce()
  })

  /**
   * O banco grava o id; o histórico, o nome. `novos` é o que separa os dois:
   * sem ele, comparar `dados` registraria o id no painel de histórico — ou,
   * pior, não registraria nada, porque `responsavelId` não é campo auditado.
   */
  it('grava o id na ação e o NOME no histórico ao trocar o responsável', async () => {
    const { cliente, update, createMany } = clienteFalso()

    await gravarAcaoComHistorico(cliente, {
      acaoId: 'acao-1',
      atual: { ...ATUAL, responsavel: 'Ana Souza' },
      dados: { ...DADOS, responsavelId: 'colab-2' },
      novos: { ...DADOS, responsavel: 'Márcia Gonçalves' },
      alteradoPor: 'user_1',
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'acao-1' },
      data: { ...DADOS, responsavelId: 'colab-2' },
    })
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          acaoId: 'acao-1',
          campo: 'responsavel',
          valorAntigo: 'Ana Souza',
          valorNovo: 'Márcia Gonçalves',
          alteradoPor: 'user_1',
        },
      ],
    })
  })

  it('não registra o responsável quando o estado novo não o traz', async () => {
    const { cliente, createMany } = clienteFalso()

    const { alteracoes } = await gravarAcaoComHistorico(cliente, {
      acaoId: 'acao-1',
      atual: { ...ATUAL, responsavel: 'Ana Souza' },
      dados: { ...DADOS },
      novos: { ...DADOS },
    })

    expect(alteracoes).toEqual([])
    expect(createMany).not.toHaveBeenCalled()
  })
})
