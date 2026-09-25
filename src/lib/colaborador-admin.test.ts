import { describe, expect, it } from 'vitest'

import { podeDesativar, validarRenomear } from './colaborador-admin'

const cadastrados = [
  { id: 'a', nome: 'Fabiano José' },
  { id: 'b', nome: 'Márcia Gonçalves' },
]

describe('validarRenomear', () => {
  it('aceita um nome novo e livre', () => {
    expect(validarRenomear(cadastrados, 'a', 'Fabiano J. Pereira')).toEqual({
      ok: true,
      nome: 'Fabiano J. Pereira',
      mudou: true,
    })
  })

  it('permite corrigir acento e caixa do próprio nome', () => {
    // É a correção que esta tela existe para fazer: quem se cadastrou sem
    // acento precisa poder arrumar.
    expect(validarRenomear(cadastrados, 'a', 'fabiano jose')).toEqual({
      ok: true,
      nome: 'fabiano jose',
      mudou: true,
    })
  })

  it('avisa quando o nome não mudou de fato', () => {
    const r = validarRenomear(cadastrados, 'a', '  Fabiano   José ')
    expect(r).toEqual({ ok: true, nome: 'Fabiano José', mudou: false })
  })

  it('recusa nome que colide com outro, mesmo com acento diferente', () => {
    // Igualdade exata deixaria passar "Marcia Goncalves" ao lado de "Márcia
    // Gonçalves" — duas pessoas no relatório por responsável.
    expect(validarRenomear(cadastrados, 'a', 'marcia goncalves')).toEqual({
      ok: false,
      erro: 'NOME_EM_USO',
    })
  })

  it('recusa nome inválido', () => {
    expect(validarRenomear(cadastrados, 'a', '  ')).toEqual({
      ok: false,
      erro: 'NOME_INVALIDO',
    })
    expect(validarRenomear(cadastrados, 'a', '123')).toEqual({
      ok: false,
      erro: 'NOME_INVALIDO',
    })
  })

  it('recusa id que não existe', () => {
    expect(validarRenomear(cadastrados, 'z', 'Qualquer Nome')).toEqual({
      ok: false,
      erro: 'NAO_ENCONTRADO',
    })
  })
})

describe('podeDesativar', () => {
  it('recusa desativar a si mesmo', () => {
    expect(podeDesativar('a', 'a')).toEqual({ ok: false, erro: 'AUTO_DESATIVACAO' })
  })

  it('permite desativar outra pessoa', () => {
    expect(podeDesativar('b', 'a')).toEqual({ ok: true })
  })

  it('permite quando quem pede não está vinculado', () => {
    expect(podeDesativar('a', null)).toEqual({ ok: true })
  })
})
