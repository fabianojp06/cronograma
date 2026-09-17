import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createRouteMatcher } from '@clerk/nextjs/server'
import { ROTAS_PUBLICAS } from './rotas-publicas'

const ehPublica = createRouteMatcher([...ROTAS_PUBLICAS])
const req = (caminho: string) =>
  new NextRequest(`https://cronograma.ctcea.org.br${caminho}`)

describe('ROTAS_PUBLICAS', () => {
  it('libera as telas de autenticação e seus subcaminhos do Clerk', () => {
    expect(ehPublica(req('/entrar'))).toBe(true)
    expect(ehPublica(req('/entrar/factor-one'))).toBe(true)
    expect(ehPublica(req('/cadastrar'))).toBe(true)
    expect(ehPublica(req('/cadastrar/verify-email-address'))).toBe(true)
  })

  it('libera os webhooks, que são chamados sem sessão de usuário', () => {
    expect(ehPublica(req('/api/webhooks/clerk'))).toBe(true)
  })

  it('protege a raiz e as rotas de domínio (padrão fechado)', () => {
    for (const caminho of ['/', '/projetos', '/projetos/1', '/api/acoes']) {
      expect(ehPublica(req(caminho)), caminho).toBe(false)
    }
  })
})
