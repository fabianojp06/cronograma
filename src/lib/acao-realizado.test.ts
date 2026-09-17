import { describe, expect, it } from 'vitest'

import {
  CAMPOS_REALIZADO,
  statusAposRealizado,
  validarRealizado,
  type EstadoParaRealizado,
} from './acao-realizado'
import { alteracoesDeAcao } from './acao-historico'

function dataUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

const AGORA = new Date('2026-09-17T13:40:00.000Z')

const ATUAL: EstadoParaRealizado = {
  status: 'NAO_INICIADO',
  previstoInicio: dataUTC('2026-09-01'),
  previstoTermino: dataUTC('2026-09-30'),
  realizadoInicio: null,
  realizadoTermino: null,
}

function validar(
  entrada: Record<string, string>,
  atual: EstadoParaRealizado = ATUAL,
) {
  return validarRealizado(entrada, atual, AGORA)
}

describe('validarRealizado', () => {
  it('aceita apenas o início e tira a ação de NAO_INICIADO', () => {
    const r = validar({ realizadoInicio: '2026-09-02', realizadoTermino: '' })

    expect(r).toEqual({
      ok: true,
      dados: {
        realizadoInicio: dataUTC('2026-09-02'),
        realizadoTermino: null,
        status: 'EM_CURSO_25',
      },
    })
  })

  it('conclui a ação quando o término é apontado', () => {
    const r = validar({
      realizadoInicio: '2026-09-02',
      realizadoTermino: '2026-09-15',
    })

    expect(r.ok && r.dados.status).toBe('CONCLUIDO')
  })

  it('aceita término usando o início já gravado no banco', () => {
    const r = validar(
      { realizadoInicio: '', realizadoTermino: '2026-09-15' },
      { ...ATUAL, realizadoInicio: dataUTC('2026-09-02'), status: 'EM_CURSO_50' },
    )

    expect(r.ok).toBe(true)
    expect(r.ok && r.dados.realizadoInicio).toBeNull()
    expect(r.ok && r.dados.status).toBe('CONCLUIDO')
  })

  it('recusa término sem início, no formulário ou no banco', () => {
    const r = validar({ realizadoInicio: '', realizadoTermino: '2026-09-15' })

    expect(r).toEqual({
      ok: false,
      erros: { realizadoInicio: 'Informe o início realizado antes do término.' },
    })
  })

  it('recusa término anterior ao início', () => {
    const r = validar({
      realizadoInicio: '2026-09-10',
      realizadoTermino: '2026-09-02',
    })

    expect(r.ok).toBe(false)
    expect(!r.ok && r.erros.realizadoTermino).toMatch(/anterior ao início realizado/)
  })

  it('recusa data realizada no futuro, campo a campo', () => {
    for (const campo of CAMPOS_REALIZADO) {
      const r = validar({ realizadoInicio: '2026-09-02', [campo]: '2026-09-18' })

      expect(r.ok).toBe(false)
      expect(!r.ok && r.erros[campo]).toBe('A data realizada não pode estar no futuro.')
    }
  })

  it('aceita a data de hoje (o dia corrente já ocorreu)', () => {
    const r = validar({ realizadoInicio: '2026-09-17', realizadoTermino: '' })

    expect(r.ok).toBe(true)
  })

  it('recusa data mal formada', () => {
    const r = validar({ realizadoInicio: '17/09/2026', realizadoTermino: '' })

    expect(r).toEqual({ ok: false, erros: { realizadoInicio: 'Data inválida.' } })
  })

  it('não toca nas datas Previsto nem na descrição', () => {
    const r = validar({
      realizadoInicio: '2026-09-02',
      realizadoTermino: '',
      previstoInicio: '2026-01-01',
      previstoTermino: '2026-01-31',
      descricao: 'tentativa de sobrescrever',
    })

    expect(r.ok && Object.keys(r.dados).sort()).toEqual([
      'realizadoInicio',
      'realizadoTermino',
      'status',
    ])
  })

  it('devolve a ação concluída para EM_CURSO_75 quando o término é apagado', () => {
    const r = validar(
      { realizadoInicio: '2026-09-02', realizadoTermino: '' },
      {
        ...ATUAL,
        status: 'CONCLUIDO',
        realizadoInicio: dataUTC('2026-09-02'),
        realizadoTermino: dataUTC('2026-09-15'),
      },
    )

    expect(r.ok && r.dados.status).toBe('EM_CURSO_75')
  })
})

describe('statusAposRealizado', () => {
  it('preserva o status intermediário informado manualmente', () => {
    const datas = { realizadoInicio: dataUTC('2026-09-02'), realizadoTermino: null }

    expect(statusAposRealizado('EM_CURSO_50', datas)).toBe('EM_CURSO_50')
  })

  it('não inicia a ação quando nenhuma data foi apontada', () => {
    expect(
      statusAposRealizado('NAO_INICIADO', {
        realizadoInicio: null,
        realizadoTermino: null,
      }),
    ).toBe('NAO_INICIADO')
  })
})

describe('trilha de auditoria do apontamento', () => {
  it('audita só o que o apontamento mudou, sem inventar mudança no Previsto', () => {
    const r = validar({ realizadoInicio: '2026-09-02', realizadoTermino: '2026-09-15' })
    if (!r.ok) throw new Error('validação deveria passar')

    const linhas = alteracoesDeAcao(ATUAL, r.dados, 'user_123')

    expect(linhas).toEqual([
      {
        campo: 'status',
        valorAntigo: 'NAO_INICIADO',
        valorNovo: 'CONCLUIDO',
        alteradoPor: 'user_123',
      },
      {
        campo: 'realizadoInicio',
        valorAntigo: null,
        valorNovo: '2026-09-02',
        alteradoPor: 'user_123',
      },
      {
        campo: 'realizadoTermino',
        valorAntigo: null,
        valorNovo: '2026-09-15',
        alteradoPor: 'user_123',
      },
    ])
  })
})
