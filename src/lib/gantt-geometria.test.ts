import { describe, expect, it } from 'vitest'

import { gerarSemanas } from './gantt'
import {
  ALTURA_LINHA_PX,
  LARGURA_MINIMA_PX,
  LARGURA_SEMANA_PX,
  barraEmPx,
  larguraDaGrade,
  montarSetas,
  xDaData,
  xDeHoje,
  xDeMarca,
} from './gantt-geometria'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
// 2026-03-02 é segunda-feira: 4 semanas (02/03, 09/03, 16/03, 23/03).
const semanas = gerarSemanas(d('2026-03-02'), d('2026-03-27'))
const DIA = LARGURA_SEMANA_PX / 7

describe('régua em pixels', () => {
  it('a janela mede semanas × largura da semana', () => {
    expect(semanas).toHaveLength(4)
    expect(larguraDaGrade(semanas)).toBe(4 * LARGURA_SEMANA_PX)
  })
  it('posiciona por DIA: a segunda é 0, a quarta é 2 dias, a semana seguinte é uma coluna', () => {
    expect(xDaData(d('2026-03-02'), semanas)).toBe(0)
    expect(xDaData(d('2026-03-04'), semanas)).toBeCloseTo(2 * DIA)
    expect(xDaData(d('2026-03-09'), semanas)).toBeCloseTo(LARGURA_SEMANA_PX)
  })
})

describe('barraEmPx', () => {
  it('o término ocupa o dia inteiro (intervalo fechado)', () => {
    // Segunda a sexta = 5 dias.
    const b = barraEmPx(d('2026-03-02'), d('2026-03-06'), semanas)!
    expect(b.esquerda).toBe(0)
    expect(b.largura).toBeCloseTo(5 * DIA)
  })
  it('uma ação de um dia ainda é visível', () => {
    const b = barraEmPx(d('2026-03-10'), d('2026-03-10'), semanas)!
    expect(b.largura).toBeGreaterThanOrEqual(LARGURA_MINIMA_PX)
  })
  it('com uma ponta só, a barra tem a largura de uma semana a partir dela', () => {
    expect(barraEmPx(d('2026-03-10'), null, semanas)!.largura).toBeCloseTo(LARGURA_SEMANA_PX)
    expect(barraEmPx(null, d('2026-03-10'), semanas)!.esquerda).toBeCloseTo(xDaData(d('2026-03-10'), semanas))
  })
  it('recorta à janela e some quando cai inteira fora', () => {
    const b = barraEmPx(d('2026-02-16'), d('2026-03-06'), semanas)!
    expect(b.esquerda).toBe(0)
    expect(b.largura).toBeCloseTo(5 * DIA)
    const direita = barraEmPx(d('2026-03-20'), d('2026-04-30'), semanas)!
    expect(direita.esquerda + direita.largura).toBeCloseTo(larguraDaGrade(semanas))
    expect(barraEmPx(d('2026-01-05'), d('2026-01-30'), semanas)).toBeNull()
    expect(barraEmPx(d('2026-05-04'), d('2026-05-08'), semanas)).toBeNull()
    expect(barraEmPx(null, null, semanas)).toBeNull()
  })
})

describe('hoje e marcas', () => {
  it('"hoje" cai no meio do dia, e some fora da janela', () => {
    expect(xDeHoje(d('2026-03-04'), semanas)).toBeCloseTo(2.5 * DIA)
    expect(xDeHoje(d('2026-02-01'), semanas)).toBeNull()
    expect(xDeHoje(d('2026-06-01'), semanas)).toBeNull()
  })
  it('a marca de uma data usa a mesma régua', () => {
    expect(xDeMarca(d('2026-03-04'), semanas)).toBe(xDeHoje(d('2026-03-04'), semanas))
    expect(xDeMarca(d('2026-12-01'), semanas)).toBeNull()
  })
})

describe('montarSetas', () => {
  const A = barraEmPx(d('2026-03-02'), d('2026-03-06'), semanas) // 0 .. 5 dias
  const B = barraEmPx(d('2026-03-16'), d('2026-03-20'), semanas) // começa bem depois
  const C = barraEmPx(d('2026-03-04'), d('2026-03-10'), semanas) // começa ANTES de A terminar

  it('sai do fim da predecessora e chega ao início da dependente, com a ponta no destino', () => {
    const [s] = montarSetas([{ de: 'a', para: 'b', bloqueada: false }], [{ id: 'a', previsto: A }, { id: 'b', previsto: B }])
    const x1 = A!.esquerda + A!.largura
    const y1 = ALTURA_LINHA_PX / 2
    expect(s.d.startsWith(`M ${x1} ${y1}`)).toBe(true)
    expect(s.x2).toBe(B!.esquerda)
    expect(s.y2).toBe(ALTURA_LINHA_PX + ALTURA_LINHA_PX / 2)
    expect(s.d.endsWith(`H ${B!.esquerda}`)).toBe(true)
    expect(s.bloqueada).toBe(false)
  })

  it('quando a dependente começa antes do fim da predecessora, contorna pela fronteira das linhas', () => {
    const [s] = montarSetas([{ de: 'a', para: 'c', bloqueada: true }], [{ id: 'a', previsto: A }, { id: 'c', previsto: C }])
    expect(s.d).toContain(`V ${ALTURA_LINHA_PX}`) // a fronteira entre as linhas 0 e 1
    expect(s.bloqueada).toBe(true)
  })

  it('a ordem das linhas manda: dependente acima da predecessora sobe', () => {
    const [s] = montarSetas([{ de: 'b', para: 'a', bloqueada: false }], [{ id: 'a', previsto: A }, { id: 'b', previsto: B }])
    expect(s.y2).toBe(ALTURA_LINHA_PX / 2)
  })

  it('ignora vínculo cuja ponta não está visível (outra página, fora da janela, sem datas)', () => {
    expect(montarSetas([{ de: 'a', para: 'z', bloqueada: false }], [{ id: 'a', previsto: A }])).toEqual([])
    expect(montarSetas([{ de: 'a', para: 'b', bloqueada: false }], [{ id: 'a', previsto: A }, { id: 'b', previsto: null }])).toEqual([])
  })
})
