import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import type { AcaoParaResumo } from './resumo-semanal'
import {
  ITENS_POR_TELA,
  agruparReplanejadas,
  descreverMudanca,
  filtrarPorEquipe,
  lerEquipe,
  montarTelas,
  type RegistroDeData,
} from './reuniao'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const hoje = d('2026-11-16')

const acao = (over: Partial<AcaoParaResumo>): AcaoParaResumo => ({
  id: 'a',
  projetoId: 'p',
  projetoNome: 'Rede',
  equipe: 'STI',
  numero: 1,
  descricao: 'Ação',
  responsavel: 'Ana',
  status: StatusAcao.EM_CURSO_50,
  previstoTermino: null,
  realizadoTermino: null,
  ...over,
})

const registro = (over: Partial<RegistroDeData>): RegistroDeData => ({
  acaoId: 'a',
  projetoId: 'p',
  projetoNome: 'Rede',
  equipe: 'STI',
  numero: 1,
  descricao: 'Ação',
  responsavel: 'Ana',
  campo: 'previstoTermino',
  valorAntigo: '2026-11-10',
  valorNovo: '2026-11-24',
  alteradoEm: new Date('2026-11-12T12:00:00Z'),
  alteradoPor: 'Bia',
  ...over,
})

describe('agruparReplanejadas', () => {
  it('uma linha por ação, com a primeira data de antes, a última de depois e o total', () => {
    const r = agruparReplanejadas([
      registro({ valorAntigo: '2026-11-10', valorNovo: '2026-11-17', alteradoEm: new Date('2026-11-11T10:00:00Z'), alteradoPor: 'Ana' }),
      registro({ valorAntigo: '2026-11-17', valorNovo: '2026-11-24', alteradoEm: new Date('2026-11-13T10:00:00Z'), alteradoPor: 'Bia' }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ de: '2026-11-10', para: '2026-11-24', mudancas: 2, por: 'Bia', campo: 'previstoTermino' })
    expect(descreverMudanca(r[0])).toBe('10/11 → 24/11')
  })

  it('mostra o início só quando o término não mudou, e ignora outros campos', () => {
    const r = agruparReplanejadas([
      registro({ campo: 'previstoInicio', valorAntigo: '2026-11-02', valorNovo: '2026-11-09' }),
      registro({ acaoId: 'b', campo: 'status', valorAntigo: 'A', valorNovo: 'B' }),
    ])
    expect(r.map((x) => [x.acaoId, x.campo])).toEqual([['a', 'previstoInicio']])
  })

  it('ida e volta à data original não é replanejamento', () => {
    expect(
      agruparReplanejadas([
        registro({ valorAntigo: '2026-11-10', valorNovo: '2026-11-17', alteradoEm: new Date('2026-11-11T10:00:00Z') }),
        registro({ valorAntigo: '2026-11-17', valorNovo: '2026-11-10', alteradoEm: new Date('2026-11-12T10:00:00Z') }),
      ]),
    ).toEqual([])
  })

  it('as mais mexidas vêm primeiro e data nula vira "sem data"', () => {
    const r = agruparReplanejadas([
      registro({ acaoId: 'x', valorAntigo: null, valorNovo: '2026-11-20' }),
      registro({ acaoId: 'y', valorAntigo: '2026-11-01', valorNovo: '2026-11-05', alteradoEm: new Date('2026-11-10T10:00:00Z') }),
      registro({ acaoId: 'y', valorAntigo: '2026-11-05', valorNovo: '2026-11-09', alteradoEm: new Date('2026-11-11T10:00:00Z') }),
    ])
    expect(r.map((x) => x.acaoId)).toEqual(['y', 'x'])
    expect(descreverMudanca(r[1])).toBe('sem data → 20/11')
  })
})

describe('montarTelas', () => {
  it('começa pelo panorama e segue a ordem atrasadas, vencem, replanejadas, concluídas', () => {
    const telas = montarTelas({ acoes: [], replanejadas: [], projetosAtivos: 3, hoje })
    expect(telas.map((t) => t.id)).toEqual(['panorama', 'atrasadas-1', 'vencendo-1', 'replanejadas-1', 'riscos-1', 'concluidas-1'])
    const p = telas[0]
    expect(p.tipo === 'panorama' && p.panorama).toMatchObject({ projetosAtivos: 3, riscosAbertos: 0, atrasadas: 0 })
  })

  it('classifica como o resumo semanal e ordena cada lista', () => {
    const telas = montarTelas({
      acoes: [
        acao({ id: 'novo', previstoTermino: d('2026-11-10') }),
        acao({ id: 'velho', previstoTermino: d('2026-11-01') }),
        acao({ id: 'v2', previstoTermino: d('2026-11-22') }),
        acao({ id: 'v1', previstoTermino: d('2026-11-18') }),
        acao({ id: 'c-velha', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-10') }),
        acao({ id: 'c-nova', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-14') }),
        acao({ id: 'longe', previstoTermino: d('2027-01-01') }),
      ],
      replanejadas: [],
      projetosAtivos: 1,
      hoje,
    })
    const ids = (id: string) => {
      const t = telas.find((x) => x.id === id)
      return t && t.tipo !== 'panorama' ? (t.itens as { acaoId: string }[]).map((i) => i.acaoId) : null
    }
    expect(ids('atrasadas-1')).toEqual(['velho', 'novo'])
    expect(ids('vencendo-1')).toEqual(['v1', 'v2'])
    expect(ids('concluidas-1')).toEqual(['c-nova', 'c-velha'])
    const atrasada = telas.find((t) => t.id === 'atrasadas-1')
    expect(atrasada && atrasada.tipo === 'atrasadas' && atrasada.itens[0].diasAtraso).toBe(15)
  })

  it('lista longa vira várias telas, sem perder item, e mantém o total', () => {
    const muitas = Array.from({ length: ITENS_POR_TELA * 2 + 1 }, (_, i) =>
      acao({ id: `a${i}`, numero: i + 1, previstoTermino: new Date(d('2026-11-01').getTime() + i * 86_400_000) }),
    )
    const telas = montarTelas({ acoes: muitas, replanejadas: [], projetosAtivos: 1, hoje })
    const atrasadas = telas.filter((t) => t.tipo === 'atrasadas')
    expect(atrasadas.map((t) => t.id)).toEqual(['atrasadas-1', 'atrasadas-2', 'atrasadas-3'])
    expect(atrasadas.every((t) => t.tipo === 'atrasadas' && t.paginas === 3 && t.total === 13)).toBe(true)
    expect(atrasadas.flatMap((t) => (t.tipo === 'atrasadas' ? t.itens : []))).toHaveLength(13)
  })

  it('o panorama conta o que as telas mostram', () => {
    const telas = montarTelas({
      acoes: [acao({ id: '1', previstoTermino: d('2026-11-01') }), acao({ id: '2', previstoTermino: d('2026-11-17') })],
      replanejadas: agruparReplanejadas([registro({})]),
      projetosAtivos: 2,
      hoje,
    })
    const p = telas[0]
    expect(p.tipo === 'panorama' && p.panorama).toEqual({ projetosAtivos: 2, riscosAbertos: 0, atrasadas: 1, vencendo: 1, concluidas: 0, replanejadas: 1 })
  })
})

describe('riscos na reunião', () => {
  const risco = (over: Record<string, unknown>) => ({
    id: 'r',
    projetoId: 'p',
    projetoNome: 'Rede',
    equipe: 'STI',
    tipo: 'RISCO',
    titulo: 'Risco',
    impacto: 'MEDIO',
    status: 'ABERTO',
    responsavel: null,
    acaoNumero: null,
    prazo: null as Date | null,
    criadoEm: new Date('2026-11-01T00:00:00Z'),
    ...over,
  })

  it('entra uma tela de riscos, ordenada por atenção, com o prazo vencido marcado', () => {
    const telas = montarTelas({
      acoes: [],
      replanejadas: [],
      riscos: [
        risco({ id: 'baixo', impacto: 'BAIXO' }),
        risco({ id: 'alto-risco', impacto: 'ALTO' }),
        risco({ id: 'alto-bloq', impacto: 'ALTO', tipo: 'BLOQUEIO', prazo: d('2026-11-10') }),
      ],
      projetosAtivos: 1,
      hoje,
    })
    const t = telas.find((x) => x.id === 'riscos-1')!
    expect(t.tipo === 'riscos' && t.itens.map((i) => i.id)).toEqual(['alto-bloq', 'alto-risco', 'baixo'])
    expect(t.tipo === 'riscos' && t.itens[0]).toMatchObject({ prazo: '2026-11-10', vencido: true })
    expect(telas[0].tipo === 'panorama' && telas[0].panorama.riscosAbertos).toBe(3)
  })

  it('sem riscos a tela continua na sequência, vazia', () => {
    const t = montarTelas({ acoes: [], replanejadas: [], projetosAtivos: 0, hoje }).find((x) => x.id === 'riscos-1')!
    expect(t.tipo === 'riscos' && t.total).toBe(0)
  })
})

describe('equipe', () => {
  it('filtra por equipe e "Sem equipe" pega as sem preenchimento', () => {
    const itens = [{ equipe: 'STI' }, { equipe: null }, { equipe: ' ' }, { equipe: 'GIA' }]
    expect(filtrarPorEquipe(itens, null)).toHaveLength(4)
    expect(filtrarPorEquipe(itens, 'STI')).toHaveLength(1)
    expect(filtrarPorEquipe(itens, 'Sem equipe')).toHaveLength(2)
  })
  it('lerEquipe só aceita equipe conhecida', () => {
    expect(lerEquipe('STI', ['STI', 'GIA'])).toBe('STI')
    expect(lerEquipe(['GIA'], ['STI', 'GIA'])).toBe('GIA')
    expect(lerEquipe('XYZ', ['STI'])).toBeNull()
    expect(lerEquipe(undefined, ['STI'])).toBeNull()
  })
})
