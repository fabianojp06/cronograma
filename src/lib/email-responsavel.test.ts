import { describe, expect, it } from 'vitest'

import {
  escaparHtml,
  mensagemDoAviso,
  montarAvisoResponsavel,
  type DadosAviso,
} from './email-responsavel'

const BASE: DadosAviso = {
  motivo: 'NOVA_ACAO',
  responsavel: 'Ana Souza',
  acao: {
    numero: 3,
    descricao: 'Levantar inventário dos switches',
    previstoInicio: '2026-03-02',
    previstoTermino: '2026-03-20',
  },
  projeto: { nome: 'Rede nova', referencia: 'PLA-DEP-2026-001' },
  link: 'https://cronograma.exemplo/projetos/p1/acoes/a1/editar',
}

describe('montarAvisoResponsavel', () => {
  it('monta assunto com número da ação e projeto', () => {
    expect(montarAvisoResponsavel(BASE).assunto).toBe(
      'Ação 3 sob sua responsabilidade — Rede nova',
    )
  })

  it('traz projeto, ação, período em dd/mm/aaaa e link no texto', () => {
    const { texto } = montarAvisoResponsavel(BASE)
    expect(texto).toContain('Olá, Ana Souza.')
    expect(texto).toContain('Uma nova ação foi cadastrada')
    expect(texto).toContain('Projeto: PLA-DEP-2026-001 — Rede nova')
    expect(texto).toContain('Ação 3: Levantar inventário dos switches')
    expect(texto).toContain('Previsto: 02/03/2026 a 20/03/2026')
    expect(texto).toContain(`Abrir a ação: ${BASE.link}`)
  })

  it('diferencia a troca de responsável da ação nova', () => {
    const { texto } = montarAvisoResponsavel({ ...BASE, motivo: 'ATRIBUIDA' })
    expect(texto).toContain('Você passou a ser o responsável')
    expect(texto).not.toContain('nova ação')
  })

  it('omite período e link quando não há', () => {
    const { texto, html } = montarAvisoResponsavel({
      ...BASE,
      acao: { ...BASE.acao, previstoInicio: null, previstoTermino: null },
      link: null,
    })
    expect(texto).not.toContain('Previsto')
    expect(texto).not.toContain('Abrir a ação')
    expect(html).not.toContain('<a ')
  })

  it('projeto sem referência mostra só o nome', () => {
    const { texto } = montarAvisoResponsavel({ ...BASE, projeto: { nome: 'Rede nova', referencia: null } })
    expect(texto).toContain('Projeto: Rede nova\n')
  })

  // A descrição é digitada por qualquer um; sem escapar, vira HTML no e-mail.
  it('escapa o que veio do usuário no HTML', () => {
    const { html } = montarAvisoResponsavel({
      ...BASE,
      acao: { ...BASE.acao, descricao: '<script>x</script> & "aspas"' },
    })
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;aspas&quot;')
    expect(html).not.toContain('<script>')
  })
})

describe('escaparHtml', () => {
  it('escapa os cinco caracteres especiais', () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    )
  })
})

describe('mensagemDoAviso', () => {
  const ana = { nome: 'Ana Souza', email: 'ana@ctcea.org.br' }

  it('confirma o envio com o endereço', () => {
    expect(mensagemDoAviso(ana, { enviado: true })).toBe('Aviso enviado para ana@ctcea.org.br.')
  })

  it('avisa quando a pessoa não tem e-mail', () => {
    expect(mensagemDoAviso({ nome: 'Ana Souza', email: null }, null)).toContain(
      'não tem e-mail cadastrado',
    )
  })

  it('distingue envio não configurado de falha', () => {
    expect(mensagemDoAviso(ana, { enviado: false, motivo: 'SEM_CHAVE' })).toContain(
      'não está configurado',
    )
    expect(mensagemDoAviso(ana, { enviado: false, motivo: 'FALHA_NO_ENVIO' })).toContain(
      'Não foi possível enviar',
    )
  })
})
