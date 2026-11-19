import { describe, expect, it } from 'vitest'

import {
  LIMITE_LOTE,
  SEM_RESPONSAVEL,
  descreverPedido,
  lerPedidoLote,
  montarAvisoLote,
  planejarLote,
  type AcaoDoLote,
} from './edicao-lote'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

function form(campos: Record<string, string | string[]>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x)
  return f
}

describe('lerPedidoLote', () => {
  it('exige ao menos uma ação e uma operação', () => {
    expect(lerPedidoLote(form({ quantidade: '2' })).ok).toBe(false)
    expect(lerPedidoLote(form({ ids: ['a'] })).ok).toBe(false)
  })
  it('lê o deslocamento com sinal e o responsável', () => {
    const r = lerPedidoLote(form({ ids: ['a', 'b', 'a'], quantidade: '3', sentido: 'adiantar', responsavelId: 'c1' }))
    expect(r).toEqual({ ok: true, pedido: { ids: ['a', 'b'], deslocamento: -3, responsavelId: 'c1' } })
  })
  it('adiar é o padrão; remover responsável tem valor próprio; vazio = não mexer', () => {
    const adiar = lerPedidoLote(form({ ids: ['a'], quantidade: '2', sentido: 'adiar' }))
    expect(adiar.ok && adiar.pedido.deslocamento).toBe(2)
    const remover = lerPedidoLote(form({ ids: ['a'], responsavelId: SEM_RESPONSAVEL }))
    expect(remover.ok && remover.pedido.responsavelId).toBe(null)
    const nada = lerPedidoLote(form({ ids: ['a'], quantidade: '2', responsavelId: '' }))
    expect(nada.ok && nada.pedido.responsavelId).toBe(undefined)
  })
  it('recusa quantidade inválida e passar do limite de ações', () => {
    for (const q of ['-1', '1.5', 'abc', '251']) {
      expect(lerPedidoLote(form({ ids: ['a'], quantidade: q })).ok).toBe(false)
    }
    const muitas = Array.from({ length: LIMITE_LOTE + 1 }, (_, i) => `id${i}`)
    const r = lerPedidoLote(form({ ids: muitas, quantidade: '1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain(String(LIMITE_LOTE))
  })
  it('quantidade 0 sem responsável não é operação', () => {
    expect(lerPedidoLote(form({ ids: ['a'], quantidade: '0' })).ok).toBe(false)
  })
})

const base: AcaoDoLote = {
  id: 'a1',
  numero: 1,
  descricao: 'Ação',
  status: 'EM_CURSO_50',
  previstoInicio: d('2026-03-02'),
  previstoTermino: d('2026-03-06'),
  responsavelId: 'r1',
  responsavelNome: 'Ana',
  versao: new Date('2026-03-01T10:00:00Z'),
}

describe('planejarLote', () => {
  it('desloca início e término em dias úteis e descreve de/para', () => {
    const [item] = planejarLote([base], { deslocamento: 2, responsavelId: undefined }, null)
    expect(item.mudancas).toEqual([
      { campo: 'previstoInicio', de: '2026-03-02', para: '2026-03-04' },
      { campo: 'previstoTermino', de: '2026-03-06', para: '2026-03-10' },
    ])
    expect(item.dados.previstoTermino).toEqual(d('2026-03-10'))
    expect(item.observacao).toBeNull()
  })
  it('troca o responsável e grava o nome no histórico', () => {
    const [item] = planejarLote([base], { deslocamento: 0, responsavelId: 'r2' }, 'Bruno')
    expect(item.mudancas).toEqual([{ campo: 'responsavel', de: 'Ana', para: 'Bruno' }])
    expect(item.dados).toEqual({ responsavelId: 'r2' })
    expect(item.novos.responsavel).toBe('Bruno')
  })
  it('remover o responsável grava null', () => {
    const [item] = planejarLote([base], { deslocamento: 0, responsavelId: null }, null)
    expect(item.dados).toEqual({ responsavelId: null })
    expect(item.mudancas[0]).toEqual({ campo: 'responsavel', de: 'Ana', para: null })
  })
  it('concluída não tem o previsto remarcado, mas aceita troca de responsável', () => {
    const [item] = planejarLote(
      [{ ...base, status: 'CONCLUIDO' }],
      { deslocamento: 5, responsavelId: 'r2' },
      'Bruno',
    )
    expect(item.mudancas.map((m) => m.campo)).toEqual(['responsavel'])
    expect(item.observacao).toContain('concluída')
  })
  it('sem data prevista não desloca; só um dos extremos desloca só ele', () => {
    const [sem] = planejarLote([{ ...base, previstoInicio: null, previstoTermino: null }], { deslocamento: 2, responsavelId: undefined }, null)
    expect(sem.mudancas).toEqual([])
    expect(sem.observacao).toContain('sem data prevista')
    const [so] = planejarLote([{ ...base, previstoInicio: null }], { deslocamento: 1, responsavelId: undefined }, null)
    expect(so.mudancas.map((m) => m.campo)).toEqual(['previstoTermino'])
  })
  it('mesmo responsável não gera mudança', () => {
    const [item] = planejarLote([base], { deslocamento: 0, responsavelId: 'r1' }, 'Ana')
    expect(item.mudancas).toEqual([])
    expect(item.observacao).toContain('já é esse')
  })
})

describe('descreverPedido', () => {
  it('conta em palavras', () => {
    expect(descreverPedido({ deslocamento: 1, responsavelId: undefined }, null)).toBe('Adiar o previsto em 1 dia útil')
    expect(descreverPedido({ deslocamento: -3, responsavelId: 'x' }, 'Bruno')).toBe(
      'Adiantar o previsto em 3 dias úteis e passar o responsável para Bruno',
    )
    expect(descreverPedido({ deslocamento: 0, responsavelId: null }, null)).toBe('Remover o responsável')
  })
})

describe('montarAvisoLote', () => {
  it('lista todas as ações em um e-mail só e escapa HTML', () => {
    const m = montarAvisoLote({
      responsavel: 'Bruno',
      projeto: { nome: 'Proj <b>', referencia: null },
      acoes: [
        { numero: 1, descricao: 'A <i>', previstoInicio: '2026-03-02', previstoTermino: '2026-03-06' },
        { numero: 2, descricao: 'B', previstoInicio: null, previstoTermino: null },
      ],
      link: 'https://s.org/projetos/1',
    })
    expect(m.assunto).toContain('2 ações passaram')
    expect(m.texto).toContain('- Ação 1: A <i>')
    expect(m.texto).toContain('- Ação 2: B')
    expect(m.html).not.toContain('<i>')
    expect(m.html).toContain('&lt;b&gt;')
  })
})
