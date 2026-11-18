import { describe, expect, it, vi } from 'vitest'

import { enviarEmail } from './enviar-email'

const MENSAGEM = { assunto: 'Assunto', texto: 'Texto', html: '<p>Texto</p>' }
const PRODUCAO = { VERCEL_ENV: 'production', RESEND_API_KEY: 're_teste' }

function respostaFalsa(ok: boolean, status = ok ? 200 : 403) {
  return vi.fn(async () => new Response(ok ? '{"id":"1"}' : '{"message":"domínio"}', { status }))
}

describe('enviarEmail', () => {
  it('chama a API do Resend com remetente, destinatário e conteúdo', async () => {
    const buscar = respostaFalsa(true)

    expect(await enviarEmail('ana@ctcea.org.br', MENSAGEM, PRODUCAO, buscar)).toEqual({
      enviado: true,
    })

    expect(buscar).toHaveBeenCalledOnce()
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_teste' })
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ['ana@ctcea.org.br'],
      subject: 'Assunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    })
  })

  it('não chama a rede fora de produção', async () => {
    const buscar = respostaFalsa(true)
    expect(await enviarEmail('a@b.br', MENSAGEM, { RESEND_API_KEY: 're_x' }, buscar)).toEqual({
      enviado: false,
      motivo: 'FORA_DE_PRODUCAO',
    })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('não chama a rede sem a chave', async () => {
    const buscar = respostaFalsa(true)
    expect(await enviarEmail('a@b.br', MENSAGEM, { VERCEL_ENV: 'production' }, buscar)).toEqual({
      enviado: false,
      motivo: 'SEM_CHAVE',
    })
    expect(buscar).not.toHaveBeenCalled()
  })

  it('recusa do Resend vira resultado, não exceção', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await enviarEmail('a@b.br', MENSAGEM, PRODUCAO, respostaFalsa(false))
    expect(r).toEqual({ enviado: false, motivo: 'FALHA_NO_ENVIO' })
    vi.restoreAllMocks()
  })

  it('falha de rede vira resultado, não exceção', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const buscar = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const r = await enviarEmail('a@b.br', MENSAGEM, PRODUCAO, buscar)
    expect(r).toEqual({ enviado: false, motivo: 'FALHA_NO_ENVIO' })
    vi.restoreAllMocks()
  })
})
