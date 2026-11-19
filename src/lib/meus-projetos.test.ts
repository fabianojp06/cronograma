import { describe, expect, it } from 'vitest'

import {
  campoCitaPessoa,
  filtrarMeusProjetos,
  lerFiltroMeusProjetos,
  montarMeusProjetos,
  pessoasDoCampo,
  type ProjetoParaMeusProjetos,
} from './meus-projetos'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const hoje = d('2026-03-20')
const ana = { id: 'ana', nome: 'Ana Souza' }

describe('pessoasDoCampo', () => {
  it('separa por vírgula, ponto e vírgula, barra, & e " e "', () => {
    expect(pessoasDoCampo('Ana, Bruno; Carla / Dani & Eva e Fábio')).toEqual([
      'Ana', 'Bruno', 'Carla', 'Dani', 'Eva', 'Fábio',
    ])
  })
  it('vazio e nulo dão lista vazia; "e" dentro de palavra não separa', () => {
    expect(pessoasDoCampo(null)).toEqual([])
    expect(pessoasDoCampo('  ')).toEqual([])
    expect(pessoasDoCampo('Eduardo Pereira')).toEqual(['Eduardo Pereira'])
  })
})

describe('campoCitaPessoa', () => {
  it('ignora acento, caixa e espaço repetido', () => {
    expect(campoCitaPessoa('ANA  SOUZA', 'Ana Souza')).toBe(true)
    expect(campoCitaPessoa('Fabiano José', 'Fabiano Jose')).toBe(true)
  })
  it('acha a pessoa numa lista', () => {
    expect(campoCitaPessoa('Bruno, Ana Souza e Carla', 'Ana Souza')).toBe(true)
  })
  it('nome parcial não casa (homônimos parciais)', () => {
    expect(campoCitaPessoa('Ana Silva', 'Ana Silva Costa')).toBe(false)
    expect(campoCitaPessoa('Ana', 'Ana Souza')).toBe(false)
    expect(campoCitaPessoa(null, 'Ana Souza')).toBe(false)
  })
  it('nome com separador dentro casa pelo campo inteiro', () => {
    expect(campoCitaPessoa('Silva e Souza', 'Silva e Souza')).toBe(true)
  })
})

const acao = (extra: object = {}) => ({
  status: 'EM_CURSO_25' as const,
  previstoInicio: d('2026-03-01'),
  previstoTermino: d('2026-04-01'),
  realizadoTermino: null,
  responsavelId: null as string | null,
  ...extra,
})

function projeto(id: string, nome: string, extra: Partial<ProjetoParaMeusProjetos> = {}): ProjetoParaMeusProjetos {
  return { id, referencia: null, nome, equipe: null, responsavel: null, apoio: null, acoes: [], ...extra }
}

describe('montarMeusProjetos', () => {
  it('lista por qualquer um dos três vínculos e diz qual', () => {
    const itens = montarMeusProjetos(
      [
        projeto('p1', 'P1', { responsavel: 'ana souza' }),
        projeto('p2', 'P2', { acoes: [acao({ responsavelId: 'ana' }), acao()] }),
        projeto('p3', 'P3', { apoio: 'Bruno e Ana Souza' }),
        projeto('p4', 'P4', { responsavel: 'Bruno', apoio: 'Carla', acoes: [acao({ responsavelId: 'bruno' })] }),
      ],
      ana,
      hoje,
    )
    expect(itens.map((i) => [i.id, i.vinculos])).toEqual([
      ['p1', ['RESPONSAVEL_PROJETO']],
      ['p2', ['RESPONSAVEL_ACOES']],
      ['p3', ['APOIO']],
    ])
    expect(itens.find((i) => i.id === 'p2')?.minhasAcoes).toBe(1)
  })

  it('combina vínculos no mesmo projeto', () => {
    const [item] = montarMeusProjetos(
      [projeto('p', 'P', { responsavel: 'Ana Souza', apoio: 'Ana Souza', acoes: [acao({ responsavelId: 'ana' })] })],
      ana,
      hoje,
    )
    expect(item.vinculos).toEqual(['RESPONSAVEL_PROJETO', 'RESPONSAVEL_ACOES', 'APOIO'])
  })

  it('conta só as minhas ações atrasadas, com a regra do painel', () => {
    const atrasada = acao({ responsavelId: 'ana', previstoTermino: d('2026-03-10') })
    const concluida = acao({ responsavelId: 'ana', status: 'CONCLUIDO', previstoTermino: d('2026-03-10') })
    const alheia = acao({ responsavelId: 'bruno', previstoTermino: d('2026-03-10') })
    const [item] = montarMeusProjetos([projeto('p', 'P', { acoes: [atrasada, concluida, alheia] })], ana, hoje)
    expect(item.minhasAcoes).toBe(2)
    expect(item.minhasAtrasadas).toBe(1)
    expect(item.resumo.acoesAtrasadas).toBe(2) // o resumo é do projeto inteiro
  })

  it('ordena: meus atrasos, depois projeto atrasado, depois por nome', () => {
    const atrasada = (resp: string | null) => acao({ responsavelId: resp, previstoTermino: d('2026-03-10') })
    const itens = montarMeusProjetos(
      [
        projeto('c', 'C calmo', { responsavel: 'Ana Souza', acoes: [acao()] }),
        projeto('b', 'B projeto atrasado', { responsavel: 'Ana Souza', acoes: [atrasada('bruno')] }),
        projeto('a', 'A meu atraso', { responsavel: 'Ana Souza', acoes: [atrasada('ana')] }),
        projeto('d', 'A outro calmo', { responsavel: 'Ana Souza', acoes: [acao()] }),
      ],
      ana,
      hoje,
    )
    expect(itens.map((i) => i.id)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('projeto sem nenhum vínculo não aparece', () => {
    expect(montarMeusProjetos([projeto('x', 'X', { responsavel: 'Bruno' })], ana, hoje)).toEqual([])
  })
})

describe('filtros', () => {
  const itens = montarMeusProjetos(
    [
      projeto('r', 'R', { responsavel: 'Ana Souza' }),
      projeto('a', 'A', { apoio: 'Ana Souza' }),
      projeto('m', 'M', { responsavel: 'Ana Souza', apoio: 'Ana Souza' }),
    ],
    ana,
    hoje,
  )
  it('"respondo" tira quem é só apoio; "apoio" pega quem tem o vínculo', () => {
    expect(filtrarMeusProjetos(itens, 'respondo').map((i) => i.id).sort()).toEqual(['m', 'r'])
    expect(filtrarMeusProjetos(itens, 'apoio').map((i) => i.id).sort()).toEqual(['a', 'm'])
    expect(filtrarMeusProjetos(itens, 'todos')).toHaveLength(3)
  })
  it('filtro inválido vira "todos"', () => {
    expect(lerFiltroMeusProjetos('xyz')).toBe('todos')
    expect(lerFiltroMeusProjetos(['apoio', 'x'])).toBe('apoio')
    expect(lerFiltroMeusProjetos(undefined)).toBe('todos')
  })
})
