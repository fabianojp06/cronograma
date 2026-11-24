import { describe, expect, it } from 'vitest'

import { ZOOM_MAXIMO, ZOOM_MINIMO, zoomDeImpressao } from './flash-impressao'

const base = { totalSemanas: 7, macroetapas: 3, realizadas: 0, proximas: 3, riscos: 2, alertas: 4, pedidosDeAjuda: 1, avisos: 0 }

describe('zoomDeImpressao', () => {
  it('relatório curto usa o zoom máximo ou perto dele, e o médio cabe numa folha', () => {
    const z = zoomDeImpressao({ ...base, macroetapas: 1, proximas: 0, riscos: 0, alertas: 0, pedidosDeAjuda: 0 })
    expect(z).toBeLessThanOrEqual(ZOOM_MAXIMO)
    expect(z).toBeGreaterThan(zoomDeImpressao(base) - 0.0001)
  })
  it('mais conteúdo, zoom menor', () => {
    expect(zoomDeImpressao({ ...base, riscos: 8, alertas: 9 })).toBeLessThan(zoomDeImpressao(base))
  })
  it('nunca passa dos limites', () => {
    expect(zoomDeImpressao({ ...base, macroetapas: 12, riscos: 60, alertas: 60, pedidosDeAjuda: 30 })).toBe(ZOOM_MINIMO)
    expect(zoomDeImpressao({ ...base, totalSemanas: 0, macroetapas: 0, proximas: 0, riscos: 0, alertas: 0, pedidosDeAjuda: 0 })).toBe(ZOOM_MAXIMO)
  })
  it('empilhar o Gantt com a curva (muitas semanas) reduz o zoom', () => {
    expect(zoomDeImpressao({ ...base, totalSemanas: 40 })).toBeLessThan(zoomDeImpressao(base))
  })
})
