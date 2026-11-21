import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import type { AcaoComPrazo } from './dashboard-prazos'
import {
  FAIXAS_DE_ATRASO,
  LIMITE_AMARELO,
  LIMITE_VERMELHO,
  ORDEM_STATUS_MAPA,
  corDoSemaforo,
  domingoDaSemana,
  eventosRecentesPorEquipe,
  idadeDoAtraso,
  mapaDeCalorEquipeStatus,
  motivosPorEquipe,
  prioridadeXAtraso,
  riscosPorEquipe,
  ritmoDeEntrega,
  semaforoPorEquipe,
  type RiscoParaGestao,
} from './dashboard-gestao'
import { ROTULO_STATUS_AGREGADO } from './projeto-resumo'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const hoje = d('2026-11-16')

const acao = (over: Partial<AcaoComPrazo>): AcaoComPrazo => ({
  id: 'a',
  numero: 1,
  descricao: 'A',
  status: StatusAcao.EM_CURSO_50,
  previstoInicio: null,
  previstoTermino: null,
  realizadoInicio: null,
  realizadoTermino: null,
  projetoId: 'p',
  projetoNome: 'P',
  equipe: 'STI',
  responsavel: null,
  ...over,
})
const risco = (over: Partial<RiscoParaGestao>): RiscoParaGestao => ({
  projetoId: 'p',
  equipe: 'STI',
  impacto: 'MEDIO',
  tipo: 'RISCO',
  prazo: null,
  ...over,
})

describe('corDoSemaforo', () => {
  const base = { abertas: 10, riscosAbertos: 0, proporcaoAtraso: 0, riscosAltosVencidos: 0, riscosAltosAbertos: 0 }
  it('verde abaixo de 5%, amarelo de 5% a 20%, vermelho acima de 20%', () => {
    expect(corDoSemaforo({ ...base, proporcaoAtraso: 0.049 })).toBe('VERDE')
    expect(corDoSemaforo({ ...base, proporcaoAtraso: LIMITE_AMARELO })).toBe('AMARELO')
    expect(corDoSemaforo({ ...base, proporcaoAtraso: LIMITE_VERMELHO })).toBe('AMARELO')
    expect(corDoSemaforo({ ...base, proporcaoAtraso: 0.2001 })).toBe('VERMELHO')
  })
  it('risco alto vencido é vermelho; risco alto aberto é amarelo, mesmo sem atraso', () => {
    expect(corDoSemaforo({ ...base, riscosAbertos: 1, riscosAltosAbertos: 1 })).toBe('AMARELO')
    expect(corDoSemaforo({ ...base, riscosAbertos: 1, riscosAltosAbertos: 1, riscosAltosVencidos: 1 })).toBe('VERMELHO')
  })
  it('sem ação aberta nem risco não há o que medir', () => {
    expect(corDoSemaforo({ ...base, abertas: 0 })).toBe('SEM_DADOS')
  })
})

describe('semaforoPorEquipe', () => {
  it('mede o atraso sobre as ações ABERTAS e explica a cor', () => {
    const acoes = [
      acao({ id: '1', previstoTermino: d('2026-11-01') }), // atrasada
      acao({ id: '2', previstoTermino: d('2026-12-01') }),
      acao({ id: '3', previstoTermino: d('2026-12-01') }),
      acao({ id: '4', previstoTermino: d('2026-12-01') }),
      acao({ id: '5', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-02'), previstoTermino: d('2026-11-01') }),
    ]
    const [c] = semaforoPorEquipe({ acoes, riscos: [], replanejamentos: [], hoje })
    expect(c).toMatchObject({ equipe: 'STI', abertas: 4, atrasadas: 1, cor: 'VERMELHO', aderenciaPercentual: 0 })
    expect(c.motivos[0]).toContain('25%')
  })

  it('cruza riscos: risco alto vencido derruba a cor mesmo sem ação atrasada', () => {
    const [c] = semaforoPorEquipe({
      acoes: [acao({ previstoTermino: d('2026-12-01') })],
      riscos: [risco({ impacto: 'ALTO', prazo: d('2026-11-10') })],
      replanejamentos: [],
      hoje,
    })
    expect(c.cor).toBe('VERMELHO')
    expect(c.riscosAltosVencidos).toBe(1)
    expect(c.motivos.join(' ')).toContain('prazo vencido')
  })

  it('conta replanejamentos da equipe, "Sem equipe" e ordena do pior para o melhor', () => {
    const r = semaforoPorEquipe({
      acoes: [
        acao({ id: 'v', equipe: 'GIA', previstoTermino: d('2026-12-01') }),
        acao({ id: 'x', equipe: null, previstoTermino: d('2026-11-01') }),
        acao({ id: 'y', equipe: 'STI', previstoTermino: d('2026-12-01') }),
      ],
      riscos: [],
      replanejamentos: [{ equipe: 'GIA' }, { equipe: 'GIA' }, { equipe: null }],
      hoje,
    })
    expect(r.map((c) => [c.equipe, c.cor])).toEqual([['Sem equipe', 'VERMELHO'], ['GIA', 'VERDE'], ['STI', 'VERDE']])
    expect(r.find((c) => c.equipe === 'GIA')!.replanejamentos).toBe(2)
    expect(r.find((c) => c.equipe === 'Sem equipe')!.replanejamentos).toBe(1)
  })

  it('equipe só com ações concluídas é "sem ações abertas"', () => {
    const [c] = semaforoPorEquipe({
      acoes: [acao({ status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-02') })],
      riscos: [],
      replanejamentos: [],
      hoje,
    })
    expect(c.cor).toBe('SEM_DADOS')
  })
})

describe('mapaDeCalorEquipeStatus', () => {
  it('cruza equipe e status na ordem fixa, com totais e máximo', () => {
    const m = mapaDeCalorEquipeStatus(
      [
        { equipe: 'STI', resumo: { status: 'ATRASADO' } },
        { equipe: 'STI', resumo: { status: 'ATRASADO' } },
        { equipe: 'STI', resumo: { status: 'CONCLUIDO' } },
        { equipe: 'GIA', resumo: { status: 'EM_ANDAMENTO' } },
        { equipe: null, resumo: { status: 'NAO_INICIADO' } },
      ],
      ROTULO_STATUS_AGREGADO,
    )
    expect(m.linhas).toEqual(['GIA', 'STI', 'Sem equipe'])
    expect(m.colunas.map((c) => c.id)).toEqual([...ORDEM_STATUS_MAPA])
    const sti = m.valores[1]
    expect(sti[ORDEM_STATUS_MAPA.indexOf('ATRASADO')]).toBe(2)
    expect(sti[ORDEM_STATUS_MAPA.indexOf('CONCLUIDO')]).toBe(1)
    expect(m.totaisDasLinhas).toEqual([1, 3, 1])
    expect(m.maximo).toBe(2)
  })
})

describe('idadeDoAtraso', () => {
  it('distribui as atrasadas nas faixas, por equipe, e ignora o que não está atrasado', () => {
    const r = idadeDoAtraso(
      [
        acao({ id: '1', previstoTermino: d('2026-11-15') }), // 1 dia
        acao({ id: '2', previstoTermino: d('2026-11-09') }), // 7 dias
        acao({ id: '3', previstoTermino: d('2026-11-08') }), // 8 dias
        acao({ id: '4', previstoTermino: d('2026-09-01') }), // 76 dias
        acao({ id: '5', previstoTermino: d('2026-01-01') }), // mais de 90
        acao({ id: '6', previstoTermino: d('2026-11-16') }), // hoje: não atrasada
        acao({ id: '7', status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-01-01') }),
        acao({ id: '8', equipe: 'GIA', previstoTermino: d('2026-11-01') }),
      ],
      hoje,
    )
    expect(r.map((l) => [l.equipe, l.total])).toEqual([['STI', 5], ['GIA', 1]])
    expect(r[0].faixas).toEqual([2, 1, 1, 1])
    expect(FAIXAS_DE_ATRASO).toHaveLength(r[0].faixas.length)
  })
})

describe('riscosPorEquipe', () => {
  it('agrupa por equipe e impacto, conta bloqueios e vencidos, mais críticos primeiro', () => {
    const r = riscosPorEquipe(
      [
        risco({ equipe: 'STI', impacto: 'BAIXO' }),
        risco({ equipe: 'GIA', impacto: 'ALTO', tipo: 'BLOQUEIO', prazo: d('2026-11-01') }),
        risco({ equipe: 'GIA', impacto: 'ALTO' }),
        risco({ equipe: 'STI', impacto: 'MEDIO', prazo: d('2026-12-01') }),
      ],
      hoje,
    )
    expect(r.map((l) => l.equipe)).toEqual(['GIA', 'STI'])
    expect(r[0]).toMatchObject({ total: 2, porImpacto: [2, 0, 0], bloqueios: 1, vencidos: 1 })
    expect(r[1]).toMatchObject({ total: 2, porImpacto: [0, 1, 1], vencidos: 0 })
  })
})

describe('prioridadeXAtraso', () => {
  const p = (id: string, benef: number, esf: number, acoes: AcaoComPrazo[]) => ({
    id,
    nome: id,
    equipe: 'STI',
    resultado: { beneficio: benef, esforco: esf },
    acoes,
  })
  it('marca como crítico o projeto de alto benefício com ação atrasada, e ignora o não avaliado', () => {
    const atrasada = [acao({ previstoTermino: d('2026-11-01') })]
    const r = prioridadeXAtraso(
      [
        p('quick', 6, 2, atrasada), // alto benefício, baixo esforço: quick win
        p('descartar', 1, 8, atrasada), // baixo benefício, alto esforço
        p('em-dia', 6, 2, [acao({ previstoTermino: d('2026-12-01') })]),
        { id: 'sem-nota', nome: 'sem-nota', equipe: null, resultado: null, acoes: atrasada },
      ],
      hoje,
    )
    expect(r.map((x) => x.projetoId)).toEqual(['quick', 'descartar', 'em-dia'])
    expect(r[0]).toMatchObject({ critico: true, quadrante: 'QUICK_WINS', atrasadas: 1 })
    expect(r[1].critico).toBe(false)
    expect(r[2]).toMatchObject({ critico: false, atrasadas: 0 })
  })
})

describe('ritmoDeEntrega', () => {
  // 2026-11-16 é segunda; o domingo da semana é 2026-11-15.
  it('domingoDaSemana', () => {
    expect(domingoDaSemana(d('2026-11-16')).toISOString().slice(0, 10)).toBe('2026-11-15')
    expect(domingoDaSemana(d('2026-11-15')).toISOString().slice(0, 10)).toBe('2026-11-15')
    expect(domingoDaSemana(d('2026-11-21')).toISOString().slice(0, 10)).toBe('2026-11-15')
  })
  it('12 semanas, a corrente por último, com concluídas, criadas e média móvel', () => {
    const r = ritmoDeEntrega(
      [d('2026-11-16'), d('2026-11-17'), d('2026-11-10'), d('2026-01-01')],
      [d('2026-11-16'), d('2026-11-03'), d('2026-11-04')],
      hoje,
    )
    expect(r).toHaveLength(12)
    expect(r[11]).toMatchObject({ inicio: '2026-11-15', concluidas: 2, criadas: 1 })
    expect(r[10]).toMatchObject({ inicio: '2026-11-08', concluidas: 1, criadas: 0 })
    expect(r[9]).toMatchObject({ inicio: '2026-11-01', concluidas: 0, criadas: 2 })
    // A de janeiro está fora da janela de 12 semanas.
    expect(r.reduce((s, x) => s + x.concluidas, 0)).toBe(3)
    // Média das 4 últimas semanas: (0 + 0 + 1 + 2) / 4.
    expect(r[11].mediaMovel).toBeCloseTo(0.75)
    expect(r[0].mediaMovel).toBe(0)
  })
})

describe('motivos por equipe', () => {
  const reg = (over: Record<string, unknown>) => ({
    acaoId: 'a',
    campo: 'previstoTermino',
    valorAntigo: '2026-03-10',
    alteradoEm: new Date('2026-11-10T12:00:00Z'),
    motivo: 'ESCOPO' as string | null,
    equipe: 'STI' as string | null,
    ...over,
  })
  it('cruza motivo e equipe contando EVENTOS (início e término juntos valem um)', () => {
    const m = motivosPorEquipe(
      [
        reg({ campo: 'previstoInicio' }),
        reg({ campo: 'previstoTermino' }),
        reg({ acaoId: 'b', motivo: 'RECURSOS', equipe: 'GIA' }),
        reg({ acaoId: 'c', motivo: null, equipe: 'GIA' }),
        reg({ acaoId: 'd', valorAntigo: null }), // primeira data: não conta
        reg({ acaoId: 'e', campo: 'status' }),
      ],
      ['ESCOPO', 'RECURSOS', 'PRIORIDADE'],
    )
    expect(m.colunas.map((c) => c.id)).toEqual(['GIA', 'STI'])
    expect(m.linhas).toEqual(['Escopo mudou', 'Falta de pessoas ou de recursos', 'Sem motivo registrado'])
    expect(m.valores).toEqual([[0, 1], [1, 0], [1, 0]])
    expect(m.maximo).toBe(1)
  })
  it('eventos recentes por equipe respeitam a janela de 30 dias', () => {
    const r = eventosRecentesPorEquipe(
      [reg({}), reg({ acaoId: 'b', alteradoEm: new Date('2026-09-01T12:00:00Z') })],
      hoje,
    )
    expect(r).toHaveLength(1)
  })
})
