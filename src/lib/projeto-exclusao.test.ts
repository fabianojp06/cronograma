import { describe, expect, it } from 'vitest'

import {
  confirmacaoValida,
  DADOS_EXCLUSAO_LOGICA,
  PALAVRA_CONFIRMACAO,
} from './projeto-exclusao'

function formData(campos: Record<string, string>) {
  const fd = new FormData()
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor)
  return fd
}

describe('confirmacaoValida', () => {
  it('aceita a palavra exata', () => {
    expect(confirmacaoValida(formData({ confirmacao: PALAVRA_CONFIRMACAO }))).toBe(true)
  })

  it('tolera espaços em volta e caixa diferente', () => {
    expect(confirmacaoValida(formData({ confirmacao: '  excluir ' }))).toBe(true)
  })

  it('recusa texto diferente', () => {
    expect(confirmacaoValida(formData({ confirmacao: 'excluirr' }))).toBe(false)
    expect(confirmacaoValida(formData({ confirmacao: '' }))).toBe(false)
  })

  it('recusa campo ausente', () => {
    expect(confirmacaoValida(formData({}))).toBe(false)
    expect(confirmacaoValida({})).toBe(false)
  })

  it('aceita objeto simples além de FormData', () => {
    expect(confirmacaoValida({ confirmacao: 'EXCLUIR' })).toBe(true)
  })
})

describe('DADOS_EXCLUSAO_LOGICA', () => {
  it('apenas desliga o campo ativo — nunca DELETE físico', () => {
    expect(DADOS_EXCLUSAO_LOGICA).toEqual({ ativo: false })
    expect(Object.keys(DADOS_EXCLUSAO_LOGICA)).toEqual(['ativo'])
  })
})

import { dadosDaExclusao, dadosDaRestauracao } from './projeto-exclusao'

describe('dados da exclusão e da restauração (lixeira)', () => {
  const agora = new Date('2026-11-21T12:00:00Z')
  it('excluir marca inativo, quando e quem, e apaga a restauração anterior', () => {
    expect(dadosDaExclusao('user_a', agora)).toEqual({
      ativo: false,
      excluidoEm: agora,
      excluidoPor: 'user_a',
      restauradoEm: null,
      restauradoPor: null,
    })
  })
  it('restaurar volta a ativo e registra quando e quem, sem tocar na exclusão', () => {
    expect(dadosDaRestauracao('user_b', agora)).toEqual({ ativo: true, restauradoEm: agora, restauradoPor: 'user_b' })
  })
})
