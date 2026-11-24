import { describe, expect, it } from 'vitest'

import { MAXIMO_MACROETAPAS, editorAberto, podeCriarMais, validarDescricaoMacroetapa, validarNomeMacroetapa } from './macroetapa'

const existentes = [
  { id: 'a', nome: 'Homologação' },
  { id: 'b', nome: 'Entrega' },
]

describe('validarNomeMacroetapa', () => {
  it('apara o nome e aceita um nome novo', () => {
    expect(validarNomeMacroetapa('  Planejamento ', existentes)).toEqual({ ok: true, nome: 'Planejamento' })
  })
  it('recusa conflito sem acento nem caixa', () => {
    expect(validarNomeMacroetapa('homologacao', existentes).ok).toBe(false)
  })
  it('recusa vazio e mais de 80 caracteres; aceita exatamente 80', () => {
    expect(validarNomeMacroetapa('   ', existentes).ok).toBe(false)
    expect(validarNomeMacroetapa('x'.repeat(81), existentes).ok).toBe(false)
    expect(validarNomeMacroetapa('x'.repeat(80), existentes).ok).toBe(true)
  })
  it('permite trocar só acento ou caixa do PRÓPRIO nome, mas não o de outro', () => {
    expect(validarNomeMacroetapa('homologacao', existentes, 'a')).toEqual({ ok: true, nome: 'homologacao' })
    expect(validarNomeMacroetapa('entrega', existentes, 'a').ok).toBe(false)
  })
})

describe('podeCriarMais', () => {
  it('vale até o máximo de 12', () => {
    expect(MAXIMO_MACROETAPAS).toBe(12)
    expect(podeCriarMais(11)).toBe(true)
    expect(podeCriarMais(12)).toBe(false)
  })
})

describe('editorAberto', () => {
  const inicial = {} as { ok?: boolean }
  it('fechado quando não foi aberto', () => {
    expect(editorAberto(null, inicial)).toBe(false)
  })
  it('aberto enquanto não há resposta nova', () => {
    expect(editorAberto(inicial, inicial)).toBe(true)
  })
  it('fecha depois de salvar com sucesso', () => {
    expect(editorAberto(inicial, { ok: true })).toBe(false)
  })
  it('continua aberto depois de erro', () => {
    expect(editorAberto(inicial, { ok: false })).toBe(true)
  })
  it('a segunda abertura funciona, mesmo com o estado anterior em sucesso', () => {
    const salvo = { ok: true }
    expect(editorAberto(salvo, salvo)).toBe(true)
    expect(editorAberto(salvo, { ok: true })).toBe(false)
  })
})

describe('validarDescricaoMacroetapa', () => {
  it('campo ausente (null) não muda nada', () => {
    expect(validarDescricaoMacroetapa(null)).toEqual({ ok: true, descricao: undefined })
  })
  it('vazio ou só espaços remove (null)', () => {
    expect(validarDescricaoMacroetapa('')).toEqual({ ok: true, descricao: null })
    expect(validarDescricaoMacroetapa('  \n ')).toEqual({ ok: true, descricao: null })
  })
  it('apara e preserva quebras de linha internas', () => {
    expect(validarDescricaoMacroetapa('  linha 1\nlinha 2 ')).toEqual({ ok: true, descricao: 'linha 1\nlinha 2' })
  })
  it('aceita 500 caracteres e recusa 501', () => {
    expect(validarDescricaoMacroetapa('x'.repeat(500)).ok).toBe(true)
    const r = validarDescricaoMacroetapa('x'.repeat(501))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/500/)
  })
})
