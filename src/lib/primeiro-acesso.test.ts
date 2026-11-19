import { describe, expect, it } from 'vitest'

import {
  caminhoSeguro,
  decidirPrimeiroAcesso,
  destinoDoPrimeiroAcesso,
  redirectSeguro,
} from './primeiro-acesso'

describe('decidirPrimeiroAcesso', () => {
  const base = { temColaborador: false, caminho: '/projetos/1', metodo: 'GET' }
  it('quem tem cadastro passa', () => {
    expect(decidirPrimeiroAcesso({ ...base, temColaborador: true })).toBe('permitir')
  })
  it('quem não tem é desviado em qualquer tela de navegação', () => {
    for (const caminho of ['/', '/projetos/1', '/dashboards', '/wins', '/meus-projetos']) {
      expect(decidirPrimeiroAcesso({ ...base, caminho })).toBe('exigir')
    }
    expect(decidirPrimeiroAcesso({ ...base, metodo: 'HEAD' })).toBe('exigir')
  })
  it('a própria tela, login, cadastro, negação e APIs nunca são desviados (sem laço)', () => {
    for (const caminho of ['/bem-vindo', '/bem-vindo/x', '/entrar', '/entrar/sso-callback', '/cadastrar', '/acesso-negado', '/api/saude', '/api/exportar/acoes']) {
      expect(decidirPrimeiroAcesso({ ...base, caminho })).toBe('permitir')
    }
  })
  it('caminho que só começa igual não é isento', () => {
    expect(decidirPrimeiroAcesso({ ...base, caminho: '/bem-vindos' })).toBe('exigir')
    expect(decidirPrimeiroAcesso({ ...base, caminho: '/apiario' })).toBe('exigir')
  })
  it('POST (Server Action) não é desviado', () => {
    expect(decidirPrimeiroAcesso({ ...base, metodo: 'POST' })).toBe('permitir')
  })
})

describe('caminhoSeguro', () => {
  it('aceita caminho relativo com consulta e âncora', () => {
    expect(caminhoSeguro('/projetos/abc?aba=prazos')).toBe('/projetos/abc?aba=prazos')
  })
  it('recusa endereço completo, //host, barra invertida e lixo', () => {
    for (const ruim of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'projetos/1', '', null, undefined, '/a\nb']) {
      expect(caminhoSeguro(ruim as string | null | undefined)).toBe('/')
    }
  })
  it('não volta para a própria tela de boas-vindas (laço)', () => {
    expect(caminhoSeguro('/bem-vindo')).toBe('/')
    expect(caminhoSeguro('/bem-vindo?volta=%2Fx')).toBe('/')
  })
})

describe('destinoDoPrimeiroAcesso', () => {
  it('leva o caminho (e a consulta) codificados', () => {
    expect(destinoDoPrimeiroAcesso('/projetos/1?aba=x')).toBe('/bem-vindo?volta=%2Fprojetos%2F1%3Faba%3Dx')
  })
  it('a raiz vai sem parâmetro', () => {
    expect(destinoDoPrimeiroAcesso('/')).toBe('/bem-vindo')
  })
})

describe('redirectSeguro', () => {
  const base = 'https://cronograma-lktu.vercel.app'
  it('aceita caminho relativo e endereço completo do próprio sistema (vira caminho)', () => {
    expect(redirectSeguro('/projetos/1', base)).toBe('/projetos/1')
    expect(redirectSeguro('https://cronograma-lktu.vercel.app/projetos/1?a=b', base)).toBe('/projetos/1?a=b')
  })
  it('descarta outro domínio, outro esquema e entradas vazias', () => {
    for (const ruim of ['https://evil.example/projetos/1', 'http://cronograma-lktu.vercel.app/x', '//evil.example', 'javascript:alert(1)', '', null]) {
      expect(redirectSeguro(ruim, base)).toBeNull()
    }
  })
  it('sem URL base conhecida, só caminho relativo vale', () => {
    expect(redirectSeguro('https://cronograma-lktu.vercel.app/x', null)).toBeNull()
    expect(redirectSeguro('/x', null)).toBe('/x')
  })
})
