import { describe, expect, it } from 'vitest'

import {
  DIAS_DE_RETENCAO,
  MAX_DETALHE,
  MAX_MENSAGEM,
  descreverErro,
  deveRegistrar,
  limiteDeRetencao,
} from './registro-erro'

describe('descreverErro', () => {
  it('separa mensagem e pilha de um Error', () => {
    const r = descreverErro(new TypeError('quebrou'))
    expect(r.mensagem).toBe('TypeError: quebrou')
    expect(r.detalhe).toContain('quebrou')
  })

  it('aceita texto e objetos soltos', () => {
    expect(descreverErro('só texto')).toEqual({ mensagem: 'só texto', detalhe: null })
    expect(descreverErro({ a: 1 }).mensagem).toBe('{"a":1}')
    expect(descreverErro(undefined).mensagem).toBe('undefined')
  })

  it('não estoura com objeto circular', () => {
    const circular: Record<string, unknown> = {}
    circular.eu = circular
    expect(() => descreverErro(circular)).not.toThrow()
  })

  it('trunca mensagem e detalhe longos', () => {
    const erro = new Error('x'.repeat(5000))
    erro.stack = 'y'.repeat(10000)
    const r = descreverErro(erro)
    expect(r.mensagem.length).toBeLessThanOrEqual(MAX_MENSAGEM)
    expect(r.detalhe!.length).toBeLessThanOrEqual(MAX_DETALHE)
  })
})

describe('deveRegistrar', () => {
  it('só em produção', () => {
    expect(deveRegistrar({ VERCEL_ENV: 'production' })).toBe(true)
    expect(deveRegistrar({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(deveRegistrar({})).toBe(false)
  })
})

describe('limiteDeRetencao', () => {
  it('fica 30 dias antes de agora', () => {
    const agora = new Date('2026-12-01T12:00:00.000Z')
    const limite = limiteDeRetencao(agora)
    expect((agora.getTime() - limite.getTime()) / 86_400_000).toBe(DIAS_DE_RETENCAO)
  })
})
