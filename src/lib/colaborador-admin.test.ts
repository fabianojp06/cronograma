import { describe, expect, it } from 'vitest'

import {
  lerAcaoAtivo,
  podeDesativar,
  projetosADivergir,
  projetosDaPessoa,
  validarRenomear,
} from './colaborador-admin'

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

describe('projetosDaPessoa e projetosADivergir', () => {
  const projetos = [
    { id: '1', responsavel: 'Fabiano José' },
    { id: '2', responsavel: 'Fabiano Jose' },
    { id: '3', responsavel: 'fabiano  josé' },
    { id: '4', responsavel: 'Márcia Gonçalves' },
    { id: '5', responsavel: null },
  ]

  it('acha todas as grafias da mesma pessoa', () => {
    // É o ponto da tela: a divergência que ela existe para curar é justamente
    // a que um `where` exato não enxerga.
    expect(projetosDaPessoa(projetos, 'Fabiano José').map((p) => p.id)).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('ignora responsável nulo', () => {
    expect(projetosDaPessoa(projetos, 'Ninguém')).toEqual([])
  })

  it('divergir exclui quem já está com a grafia certa', () => {
    expect(projetosADivergir(projetos, 'Fabiano José').map((p) => p.id)).toEqual([
      '2',
      '3',
    ])
  })

  it('não diverge nada quando todos já estão certos', () => {
    expect(projetosADivergir([{ id: '1', responsavel: 'Ana' }], 'Ana')).toEqual([])
  })
})

describe('lerAcaoAtivo', () => {
  it('aceita as duas intenções', () => {
    expect(lerAcaoAtivo('desativar')).toBe('desativar')
    expect(lerAcaoAtivo('reativar')).toBe('reativar')
  })

  it('recusa qualquer outra coisa', () => {
    expect(lerAcaoAtivo('apagar')).toBeNull()
    expect(lerAcaoAtivo('')).toBeNull()
    expect(lerAcaoAtivo(null)).toBeNull()
    expect(lerAcaoAtivo(1)).toBeNull()
  })
})
