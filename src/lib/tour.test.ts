import { describe, expect, it } from 'vitest'

import { GRUPO_ADMINISTRACAO, GRUPOS_DO_MENU, alvoDoGrupo, alvoDoMenu } from './menu'
import { PASSOS_TOUR, passosDoTour, posicionarBalao } from './tour'

describe('passos do tour', () => {
  it('o Painel e cada grupo do menu têm o seu passo, e a Administração só para o administrador', () => {
    const alvos = new Set(PASSOS_TOUR.map((p) => p.alvo))
    expect(alvos).toContain(alvoDoMenu('/'))
    for (const g of GRUPOS_DO_MENU) expect(alvos, `falta passo do grupo ${g.id}`).toContain(alvoDoGrupo(g.id))
    const admin = PASSOS_TOUR.find((p) => p.alvo === alvoDoGrupo(GRUPO_ADMINISTRACAO.id))
    expect(admin?.somenteAdmin).toBe(true)
  })

  it('o menu de ajuda e o sino também têm passo', () => {
    const alvos = PASSOS_TOUR.map((p) => p.alvo)
    expect(alvos).toContain('ajuda')
    expect(alvos).toContain('sino')
  })

  it('alvos são únicos, e todo passo tem título e texto', () => {
    const alvos = PASSOS_TOUR.map((p) => p.alvo).filter((a) => a !== null)
    expect(new Set(alvos).size).toBe(alvos.length)
    for (const p of PASSOS_TOUR) {
      expect(p.titulo.length).toBeGreaterThan(0)
      expect(p.texto.length).toBeGreaterThan(10)
    }
  })

  it('quem não administra não vê o passo de administração', () => {
    expect(passosDoTour(false).some((p) => p.somenteAdmin)).toBe(false)
    expect(passosDoTour(true).length).toBe(passosDoTour(false).length + 1)
  })

  it('começa por uma boas-vindas sem alvo', () => {
    expect(PASSOS_TOUR[0].alvo).toBeNull()
  })
})

describe('alvoDoMenu', () => {
  it('gera ids estáveis', () => {
    expect(alvoDoMenu('/')).toBe('menu-painel')
    expect(alvoDoMenu('/wins/equipe')).toBe('menu-wins-equipe')
  })
})

describe('posicionarBalao', () => {
  const tela = { largura: 1000, altura: 700 }
  const balao = { largura: 320, altura: 180 }
  it('centraliza sem alvo', () => {
    expect(posicionarBalao(null, tela, balao)).toEqual({ top: 260, left: 340 })
  })
  it('fica abaixo do alvo quando cabe', () => {
    const r = posicionarBalao({ top: 10, left: 100, width: 80, height: 30 }, tela, balao)
    expect(r).toEqual({ top: 52, left: 100 })
  })
  it('sobe quando não cabe abaixo', () => {
    const r = posicionarBalao({ top: 600, left: 100, width: 80, height: 30 }, tela, balao)
    expect(r.top).toBe(600 - 180 - 12)
  })
  it('não sai pela direita', () => {
    const r = posicionarBalao({ top: 10, left: 950, width: 40, height: 30 }, tela, balao)
    expect(r.left).toBe(1000 - 320 - 12)
  })
})
