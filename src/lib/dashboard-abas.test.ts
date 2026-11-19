import { describe, expect, it } from 'vitest'

import {
  abaMostra,
  hrefDaAba,
  lerAba,
  listarAbas,
  resumoDeAtencao,
  slugDaAba,
} from './dashboard-abas'
import { GRUPOS_RELATORIO, RELATORIOS, ROTULO_GRUPO } from './dashboard-catalogo'

describe('lerAba', () => {
  it('lê o slug e cai no panorama quando falta ou é inválido', () => {
    expect(lerAba('prazos')).toBe('PRAZOS')
    expect(lerAba('todas')).toBe('TODAS')
    expect(lerAba(['wins', 'x'])).toBe('WINS')
    expect(lerAba(undefined)).toBe('PANORAMA')
    expect(lerAba('inexistente')).toBe('PANORAMA')
    expect(lerAba('PRAZOS')).toBe('PANORAMA') // o slug é minúsculo; não adivinha
  })
  it('todo grupo do catálogo tem aba (nenhum relatório fica inalcançável)', () => {
    for (const grupo of GRUPOS_RELATORIO) expect(lerAba(slugDaAba(grupo))).toBe(grupo)
  })
})

describe('abaMostra', () => {
  it('mostra a seção na própria aba e em "todas", e em nenhuma outra', () => {
    expect(abaMostra('PRAZOS', 'PRAZOS')).toBe(true)
    expect(abaMostra('TODAS', 'WINS')).toBe(true)
    expect(abaMostra('PRAZOS', 'WINS')).toBe(false)
  })
})

describe('listarAbas', () => {
  const abas = listarAbas(ROTULO_GRUPO)
  it('termina em "Todas" com o total de relatórios do catálogo', () => {
    expect(abas.at(-1)).toMatchObject({ aba: 'TODAS', rotulo: 'Todas', relatorios: RELATORIOS.length })
  })
  it('as contagens somam o catálogo, sem relatório órfão', () => {
    const soma = abas.filter((a) => a.aba !== 'TODAS').reduce((s, a) => s + a.relatorios, 0)
    expect(soma).toBe(RELATORIOS.length)
  })
})

describe('hrefDaAba', () => {
  it('mantém filtros e período, troca a aba e omite a padrão', () => {
    expect(hrefDaAba('PRAZOS', { equipe: 'STI', de: '2026-03-01' })).toBe(
      '/dashboards?equipe=STI&de=2026-03-01&aba=prazos',
    )
    expect(hrefDaAba('PANORAMA', { equipe: 'STI', aba: 'prazos' })).toBe('/dashboards?equipe=STI')
    expect(hrefDaAba('PANORAMA', {})).toBe('/dashboards')
  })
  it('acrescenta a âncora e descarta a página', () => {
    expect(hrefDaAba('QUALIDADE', { pagina: '3' }, 'higiene-dados')).toBe(
      '/dashboards?aba=qualidade#higiene-dados',
    )
  })
})

describe('resumoDeAtencao', () => {
  const base = { acoesAtrasadas: 0, vencendoEm7Dias: 0, projetosSemAcoes: 0, winsParaPromover: 0, replanejamentos: 0 }
  it('devolve os cinco itens, cada um apontando para uma aba e seção do catálogo', () => {
    const itens = resumoDeAtencao(base)
    expect(itens).toHaveLength(5)
    const ids = new Set(RELATORIOS.map((r) => r.id))
    for (const item of itens) {
      expect(ids.has(item.ancora), `âncora ${item.ancora} fora do catálogo`).toBe(true)
      const relatorio = RELATORIOS.find((r) => r.id === item.ancora)!
      expect(relatorio.grupo).toBe(item.aba)
    }
  })
  it('zero é neutro (boa notícia); acima de zero pede ação nos itens que são problema', () => {
    expect(resumoDeAtencao(base).every((i) => i.tom === 'neutro')).toBe(true)
    const alto = resumoDeAtencao({ ...base, acoesAtrasadas: 4, projetosSemAcoes: 1, winsParaPromover: 2 })
    expect(alto.filter((i) => i.tom === 'alerta').map((i) => i.id)).toEqual(['atrasadas', 'sem-acoes', 'wins'])
  })
  it('vencendo e replanejamentos são informação, nunca alerta', () => {
    const itens = resumoDeAtencao({ ...base, vencendoEm7Dias: 9, replanejamentos: 12 })
    expect(itens.find((i) => i.id === 'vencendo')?.tom).toBe('neutro')
    expect(itens.find((i) => i.id === 'replanejamentos')?.tom).toBe('neutro')
  })
})
