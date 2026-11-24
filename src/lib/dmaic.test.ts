import { describe, expect, it } from 'vitest'

import {
  FASES_DMAIC,
  alertasDeFaseForaDeOrdem,
  faseDmaicDoNome,
  faseAtualDmaic,
  fasesDmaicQueFaltam,
} from './dmaic'

const linha = (nome: string, realizado: number | null) => ({
  nome,
  avanco: realizado === null ? null : { realizado },
})

describe('FASES_DMAIC', () => {
  it('são cinco, na ordem D-M-A-I-C, com nome único e descrição', () => {
    expect(FASES_DMAIC.map((f) => f.nome)).toEqual([
      'D – Definir',
      'M – Medir',
      'A – Analisar',
      'I – Melhorar',
      'C – Controlar',
    ])
    for (const f of FASES_DMAIC) expect(f.descricao.length).toBeGreaterThan(40)
    expect(f500(FASES_DMAIC.map((f) => f.descricao))).toBe(true)
  })
})
const f500 = (ds: string[]) => ds.every((d) => d.length <= 500)

describe('faseDmaicDoNome', () => {
  it('reconhece sem acento, caixa nem espaço repetido', () => {
    expect(faseDmaicDoNome('d – definir')?.sigla).toBe('D')
    expect(faseDmaicDoNome('I – Melhorar')?.sigla).toBe('I')
    expect(faseDmaicDoNome('  C  –  CONTROLAR ')?.sigla).toBe('C')
  })
  it('nome comum não é fase', () => {
    expect(faseDmaicDoNome('Homologação')).toBeNull()
    expect(faseDmaicDoNome('Definir')).toBeNull()
  })
})

describe('fasesDmaicQueFaltam', () => {
  it('projeto vazio: as cinco', () => {
    expect(fasesDmaicQueFaltam([])).toHaveLength(5)
  })
  it('pula a que já existe (mesmo escrita diferente) e mantém a ordem', () => {
    const faltam = fasesDmaicQueFaltam([{ nome: 'm – medir' }, { nome: 'Outra' }])
    expect(faltam.map((f) => f.sigla)).toEqual(['D', 'A', 'I', 'C'])
  })
  it('todas presentes: nenhuma', () => {
    expect(fasesDmaicQueFaltam(FASES_DMAIC.map((f) => ({ nome: f.nome })))).toEqual([])
  })
})

describe('faseAtualDmaic', () => {
  it('sem macroetapas DMAIC: null', () => {
    expect(faseAtualDmaic([linha('Homologação', 10)])).toBeNull()
  })
  it('é a primeira fase DMAIC com ações e realizado abaixo de 100', () => {
    const l = [linha('D – Definir', 100), linha('M – Medir', 100), linha('A – Analisar', 40), linha('I – Melhorar', 0)]
    expect(faseAtualDmaic(l)).toEqual({ nome: 'A – Analisar', concluidas: false })
  })
  it('usa a ordem do DMAIC, não a da lista', () => {
    const l = [linha('I – Melhorar', 0), linha('D – Definir', 100), linha('M – Medir', 60)]
    expect(faseAtualDmaic(l)?.nome).toBe('M – Medir')
  })
  it('fase sem ações é ignorada', () => {
    const l = [linha('D – Definir', null), linha('M – Medir', 20)]
    expect(faseAtualDmaic(l)?.nome).toBe('M – Medir')
  })
  it('todas em 100: concluídas', () => {
    const l = FASES_DMAIC.map((f) => linha(f.nome, 100))
    expect(faseAtualDmaic(l)).toEqual({ nome: 'C – Controlar', concluidas: true })
  })
  it('nenhuma fase com ações: null', () => {
    expect(faseAtualDmaic([linha('D – Definir', null)])).toBeNull()
  })
})

describe('alertasDeFaseForaDeOrdem', () => {
  it('fase posterior com avanço e anterior em 0%: um alerta', () => {
    const l = [linha('D – Definir', 100), linha('A – Analisar', 0), linha('I – Melhorar', 30)]
    expect(alertasDeFaseForaDeOrdem(l)).toEqual([
      'I – Melhorar já tem avanço, mas A – Analisar ainda está em 0%.',
    ])
  })
  it('anterior parcial (não zerada) não alerta: sobreposição é normal', () => {
    const l = [linha('A – Analisar', 10), linha('I – Melhorar', 30)]
    expect(alertasDeFaseForaDeOrdem(l)).toEqual([])
  })
  it('fase sem ações não conta como zerada', () => {
    const l = [linha('A – Analisar', null), linha('I – Melhorar', 30)]
    expect(alertasDeFaseForaDeOrdem(l)).toEqual([])
  })
  it('cita a primeira fase posterior com avanço, uma vez por fase zerada', () => {
    const l = [linha('D – Definir', 0), linha('M – Medir', 5), linha('A – Analisar', 0), linha('C – Controlar', 9)]
    expect(alertasDeFaseForaDeOrdem(l)).toEqual([
      'M – Medir já tem avanço, mas D – Definir ainda está em 0%.',
      'C – Controlar já tem avanço, mas A – Analisar ainda está em 0%.',
    ])
  })
  it('sem fases DMAIC: nada', () => {
    expect(alertasDeFaseForaDeOrdem([linha('Obra', 0), linha('Entrega', 50)])).toEqual([])
  })
})
