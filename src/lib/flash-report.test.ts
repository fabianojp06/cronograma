import { describe, expect, it } from 'vitest'
import {
  janelaDoProjeto,
  montarFlashReport,
  normalizarSemana,
  type AcaoDoRelatorio,
  type EntradaFlash,
  type RiscoDoRelatorio,
} from './flash-report'
import { periodoDaSemana, semanaDe, semanaSeguinte, chaveSemana, type SemanaCtcea } from './semana-ctcea'

const DIA = 86_400_000
const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia))

// Janela de 10 semanas: da semana de 05/10/2026 até 9 semanas depois.
const S1 = semanaDe(d(2026, 10, 5))
function semanaN(n: number): SemanaCtcea {
  let s = S1
  for (let i = 1; i < n; i++) s = semanaSeguinte(s)
  return s
}
const inicioN = (n: number) => new Date(periodoDaSemana(semanaN(n)).inicio.getTime() + DIA) // segunda
const fimN = (n: number) => new Date(periodoDaSemana(semanaN(n)).fim.getTime() - DIA) // sexta
const HOJE = d(2026, 12, 20) // depois da janela: semana passada

function acao(p: Partial<AcaoDoRelatorio> & { numero: number }): AcaoDoRelatorio {
  return {
    id: `a${p.numero}`,
    descricao: `Ação ${p.numero}`,
    macroetapaId: null,
    status: 'NAO_INICIADO',
    previstoInicio: null,
    previstoTermino: null,
    realizadoTermino: null,
    bloqueada: false,
    atrasada: false,
    ...p,
  }
}

function risco(p: Partial<RiscoDoRelatorio> & { id: string }): RiscoDoRelatorio {
  return {
    tipo: 'RISCO', titulo: p.id, impacto: 'MEDIO', status: 'ABERTO', prazo: null, plano: null,
    responsavel: null, pedeAjuda: false, criadoEm: d(2026, 10, 1), acaoNumero: null, ...p,
  }
}

function entrada(p: Partial<EntradaFlash> = {}): EntradaFlash {
  return {
    projeto: { nome: 'P', cliente: null, objetivo: null, lider: null },
    macroetapas: [{ id: 'm1', nome: 'Integrações', ordem: 1 }, { id: 'm2', nome: 'Entrega', ordem: 2 }],
    acoes: [
      acao({ numero: 1, macroetapaId: 'm1', previstoInicio: inicioN(1), previstoTermino: fimN(5) }),
      acao({ numero: 2, macroetapaId: 'm2', previstoInicio: inicioN(6), previstoTermino: fimN(10) }),
    ],
    acoesNoFimDeCada: new Map(),
    riscos: [],
    semana: semanaN(7),
    hoje: HOJE,
    ...p,
  }
}

describe('janela e curva', () => {
  it('posição da semana e total', () => {
    const r = montarFlashReport(entrada())
    expect(r.semanaDoProjeto).toBe(7)
    expect(r.totalSemanas).toBe(10)
    expect(r.periodo).toEqual(periodoDaSemana(semanaN(7)))
  })

  it('curva: 10 pontos, previsto não decresce, realizado nulo depois da semana escolhida', () => {
    const fotos = new Map<string, { status: 'CONCLUIDO' | 'NAO_INICIADO'; previstoInicio: Date; previstoTermino: Date }[]>()
    for (let n = 1; n <= 6; n++) {
      fotos.set(chaveSemana(semanaN(n)), [
        { status: n >= 5 ? 'CONCLUIDO' : 'NAO_INICIADO', previstoInicio: inicioN(1), previstoTermino: fimN(5) },
      ])
    }
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: fotos }))
    expect(r.curva).toHaveLength(10)
    expect(r.curva.map((p) => p.rotulo)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'])
    for (let i = 1; i < 10; i++) expect(r.curva[i].previsto).toBeGreaterThanOrEqual(r.curva[i - 1].previsto)
    expect(r.curva[0].realizado).toBe(0)
    expect(r.curva[4].realizado).toBe(100)
    expect(r.curva[6].realizado).toBe(0) // semana escolhida, sem foto: ações atuais (nenhuma concluída)
    expect(r.curva.slice(7).every((p) => p.realizado === null)).toBe(true)
  })

  it('projeto sem datas: janela vazia, sem exceção', () => {
    const r = montarFlashReport(entrada({ acoes: [acao({ numero: 1 })], macroetapas: [] }))
    expect(r.totalSemanas).toBe(0)
    expect(r.semanaDoProjeto).toBe(0)
    expect(r.curva).toEqual([])
    expect(r.consolidado).toBeNull()
    expect(r.farol.sinal).toBe('SEM_DADOS')
    expect(r.avisos.length).toBeGreaterThan(0)
  })
})

describe('macroetapas', () => {
  it('células: null fora, REALIZADO, ATENCAO na semana escolhida, PLANEJADO depois', () => {
    // m1 vai da semana 1 à 9 e está com 0% de realizado contra previsto alto.
    const acoes = [
      acao({ numero: 1, macroetapaId: 'm1', previstoInicio: inicioN(1), previstoTermino: fimN(9) }),
      acao({ numero: 2, macroetapaId: 'm2', previstoInicio: inicioN(6), previstoTermino: fimN(10) }),
    ]
    const r = montarFlashReport(entrada({ acoes }))
    const m1 = r.macroetapas[0]
    expect(m1.nome).toBe('Integrações')
    expect(m1.avanco!.desvio).toBeLessThanOrEqual(-10)
    expect(m1.celulas).toHaveLength(10)
    expect(m1.celulas.slice(0, 6)).toEqual(Array(6).fill('REALIZADO'))
    expect(m1.celulas[6]).toBe('ATENCAO')
    expect(m1.celulas.slice(7, 9)).toEqual(['PLANEJADO', 'PLANEJADO'])
    expect(m1.celulas[9]).toBeNull()
    const m2 = r.macroetapas[1]
    expect(m2.celulas.slice(0, 5)).toEqual(Array(5).fill(null))
  })

  it('"Sem macroetapa" só se houver ação solta', () => {
    expect(montarFlashReport(entrada()).macroetapas.map((m) => m.nome)).toEqual(['Integrações', 'Entrega'])
    const acoes = [...entrada().acoes, acao({ numero: 3, previstoInicio: inicioN(2), previstoTermino: fimN(3) })]
    const r = montarFlashReport(entrada({ acoes }))
    expect(r.macroetapas.map((m) => m.nome)).toEqual(['Integrações', 'Entrega', 'Sem macroetapa'])
  })

  it('projeto sem macroetapas: só o grupo solto e aviso sugerindo cadastrar', () => {
    const r = montarFlashReport(entrada({ macroetapas: [], acoes: entrada().acoes.map((a) => ({ ...a, macroetapaId: null })) }))
    expect(r.macroetapas.map((m) => m.nome)).toEqual(['Sem macroetapa'])
    expect(r.avisos.join(' ')).toMatch(/cadastre macroetapas/i)
  })
})

describe('atividades', () => {
  it('realizadas: concluídas na semana, máx. 4 e total; próximas: cruzam a semana seguinte', () => {
    const fim7 = periodoDaSemana(semanaN(7)).fim
    const concl = [1, 2, 3, 4, 5, 6].map((n) =>
      acao({ numero: n, status: 'CONCLUIDO', previstoInicio: inicioN(5), previstoTermino: fimN(7),
        realizadoTermino: new Date(fim7.getTime() - n * DIA + DIA) }),
    )
    const velha = acao({ numero: 7, status: 'CONCLUIDO', realizadoTermino: fimN(3) })
    const prox = acao({ numero: 8, previstoInicio: inicioN(7), previstoTermino: fimN(8) })
    const fora = acao({ numero: 9, previstoInicio: inicioN(9), previstoTermino: fimN(9) })
    const feita = acao({ numero: 10, status: 'CONCLUIDO', previstoInicio: inicioN(8), previstoTermino: fimN(8) })
    const r = montarFlashReport(entrada({ acoes: [...concl, velha, prox, fora, feita], macroetapas: [] }))
    expect(r.totalRealizadas).toBe(6)
    expect(r.realizadas).toHaveLength(4)
    expect(r.realizadas[0].numero).toBe(1) // mais recente primeiro
    expect(r.proximas.map((i) => i.numero)).toEqual([8])
    expect(r.totalProximas).toBe(1)
  })
})

describe('alertas', () => {
  const base = () => {
    const acoes = [
      acao({ numero: 1, macroetapaId: 'm1', previstoInicio: inicioN(1), previstoTermino: fimN(9) }),
      acao({ numero: 2, macroetapaId: 'm2', previstoInicio: inicioN(9), previstoTermino: fimN(10), atrasada: true, bloqueada: true }),
    ]
    return acoes
  }

  it('ordem e textos no singular', () => {
    const hoje = new Date(fimN(10).getTime() + 5 * DIA)
    const r = montarFlashReport(entrada({
      acoes: base(), hoje,
      riscos: [risco({ id: 'r1', prazo: d(2026, 10, 1) })],
    }))
    expect(r.alertas.map((a) => a.tipo)).toEqual(['MACROETAPA_DESVIO', 'ACOES_ATRASADAS', 'RISCOS_VENCIDOS', 'ACOES_BLOQUEADAS'])
    expect(r.alertas[0].texto).toMatch(/^Integrações com desvio de −\d+(,\d)? p\.p\.$/)
    expect(r.alertas[1].texto).toBe('1 ação atrasada (a mais antiga: #2, há 5 dias)')
    expect(r.alertas[2].texto).toBe('1 risco aberto com prazo vencido')
    expect(r.alertas[3].texto).toBe('1 ação bloqueada por dependência')
  })

  it('plural e omissão com zero', () => {
    const acoes = [
      acao({ numero: 1, previstoInicio: inicioN(1), previstoTermino: fimN(2), atrasada: true, bloqueada: true }),
      acao({ numero: 2, previstoInicio: inicioN(1), previstoTermino: fimN(3), atrasada: true, bloqueada: true }),
    ]
    const hoje = new Date(fimN(3).getTime() + DIA)
    const r = montarFlashReport(entrada({
      acoes, macroetapas: [], hoje,
      riscos: [risco({ id: 'a', prazo: d(2026, 1, 1) }), risco({ id: 'b', prazo: d(2026, 1, 1), tipo: 'BLOQUEIO' })],
    }))
    const textos = r.alertas.map((a) => a.texto)
    expect(r.alertas.filter((a) => a.tipo === 'MACROETAPA_DESVIO').length).toBeLessThanOrEqual(1)
    expect(textos).toContain('2 ações atrasadas (a mais antiga: #1, há 8 dias)')
    expect(textos).toContain('2 riscos abertos com prazo vencido')
    expect(textos).toContain('2 ações bloqueadas por dependência')
    expect(montarFlashReport(entrada()).alertas.filter((a) => a.tipo !== 'MACROETAPA_DESVIO')).toEqual([])
  })

  it('nunca escreve -0', () => {
    const r = montarFlashReport(entrada())
    expect(JSON.stringify(r.alertas)).not.toMatch(/-0|−0 /)
  })
})

describe('riscos e pedidos de ajuda', () => {
  it('só abertos com pedeAjuda, por ordem de atenção', () => {
    const r = montarFlashReport(entrada({
      riscos: [
        risco({ id: 'baixo', impacto: 'BAIXO', pedeAjuda: true }),
        risco({ id: 'alto', impacto: 'ALTO', pedeAjuda: true }),
        risco({ id: 'sem', impacto: 'ALTO', pedeAjuda: false }),
        risco({ id: 'resolvido', impacto: 'ALTO', pedeAjuda: true, status: 'RESOLVIDO' }),
      ],
    }))
    expect(r.pedidosDeAjuda.map((x) => x.id)).toEqual(['alto', 'baixo'])
    expect(r.riscos.map((x) => x.id)).not.toContain('resolvido')
  })
})

describe('farol e consolidado', () => {
  it('semana passada usa a foto do fim dela', () => {
    const foto = new Map([[chaveSemana(semanaN(7)), [
      { status: 'CONCLUIDO' as const, previstoInicio: inicioN(1), previstoTermino: fimN(5) },
      { status: 'CONCLUIDO' as const, previstoInicio: inicioN(6), previstoTermino: fimN(10) },
    ]]])
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: foto }))
    expect(r.consolidado!.realizado).toBe(100)
    expect(r.farol.sinal).toBe('ADIANTADO')
  })
})

describe('normalizarSemana', () => {
  const janela = { primeira: semanaN(1), ultima: semanaN(10) }
  const hoje = fimN(7)
  const atual = semanaDe(hoje)

  it('válida dentro da janela é mantida', () => {
    const s = semanaN(3)
    expect(normalizarSemana(chaveSemana(s), janela, hoje)).toEqual(s)
  })
  it('inválida, ausente e fora do calendário → semana de hoje', () => {
    expect(normalizarSemana('2026-99', janela, hoje)).toEqual(atual)
    expect(normalizarSemana('abc', janela, hoje)).toEqual(atual)
    expect(normalizarSemana(undefined, janela, hoje)).toEqual(atual)
  })
  it('futura → semana de hoje', () => {
    expect(normalizarSemana(chaveSemana(semanaN(9)), janela, hoje)).toEqual(atual)
  })
  it('fora da janela é limitada; hoje fora da janela também', () => {
    expect(normalizarSemana('2020-10', janela, hoje)).toEqual(janela.primeira)
    const depois = new Date(fimN(10).getTime() + 30 * DIA)
    expect(normalizarSemana(undefined, janela, depois)).toEqual(janela.ultima)
  })
  it('janela vazia devolve a semana de hoje', () => {
    expect(normalizarSemana(undefined, null, hoje)).toEqual(atual)
  })
  it('janelaDoProjeto', () => {
    expect(janelaDoProjeto(entrada().acoes)).toEqual(janela)
    expect(janelaDoProjeto([])).toBeNull()
  })
})
