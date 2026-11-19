import { describe, expect, it } from 'vitest'

import { LIMITE_COMENTARIO, podeApagarComentario, validarComentario } from './comentario-validacao'

describe('validarComentario', () => {
  it('apara e aceita texto normal', () => {
    expect(validarComentario('  Aguardando o fornecedor  ')).toEqual({
      ok: true,
      texto: 'Aguardando o fornecedor',
    })
  })
  it('recusa vazio, só espaços e não-texto', () => {
    for (const entrada of ['', '   \n ', null, undefined, 42]) {
      expect(validarComentario(entrada).ok).toBe(false)
    }
  })
  it('aceita exatamente o limite e recusa um a mais', () => {
    expect(validarComentario('a'.repeat(LIMITE_COMENTARIO)).ok).toBe(true)
    const r = validarComentario('a'.repeat(LIMITE_COMENTARIO + 1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain(String(LIMITE_COMENTARIO + 1))
  })
  it('preserva quebras de linha internas', () => {
    expect(validarComentario('a\nb')).toEqual({ ok: true, texto: 'a\nb' })
  })
})

describe('podeApagarComentario', () => {
  it('o autor apaga o seu; outra pessoa não; administrador apaga qualquer um', () => {
    expect(podeApagarComentario('u1', 'u1', false)).toBe(true)
    expect(podeApagarComentario('u1', 'u2', false)).toBe(false)
    expect(podeApagarComentario('u1', 'u2', true)).toBe(true)
  })
})
