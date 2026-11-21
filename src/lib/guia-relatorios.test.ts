import { describe, expect, it } from 'vitest'

import { RELATORIOS } from './dashboard-catalogo'
import { GUIA_RELATORIOS } from './guia-relatorios'

describe('guia dos relatórios', () => {
  it('todo relatório do catálogo tem entrada no guia, e o guia não tem entrada órfã', () => {
    const catalogo = RELATORIOS.map((r) => r.id).sort()
    const guia = Object.keys(GUIA_RELATORIOS).sort()
    const faltam = catalogo.filter((id) => !guia.includes(id))
    const sobram = guia.filter((id) => !catalogo.includes(id))
    expect(faltam, `Relatórios sem guia: ${faltam.join(', ')}. Acrescente em src/lib/guia-relatorios.ts.`).toEqual([])
    expect(sobram, `Entradas do guia sem relatório: ${sobram.join(', ')}`).toEqual([])
  })

  it('cada entrada tem os quatro campos preenchidos', () => {
    for (const [id, g] of Object.entries(GUIA_RELATORIOS)) {
      expect(g.mostra.trim().length, `${id}: mostra`).toBeGreaterThan(10)
      expect(g.comoLer.length, `${id}: comoLer`).toBeGreaterThan(0)
      for (const linha of g.comoLer) expect(linha.trim().length, `${id}: linha de comoLer`).toBeGreaterThan(10)
      expect(g.deOndeVem.trim().length, `${id}: deOndeVem`).toBeGreaterThan(10)
      expect(g.alerta.trim().length, `${id}: alerta`).toBeGreaterThan(10)
    }
  })
})
