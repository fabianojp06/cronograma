import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import { classificarMinhasAcoes, type AcaoDaPessoa } from './minhas-acoes'

const HOJE = new Date('2026-11-16T00:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)

function acao(id: string, extra: Partial<AcaoDaPessoa> = {}): AcaoDaPessoa {
  return {
    id,
    projetoId: 'p',
    numero: 1,
    descricao: id,
    status: StatusAcao.EM_CURSO_50,
    previstoInicio: null,
    previstoTermino: d('2026-12-01'),
    realizadoTermino: null,
    projeto: { nome: 'Portal', referencia: null },
    ...extra,
  }
}

describe('classificarMinhasAcoes', () => {
  it('põe cada ação em um só grupo', () => {
    const g = classificarMinhasAcoes(
      [
        acao('atrasada', { previstoTermino: d('2026-11-10') }),
        acao('aberta'),
        acao('feita', { status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-11-01') }),
        acao('realizada', { realizadoTermino: d('2026-11-02'), previstoTermino: d('2026-11-01') }),
        acao('semPrazo', { previstoTermino: null }),
      ],
      HOJE,
    )
    expect(g.atrasadas.map((a) => a.id)).toEqual(['atrasada'])
    expect(g.atrasadas[0].diasDeAtraso).toBe(6)
    expect(g.emAberto.map((a) => a.id)).toEqual(['aberta', 'semPrazo'])
    expect(g.concluidas.map((a) => a.id).sort()).toEqual(['feita', 'realizada'])
  })

  it('o prazo de hoje ainda não é atraso', () => {
    const g = classificarMinhasAcoes([acao('hoje', { previstoTermino: HOJE })], HOJE)
    expect(g.atrasadas).toEqual([])
    expect(g.emAberto).toHaveLength(1)
  })

  it('ordena atrasadas da mais antiga e concluídas da mais recente', () => {
    const g = classificarMinhasAcoes(
      [
        acao('a2', { previstoTermino: d('2026-11-12') }),
        acao('a1', { previstoTermino: d('2026-10-01') }),
        acao('c1', { status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-09-01') }),
        acao('c2', { status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-10-01') }),
      ],
      HOJE,
    )
    expect(g.atrasadas.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(g.concluidas.map((a) => a.id)).toEqual(['c2', 'c1'])
  })
})
