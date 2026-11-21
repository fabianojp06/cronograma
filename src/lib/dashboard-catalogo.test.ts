import { readFileSync } from 'node:fs'
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

/**
 * Texto da página e das seções que ela monta, na ORDEM em que são renderizadas:
 * a página abre com as seções de panorama/composição/dimensão e depois chama
 * prazos, qualidade, WIN e auditoria. Concatenar nessa ordem mantém a conferência
 * valendo depois de a página ter sido dividida em módulos.
 */
function textoDaPagina(): string {
  return ['secoes/gestao.tsx', 'page.tsx', 'secoes/prazos.tsx', 'secoes/tempo.tsx', 'secoes/qualidade.tsx', 'secoes/wins.tsx', 'secoes/auditoria.tsx']
    .map((arquivo) => readFileSync(new URL(`../app/dashboards/${arquivo}`, import.meta.url), 'utf-8'))
    .join('\n')
}

describe('a página segue a ordem do catálogo', () => {
  /**
   * O índice de navegação é derivado do catálogo, mas as seções são escritas à
   * mão na página. Se as duas ordens divergirem, o menu leva a pessoa a uma
   * seção que está acima ou abaixo de onde ele diz — e nada quebra, o que é o
   * pior tipo de defeito. Já aconteceu: as seções de WIN entraram entre as duas
   * de auditoria e o índice passou a mentir.
   */
  it('renderiza as seções na mesma ordem em que o catálogo as declara', () => {
    const pagina = textoDaPagina()
    // Só as seções escritas com id literal: as de dimensão saem de um laço,
    // com o id vindo de variável, e a ordem delas já é derivada de uma lista.
    const naPagina = [...pagina.matchAll(/rel\('([a-z-]+)'\)/g)].map((m) => m[1])
    expect(naPagina.length).toBeGreaterThan(5)

    const esperada = RELATORIOS.map((r) => r.id).filter((id) => naPagina.includes(id))
    expect(naPagina).toEqual(esperada)
  })

  it('todo id usado na página existe no catálogo', () => {
    const pagina = textoDaPagina()
    const ids = new Set(RELATORIOS.map((r) => r.id))
    for (const [, id] of pagina.matchAll(/rel\('([a-z-]+)'\)/g)) {
      expect(ids.has(id), `id "${id}" não está no catálogo`).toBe(true)
    }
  })
})
