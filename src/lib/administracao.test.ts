import { describe, expect, it } from 'vitest'

import {
  podeAdministrar,
  podeDeixarDeSerAdministrador,
  semAdministradores,
} from './administracao'

describe('podeAdministrar', () => {
  it('sem nenhum administrador, qualquer conta pode', () => {
    expect(podeAdministrar({ totalAdministradores: 0, eAdministrador: false })).toBe(true)
  })

  it('com administradores, só eles', () => {
    expect(podeAdministrar({ totalAdministradores: 2, eAdministrador: true })).toBe(true)
    expect(podeAdministrar({ totalAdministradores: 2, eAdministrador: false })).toBe(false)
  })

  it('semAdministradores só vale com zero', () => {
    expect(semAdministradores({ totalAdministradores: 0, eAdministrador: false })).toBe(true)
    expect(semAdministradores({ totalAdministradores: 1, eAdministrador: true })).toBe(false)
  })
})

describe('podeDeixarDeSerAdministrador', () => {
  it('bloqueia o último administrador ativo', () => {
    expect(podeDeixarDeSerAdministrador({ administrador: true, ativo: true }, 1)).toEqual({
      ok: false,
      erro: 'ULTIMO_ADMINISTRADOR',
    })
  })

  it('libera quando há outro administrador', () => {
    expect(podeDeixarDeSerAdministrador({ administrador: true, ativo: true }, 2)).toEqual({
      ok: true,
    })
  })

  it('quem não é administrador não é afetado', () => {
    expect(podeDeixarDeSerAdministrador({ administrador: false, ativo: true }, 1)).toEqual({
      ok: true,
    })
  })

  it('administrador já inativo não conta como o último', () => {
    expect(podeDeixarDeSerAdministrador({ administrador: true, ativo: false }, 1)).toEqual({
      ok: true,
    })
  })
})
