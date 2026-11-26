import { describe, expect, it } from 'vitest'

import { VARIAVEL_ESCAPE, decidirMigracao, hostDoBanco } from './migracao-deploy'

const BANCO = 'postgresql://usuario:senha@host:5432/banco'

describe('decidirMigracao', () => {
  it('aplica em produção com banco configurado', () => {
    expect(decidirMigracao({ VERCEL_ENV: 'production', DATABASE_URL: BANCO })).toEqual({
      acao: 'APLICAR',
    })
  })

  it('NÃO aplica em preview, ainda que o banco esteja configurado', () => {
    // A armadilha que este módulo existe para evitar: preview e produção
    // compartilham a mesma DATABASE_URL nesta instalação.
    const decisao = decidirMigracao({ VERCEL_ENV: 'preview', DATABASE_URL: BANCO })
    expect(decisao.acao).toBe('PULAR')
    if (decisao.acao === 'PULAR') expect(decisao.motivo).toContain('antes do merge')
  })

  it('NÃO aplica no ambiente de development da Vercel', () => {
    expect(
      decidirMigracao({ VERCEL_ENV: 'development', DATABASE_URL: BANCO }).acao,
    ).toBe('PULAR')
  })

  it('NÃO aplica fora da Vercel — build local ou CI', () => {
    const decisao = decidirMigracao({ DATABASE_URL: BANCO })
    expect(decisao.acao).toBe('PULAR')
    if (decisao.acao === 'PULAR') expect(decisao.motivo).toContain('CI')
  })

  it('trata VERCEL_ENV vazio como fora da Vercel', () => {
    expect(decidirMigracao({ VERCEL_ENV: '', DATABASE_URL: BANCO }).acao).toBe('PULAR')
  })

  it('erra em produção sem DATABASE_URL, em vez de seguir o build', () => {
    const decisao = decidirMigracao({ VERCEL_ENV: 'production' })
    expect(decisao.acao).toBe('ERRO')
    if (decisao.acao === 'ERRO') expect(decisao.motivo).toContain('DATABASE_URL')
  })

  it('erra em produção com DATABASE_URL só de espaços', () => {
    expect(decidirMigracao({ VERCEL_ENV: 'production', DATABASE_URL: '   ' }).acao).toBe(
      'ERRO',
    )
  })

  it('o escape manual vence tudo, inclusive produção', () => {
    const decisao = decidirMigracao({
      VERCEL_ENV: 'production',
      DATABASE_URL: BANCO,
      PULAR_MIGRACAO: '1',
    })
    expect(decisao.acao).toBe('PULAR')
    if (decisao.acao === 'PULAR') expect(decisao.motivo).toContain(VARIAVEL_ESCAPE)
  })

  it('escape vazio não conta como escape', () => {
    expect(
      decidirMigracao({
        VERCEL_ENV: 'production',
        DATABASE_URL: BANCO,
        PULAR_MIGRACAO: '',
      }).acao,
    ).toBe('APLICAR')
  })

  it('nunca aplica quando o ambiente está totalmente vazio', () => {
    expect(decidirMigracao({}).acao).toBe('PULAR')
  })
})

describe('homologação (branch homologacao, banco próprio)', () => {
  const HOMOLOG = 'postgresql://u:s@homolog.proxy.rlwy.net:12345/railway'
  const base = {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'homologacao',
    HOMOLOGACAO_BANCO_HOST: 'homolog.proxy.rlwy.net:12345',
  }

  it('aplica quando a DATABASE_URL é do banco da homologação', () => {
    expect(decidirMigracao({ ...base, DATABASE_URL: HOMOLOG })).toEqual({ acao: 'APLICAR' })
  })

  it('ERRA se a DATABASE_URL aponta para outro banco (o de produção, por exemplo)', () => {
    const d = decidirMigracao({ ...base, DATABASE_URL: BANCO })
    expect(d.acao).toBe('ERRO')
    if (d.acao === 'ERRO') expect(d.motivo).toContain('não para')
  })

  it('ERRA sem a trava de host: nunca migra às cegas', () => {
    expect(
      decidirMigracao({ ...base, HOMOLOGACAO_BANCO_HOST: undefined, DATABASE_URL: HOMOLOG }).acao,
    ).toBe('ERRO')
  })

  it('ERRA sem DATABASE_URL ou com uma ilegível', () => {
    expect(decidirMigracao({ ...base }).acao).toBe('ERRO')
    expect(decidirMigracao({ ...base, DATABASE_URL: 'isso nao e url' }).acao).toBe('ERRO')
  })

  it('outras branches de preview continuam sem migrar, mesmo com a trava definida', () => {
    const d = decidirMigracao({ ...base, VERCEL_GIT_COMMIT_REF: 'etapa-9', DATABASE_URL: HOMOLOG })
    expect(d.acao).toBe('PULAR')
  })

  it('a branch homologacao fora de preview não ganha o caminho da homologação', () => {
    expect(
      decidirMigracao({ ...base, VERCEL_ENV: 'development', DATABASE_URL: HOMOLOG }).acao,
    ).toBe('PULAR')
  })

  it('o escape manual ainda vale', () => {
    expect(decidirMigracao({ ...base, DATABASE_URL: HOMOLOG, PULAR_MIGRACAO: '1' }).acao).toBe('PULAR')
  })

  it('hostDoBanco lê host:porta e devolve null para o que não é URL', () => {
    expect(hostDoBanco(HOMOLOG)).toBe('homolog.proxy.rlwy.net:12345')
    expect(hostDoBanco('postgresql://u:s@host/banco')).toBe('host')
    expect(hostDoBanco('')).toBeNull()
    expect(hostDoBanco(undefined)).toBeNull()
  })
})
