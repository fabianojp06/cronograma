import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import {
  corteDaFoto,
  fotoDoProjeto,
  lerDataDaFoto,
  reconstruirAcao,
  semanaAnteriorAoRegistro,
  type AcaoComHistorico,
} from './foto-em-data'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const HOJE = d('2026-11-16')

function acao(extra: Partial<AcaoComHistorico> = {}): AcaoComHistorico {
  return {
    id: 'a1',
    numero: 1,
    descricao: 'Levantar requisitos',
    status: StatusAcao.CONCLUIDO,
    previstoInicio: d('2026-02-01'),
    previstoTermino: d('2026-05-30'),
    realizadoInicio: d('2026-02-03'),
    realizadoTermino: d('2026-05-20'),
    responsavel: 'Bia',
    createdAt: d('2026-01-10'),
    historico: [],
    ...extra,
  }
}

describe('corteDaFoto', () => {
  it('é o começo do dia seguinte em Brasília: 22h de 31/03 ainda é 31/03', () => {
    const corte = corteDaFoto('2026-03-31')
    expect(corte.toISOString()).toBe('2026-04-01T03:00:00.000Z')
    const noite = new Date('2026-04-01T01:00:00Z') // 22h de 31/03 em Brasília
    expect(noite < corte).toBe(true)
  })
})

describe('lerDataDaFoto', () => {
  it('aceita um dia passado e recusa inválido, hoje e futuro', () => {
    expect(lerDataDaFoto('2026-03-31', HOJE)).toBe('2026-03-31')
    expect(lerDataDaFoto('2026-02-30', HOJE)).toBeNull()
    expect(lerDataDaFoto('lixo', HOJE)).toBeNull()
    expect(lerDataDaFoto('2026-11-16', HOJE)).toBeNull()
    expect(lerDataDaFoto('2027-01-01', HOJE)).toBeNull()
    expect(lerDataDaFoto(undefined, HOJE)).toBeNull()
    expect(lerDataDaFoto(['2026-03-31', 'x'], HOJE)).toBe('2026-03-31')
  })
})

describe('reconstruirAcao', () => {
  const corte = corteDaFoto('2026-03-31')

  it('desfaz o que mudou depois da data e mantém o que mudou antes', () => {
    const r = reconstruirAcao(
      acao({
        historico: [
          // antes da data: continua valendo
          { campo: 'status', valorAntigo: 'NAO_INICIADO', alteradoEm: d('2026-03-01') },
          // depois da data: desfeito
          { campo: 'status', valorAntigo: 'EM_CURSO_50', alteradoEm: d('2026-05-20') },
          { campo: 'realizadoTermino', valorAntigo: null, alteradoEm: d('2026-05-20') },
          { campo: 'responsavel', valorAntigo: 'Ana', alteradoEm: d('2026-06-01') },
          { campo: 'previstoTermino', valorAntigo: '2026-04-15', alteradoEm: d('2026-04-10') },
        ],
      }),
      corte,
    )
    expect(r).toMatchObject({
      status: 'EM_CURSO_50',
      realizadoTermino: null,
      responsavel: 'Ana',
      previstoTermino: d('2026-04-15'),
      previstoInicio: d('2026-02-01'),
    })
  })

  it('o mesmo campo alterado duas vezes depois da data volta ao valor mais antigo', () => {
    const r = reconstruirAcao(
      acao({
        historico: [
          { campo: 'previstoTermino', valorAntigo: '2026-04-15', alteradoEm: d('2026-04-10') },
          { campo: 'previstoTermino', valorAntigo: '2026-05-01', alteradoEm: d('2026-04-20') },
        ],
      }),
      corte,
    )
    expect(r?.previstoTermino).toEqual(d('2026-04-15'))
  })

  it('alteração às 22h do dia da foto não é desfeita; a da 1h do dia seguinte é', () => {
    const r = reconstruirAcao(
      acao({
        historico: [
          { campo: 'responsavel', valorAntigo: 'Ana', alteradoEm: new Date('2026-04-01T02:00:00Z') },
          { campo: 'status', valorAntigo: 'EM_CURSO_25', alteradoEm: new Date('2026-04-01T04:00:00Z') },
        ],
      }),
      corte,
    )
    expect(r?.responsavel).toBe('Bia')
    expect(r?.status).toBe('EM_CURSO_25')
  })

  it('devolve null para a ação criada depois da data', () => {
    expect(reconstruirAcao(acao({ createdAt: d('2026-04-02') }), corte)).toBeNull()
  })

  it('ignora campo desconhecido e status inválido no histórico', () => {
    const r = reconstruirAcao(
      acao({
        historico: [
          { campo: 'descricao', valorAntigo: 'x', alteradoEm: d('2026-06-01') },
          { campo: 'status', valorAntigo: 'LIXO', alteradoEm: d('2026-06-02') },
        ],
      }),
      corte,
    )
    expect(r?.status).toBe('CONCLUIDO')
    expect(r?.descricao).toBe('Levantar requisitos')
  })
})

describe('fotoDoProjeto', () => {
  it('conta as criadas depois e avisa quando a data é anterior ao registro', () => {
    const corte = corteDaFoto('2026-03-31')
    const foto = fotoDoProjeto(
      [acao({ numero: 2 }), acao({ id: 'a2', numero: 1 }), acao({ id: 'a3', createdAt: d('2026-09-01') })],
      corte,
      d('2026-01-10'),
    )
    expect(foto.acoes.map((a) => a.numero)).toEqual([1, 2])
    expect(foto.criadasDepois).toBe(1)
    expect(foto.anteriorAoRegistro).toBe(false)

    expect(fotoDoProjeto([], corteDaFoto('2025-12-01'), d('2026-01-10')).anteriorAoRegistro).toBe(true)
    expect(fotoDoProjeto([], corte, null).anteriorAoRegistro).toBe(false)
  })
})

describe('semanaAnteriorAoRegistro', () => {
  // Registro começou às 09h (Brasília) de 10/01/2026: a criação da primeira ação.
  const REGISTRO = new Date('2026-01-10T12:00:00Z')

  it('é verdadeira quando o sábado da semana cai antes (ou no dia) do início do registro', () => {
    expect(semanaAnteriorAoRegistro(d('2026-01-03'), REGISTRO)).toBe(true)
    // O corte é o começo do dia SEGUINTE em Brasília: o dia 09/01 inteiro é anterior ao registro...
    expect(semanaAnteriorAoRegistro(d('2026-01-09'), REGISTRO)).toBe(true)
    // ...mas o dia 10/01 já contém o registro, então a semana que termina nele não é anterior.
    expect(semanaAnteriorAoRegistro(d('2026-01-10'), REGISTRO)).toBe(false)
  })

  it('é falsa quando a semana termina depois do início do registro, inclusive a semana de hoje', () => {
    expect(semanaAnteriorAoRegistro(d('2026-01-17'), REGISTRO)).toBe(false)
    expect(semanaAnteriorAoRegistro(d('2026-11-21'), REGISTRO)).toBe(false)
  })

  it('é falsa quando não há registro nenhum (nada para comparar)', () => {
    expect(semanaAnteriorAoRegistro(d('2026-01-03'), null)).toBe(false)
  })

  it('concorda com o campo anteriorAoRegistro da foto, que usa a mesma regra', () => {
    for (const fim of ['2026-01-03', '2026-01-09', '2026-01-10', '2026-01-17']) {
      const foto = fotoDoProjeto([], corteDaFoto(fim), REGISTRO)
      expect(semanaAnteriorAoRegistro(d(fim), REGISTRO)).toBe(foto.anteriorAoRegistro)
    }
  })
})
