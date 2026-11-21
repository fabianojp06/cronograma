import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import {
  MAXIMO_ITENS_POR_BLOCO,
  SEM_EQUIPE,
  frasePrincipal,
  hojeEmBrasilia,
  lerConteudo,
  montarResumo,
  resumoVazio,
  rotuloDaSemana,
  semanaDisponivel,
  type AcaoParaResumo,
} from './resumo-semanal'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
/** Um instante em Brasília (UTC-3). */
const br = (iso: string, hora: string) => new Date(`${iso}T${hora}:00-03:00`)

describe('semanaDisponivel', () => {
  // 2026-11-16 é segunda-feira.
  it('segunda a partir das 8h de Brasília é a própria semana', () => {
    expect(semanaDisponivel(br('2026-11-16', '08:00'))).toBe('2026-11-16')
    expect(semanaDisponivel(br('2026-11-16', '23:59'))).toBe('2026-11-16')
  })
  it('segunda antes das 8h ainda é a semana anterior', () => {
    expect(semanaDisponivel(br('2026-11-16', '07:59'))).toBe('2026-11-09')
    expect(semanaDisponivel(br('2026-11-16', '00:00'))).toBe('2026-11-09')
  })
  it('o resto da semana, inclusive o domingo, é a segunda anterior', () => {
    expect(semanaDisponivel(br('2026-11-17', '12:00'))).toBe('2026-11-16')
    expect(semanaDisponivel(br('2026-11-20', '09:00'))).toBe('2026-11-16')
    expect(semanaDisponivel(br('2026-11-22', '20:00'))).toBe('2026-11-16')
  })
  it('usa o relógio de Brasília, não o de UTC', () => {
    // 01h UTC de terça = 22h de segunda em Brasília: ainda é a segunda.
    expect(semanaDisponivel(new Date('2026-11-17T01:00:00Z'))).toBe('2026-11-16')
    // 10h UTC de segunda = 7h em Brasília: ainda não passou das 8h.
    expect(semanaDisponivel(new Date('2026-11-16T10:00:00Z'))).toBe('2026-11-09')
    expect(semanaDisponivel(new Date('2026-11-16T11:00:00Z'))).toBe('2026-11-16')
  })
  it('atravessa o virar do ano', () => {
    // 2027-01-01 é sexta; a segunda anterior é 2026-12-28.
    expect(semanaDisponivel(br('2027-01-01', '10:00'))).toBe('2026-12-28')
  })
})

describe('hojeEmBrasilia', () => {
  it('é a data de Brasília à meia-noite UTC', () => {
    expect(hojeEmBrasilia(new Date('2026-11-17T01:00:00Z')).toISOString()).toBe('2026-11-16T00:00:00.000Z')
    expect(hojeEmBrasilia(new Date('2026-11-17T03:00:00Z')).toISOString()).toBe('2026-11-17T00:00:00.000Z')
  })
})

const base = (over: Partial<AcaoParaResumo>): AcaoParaResumo => ({
  id: 'a',
  projetoId: 'p',
  projetoNome: 'Projeto',
  equipe: 'STI',
  numero: 1,
  descricao: 'Ação',
  responsavel: null,
  status: StatusAcao.EM_CURSO_50,
  previstoTermino: null,
  realizadoTermino: null,
  ...over,
})

describe('montarResumo', () => {
  const hoje = d('2026-11-16')

  it('separa concluídas, atrasadas e as que vencem, por equipe', () => {
    const r = montarResumo(
      [
        base({ id: 'c1', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-12') }),
        base({ id: 'c-velha', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-01') }),
        base({ id: 'at', previstoTermino: d('2026-11-10') }),
        base({ id: 'v1', previstoTermino: d('2026-11-20') }),
        base({ id: 'v-longe', previstoTermino: d('2026-12-30') }),
        base({ id: 'g1', equipe: 'GIA', previstoTermino: d('2026-11-01') }),
      ],
      hoje,
      '2026-11-16',
    )
    expect(r.totais).toEqual({ concluidas: 1, atrasadas: 2, vencendo: 1 })
    const sti = r.equipes.find((e) => e.equipe === 'STI')!
    expect(sti.concluidas.itens.map((i) => i.acaoId)).toEqual(['c1'])
    expect(sti.atrasadas.itens.map((i) => i.acaoId)).toEqual(['at'])
    expect(sti.vencendo.itens.map((i) => i.acaoId)).toEqual(['v1'])
    expect(r.de).toBe('2026-11-09')
    expect(r.ate).toBe('2026-11-23')
  })

  it('a regra de atraso é a do painel: vence hoje não é atrasada; concluída nunca é', () => {
    const r = montarResumo(
      [
        base({ id: 'hoje', previstoTermino: d('2026-11-16') }),
        base({ id: 'conc', status: StatusAcao.CONCLUIDO, realizadoTermino: d('2026-11-14'), previstoTermino: d('2026-11-01') }),
      ],
      hoje,
      '2026-11-16',
    )
    expect(r.totais.atrasadas).toBe(0)
    expect(r.totais.vencendo).toBe(1)
  })

  it('concluída só pelo status usa o dia do histórico', () => {
    const r = montarResumo(
      [
        base({ id: 'dentro', status: StatusAcao.CONCLUIDO, concluidoEm: d('2026-11-13') }),
        base({ id: 'fora', status: StatusAcao.CONCLUIDO, concluidoEm: d('2026-10-01') }),
        base({ id: 'sem', status: StatusAcao.CONCLUIDO }),
      ],
      hoje,
      '2026-11-16',
    )
    expect(r.equipes[0].concluidas.itens.map((i) => i.acaoId)).toEqual(['dentro'])
  })

  it('guarda o total e só os 10 mais relevantes de cada bloco, na ordem certa', () => {
    const muitas = Array.from({ length: 14 }, (_, i) =>
      base({ id: `a${i}`, numero: i + 1, previstoTermino: new Date(d('2026-11-01').getTime() + i * 86_400_000) }),
    )
    const r = montarResumo(muitas, hoje, '2026-11-16')
    const { atrasadas } = r.equipes[0]
    expect(atrasadas.total).toBe(14)
    expect(atrasadas.itens).toHaveLength(MAXIMO_ITENS_POR_BLOCO)
    // As mais antigas primeiro, com os dias de atraso.
    expect(atrasadas.itens[0]).toMatchObject({ acaoId: 'a0', diasAtraso: 15 })
  })

  it('projeto sem equipe vira "Sem equipe"; equipe com mais atraso vem primeiro', () => {
    const r = montarResumo(
      [
        base({ id: 'x', equipe: null, previstoTermino: d('2026-11-01') }),
        base({ id: 'y', equipe: 'GRH', previstoTermino: d('2026-11-01') }),
        base({ id: 'z', equipe: 'GRH', previstoTermino: d('2026-11-02') }),
        base({ id: 'w', equipe: '  ', previstoTermino: d('2026-11-02') }),
      ],
      hoje,
      '2026-11-16',
    )
    expect(r.equipes.map((e) => e.equipe)).toEqual(['GRH', SEM_EQUIPE])
    expect(r.equipes[1].atrasadas.total).toBe(2)
  })

  it('ação sem previsto e equipe sem nada ficam de fora', () => {
    const r = montarResumo([base({ previstoTermino: null }), base({ equipe: 'GIA', previstoTermino: d('2027-03-01') })], hoje, '2026-11-16')
    expect(r.equipes).toEqual([])
    expect(resumoVazio(r)).toBe(true)
  })
})

describe('textos', () => {
  it('rotulo da semana vai da segunda ao domingo', () => {
    expect(rotuloDaSemana('2026-11-16')).toBe('Semana de 16/11 a 22/11')
    expect(rotuloDaSemana('2026-12-28')).toBe('Semana de 28/12 a 03/01')
  })
  it('frase principal, com singular e plural, e a de semana vazia', () => {
    expect(frasePrincipal({ totais: { concluidas: 1, atrasadas: 1, vencendo: 1 } })).toBe(
      '1 atrasada · 1 vence em 7 dias · 1 concluída',
    )
    expect(frasePrincipal({ totais: { concluidas: 9, atrasadas: 12, vencendo: 18 } })).toBe(
      '12 atrasadas · 18 vencem em 7 dias · 9 concluídas',
    )
    expect(frasePrincipal({ totais: { concluidas: 0, atrasadas: 0, vencendo: 0 } })).toContain('sem conclusões')
  })
  it('lerConteudo recusa o que não é um resumo', () => {
    expect(lerConteudo(null)).toBeNull()
    expect(lerConteudo('x')).toBeNull()
    expect(lerConteudo({ semana: '2026-11-16' })).toBeNull()
    const ok = montarResumo([], d('2026-11-16'), '2026-11-16')
    expect(lerConteudo(JSON.parse(JSON.stringify(ok)))).toEqual(ok)
  })
})
