import { describe, expect, it } from 'vitest'

import { gravarLote, type ClienteLote, type ItemParaGravar } from './acao-lote'
import { planejarLote } from './edicao-lote'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const versao = new Date('2026-03-01T10:00:00Z')

function item(id: string): ItemParaGravar {
  const [plano] = planejarLote(
    [{ id, numero: 1, descricao: 'x', status: 'EM_CURSO_25', previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-06'), responsavelId: null, responsavelNome: null, versao }],
    { deslocamento: 1, responsavelId: undefined },
    null,
  )
  return { ...plano, atual: { previstoInicio: d('2026-03-02'), previstoTermino: d('2026-03-06') } }
}

function falso(conflitaCom: string[] = []) {
  const chamadas = { updates: [] as string[], historico: [] as { acaoId: string; campo: string }[] }
  const cliente: ClienteLote = {
    async $transaction(fn) {
      return fn({
        acao: {
          async updateMany({ where }) {
            chamadas.updates.push(where.id)
            return { count: conflitaCom.includes(where.id) ? 0 : 1 }
          },
        },
        historicoAlteracao: {
          async createMany({ data }) {
            chamadas.historico.push(...data.map((l) => ({ acaoId: l.acaoId, campo: l.campo })))
          },
        },
      })
    },
  }
  return { cliente, chamadas }
}

describe('gravarLote', () => {
  it('grava as ações e uma linha de histórico por campo alterado, por ação', async () => {
    const { cliente, chamadas } = falso()
    const r = await gravarLote(cliente, [item('a'), item('b')], 'user_1')
    expect(r).toEqual({ gravadas: ['a', 'b'], conflitos: [] })
    expect(chamadas.historico).toEqual([
      { acaoId: 'a', campo: 'previstoInicio' },
      { acaoId: 'a', campo: 'previstoTermino' },
      { acaoId: 'b', campo: 'previstoInicio' },
      { acaoId: 'b', campo: 'previstoTermino' },
    ])
  })
  it('a ação alterada por outra pessoa é pulada, sem histórico, e as demais gravam', async () => {
    const { cliente, chamadas } = falso(['a'])
    const r = await gravarLote(cliente, [item('a'), item('b')], 'user_1')
    expect(r).toEqual({ gravadas: ['b'], conflitos: ['a'] })
    expect(chamadas.historico.every((l) => l.acaoId === 'b')).toBe(true)
  })
  it('item sem mudança nem toca o banco', async () => {
    const { cliente, chamadas } = falso()
    const vazio = { ...item('a'), mudancas: [] }
    const r = await gravarLote(cliente, [vazio], null)
    expect(r).toEqual({ gravadas: [], conflitos: [] })
    expect(chamadas.updates).toEqual([])
  })
})
