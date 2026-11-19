import { describe, expect, it } from 'vitest'

import { destinatariosDoComentario, lerMarcados, trechoDoComentario } from './notificacao'

const ativos = new Set(['ana', 'bruno', 'carla'])
const base = { autorId: 'ana', responsavelId: null, marcados: [], ativos }

describe('destinatariosDoComentario', () => {
  it('avisa o responsável sempre, com o motivo RESPONSAVEL', () => {
    expect(destinatariosDoComentario({ ...base, responsavelId: 'bruno' })).toEqual([
      { colaboradorId: 'bruno', motivo: 'RESPONSAVEL' },
    ])
  })
  it('avisa os marcados', () => {
    expect(destinatariosDoComentario({ ...base, marcados: ['bruno', 'carla'] })).toEqual([
      { colaboradorId: 'bruno', motivo: 'MARCADO' },
      { colaboradorId: 'carla', motivo: 'MARCADO' },
    ])
  })
  it('quem é marcado e responsável recebe uma só, como MARCADO', () => {
    expect(
      destinatariosDoComentario({ ...base, responsavelId: 'bruno', marcados: ['bruno'] }),
    ).toEqual([{ colaboradorId: 'bruno', motivo: 'MARCADO' }])
  })
  it('ninguém é avisado do próprio comentário', () => {
    expect(
      destinatariosDoComentario({ ...base, responsavelId: 'ana', marcados: ['ana', 'bruno'] }),
    ).toEqual([{ colaboradorId: 'bruno', motivo: 'MARCADO' }])
  })
  it('colaborador inativo ou desconhecido não recebe', () => {
    expect(
      destinatariosDoComentario({ ...base, responsavelId: 'inativo', marcados: ['fantasma'] }),
    ).toEqual([])
  })
  it('conta sem cadastro comenta e avisa normalmente', () => {
    expect(
      destinatariosDoComentario({ ...base, autorId: null, responsavelId: 'bruno' }),
    ).toHaveLength(1)
  })
})

describe('lerMarcados', () => {
  it('junta os campos repetidos, sem vazios nem duplicatas', () => {
    const f = new FormData()
    for (const v of ['a', ' b ', '', 'a']) f.append('avisar', v)
    expect(lerMarcados(f)).toEqual(['a', 'b'])
  })
  it('sem o campo, lista vazia', () => {
    expect(lerMarcados(new FormData())).toEqual([])
  })
})

describe('trechoDoComentario', () => {
  it('não corta texto curto e normaliza quebras de linha', () => {
    expect(trechoDoComentario('oi\n\n  tudo bem')).toBe('oi tudo bem')
  })
  it('corta em palavra e acrescenta reticências', () => {
    const t = trechoDoComentario('palavra '.repeat(50), 40)
    expect(t.endsWith('…')).toBe(true)
    expect(t.length).toBeLessThanOrEqual(41)
    expect(t).not.toMatch(/palav…$/)
  })
})
