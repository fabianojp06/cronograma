import { describe, expect, it } from 'vitest'

import {
  agruparErrosPorOrigem,
  conferirConfiguracao,
  corpoDaSaude,
  cronEstaAtrasado,
  destinatariosDeAlerta,
  deveAlertar,
  montarAlertaErro,
  situacaoDoVolume,
  statusDaSaude,
} from './monitoramento'

describe('saúde', () => {
  it('200 com banco ok, 503 sem', () => {
    expect(statusDaSaude({ ok: true, ms: 5 })).toBe(200)
    expect(statusDaSaude({ ok: false, erro: 'x' })).toBe(503)
  })
  it('o corpo público não vaza a mensagem do erro', () => {
    const corpo = corpoDaSaude({ ok: false, erro: 'senha do banco errada' })
    expect(JSON.stringify(corpo)).not.toContain('senha')
    expect(corpo.status).toBe('fora')
  })
})

describe('deveAlertar', () => {
  it('avisa o primeiro erro da origem e silencia os da mesma hora', () => {
    expect(deveAlertar('Falha ao salvar WIN', false)).toBe(true)
    expect(deveAlertar('Falha ao salvar WIN', true)).toBe(false)
  })
  it('nunca alerta pelas origens do próprio envio de e-mail (evita laço)', () => {
    expect(deveAlertar('Resend recusou o e-mail', false)).toBe(false)
    expect(deveAlertar('Falha ao enviar e-mail', false)).toBe(false)
    expect(deveAlertar('Falha ao enviar o alerta de erro', false)).toBe(false)
  })
})

describe('destinatariosDeAlerta', () => {
  it('EMAIL_ALERTAS manda, sem duplicar nem aceitar lixo', () => {
    expect(
      destinatariosDeAlerta({ EMAIL_ALERTAS: ' A@x.org, a@x.org ,b@x.org,sem-arroba' }, ['z@x.org']),
    ).toEqual(['a@x.org', 'b@x.org'])
  })
  it('sem a variável, usa os administradores com e-mail', () => {
    expect(destinatariosDeAlerta({}, ['z@x.org', null, ''])).toEqual(['z@x.org'])
  })
  it('sem ninguém, lista vazia', () => {
    expect(destinatariosDeAlerta({}, [null])).toEqual([])
  })
})

describe('montarAlertaErro', () => {
  it('escapa HTML e inclui link do painel só com URL base', () => {
    const m = montarAlertaErro({ origem: 'A<b>', mensagem: '<script>', rota: '/x', urlBase: 'https://s.org' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.texto).toContain('https://s.org/administracao/sistema')
    expect(montarAlertaErro({ origem: 'a', mensagem: 'm', rota: null, urlBase: null }).texto).not.toContain('http')
  })
})

describe('agruparErrosPorOrigem', () => {
  const agora = new Date('2026-11-19T12:00:00Z')
  const h = (horas: number) => new Date(agora.getTime() - horas * 3600_000)
  it('conta 24 h e 7 dias, ignora o mais antigo e ordena pelas mais ruidosas', () => {
    const r = agruparErrosPorOrigem(
      [
        { origem: 'A', criadoEm: h(1) },
        { origem: 'A', criadoEm: h(30) },
        { origem: 'B', criadoEm: h(2) },
        { origem: 'B', criadoEm: h(3) },
        { origem: 'C', criadoEm: h(24 * 8) },
      ],
      agora,
    )
    expect(r.map((l) => [l.origem, l.ultimas24h, l.ultimos7d])).toEqual([
      ['B', 2, 2],
      ['A', 1, 2],
    ])
    expect(r[1].ultimoEm).toEqual(h(1))
  })
})

describe('situacaoDoVolume', () => {
  it('ok, atenção a partir de 70% e acima do teto', () => {
    expect(situacaoDoVolume(300).nivel).toBe('ok')
    expect(situacaoDoVolume(7000).nivel).toBe('atencao')
    expect(situacaoDoVolume(10_000).nivel).toBe('atencao')
    expect(situacaoDoVolume(10_001).nivel).toBe('acima')
  })
})

describe('conferirConfiguracao', () => {
  it('só diz se está definida, nunca o valor', () => {
    const itens = conferirConfiguracao({ CLERK_SECRET_KEY: 'sk_segredo', RESEND_API_KEY: '  ' })
    expect(JSON.stringify(itens)).not.toContain('sk_segredo')
    expect(itens.find((i) => i.id === 'clerk')?.ok).toBe(true)
    expect(itens.find((i) => i.id === 'resend')?.ok).toBe(false)
  })
})

describe('cronEstaAtrasado', () => {
  const agora = new Date('2026-11-19T12:00:00Z')
  it('nunca rodou não é atraso; rodou há 7 dias não; há 10 dias sim', () => {
    expect(cronEstaAtrasado(null, agora)).toBe(false)
    expect(cronEstaAtrasado(new Date('2026-11-12T11:00:00Z'), agora)).toBe(false)
    expect(cronEstaAtrasado(new Date('2026-11-09T11:00:00Z'), agora)).toBe(true)
  })
})
