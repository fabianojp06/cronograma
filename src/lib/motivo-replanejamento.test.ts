import { describe, expect, it } from 'vitest'

import { alteracoesDeAcao } from './acao-historico'
import { contarPorMotivo, type RegistroHistorico } from './dashboard-auditoria'
import {
  SEM_MOTIVO_REGISTRADO,
  descreverMotivo,
  lerMotivoReplanejamento,
  nomeDoMotivo,
  replanejaDataExistente,
} from './motivo-replanejamento'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('replanejaDataExistente', () => {
  const atual = { previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-10') }
  it('mudar ou limpar data que existia conta', () => {
    expect(replanejaDataExistente(atual, { previstoTermino: d('2026-03-20') })).toBe(true)
    expect(replanejaDataExistente(atual, { previstoInicio: null })).toBe(true)
    expect(replanejaDataExistente(atual, { previstoInicio: '2026-03-09' })).toBe(true)
  })
  it('data igual, campo ausente ou data que estava vazia não contam', () => {
    expect(replanejaDataExistente(atual, { previstoTermino: d('2026-03-10') })).toBe(false)
    expect(replanejaDataExistente(atual, {})).toBe(false)
    expect(replanejaDataExistente({ previstoInicio: null, previstoTermino: null }, { previstoInicio: d('2026-04-01') })).toBe(false)
  })
})

describe('lerMotivoReplanejamento', () => {
  it('exige um motivo da lista', () => {
    expect(lerMotivoReplanejamento(fd({}))).toMatchObject({ ok: false })
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'XYZ' }))).toMatchObject({ ok: false })
  })
  it('aceita com ou sem detalhe, e apara o detalhe', () => {
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'ESCOPO' }))).toEqual({ ok: true, motivo: { motivo: 'ESCOPO', detalhe: null } })
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'ESCOPO', motivoDetalhe: '  cliente   pediu ' }))).toEqual({
      ok: true,
      motivo: { motivo: 'ESCOPO', detalhe: 'cliente pediu' },
    })
  })
  it('"Outro" exige o detalhe, e o detalhe tem teto', () => {
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'OUTRO' }))).toMatchObject({ ok: false })
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'OUTRO', motivoDetalhe: 'ab' }))).toMatchObject({ ok: false })
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'OUTRO', motivoDetalhe: 'mudou a norma' }))).toMatchObject({ ok: true })
    expect(lerMotivoReplanejamento(fd({ motivoReplanejamento: 'ESCOPO', motivoDetalhe: 'x'.repeat(501) }))).toMatchObject({ ok: false })
  })
})

describe('textos', () => {
  it('descreve o motivo sem o parêntese e com o detalhe', () => {
    expect(descreverMotivo('DEPENDENCIA_EXTERNA', 'fornecedor atrasou')).toBe('Dependência externa — fornecedor atrasou')
    expect(descreverMotivo('ESCOPO', null)).toBe('Escopo mudou')
    expect(descreverMotivo(null, null)).toBe(SEM_MOTIVO_REGISTRADO)
    expect(nomeDoMotivo('OUTRO')).toBe('Outro')
    expect(descreverMotivo('CODIGO_NOVO', null)).toBe('CODIGO_NOVO')
  })
})

describe('motivo no histórico da ação', () => {
  it('só as linhas de data prevista com valor antigo levam o motivo', () => {
    const linhas = alteracoesDeAcao(
      { status: 'NAO_INICIADO', previstoInicio: null, previstoTermino: d('2026-03-10') },
      { status: 'EM_CURSO_25', previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-20') },
      'user_x',
      { motivo: 'ESCOPO', detalhe: null },
    )
    const por = Object.fromEntries(linhas.map((l) => [l.campo, l]))
    expect(por.previstoTermino.motivo).toBe('ESCOPO')
    expect(por.previstoInicio.motivo).toBeUndefined() // estava vazia: primeira data
    expect(por.status.motivo).toBeUndefined()
  })
  it('sem motivo informado, as linhas ficam como sempre foram', () => {
    const linhas = alteracoesDeAcao({ previstoTermino: d('2026-03-10') }, { previstoTermino: d('2026-03-20') }, 'u')
    expect(linhas).toEqual([{ campo: 'previstoTermino', valorAntigo: '2026-03-10', valorNovo: '2026-03-20', alteradoPor: 'u' }])
  })
})

describe('contarPorMotivo (Dashboards)', () => {
  const reg = (over: Partial<RegistroHistorico>): RegistroHistorico => ({
    id: Math.random().toString(),
    campo: 'previstoTermino',
    valorAntigo: '2026-03-10',
    valorNovo: '2026-03-20',
    alteradoEm: new Date('2026-11-10T12:00:00Z'),
    alteradoPor: null,
    acaoId: 'a',
    acaoNumero: 1,
    acaoDescricao: 'A',
    projetoId: 'p',
    projetoNome: 'P',
    motivo: null,
    ...over,
  })

  it('conta eventos, não linhas: início e término no mesmo instante valem um', () => {
    const r = contarPorMotivo([
      reg({ campo: 'previstoInicio', motivo: 'ESCOPO' }),
      reg({ campo: 'previstoTermino', motivo: 'ESCOPO' }),
      reg({ acaoId: 'b', motivo: 'RECURSOS' }),
      reg({ acaoId: 'c', motivo: 'RECURSOS', alteradoEm: new Date('2026-11-11T12:00:00Z') }),
    ])
    expect(r.map((x) => [x.motivo, x.quantidade])).toEqual([['RECURSOS', 2], ['ESCOPO', 1]])
  })
  it('o que não tem motivo vira "Sem motivo registrado", por último nos empates', () => {
    const r = contarPorMotivo([reg({ acaoId: 'a' }), reg({ acaoId: 'b', motivo: 'PRIORIDADE' })])
    expect(r.map((x) => x.rotulo)).toEqual(['Prioridade mudou', SEM_MOTIVO_REGISTRADO])
  })
  it('ignora outros campos e a primeira data preenchida', () => {
    expect(contarPorMotivo([reg({ campo: 'status' }), reg({ valorAntigo: null })])).toEqual([])
  })
})
