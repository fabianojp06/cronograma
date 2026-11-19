import { describe, expect, it } from 'vitest'

import { TAMANHO_MAXIMO_DESCRICAO } from './acao-validacao'
import { descricaoDaCopia } from './duplicar-acao'

describe('descricaoDaCopia', () => {
  it('acrescenta o sufixo', () => {
    expect(descricaoDaCopia('Fechamento mensal')).toBe('Fechamento mensal (cópia)')
  })
  it('copiar a cópia não empilha sufixos', () => {
    expect(descricaoDaCopia('Fechamento mensal (cópia)')).toBe('Fechamento mensal (cópia)')
  })
  it('respeita o teto da descrição, cortando o texto e preservando o sufixo', () => {
    const r = descricaoDaCopia('a'.repeat(TAMANHO_MAXIMO_DESCRICAO))
    expect(r.length).toBeLessThanOrEqual(TAMANHO_MAXIMO_DESCRICAO)
    expect(r.endsWith(' (cópia)')).toBe(true)
  })
})
