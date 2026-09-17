import { describe, expect, it } from 'vitest'
import { formatarDataBR } from './formatacao'

describe('formatarDataBR', () => {
  it('formata a data no padrão dd/mm/aaaa', () => {
    expect(formatarDataBR(new Date(2026, 0, 5))).toBe('05/01/2026')
  })

  it('preserva dois dígitos em dia e mês', () => {
    expect(formatarDataBR(new Date(2026, 11, 31))).toBe('31/12/2026')
  })
})
