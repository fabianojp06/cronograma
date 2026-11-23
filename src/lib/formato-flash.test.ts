import { describe, expect, it } from 'vitest'

import { desvioEscritoFlash, percentualEscrito } from './formato-flash'

describe('percentualEscrito', () => {
  it('usa vírgula e uma casa', () => {
    expect(percentualEscrito(68)).toBe('68,0%')
    expect(percentualEscrito(63.96)).toBe('64,0%')
    expect(percentualEscrito(0)).toBe('0,0%')
  })
  it('nunca escreve -0', () => {
    expect(percentualEscrito(-0)).toBe('0,0%')
    expect(percentualEscrito(-0.04)).toBe('0,0%')
  })
})

describe('desvioEscritoFlash', () => {
  it('usa o menos de verdade e o sinal de mais', () => {
    expect(desvioEscritoFlash(-4)).toBe('−4,0 p.p.')
    expect(desvioEscritoFlash(2.55)).toBe('+2,6 p.p.')
  })
  it('zero não leva sinal nem -0', () => {
    expect(desvioEscritoFlash(0)).toBe('0,0 p.p.')
    expect(desvioEscritoFlash(-0.04)).toBe('0,0 p.p.')
  })
})
