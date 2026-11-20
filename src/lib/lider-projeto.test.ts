import { describe, expect, it } from 'vitest'

import { lerEscolhaLider, opcoesDoLider, resolverLider } from './lider-projeto'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

const lista = [
  { id: 'a', nome: 'Ana Silva', ativo: true },
  { id: 'b', nome: 'Bruno José', ativo: true },
  { id: 'i', nome: 'Inativo Antigo', ativo: false },
]

describe('lerEscolhaLider', () => {
  it('lê cada forma do select', () => {
    expect(lerEscolhaLider(fd({}))).toEqual({ tipo: 'ausente' })
    expect(lerEscolhaLider(fd({ lider: '' }))).toEqual({ tipo: 'nenhum' })
    expect(lerEscolhaLider(fd({ lider: 't' }))).toEqual({ tipo: 'manter' })
    expect(lerEscolhaLider(fd({ lider: 'c:abc' }))).toEqual({ tipo: 'colaborador', id: 'abc' })
    expect(lerEscolhaLider(fd({ lider: 'lixo' }))).toEqual({ tipo: 'nenhum' })
    expect(lerEscolhaLider(fd({ lider: 'c:' }))).toEqual({ tipo: 'nenhum' })
  })
})

describe('opcoesDoLider', () => {
  it('projeto novo: nada selecionado e só ativos', () => {
    const r = opcoesDoLider(lista, { liderId: null, responsavel: null })
    expect(r.selecionado).toBe('')
    expect(r.opcoes.map((o) => o.valor)).toEqual(['', 'c:a', 'c:b'])
  })
  it('com líder gravado, vem selecionado', () => {
    expect(opcoesDoLider(lista, { liderId: 'b', responsavel: 'qualquer' }).selecionado).toBe('c:b')
  })
  it('líder inativo continua na lista, marcado', () => {
    const r = opcoesDoLider(lista, { liderId: 'i', responsavel: 'Inativo Antigo' })
    expect(r.selecionado).toBe('c:i')
    expect(r.opcoes.find((o) => o.valor === 'c:i')?.rotulo).toBe('Inativo Antigo (inativo)')
  })
  it('texto antigo que casa sem acento nem caixa pré-seleciona o colaborador', () => {
    expect(opcoesDoLider(lista, { liderId: null, responsavel: 'bruno jose' }).selecionado).toBe('c:b')
  })
  it('texto antigo que não casa vira a opção "t"', () => {
    const r = opcoesDoLider(lista, { liderId: null, responsavel: 'Fulano de Fora' })
    expect(r.selecionado).toBe('t')
    expect(r.opcoes[1]).toEqual({ valor: 't', rotulo: 'Fulano de Fora (texto antigo, fora do cadastro)' })
  })
  it('nome parcial não casa', () => {
    expect(opcoesDoLider(lista, { liderId: null, responsavel: 'Ana' }).selecionado).toBe('t')
  })
})

describe('resolverLider', () => {
  it('ausente e manter não alteram', () => {
    expect(resolverLider({ tipo: 'ausente' }, null, null)).toEqual({ ok: true, alterar: false })
    expect(resolverLider({ tipo: 'manter' }, null, null)).toEqual({ ok: true, alterar: false })
  })
  it('nenhum limpa liderId e responsável', () => {
    expect(resolverLider({ tipo: 'nenhum' }, null, 'a')).toEqual({
      ok: true,
      alterar: true,
      liderId: null,
      responsavel: null,
    })
  })
  it('colaborador grava o id e copia o nome canônico', () => {
    expect(resolverLider({ tipo: 'colaborador', id: 'a' }, lista[0], null)).toEqual({
      ok: true,
      alterar: true,
      liderId: 'a',
      responsavel: 'Ana Silva',
    })
  })
  it('recusa inexistente ou inativo, exceto o líder já gravado', () => {
    expect(resolverLider({ tipo: 'colaborador', id: 'x' }, null, null)).toMatchObject({ ok: false })
    expect(resolverLider({ tipo: 'colaborador', id: 'i' }, lista[2], null)).toMatchObject({ ok: false })
    expect(resolverLider({ tipo: 'colaborador', id: 'i' }, lista[2], 'i')).toMatchObject({ ok: true })
  })
})
