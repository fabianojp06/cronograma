import { describe, expect, it } from 'vitest'

import { autorizarCron } from './autorizacao-cron'

describe('autorizarCron', () => {
  it('aceita o Bearer com o segredo certo', () => {
    expect(autorizarCron('Bearer segredo', 'segredo')).toBe('ok')
  })

  it('recusa cabeçalho ausente, errado ou de outro tamanho', () => {
    expect(autorizarCron(null, 'segredo')).toBe('negado')
    expect(autorizarCron('Bearer outro!!', 'segredo')).toBe('negado')
    expect(autorizarCron('Bearer x', 'segredo')).toBe('negado')
    expect(autorizarCron('segredo', 'segredo')).toBe('negado')
  })

  it('sem segredo configurado recusa tudo, inclusive "Bearer undefined"', () => {
    expect(autorizarCron('Bearer undefined', undefined)).toBe('sem-segredo')
    expect(autorizarCron('Bearer ', '  ')).toBe('sem-segredo')
  })
})
