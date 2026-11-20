import { describe, expect, it } from 'vitest'

import {
  acaoIniciada,
  bloqueioDaGravacao,
  etiquetaDaDependencia,
  ehLiderDoProjeto,
  gravacaoInicia,
  riscoDaPredecessora,
  validarJustificativa,
  validarMotivoLiberacao,
  validarNovaDependencia,
} from './dependencia-acao'

const par = (acaoId: string, predecessoraId: string) => ({ acaoId, predecessoraId })
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('validarNovaDependencia', () => {
  it('aceita um vínculo novo', () => {
    expect(validarNovaDependencia(par('B', 'A'), [])).toBeNull()
  })
  it('recusa depender de si mesma', () => {
    expect(validarNovaDependencia(par('A', 'A'), [])).toBe('MESMA_ACAO')
  })
  it('recusa repetir o vínculo', () => {
    expect(validarNovaDependencia(par('B', 'A'), [par('B', 'A')])).toBe('JA_EXISTE')
  })
  it('recusa ciclo direto', () => {
    expect(validarNovaDependencia(par('A', 'B'), [par('B', 'A')])).toBe('CICLO')
  })
  it('recusa ciclo indireto', () => {
    // C depende de B, B depende de A; A depender de C fecha o ciclo.
    expect(validarNovaDependencia(par('A', 'C'), [par('B', 'A'), par('C', 'B')])).toBe('CICLO')
  })
  it('aceita vários predecessores e losango sem ciclo', () => {
    const existentes = [par('B', 'A'), par('C', 'A'), par('D', 'B')]
    expect(validarNovaDependencia(par('D', 'C'), existentes)).toBeNull()
  })
})

describe('início da ação', () => {
  const parada = { status: 'NAO_INICIADO', realizadoInicio: null, realizadoTermino: null }
  it('não iniciada não conta como iniciada', () => {
    expect(acaoIniciada(parada)).toBe(false)
  })
  it('status avançado ou realizado apontado contam', () => {
    expect(acaoIniciada({ ...parada, status: 'EM_CURSO_25' })).toBe(true)
    expect(acaoIniciada({ ...parada, realizadoInicio: d('2026-01-05') })).toBe(true)
  })
  it('só a passagem de não iniciada para iniciada inicia', () => {
    expect(gravacaoInicia(parada, { ...parada, status: 'EM_CURSO_25' })).toBe(true)
    expect(gravacaoInicia(parada, parada)).toBe(false)
    const andando = { ...parada, status: 'EM_CURSO_50' }
    expect(gravacaoInicia(andando, { ...andando, status: 'EM_CURSO_75' })).toBe(false)
  })
})

describe('bloqueioDaGravacao', () => {
  const preds = [
    { id: 'a', numero: 3, status: 'EM_CURSO_50' },
    { id: 'b', numero: 4, status: 'CONCLUIDO' },
  ]
  it('bloqueia o início com predecessora pendente e cita o número', () => {
    const msg = bloqueioDaGravacao({ inicia: true, predecessoras: preds, liberada: false })
    expect(msg).toContain('#3')
    expect(msg).not.toContain('#4')
  })
  it('não bloqueia se liberada, se não inicia ou se todas terminaram', () => {
    expect(bloqueioDaGravacao({ inicia: true, predecessoras: preds, liberada: true })).toBeNull()
    expect(bloqueioDaGravacao({ inicia: false, predecessoras: preds, liberada: false })).toBeNull()
    expect(
      bloqueioDaGravacao({ inicia: true, predecessoras: [preds[1]], liberada: false }),
    ).toBeNull()
  })
  it('usa o plural com mais de uma pendente', () => {
    const msg = bloqueioDaGravacao({
      inicia: true,
      predecessoras: [preds[0], { id: 'c', numero: 5, status: 'NAO_INICIADO' }],
      liberada: false,
    })
    expect(msg).toContain('#3, #5')
    expect(msg).toContain('ações')
  })
})

describe('ehLiderDoProjeto', () => {
  it('administrador sempre é líder', () => {
    expect(
      ehLiderDoProjeto({ nomeDoColaborador: null, responsavelDoProjeto: null, administrador: true }),
    ).toBe(true)
  })
  it('casa o responsável do projeto sem acento nem caixa', () => {
    expect(
      ehLiderDoProjeto({
        nomeDoColaborador: 'Fabiano José',
        responsavelDoProjeto: 'fabiano jose',
        administrador: false,
      }),
    ).toBe(true)
  })
  it('nome parcial ou ausente não casa', () => {
    expect(
      ehLiderDoProjeto({
        nomeDoColaborador: 'Ana Silva',
        responsavelDoProjeto: 'Ana Silva Costa',
        administrador: false,
      }),
    ).toBe(false)
    expect(
      ehLiderDoProjeto({ nomeDoColaborador: 'Ana', responsavelDoProjeto: null, administrador: false }),
    ).toBe(false)
  })
})

describe('textos', () => {
  it('motivo exige 5 a 500 caracteres', () => {
    expect(validarMotivoLiberacao('  ')).toMatchObject({ ok: false })
    expect(validarMotivoLiberacao('urgente')).toEqual({ ok: true, texto: 'urgente' })
    expect(validarMotivoLiberacao('x'.repeat(501))).toMatchObject({ ok: false })
    expect(validarMotivoLiberacao(null)).toMatchObject({ ok: false })
  })
  it('justificativa só é obrigatória ao recusar', () => {
    expect(validarJustificativa('', true)).toEqual({ ok: true, texto: '' })
    expect(validarJustificativa('', false)).toMatchObject({ ok: false })
    expect(validarJustificativa('prazo do contrato', false)).toMatchObject({ ok: true })
  })
})

describe('riscoDaPredecessora', () => {
  const hoje = d('2026-11-20')
  const base = { status: 'EM_CURSO_50', realizadoTermino: null }
  it('atrasada quando passou do previsto sem terminar', () => {
    expect(riscoDaPredecessora({ ...base, previstoTermino: d('2026-11-10') }, d('2026-12-01'), hoje)).toBe(
      'ATRASADA',
    )
  })
  it('sobrepõe quando o término previsto não antecede o início da ação', () => {
    expect(riscoDaPredecessora({ ...base, previstoTermino: d('2026-12-05') }, d('2026-12-01'), hoje)).toBe(
      'SOBREPOE',
    )
  })
  it('sem risco quando concluída, sem data ou dentro do plano', () => {
    expect(
      riscoDaPredecessora(
        { status: 'CONCLUIDO', realizadoTermino: null, previstoTermino: d('2026-11-01') },
        null,
        hoje,
      ),
    ).toBeNull()
    expect(riscoDaPredecessora({ ...base, previstoTermino: null }, d('2026-12-01'), hoje)).toBeNull()
    expect(riscoDaPredecessora({ ...base, previstoTermino: d('2026-11-30') }, d('2026-12-01'), hoje)).toBeNull()
  })
})

describe('etiquetaDaDependencia', () => {
  const pend = [{ id: 'a', numero: 3, status: 'EM_CURSO_50' }]
  it('sem predecessoras não há selo', () => {
    expect(etiquetaDaDependencia({ predecessoras: [], iniciada: false, liberada: false })).toBeNull()
  })
  it('bloqueada enquanto pendente, não iniciada e sem liberação', () => {
    expect(etiquetaDaDependencia({ predecessoras: pend, iniciada: false, liberada: false })).toEqual({
      texto: 'bloqueada por #3',
      bloqueada: true,
    })
  })
  it('liberada, iniciada ou com tudo concluído não aparece como bloqueada', () => {
    expect(etiquetaDaDependencia({ predecessoras: pend, iniciada: false, liberada: true })?.bloqueada).toBe(false)
    expect(etiquetaDaDependencia({ predecessoras: pend, iniciada: true, liberada: false })?.bloqueada).toBe(false)
    expect(
      etiquetaDaDependencia({
        predecessoras: [{ id: 'a', numero: 3, status: 'CONCLUIDO' }],
        iniciada: false,
        liberada: false,
      })?.bloqueada,
    ).toBe(false)
  })
})
