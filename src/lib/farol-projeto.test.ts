import { beforeEach, describe, expect, it, vi } from 'vitest'

const avancoFalso = vi.hoisted(() => ({ desvio: null as number | null }))

vi.mock('./avanco-fisico', () => ({
  avancoEm: () =>
    avancoFalso.desvio === null
      ? null
      : { previsto: 0, realizado: 0, desvio: avancoFalso.desvio, peso: 1, acoesSemPeso: 0 },
}))

import { sinalDoProjeto, type RiscoParaSinal } from './farol-projeto'

const hoje = new Date('2026-11-23T12:00:00Z')
const ontem = new Date('2026-11-22T12:00:00Z')
const amanha = new Date('2026-11-24T12:00:00Z')

function farol(desvio: number | null, riscos: RiscoParaSinal[] = []) {
  avancoFalso.desvio = desvio
  return sinalDoProjeto({ acoes: [], riscos, hoje })
}

const riscoAlto: RiscoParaSinal = { impacto: 'ALTO', status: 'ABERTO', prazo: ontem }

describe('sinalDoProjeto', () => {
  beforeEach(() => {
    avancoFalso.desvio = null
  })

  it.each([
    [-10, 'ATRASADO'],
    [-15, 'ATRASADO'],
    [-9.9, 'ATENCAO'],
    [-3, 'ATENCAO'],
    [-2.9, 'EM_DIA'],
    [0, 'EM_DIA'],
    [3, 'EM_DIA'],
    [3.1, 'ADIANTADO'],
  ])('desvio %s vira %s', (desvio, sinal) => {
    const f = farol(desvio)
    expect(f.sinal).toBe(sinal)
    expect(f.subiuPorRisco).toBe(false)
    expect(f.motivo).not.toBe('')
  })

  it('sem ações com peso: SEM_DADOS', () => {
    const f = farol(null, [riscoAlto])
    expect(f).toEqual({
      sinal: 'SEM_DADOS',
      desvio: null,
      motivo: 'Sem ações com datas previstas',
      subiuPorRisco: false,
    })
  })

  it('risco alto aberto vencido sobe um nível', () => {
    const f = farol(0, [riscoAlto])
    expect(f.sinal).toBe('ATENCAO')
    expect(f.subiuPorRisco).toBe(true)
    expect(f.motivo).toContain('risco')
    expect(farol(5, [riscoAlto]).sinal).toBe('EM_DIA')
    expect(farol(-5, [riscoAlto]).sinal).toBe('ATRASADO')
  })

  it('ATRASADO nunca passa disso', () => {
    const f = farol(-20, [riscoAlto])
    expect(f.sinal).toBe('ATRASADO')
    expect(f.subiuPorRisco).toBe(false)
  })

  it('risco que não conta não sobe', () => {
    const semEfeito: RiscoParaSinal[] = [
      { impacto: 'ALTO', status: 'RESOLVIDO', prazo: ontem },
      { impacto: 'MEDIO', status: 'ABERTO', prazo: ontem },
      { impacto: 'ALTO', status: 'ABERTO', prazo: amanha },
      { impacto: 'ALTO', status: 'ABERTO', prazo: null },
    ]
    expect(farol(0, semEfeito).sinal).toBe('EM_DIA')
    expect(farol(0, semEfeito).subiuPorRisco).toBe(false)
  })

  it('prazo igual a hoje não sobe', () => {
    const f = farol(0, [{ impacto: 'ALTO', status: 'ABERTO', prazo: hoje }])
    expect(f.sinal).toBe('EM_DIA')
    expect(f.subiuPorRisco).toBe(false)
  })

  it('desvio negativo minúsculo não vira -0', () => {
    const f = farol(-0.04)
    expect(Object.is(f.desvio, -0)).toBe(false)
    expect(f.motivo).not.toContain('−0')
  })

  it('desvio nunca é -0 e o motivo usa menos de verdade e vírgula', () => {
    expect(Object.is(farol(-0).desvio, -0)).toBe(false)
    expect(farol(-0).motivo).toContain('0 p.p.')
    expect(farol(-4).motivo).toContain('−4 p.p.')
    expect(farol(3.5).motivo).toContain('+3,5 p.p.')
  })
})
