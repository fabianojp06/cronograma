import { describe, expect, it } from 'vitest'

import { descreverLinkNoHistorico, origemDoLink, urlValida, validarLink } from './link-acao'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

describe('urlValida', () => {
  it('aceita http e https com servidor', () => {
    expect(urlValida('https://ctcea.sharepoint.com/sites/x/Documentos/ata.pdf?web=1')).toBe(true)
    expect(urlValida('http://intranet.local/arquivo')).toBe(true)
    expect(urlValida('https://drive.google.com/file/d/abc/view#p=2')).toBe(true)
  })
  it('recusa esquemas perigosos e endereços sem esquema', () => {
    for (const ruim of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://x.com/a', 'vbscript:x', 'blob:https://x.com/1']) {
      expect(urlValida(ruim), ruim).toBe(false)
    }
    expect(urlValida('sharepoint.com/ata')).toBe(false)
    expect(urlValida('//x.com/a')).toBe(false)
    expect(urlValida('https://')).toBe(false)
    expect(urlValida('')).toBe(false)
  })
  it('recusa espaço, caracteres de controle e endereço longo demais', () => {
    expect(urlValida('https://x.com/a b')).toBe(false)
    expect(urlValida('https://x.com/a\nb')).toBe(false)
    expect(urlValida('https://x.com/a\u0000')).toBe(false)
    expect(urlValida(`https://x.com/${'a'.repeat(2000)}`)).toBe(false)
  })
})

describe('validarLink', () => {
  it('lê título, endereço e tipo (padrão Documento) e apara', () => {
    expect(validarLink(fd({ titulo: '  Ata   do kickoff ', url: ' https://x.com/a ', tipo: 'ATA' }))).toEqual({
      ok: true,
      dados: { titulo: 'Ata do kickoff', url: 'https://x.com/a', tipo: 'ATA' },
    })
    expect(validarLink(fd({ titulo: 'T', url: 'https://x.com' }))).toMatchObject({ ok: true, dados: { tipo: 'DOCUMENTO' } })
  })
  it('recusa título vazio, endereço inválido e tipo desconhecido, com a mensagem de cada campo', () => {
    const r = validarLink(fd({ titulo: '', url: 'javascript:alert(1)', tipo: 'X' }))
    expect(r).toMatchObject({ ok: false, erros: { titulo: expect.any(String), url: expect.stringContaining('https://'), tipo: expect.any(String) } })
    expect(validarLink(fd({ titulo: 'T', url: '' }))).toMatchObject({ ok: false, erros: { url: 'Informe o endereço do link.' } })
    expect(validarLink(fd({ titulo: 'x'.repeat(201), url: 'https://x.com' }))).toMatchObject({ ok: false, erros: { titulo: expect.any(String) } })
  })
})

describe('textos', () => {
  it('origem sem www', () => {
    expect(origemDoLink('https://www.ctcea.org.br/a')).toBe('ctcea.org.br')
    expect(origemDoLink('https://ctcea.sharepoint.com/x')).toBe('ctcea.sharepoint.com')
    expect(origemDoLink('lixo')).toBe('')
  })
  it('descreve para o histórico', () => {
    expect(descreverLinkNoHistorico({ titulo: 'Kickoff', url: 'https://x.sharepoint.com/a', tipo: 'ATA' })).toBe('Ata: Kickoff (x.sharepoint.com)')
  })
})
