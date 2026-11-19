import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import { agruparAtrasos, montarAvisoAtrasos, type AcaoParaAviso } from './email-atrasos'

const HOJE = new Date('2026-11-16T00:00:00Z')
const ana = { id: 'c1', nome: 'Ana Souza', email: 'ana@ctcea.org.br' }

function acao(extra: Partial<AcaoParaAviso> & { id: string }): AcaoParaAviso {
  return {
    projetoId: 'p1',
    numero: 1,
    descricao: 'Levantar requisitos',
    status: StatusAcao.EM_CURSO_50,
    previstoTermino: new Date('2026-11-10T00:00:00Z'),
    realizadoTermino: null,
    projeto: { nome: 'Portal', referencia: 'PLA-1' },
    responsavel: ana,
    ...extra,
  }
}

describe('agruparAtrasos', () => {
  it('agrupa por pessoa, com o mais atrasado primeiro e os dias contados', () => {
    const grupos = agruparAtrasos(
      [
        acao({ id: 'a', previstoTermino: new Date('2026-11-14T00:00:00Z') }),
        acao({ id: 'b', numero: 2, previstoTermino: new Date('2026-11-01T00:00:00Z') }),
      ],
      HOJE,
    )
    expect(grupos).toHaveLength(1)
    expect(grupos[0].itens.map((i) => [i.acaoId, i.diasDeAtraso])).toEqual([
      ['b', 15],
      ['a', 2],
    ])
  })

  it('ignora concluída, com realizado, no prazo, sem prazo, sem responsável e sem e-mail', () => {
    const grupos = agruparAtrasos(
      [
        acao({ id: 'concluida', status: StatusAcao.CONCLUIDO }),
        acao({ id: 'realizada', realizadoTermino: new Date('2026-11-12T00:00:00Z') }),
        acao({ id: 'hoje', previstoTermino: HOJE }),
        acao({ id: 'semPrazo', previstoTermino: null }),
        acao({ id: 'semDono', responsavel: null }),
        acao({ id: 'semEmail', responsavel: { id: 'c2', nome: 'Bia', email: null } }),
      ],
      HOJE,
    )
    expect(grupos).toEqual([])
  })

  it('separa pessoas e ordena por nome', () => {
    const grupos = agruparAtrasos(
      [
        acao({ id: 'a', responsavel: { id: 'c3', nome: 'Zeca', email: 'z@x.br' } }),
        acao({ id: 'b' }),
      ],
      HOJE,
    )
    expect(grupos.map((g) => g.nome)).toEqual(['Ana Souza', 'Zeca'])
  })
})

describe('montarAvisoAtrasos', () => {
  const grupo = agruparAtrasos([acao({ id: 'a', descricao: 'Revisar <b>' })], HOJE)[0]

  it('usa o singular, cita prazo e dias, e linka a ação', () => {
    const m = montarAvisoAtrasos(grupo, 'https://app.ctcea.org.br')
    expect(m.assunto).toBe('Você tem 1 ação atrasada — Cronograma CTCEA')
    expect(m.texto).toContain('PLA-1 — Portal · Ação 1: Revisar <b> — prazo 10/11/2026, 6 dias de atraso')
    expect(m.texto).toContain('https://app.ctcea.org.br/projetos/p1/acoes/a/editar')
  })

  it('escapa o texto do usuário no HTML', () => {
    const m = montarAvisoAtrasos(grupo, null)
    expect(m.html).toContain('Revisar &lt;b&gt;')
    expect(m.html).not.toContain('<b>')
    expect(m.texto).not.toContain('http')
  })

  it('usa o plural com mais de uma ação', () => {
    const dois = agruparAtrasos([acao({ id: 'a' }), acao({ id: 'b', numero: 2 })], HOJE)[0]
    expect(montarAvisoAtrasos(dois, null).assunto).toBe(
      'Você tem 2 ações atrasadas — Cronograma CTCEA',
    )
  })
})
