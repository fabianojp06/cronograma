import { describe, expect, it } from 'vitest'

import { VARIAVEL_ESCAPE, decidirMigracao } from './migracao-deploy'

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
