import { describe, expect, it } from 'vitest'
import {
  ID_SEM_MACROETAPA,
  janelaDoProjeto,
  montarFlashReport,
  normalizarSemana,
  type AcaoDoRelatorio,
  type EntradaFlash,
  type RiscoDoRelatorio,
} from './flash-report'
import { avancoEm } from './avanco-fisico'
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
        { status: 'NAO_INICIADO', previstoInicio: inicioN(6), previstoTermino: fimN(10) },
      ])
    }
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: fotos }))
    expect(r.curva).toHaveLength(10)
    expect(r.curva.map((p) => p.rotulo)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10'])
    for (let i = 1; i < 10; i++) expect(r.curva[i].previsto).toBeGreaterThanOrEqual(r.curva[i - 1].previsto)
    expect(r.curva[0].realizado).toBe(0)
    expect(r.curva[4].realizado).toBe(avancoEm(fotos.get(chaveSemana(semanaN(5)))!, periodoDaSemana(semanaN(5)).fim)!.realizado)
    expect(r.curva[4].realizado).toBeGreaterThan(0)
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
  it('células: null fora, DECORRIDO (sem avanço, sem foto), ATENCAO na escolhida, PLANEJADO depois', () => {
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
    // Semanas passadas sem foto não têm como ser medidas: nunca verde.
    expect(m1.celulas.slice(0, 6)).toEqual(Array(6).fill('DECORRIDO'))
    expect(m1.celulas[6]).toBe('ATENCAO')
    expect(m1.celulas.slice(7, 9)).toEqual(['PLANEJADO', 'PLANEJADO'])
    expect(m1.celulas[9]).toBeNull()
    const m2 = r.macroetapas[1]
    expect(m2.celulas.slice(0, 5)).toEqual(Array(5).fill(null))
  })

  it('cada semana passada usa a foto dela: sem avanço → DECORRIDO, com avanço → REALIZADO, atrasada → ATENCAO', () => {
    // m1: uma ação de sexta da semana 1 até a sexta da 9. No sábado da semana 1 o
    // previsto é de um dia (−2,x p.p. contra 0% realizado: ainda não é Atenção).
    const acoes = [
      acao({ numero: 1, macroetapaId: 'm1', previstoInicio: fimN(1), previstoTermino: fimN(9) }),
      acao({ numero: 2, macroetapaId: 'm2', previstoInicio: inicioN(6), previstoTermino: fimN(10) }),
    ]
    const fotoComStatus = (status: AcaoDoRelatorio['status']) =>
      acoes.map((a) => ({ id: a.id, status, previstoInicio: a.previstoInicio, previstoTermino: a.previstoTermino }))
    const fotos = new Map([
      [chaveSemana(semanaN(1)), fotoComStatus('NAO_INICIADO')], // 0% e previsto ~2%: DECORRIDO
      [chaveSemana(semanaN(2)), fotoComStatus('NAO_INICIADO')], // 0% e previsto alto: atrasada ali → ATENCAO
      [chaveSemana(semanaN(3)), fotoComStatus('CONCLUIDO')], // avanço → REALIZADO
      [chaveSemana(semanaN(4)), fotoComStatus('CONCLUIDO')],
      [chaveSemana(semanaN(5)), fotoComStatus('CONCLUIDO')],
      [chaveSemana(semanaN(6)), fotoComStatus('CONCLUIDO')],
      [chaveSemana(semanaN(7)), fotoComStatus('CONCLUIDO')],
    ])
    const r = montarFlashReport(entrada({ acoes, acoesNoFimDeCada: fotos }))
    expect(r.macroetapas[0].celulas.slice(0, 7)).toEqual([
      'DECORRIDO', 'ATENCAO', 'REALIZADO', 'REALIZADO', 'REALIZADO', 'REALIZADO', 'REALIZADO',
    ])
    expect(r.macroetapas[0].celulas.slice(7, 9)).toEqual(['PLANEJADO', 'PLANEJADO'])
  })

  it('linha leva o id da macroetapa; o grupo solto usa um id reservado', () => {
    const acoes = [...entrada().acoes, acao({ numero: 3, previstoInicio: inicioN(2), previstoTermino: fimN(3) })]
    const r = montarFlashReport(entrada({ acoes }))
    expect(r.macroetapas.map((m) => m.id)).toEqual(['m1', 'm2', ID_SEM_MACROETAPA])
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

import { diasUteisEntre } from './dias-uteis'
import { pesoDaAcao } from './avanco-fisico'
import { totalDeSemanas } from './semana-ctcea'

/** Termino (dia útil) tal que a ação tem exatamente `n` dias úteis de peso. */
function terminoComPeso(inicio: Date, n: number): Date {
  let t = inicio
  while (diasUteisEntre(inicio, t) < n || diasUteisEntre(inicio, new Date(t.getTime() - DIA)) === n) {
    t = new Date(t.getTime() + DIA)
  }
  return t
}

/**
 * Macroetapa "Integrações" de 100 dias úteis, toda vencida em relação à semana
 * escolhida (previsto = 100%): `a` dias concluídos, `b` dias em `statusB`
 * (padrão 75%), `c` dias em `statusC` (padrão não iniciado). Desvio =
 * −(b·25 + c·100) / 100 quando statusB = EM_CURSO_75.
 */
function cenario(
  a: number,
  b: number,
  c: number,
  statusC: 'NAO_INICIADO' | 'EM_CURSO_25' = 'NAO_INICIADO',
  statusB: 'EM_CURSO_75' | 'EM_CURSO_50' = 'EM_CURSO_75',
): EntradaFlash {
  const inicio = d(2026, 3, 2)
  const partes: [number, AcaoDoRelatorio['status']][] = [[a, 'CONCLUIDO'], [b, statusB], [c, statusC]]
  const acoes = partes
    .filter(([n]) => n > 0)
    .map(([n, status], i) => {
      const x = acao({ numero: i + 1, macroetapaId: 'm1', status, previstoInicio: inicio, previstoTermino: terminoComPeso(inicio, n) })
      expect(pesoDaAcao(x)).toBe(n)
      return x
    })
  return entrada({ macroetapas: [{ id: 'm1', nome: 'Integrações', ordem: 1 }], acoes, semana: semanaDe(new Date(Math.max(...acoes.map((x) => x.previstoTermino!.getTime())))) })
}

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
    expect(textos).toEqual([
      'Sem macroetapa com desvio de −100 p.p.',
      '2 ações atrasadas (a mais antiga: #1, há 8 dias)',
      '2 riscos abertos com prazo vencido',
      '2 ações bloqueadas por dependência',
    ])
    expect(montarFlashReport(entrada()).alertas.filter((a) => a.tipo !== 'MACROETAPA_DESVIO')).toEqual([])
  })

  it('texto do desvio: menos de verdade, vírgula decimal, inteiro sem vírgula', () => {
    const inteiro = montarFlashReport(cenario(90, 0, 10)).alertas[0].texto
    expect(inteiro).toBe('Integrações com desvio de −10 p.p.')
    const decimal = montarFlashReport(cenario(75, 25, 0, 'NAO_INICIADO', 'EM_CURSO_50')).alertas[0].texto
    expect(decimal).toBe('Integrações com desvio de −12,5 p.p.')
    for (const t of [inteiro, decimal]) expect(t).not.toContain('-')
  })

  it('limite do alerta de macroetapa: −10 alerta, −9,5 não, zero não', () => {
    expect(montarFlashReport(cenario(90, 0, 10)).alertas.map((a) => a.tipo)).toEqual(['MACROETAPA_DESVIO'])
    expect(montarFlashReport(cenario(62, 38, 0)).alertas).toEqual([]) // 38 de peso a 75% = −9,5
    expect(montarFlashReport(cenario(100, 0, 0)).alertas).toEqual([])
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

describe('limite da célula ATENCAO', () => {
  const celulaEscolhida = (e: EntradaFlash) => {
    const r = montarFlashReport(e)
    return r.macroetapas[0].celulas[r.semanaDoProjeto - 1]
  }
  it('desvio exatamente −3 → ATENCAO; −2,5 → REALIZADO', () => {
    const tres = cenario(88, 12, 0)
    expect(montarFlashReport(tres).macroetapas[0].avanco!.desvio).toBe(-3)
    expect(celulaEscolhida(tres)).toBe('ATENCAO')
    const doisEMeio = cenario(90, 10, 0)
    expect(montarFlashReport(doisEMeio).macroetapas[0].avanco!.desvio).toBe(-2.5)
    expect(celulaEscolhida(doisEMeio)).toBe('REALIZADO')
  })
})

describe('semana passada: estado da semana, não de hoje', () => {
  const comFoto = () => {
    const acoes = entrada().acoes.map((a) => ({ ...a, status: 'CONCLUIDO' as const }))
    const foto = new Map([[chaveSemana(semanaN(7)), acoes.map((a) => ({
      id: a.id, status: 'NAO_INICIADO' as const, previstoInicio: a.previstoInicio, previstoTermino: a.previstoTermino,
    }))]])
    return entrada({ acoes, acoesNoFimDeCada: foto })
  }

  it('macroetapa, alerta e célula usam a foto da semana', () => {
    const r = montarFlashReport(comFoto())
    const m2 = r.macroetapas[1]
    expect(m2.avanco!.realizado).toBe(0)
    expect(m2.celulas[6]).toBe('ATENCAO')
    expect(r.alertas.map((a) => a.tipo)).toContain('MACROETAPA_DESVIO')
    expect(r.avisos.join(' ')).not.toMatch(/sem foto/i)
  })

  it('sem foto: usa o estado atual e avisa', () => {
    const r = montarFlashReport(entrada())
    expect(r.avisos.join(' ')).toMatch(/semana passada sem foto do histórico: valores calculados com o estado atual/i)
  })

  it('semana passada avisa que alertas, riscos e próximas mostram hoje; semana atual não', () => {
    expect(montarFlashReport(entrada()).avisos.join(' ')).toMatch(/riscos e as próximas atividades mostram a situação de hoje/i)
    const atual = montarFlashReport(entrada({ hoje: new Date(inicioN(7).getTime() + DIA) }))
    expect(atual.avisos.join(' ')).not.toMatch(/situação de hoje|sem foto/)
  })

  it('foto sem ids não agrupa por macroetapa: cai no estado atual com aviso', () => {
    const foto = new Map([[chaveSemana(semanaN(7)), [
      { status: 'NAO_INICIADO' as const, previstoInicio: inicioN(1), previstoTermino: fimN(5) },
    ]]])
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: foto }))
    expect(r.avisos.join(' ')).toMatch(/foto da semana sem identificação das ações/i)
  })
})

describe('janelas e dados incomuns', () => {
  it('janela que cruza 2026 → 2027', () => {
    const acoes = [acao({ numero: 1, previstoInicio: d(2026, 12, 14), previstoTermino: d(2027, 1, 18) })]
    const e = entrada({ acoes, macroetapas: [], semana: semanaDe(d(2027, 1, 4)), hoje: d(2027, 2, 1) })
    expect(janelaDoProjeto(acoes)).toEqual({ primeira: { ano: 2026, semana: 51 }, ultima: { ano: 2027, semana: 4 } })
    const r = montarFlashReport(e)
    expect(r.totalSemanas).toBe(6)
    expect(r.semanaDoProjeto).toBe(4)
    expect(r.curva.map((p) => p.rotulo)).toEqual(['S01', 'S02', 'S03', 'S04', 'S05', 'S06'])
    expect(r.curva.slice(4).every((p) => p.realizado === null)).toBe(true)
  })

  it('ano de 53 semanas (2028)', () => {
    expect(totalDeSemanas(2028)).toBe(53)
    const acoes = [acao({ numero: 1, previstoInicio: d(2028, 12, 18), previstoTermino: d(2029, 1, 3) })]
    expect(janelaDoProjeto(acoes)).toEqual({ primeira: { ano: 2028, semana: 52 }, ultima: { ano: 2029, semana: 1 } })
    const r = montarFlashReport(entrada({ acoes, macroetapas: [], semana: { ano: 2028, semana: 53 }, hoje: d(2029, 1, 10) }))
    expect(r.totalSemanas).toBe(3)
    expect(r.semanaDoProjeto).toBe(2)
    const hoje = d(2029, 1, 10)
    expect(normalizarSemana('2028-53', { primeira: { ano: 2028, semana: 52 }, ultima: { ano: 2029, semana: 1 } }, hoje)).toEqual({ ano: 2028, semana: 53 })
    expect(normalizarSemana('2027-53', null, hoje)).toEqual(semanaDe(hoje))
  })

  it('só uma ponta de data: a janela é essa semana e a ação fica sem peso', () => {
    const acoes = [acao({ numero: 1, previstoTermino: fimN(3) })]
    const r = montarFlashReport(entrada({ acoes, macroetapas: [], semana: semanaN(3) }))
    expect(r.totalSemanas).toBe(1)
    expect(r.semanaDoProjeto).toBe(1)
    expect(r.consolidado).toBeNull()
  })

  it('término antes do início e nenhuma ação com peso: sem curva e com aviso', () => {
    const acoes = [acao({ numero: 1, previstoInicio: fimN(5), previstoTermino: inicioN(2) })]
    const r = montarFlashReport(entrada({ acoes, macroetapas: [], semana: semanaN(3) }))
    expect(r.curva).toEqual([])
    expect(r.consolidado).toBeNull()
    expect(r.avisos.join(' ')).toMatch(/nenhuma ação com peso/i)
  })

  it('macroetapaId desconhecido cai em "Sem macroetapa"', () => {
    const acoes = [...entrada().acoes, acao({ numero: 3, macroetapaId: 'fantasma', previstoInicio: inicioN(2), previstoTermino: fimN(3) })]
    const r = montarFlashReport(entrada({ acoes }))
    expect(r.macroetapas.map((m) => m.nome)).toEqual(['Integrações', 'Entrega', 'Sem macroetapa'])
  })
})

describe('semana corrente: uma data só', () => {
  it('farol, consolidado e curva usam hoje (não o sábado) e dão o mesmo desvio', () => {
    // Quarta-feira da semana 7; ação 1 (S1-S5) concluída, ação 2 não começou.
    const hoje = new Date(inicioN(7).getTime() + 2 * DIA)
    const r = montarFlashReport(
      entrada({
        semana: semanaN(7),
        hoje,
        acoes: [
          acao({ numero: 1, macroetapaId: 'm1', status: 'EM_CURSO_50', previstoInicio: inicioN(5), previstoTermino: fimN(9) }),
          acao({ numero: 2, macroetapaId: 'm2', previstoInicio: inicioN(1), previstoTermino: fimN(10) }),
        ],
      }),
    )
    expect(r.farol.desvio).toBe(Math.round(r.consolidado!.desvio * 10) / 10)
    const ponto = r.curva[r.semanaDoProjeto - 1]
    expect(ponto.previsto).toBe(r.consolidado!.previsto)
  })
})

describe('semana passada: previsto da curva e do cabeçalho vêm da mesma base', () => {
  it('depois de um replanejamento, o ponto da semana escolhida e o consolidado coincidem', () => {
    // Plano de hoje: as duas ações terminam na semana 10. Plano da semana 7 (foto):
    // as duas já tinham terminado na semana 5, então previsto 100% naquela época.
    const acoes = entrada().acoes
    const foto = new Map([[chaveSemana(semanaN(7)), acoes.map((a) => ({
      id: a.id, status: 'NAO_INICIADO' as const, previstoInicio: inicioN(1), previstoTermino: fimN(5),
    }))]])
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: foto }))
    expect(r.consolidado!.previsto).toBe(100)
    expect(r.curva[r.semanaDoProjeto - 1].previsto).toBe(r.consolidado!.previsto)
    expect(r.curva[r.semanaDoProjeto - 1].realizado).toBe(r.consolidado!.realizado)
  })

  it('todo ponto com foto usa o plano da própria foto (pode não ser monótono: valores honestos)', () => {
    const acoes = entrada().acoes
    const antes = acoes.map((a) => ({ id: a.id, status: 'NAO_INICIADO' as const, previstoInicio: inicioN(1), previstoTermino: fimN(5) }))
    const foto = new Map([[chaveSemana(semanaN(2)), antes]])
    const r = montarFlashReport(entrada({ acoesNoFimDeCada: foto }))
    const sabado2 = periodoDaSemana(semanaN(2)).fim
    expect(r.curva[1].previsto).toBe(avancoEm(antes, sabado2)!.previsto)
    expect(r.curva[1].previsto).not.toBe(avancoEm(acoes, sabado2)!.previsto)
  })
})

describe('aviso de ações sem datas', () => {
  const semDatas = (n: number) => Array.from({ length: n }, (_, i) => acao({ numero: 50 + i }))
  it('singular e plural, com o texto exato', () => {
    const um = montarFlashReport(entrada({ acoes: [...entrada().acoes, ...semDatas(1)] }))
    expect(um.avisos).toContain('1 ação sem datas previstas ficou fora do avanço físico.')
    const dois = montarFlashReport(entrada({ acoes: [...entrada().acoes, ...semDatas(2)] }))
    expect(dois.avisos).toContain('2 ações sem datas previstas ficaram fora do avanço físico.')
  })
  it('sem ação excluída, sem aviso', () => {
    expect(montarFlashReport(entrada()).avisos.join(' ')).not.toMatch(/fora do avanço físico/)
  })
})

describe('desvio nunca sai como -0', () => {
  it('consolidado com desvio zero não é -0', () => {
    const hoje = new Date(inicioN(7).getTime() + 2 * DIA)
    const r = montarFlashReport(entrada({ hoje, acoes: [acao({ numero: 1, previstoInicio: inicioN(8), previstoTermino: fimN(9) })], macroetapas: [] }))
    expect(Object.is(r.consolidado!.desvio, -0)).toBe(false)
  })
})
