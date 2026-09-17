import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import { dadosSeed, emDias } from './seed-dados'

const hoje = new Date(Date.UTC(2026, 8, 17)) // 17/09/2026, referência fixa do teste
const projetos = dadosSeed(hoje)

describe('dados do seed', () => {
  it('produz 3 projetos com 5 ações cada', () => {
    expect(projetos).toHaveLength(3)
    for (const p of projetos) {
      expect(p.acoes).toHaveLength(5)
    }
  })

  it('numera as ações sequencialmente a partir de 1 dentro de cada projeto', () => {
    for (const p of projetos) {
      expect(p.acoes.map((a) => a.numero)).toEqual([1, 2, 3, 4, 5])
    }
  })

  it('usa referências de projeto distintas (chave de idempotência do seed)', () => {
    const refs = projetos.map((p) => p.referencia)
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('mantém previstoInicio <= previstoTermino em todas as ações', () => {
    for (const p of projetos) {
      for (const a of p.acoes) {
        expect(a.previstoInicio.getTime()).toBeLessThanOrEqual(a.previstoTermino.getTime())
      }
    }
  })

  it('gera datas Previsto tanto no passado quanto no futuro', () => {
    const todas = projetos.flatMap((p) => p.acoes)
    expect(todas.some((a) => a.previstoTermino < hoje)).toBe(true)
    expect(todas.some((a) => a.previstoInicio > hoje)).toBe(true)
  })

  it('inclui ações em atraso (previsto vencido, sem realizadoTermino, não concluídas)', () => {
    const atrasadas = projetos.flatMap((p) =>
      p.acoes.filter(
        (a) =>
          a.previstoTermino < hoje &&
          a.realizadoTermino === null &&
          a.status !== StatusAcao.CONCLUIDO,
      ),
    )
    expect(atrasadas.length).toBeGreaterThanOrEqual(2)
  })

  it('só marca realizadoTermino em ações concluídas', () => {
    for (const p of projetos) {
      for (const a of p.acoes) {
        if (a.realizadoTermino !== null) {
          expect(a.status).toBe(StatusAcao.CONCLUIDO)
        }
      }
    }
  })

  it('emDias desloca a data normalizando para meia-noite UTC', () => {
    const base = new Date('2026-09-17T18:42:31.500Z')
    expect(emDias(base, 0).toISOString()).toBe('2026-09-17T00:00:00.000Z')
    expect(emDias(base, 5).toISOString()).toBe('2026-09-22T00:00:00.000Z')
    expect(emDias(base, -20).toISOString()).toBe('2026-08-28T00:00:00.000Z')
  })
})
