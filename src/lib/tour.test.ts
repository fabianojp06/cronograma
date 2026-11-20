import { describe, expect, it } from 'vitest'

import { MENU, MENU_ADMIN, alvoDoMenu } from './menu'
import { PASSOS_TOUR, passosDoTour, posicionarBalao } from './tour'

describe('passos do tour', () => {
  it('cada item do menu tem o seu passo', () => {
    const alvos = new Set(PASSOS_TOUR.map((p) => p.alvo))
    for (const item of MENU) expect(alvos, `falta passo do menu ${item.href}`).toContain(alvoDoMenu(item.href))
  })

  it('alvos são únicos, e todo passo tem título e texto', () => {
    const alvos = PASSOS_TOUR.map((p) => p.alvo).filter((a) => a !== null)
    expect(new Set(alvos).size).toBe(alvos.length)
    for (const p of PASSOS_TOUR) {
      expect(p.titulo.length).toBeGreaterThan(0)
      expect(p.texto.length).toBeGreaterThan(10)
    }
  })

  it('o passo da administração existe e só aparece para administrador', () => {
    expect(MENU_ADMIN.length).toBeGreaterThan(0)
    const admin = passosDoTour(true).find((p) => p.alvo === 'administracao')
    expect(admin?.somenteAdmin).toBe(true)
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
