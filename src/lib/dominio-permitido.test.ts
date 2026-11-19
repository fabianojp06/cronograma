import { describe, expect, it } from 'vitest'

import {
  contaAutorizada,
  decidirAcesso,
  emailNoDominio,
  lerExcecoes,
} from './dominio-permitido'

describe('emailNoDominio', () => {
  it('aceita o domínio exato, sem diferenciar caixa nem espaços nas pontas', () => {
    expect(emailNoDominio('ana@ctcea.org.br')).toBe(true)
    expect(emailNoDominio('  Ana.Souza@CTCEA.ORG.BR ')).toBe(true)
  })

  it('recusa outros domínios, subdomínios e parecidos', () => {
    for (const e of [
      'ana@gmail.com',
      'ana@sub.ctcea.org.br',
      'ana@meuctcea.org.br',
      'ana@ctcea.org.br.outro.com',
      'ana@ctcea.org',
      'ana@ctcea.com.br',
    ]) {
      expect(emailNoDominio(e), e).toBe(false)
    }
  })

  it('recusa formas malformadas que tentam enganar a comparação', () => {
    for (const e of ['', '@ctcea.org.br', 'ctcea.org.br', 'a@b@ctcea.org.br', 'a b@ctcea.org.br', 'ana@ctcea.org.br\n@x.com']) {
      expect(emailNoDominio(e), JSON.stringify(e)).toBe(false)
    }
  })
})

describe('contaAutorizada', () => {
  it('exige e-mail principal verificado e do domínio', () => {
    expect(contaAutorizada({ endereco: 'ana@ctcea.org.br', verificado: true })).toBe(true)
    expect(contaAutorizada({ endereco: 'ana@ctcea.org.br', verificado: false })).toBe(false)
    expect(contaAutorizada({ endereco: 'ana@gmail.com', verificado: true })).toBe(false)
    expect(contaAutorizada(null)).toBe(false)
  })

  it('exceção por endereço só vale com o e-mail verificado e exatamente igual', () => {
    const excecoes = lerExcecoes(' Dono@Gmail.com , , outro@x.com ')
    expect(excecoes).toEqual(['dono@gmail.com', 'outro@x.com'])
    expect(contaAutorizada({ endereco: 'DONO@gmail.com', verificado: true }, excecoes)).toBe(true)
    expect(contaAutorizada({ endereco: 'dono@gmail.com', verificado: false }, excecoes)).toBe(false)
    expect(contaAutorizada({ endereco: 'intruso@gmail.com', verificado: true }, excecoes)).toBe(false)
    expect(lerExcecoes(undefined)).toEqual([])
  })
})

describe('decidirAcesso', () => {
  it('permite a conta autorizada', () => {
    expect(decidirAcesso('autorizada', '/projetos/1')).toEqual({ tipo: 'permitir' })
  })

  it('nega página com redirecionamento e API com 403, e a falha de checagem também nega', () => {
    expect(decidirAcesso('dominio', '/projetos/1')).toEqual({ tipo: 'negar-pagina', motivo: 'dominio' })
    expect(decidirAcesso('dominio', '/api/exportar/acoes')).toEqual({ tipo: 'negar-api', motivo: 'dominio' })
    expect(decidirAcesso('verificacao', '/')).toEqual({ tipo: 'negar-pagina', motivo: 'verificacao' })
    expect(decidirAcesso('verificacao', '/api')).toEqual({ tipo: 'negar-api', motivo: 'verificacao' })
  })
})
