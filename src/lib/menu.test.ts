import { describe, expect, it } from 'vitest'

import {
  GRUPO_ADMINISTRACAO,
  GRUPOS_DO_MENU,
  MENU,
  MENU_ADMIN,
  PAINEL,
  alvoDoGrupo,
  grupoAtivo,
  itemAtivo,
} from './menu'

const todos = [...GRUPOS_DO_MENU, GRUPO_ADMINISTRACAO]

describe('grupos do menu', () => {
  it('são poucos e nenhum fica vazio; os endereços não se repetem', () => {
    expect(GRUPOS_DO_MENU.length).toBeLessThanOrEqual(4)
    for (const g of todos) expect(g.itens.length, g.id).toBeGreaterThan(0)
    const hrefs = [PAINEL.href, ...todos.flatMap((g) => g.itens.map((i) => i.href))]
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('o menu em linha (usado por manual e testes) tem o Painel e todos os itens dos grupos de trabalho', () => {
    expect(MENU[0]).toEqual(PAINEL)
    expect(MENU.map((i) => i.href)).toEqual([PAINEL.href, ...GRUPOS_DO_MENU.flatMap((g) => g.itens.map((i) => i.href))])
  })

  it('a Administração traz a visão geral e todas as ferramentas', () => {
    expect(GRUPO_ADMINISTRACAO.itens.map((i) => i.href)).toEqual(['/administracao', ...MENU_ADMIN.map((i) => i.href)])
  })

  it('ids de grupo geram alvos de tour distintos', () => {
    const alvos = todos.map((g) => alvoDoGrupo(g.id))
    expect(new Set(alvos).size).toBe(alvos.length)
  })
})

describe('item e grupo ativos', () => {
  it('a raiz só vale na raiz; o resto, pelo prefixo', () => {
    expect(itemAtivo('/', todos)?.href).toBe('/')
    expect(itemAtivo('/projetos', todos)?.href).toBe('/projetos')
    expect(itemAtivo('/projetos/abc/acoes/xyz/editar', todos)?.href).toBe('/projetos')
    expect(itemAtivo('/coisa-nova', todos)).toBeNull()
  })
  it('vence o endereço mais longo: pesos da priorização são da Administração', () => {
    expect(itemAtivo('/priorizacao', todos)?.href).toBe('/priorizacao')
    expect(itemAtivo('/priorizacao/abc', todos)?.href).toBe('/priorizacao')
    expect(itemAtivo('/priorizacao/pesos', todos)?.href).toBe('/priorizacao/pesos')
    expect(itemAtivo('/wins/equipe', todos)?.href).toBe('/wins/equipe')
    expect(itemAtivo('/wins', todos)?.href).toBe('/wins')
  })
  it('o grupo ativo é o do item da página', () => {
    expect(grupoAtivo('/projetos/x', todos)).toBe('trabalho')
    expect(grupoAtivo('/minhas-acoes', todos)).toBe('pessoas')
    expect(grupoAtivo('/reuniao', todos)).toBe('analise')
    expect(grupoAtivo('/priorizacao/pesos', todos)).toBe('administracao')
    expect(grupoAtivo('/', todos)).toBeNull() // o Painel não é de nenhum grupo
    expect(grupoAtivo('/manual', todos)).toBeNull()
  })
})
