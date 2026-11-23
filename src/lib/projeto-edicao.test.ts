import { describe, expect, it } from 'vitest'

import {
  CAMPOS_PROJETO,
  camposAlterados,
  lerIdProjeto,
  valoresIniciais,
} from './projeto-edicao'
import { CAMPOS_TEXTO_OPCIONAIS, type DadosProjeto } from './projeto-validacao'

const BASE: DadosProjeto = {
  nome: 'Modernização da rede',
  prioridade: 2,
  referencia: 'PLA-DEP-2026-014',
  equipe: 'STI',
  natureza: null,
  categoria: null,
  responsavel: 'Ana',
  apoio: null,
  setorEnvolvido: null,
  comentario: null,
}

describe('CAMPOS_PROJETO', () => {
  it('cobre todos os campos editáveis do Projeto', () => {
    expect(CAMPOS_PROJETO).toEqual(['nome', 'prioridade', ...CAMPOS_TEXTO_OPCIONAIS, 'cliente', 'objetivo'])
  })
})

describe('valoresIniciais', () => {
  it('converte null e prioridade numérica em string para o formulário', () => {
    const valores = valoresIniciais(BASE)
    expect(valores.nome).toBe('Modernização da rede')
    expect(valores.prioridade).toBe('2')
    expect(valores.natureza).toBe('')
    expect(valores.comentario).toBe('')
  })

  it('devolve string vazia para campo ausente', () => {
    expect(valoresIniciais({ nome: 'X' }).equipe).toBe('')
  })
})

describe('lerIdProjeto', () => {
  it('lê o id de um FormData', () => {
    const dados = new FormData()
    dados.set('id', ' abc123 ')
    expect(lerIdProjeto(dados)).toBe('abc123')
  })

  it('devolve null quando o id está ausente ou vazio', () => {
    expect(lerIdProjeto({})).toBeNull()
    expect(lerIdProjeto({ id: '   ' })).toBeNull()
  })
})

describe('camposAlterados', () => {
  it('devolve vazio quando nada mudou', () => {
    expect(camposAlterados(BASE, { ...BASE })).toEqual([])
  })

  it('aponta apenas os campos com valor diferente', () => {
    const novos = { ...BASE, responsavel: 'Bruno', prioridade: 1 }
    expect(camposAlterados(BASE, novos).sort()).toEqual(['prioridade', 'responsavel'])
  })

  it('trata campo ausente no banco como null (sem falso positivo)', () => {
    const semNatureza: Partial<DadosProjeto> = { ...BASE }
    delete semNatureza.natureza
    expect(camposAlterados(semNatureza, BASE)).toEqual([])
  })

  it('detecta preenchimento de um campo antes nulo', () => {
    expect(camposAlterados(BASE, { ...BASE, apoio: 'GIA' })).toEqual(['apoio'])
  })
})

describe('camposAlterados com cliente/objetivo', () => {
  it('campo ausente nos novos dados não conta como alteração', () => {
    const atual = { nome: 'P', cliente: 'Marinha', objetivo: 'X' } as Partial<DadosProjeto>
    const novos = { nome: 'P', prioridade: null } as DadosProjeto
    expect(camposAlterados({ ...atual, prioridade: null }, novos)).toEqual([])
  })

  it('mudar o cliente é alteração', () => {
    const novos = { nome: 'P', prioridade: null, cliente: 'Outro' } as DadosProjeto
    expect(camposAlterados({ nome: 'P', prioridade: null, cliente: 'Marinha' }, novos)).toEqual(['cliente'])
  })
})
