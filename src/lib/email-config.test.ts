import { describe, expect, it } from 'vitest'

import { configuracaoEmail, REMETENTE_PADRAO, urlBaseDoSistema } from './email-config'

describe('configuracaoEmail', () => {
  it('envia em produção com a chave', () => {
    expect(configuracaoEmail({ VERCEL_ENV: 'production', RESEND_API_KEY: 're_x' })).toEqual({
      ativo: true,
      chave: 're_x',
      remetente: REMETENTE_PADRAO,
      urlBase: null,
    })
  })

  it('usa o remetente configurado', () => {
    const c = configuracaoEmail({
      VERCEL_ENV: 'production',
      RESEND_API_KEY: 're_x',
      EMAIL_REMETENTE: 'Cronograma <cronograma@ctcea.org.br>',
    })
    expect(c).toMatchObject({ ativo: true, remetente: 'Cronograma <cronograma@ctcea.org.br>' })
  })

  // O preview usa o banco de produção: enviar dali avisaria colaboradores reais.
  it('não envia no preview, mesmo com a chave', () => {
    expect(configuracaoEmail({ VERCEL_ENV: 'preview', RESEND_API_KEY: 're_x' })).toMatchObject({
      ativo: false,
      motivo: 'FORA_DE_PRODUCAO',
    })
  })

  it('não envia fora da Vercel', () => {
    expect(configuracaoEmail({ RESEND_API_KEY: 're_x' })).toMatchObject({
      ativo: false,
      motivo: 'FORA_DE_PRODUCAO',
    })
  })

  it('não envia em produção sem a chave', () => {
    expect(configuracaoEmail({ VERCEL_ENV: 'production', RESEND_API_KEY: '  ' })).toMatchObject({
      ativo: false,
      motivo: 'SEM_CHAVE',
    })
  })
})

describe('urlBaseDoSistema', () => {
  it('prefere APP_URL, sem barra no fim', () => {
    expect(
      urlBaseDoSistema({ APP_URL: 'https://cronograma.ctcea.org.br/', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }),
    ).toBe('https://cronograma.ctcea.org.br')
  })

  it('cai no domínio de produção da Vercel', () => {
    expect(urlBaseDoSistema({ VERCEL_PROJECT_PRODUCTION_URL: 'cronograma-lktu.vercel.app' })).toBe(
      'https://cronograma-lktu.vercel.app',
    )
  })

  it('sem nenhuma das duas, não há link', () => {
    expect(urlBaseDoSistema({})).toBeNull()
  })
})
