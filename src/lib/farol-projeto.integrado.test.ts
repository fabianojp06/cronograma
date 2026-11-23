// Sem mock: percorre sinalDoProjeto -> avancoEm de verdade, para pegar
// mudança de contrato entre os dois módulos.
import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import type { AcaoParaAvanco } from './avanco-fisico'
import { sinalDoProjeto } from './farol-projeto'

const d = (mes: number, dia: number) => new Date(Date.UTC(2026, mes - 1, dia))

// 1 a 5 de junho de 2026: segunda a sexta (5 dias úteis). Em 3/6 o previsto é 60%.
const semana = (status: StatusAcao): AcaoParaAvanco => ({
  status,
  previstoInicio: d(6, 1),
  previstoTermino: d(6, 5),
})

const hoje = d(6, 3)

describe('sinalDoProjeto com avancoEm real', () => {
  it('não iniciada em 3/6: previsto 60, realizado 0, desvio -60 -> ATRASADO', () => {
    const f = sinalDoProjeto({
      acoes: [semana(StatusAcao.NAO_INICIADO)],
      riscos: [],
      hoje,
    })
    expect(f.sinal).toBe('ATRASADO')
    expect(f.desvio).toBe(-60)
    expect(f.motivo).toContain('−60 p.p.')
  })

  it('75% em 4/6: previsto 80, desvio -5 -> ATENCAO', () => {
    const f = sinalDoProjeto({
      acoes: [semana(StatusAcao.EM_CURSO_75)],
      riscos: [],
      hoje: d(6, 4),
    })
    expect(f.sinal).toBe('ATENCAO')
    expect(f.desvio).toBe(-5)
  })

  it('50% e 75% em 3/6: realizado 62,5, previsto 60, desvio +2,5 -> EM_DIA', () => {
    const f = sinalDoProjeto({
      acoes: [semana(StatusAcao.EM_CURSO_50), semana(StatusAcao.EM_CURSO_75)],
      riscos: [],
      hoje,
    })
    expect(f.sinal).toBe('EM_DIA')
    expect(f.desvio).toBe(2.5)
    expect(f.motivo).toContain('+2,5 p.p.')
  })

  it('50% em 2/6: previsto 40, desvio +10 -> ADIANTADO', () => {
    const f = sinalDoProjeto({
      acoes: [semana(StatusAcao.EM_CURSO_50)],
      riscos: [],
      hoje: d(6, 2),
    })
    expect(f.sinal).toBe('ADIANTADO')
    expect(f.desvio).toBe(10)
  })

  it('risco alto vencido sobe EM_DIA para ATENCAO', () => {
    const f = sinalDoProjeto({
      acoes: [semana(StatusAcao.EM_CURSO_50), semana(StatusAcao.EM_CURSO_75)],
      riscos: [{ impacto: 'ALTO', status: 'ABERTO', prazo: d(6, 2) }],
      hoje,
    })
    expect(f.sinal).toBe('ATENCAO')
    expect(f.subiuPorRisco).toBe(true)
  })

  it('lista vazia -> SEM_DADOS', () => {
    const f = sinalDoProjeto({ acoes: [], riscos: [], hoje })
    expect(f.sinal).toBe('SEM_DADOS')
    expect(f.desvio).toBeNull()
  })

  it('ações sem datas -> SEM_DADOS', () => {
    const f = sinalDoProjeto({
      acoes: [
        { status: StatusAcao.CONCLUIDO, previstoInicio: null, previstoTermino: null },
      ],
      riscos: [],
      hoje,
    })
    expect(f.sinal).toBe('SEM_DADOS')
    expect(f.motivo).toBe('Sem ações com datas previstas')
  })
})
