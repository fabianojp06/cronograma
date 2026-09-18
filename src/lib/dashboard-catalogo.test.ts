import { describe, expect, it } from 'vitest'

import {
  GRUPOS_RELATORIO,
  RELATORIOS,
  gruposComRelatorios,
  relatoriosDoGrupo,
} from './dashboard-catalogo'

describe('catálogo de relatórios', () => {
  it('não tem id repetido — o id vira âncora na URL', () => {
    const ids = RELATORIOS.map((relatorio) => relatorio.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('usa ids válidos como fragmento de URL (minúsculas e hífen)', () => {
    for (const relatorio of RELATORIOS) {
      expect(relatorio.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('declara título e pergunta de negócio em todo relatório', () => {
    for (const relatorio of RELATORIOS) {
      expect(relatorio.titulo.trim()).not.toBe('')
      expect(relatorio.pergunta.trim()).not.toBe('')
    }
  })

  it('só usa grupos declarados em GRUPOS_RELATORIO', () => {
    for (const relatorio of RELATORIOS) {
      expect(GRUPOS_RELATORIO).toContain(relatorio.grupo)
    }
  })

  it('relatoriosDoGrupo preserva a ordem do catálogo', () => {
    expect(relatoriosDoGrupo('DISTRIBUICAO').map((r) => r.id)).toEqual([
      'por-equipe',
      'por-responsavel',
      'por-natureza',
      'por-categoria',
      'por-prioridade',
    ])
  })

  it('gruposComRelatorios cobre todos os grupos e nenhum fica vazio', () => {
    const grupos = gruposComRelatorios()
    expect(grupos).toEqual([...GRUPOS_RELATORIO])
    for (const grupo of grupos) {
      expect(relatoriosDoGrupo(grupo).length).toBeGreaterThan(0)
    }
  })
})
