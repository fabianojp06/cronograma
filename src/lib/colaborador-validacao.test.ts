import { describe, expect, it } from 'vitest'

import {
  chaveDoNome,
  encontrarPorNome,
  normalizarNome,
  validarNomeColaborador,
} from './colaborador-validacao'

describe('validarNomeColaborador', () => {
  it('aceita um nome comum e devolve com os espaços normalizados', () => {
    expect(validarNomeColaborador('  Fabiano   José  ')).toEqual({
      ok: true,
      nome: 'Fabiano José',
    })
  })

  it('preserva acento e caixa — é o nome que vai para o plano de ação', () => {
    expect(validarNomeColaborador('Márcia Gonçalves')).toEqual({
      ok: true,
      nome: 'Márcia Gonçalves',
    })
  })

  it.each([
    ['', 'VAZIO'],
    ['   ', 'VAZIO'],
    ['A', 'CURTO'],
    ['123', 'SEM_LETRA'],
    ['-- --', 'SEM_LETRA'],
  ])('recusa %j com o erro %s', (entrada, erro) => {
    expect(validarNomeColaborador(entrada)).toEqual({ ok: false, erro })
  })

  it('recusa nome longo demais', () => {
    expect(validarNomeColaborador('a'.repeat(121))).toEqual({ ok: false, erro: 'LONGO' })
  })

  it('recusa o que não é string', () => {
    expect(validarNomeColaborador(null)).toEqual({ ok: false, erro: 'VAZIO' })
    expect(validarNomeColaborador(42)).toEqual({ ok: false, erro: 'VAZIO' })
  })
})

describe('normalizarNome', () => {
  it('colapsa espaços internos e corta as pontas', () => {
    expect(normalizarNome(' João   da  Silva ')).toBe('João da Silva')
  })
})

describe('chaveDoNome', () => {
  // A chave existe para reconhecer a pessoa que o importador já cadastrou.
  // Sem ela, quem digitasse "fabiano jose" esbarraria no índice único de
  // `nome` com uma mensagem que não explica nada.
  it('reconhece a mesma pessoa apesar de acento, caixa e espaço', () => {
    expect(chaveDoNome('fabiano  jose')).toBe(chaveDoNome('Fabiano José'))
  })

  it('não confunde pessoas diferentes', () => {
    expect(chaveDoNome('Fabiano José')).not.toBe(chaveDoNome('Fabiano Júnior'))
  })
})

describe('encontrarPorNome', () => {
  const cadastrados = [
    { id: 'a', nome: 'Fabiano José' },
    { id: 'b', nome: 'Márcia Gonçalves' },
  ]

  it('acha a pessoa mesmo com grafia diferente', () => {
    // O cenário real: alguém se cadastra sem acento num banco zerado, e depois
    // a planilha chega com a grafia certa.
    expect(encontrarPorNome(cadastrados, 'fabiano  jose')?.id).toBe('a')
    expect(encontrarPorNome(cadastrados, 'MARCIA GONCALVES')?.id).toBe('b')
  })

  it('devolve undefined para quem não está cadastrado', () => {
    expect(encontrarPorNome(cadastrados, 'Outra Pessoa')).toBeUndefined()
  })

  it('não confunde nomes parecidos', () => {
    expect(encontrarPorNome(cadastrados, 'Fabiano Júnior')).toBeUndefined()
  })

  it('aguenta lista vazia', () => {
    expect(encontrarPorNome([], 'Qualquer Um')).toBeUndefined()
  })
})
