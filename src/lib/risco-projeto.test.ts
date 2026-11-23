import { describe, expect, it } from 'vitest'

import {
  alteracoesDeRisco,
  ordenarPorAtencao,
  podeExcluirRisco,
  prazoVencido,
  riscoAberto,
  validarRisco,
  valorDoHistoricoRisco,
} from './risco-projeto'

const fd = (campos: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const valido = { tipo: 'RISCO', titulo: 'Fornecedor pode atrasar', impacto: 'ALTO' }

describe('validarRisco', () => {
  it('aceita o mínimo, com status ABERTO e campos opcionais nulos', () => {
    expect(validarRisco(fd(valido))).toEqual({
      ok: true,
      dados: { tipo: 'RISCO', titulo: 'Fornecedor pode atrasar', descricao: null, impacto: 'ALTO', status: 'ABERTO', acaoId: null, responsavelId: null, prazo: null, plano: null },
    })
  })
  it('lê todos os campos, apara e junta espaços do título', () => {
    const r = validarRisco(fd({ ...valido, titulo: '  Vai   atrasar ', descricao: ' x ', status: 'EM_TRATAMENTO', acaoId: 'a1', responsavelId: 'c1', prazo: '2026-12-01', plano: ' fazer y ' }))
    expect(r).toMatchObject({ ok: true, dados: { titulo: 'Vai atrasar', descricao: 'x', status: 'EM_TRATAMENTO', acaoId: 'a1', responsavelId: 'c1', plano: 'fazer y' } })
    expect(r.ok && r.dados.prazo?.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })
  it('exige tipo, título e impacto válidos', () => {
    const r = validarRisco(fd({ tipo: 'X', titulo: '', impacto: 'MUITO' }))
    expect(r).toMatchObject({ ok: false, erros: { tipo: expect.any(String), titulo: expect.any(String), impacto: expect.any(String) } })
  })
  it('recusa status inválido, data impossível e textos longos demais', () => {
    expect(validarRisco(fd({ ...valido, status: 'FEITO' }))).toMatchObject({ ok: false, erros: { status: expect.any(String) } })
    expect(validarRisco(fd({ ...valido, prazo: '2026-02-31' }))).toMatchObject({ ok: false, erros: { prazo: 'Data inválida.' } })
    expect(validarRisco(fd({ ...valido, prazo: 'amanhã' }))).toMatchObject({ ok: false, erros: { prazo: 'Data inválida.' } })
    expect(validarRisco(fd({ ...valido, titulo: 'x'.repeat(201) }))).toMatchObject({ ok: false, erros: { titulo: expect.any(String) } })
    expect(validarRisco(fd({ ...valido, plano: 'x'.repeat(2001) }))).toMatchObject({ ok: false, erros: { plano: expect.any(String) } })
  })
})

describe('regras', () => {
  it('aberto = aberto ou em tratamento', () => {
    expect(['ABERTO', 'EM_TRATAMENTO'].every(riscoAberto)).toBe(true)
    expect(['RESOLVIDO', 'ACONTECEU'].some(riscoAberto)).toBe(false)
  })

  it('prazo vencido só vale para aberto, com prazo anterior a hoje', () => {
    const hoje = d('2026-11-16')
    expect(prazoVencido({ status: 'ABERTO', prazo: d('2026-11-10') }, hoje)).toBe(true)
    expect(prazoVencido({ status: 'ABERTO', prazo: d('2026-11-16') }, hoje)).toBe(false)
    expect(prazoVencido({ status: 'RESOLVIDO', prazo: d('2026-11-10') }, hoje)).toBe(false)
    expect(prazoVencido({ status: 'ABERTO', prazo: null }, hoje)).toBe(false)
  })

  it('ordem de atenção: impacto, bloqueio antes de risco, prazo, mais antigo', () => {
    const r = (id: string, impacto: string, tipo: string, prazo: Date | null, criado: string) => ({ id, impacto, tipo, prazo, criadoEm: d(criado) })
    const ordem = ordenarPorAtencao([
      r('baixo', 'BAIXO', 'BLOQUEIO', null, '2026-01-01'),
      r('medio', 'MEDIO', 'RISCO', null, '2026-01-01'),
      r('alto-risco-tarde', 'ALTO', 'RISCO', d('2026-12-01'), '2026-01-01'),
      r('alto-risco-cedo', 'ALTO', 'RISCO', d('2026-11-20'), '2026-01-02'),
      r('alto-bloq', 'ALTO', 'BLOQUEIO', null, '2026-01-03'),
      r('alto-risco-sem-prazo', 'ALTO', 'RISCO', null, '2026-01-01'),
    ]).map((x) => x.id)
    expect(ordem).toEqual(['alto-bloq', 'alto-risco-cedo', 'alto-risco-tarde', 'alto-risco-sem-prazo', 'medio', 'baixo'])
  })

  it('exclui quem registrou ou o administrador', () => {
    expect(podeExcluirRisco('u1', 'u1', false)).toBe(true)
    expect(podeExcluirRisco('u1', 'u2', false)).toBe(false)
    expect(podeExcluirRisco('u1', 'u2', true)).toBe(true)
  })
})

describe('histórico', () => {
  const base = { tipo: 'RISCO', impacto: 'MEDIO', status: 'ABERTO', responsavel: 'Ana', prazo: d('2026-12-01') }
  it('só gera linha do que mudou', () => {
    expect(alteracoesDeRisco(base, base)).toEqual([])
    expect(alteracoesDeRisco(base, { ...base, status: 'RESOLVIDO', prazo: null })).toEqual([
      { campo: 'status', valorAntigo: 'ABERTO', valorNovo: 'RESOLVIDO' },
      { campo: 'prazo', valorAntigo: '2026-12-01', valorNovo: null },
    ])
    expect(alteracoesDeRisco(base, { ...base, responsavel: null, tipo: 'BLOQUEIO' }).map((l) => l.campo)).toEqual(['tipo', 'responsavel'])
  })
  it('traduz os valores para a tela', () => {
    expect(valorDoHistoricoRisco('status', 'EM_TRATAMENTO')).toBe('Em tratamento')
    expect(valorDoHistoricoRisco('impacto', 'ALTO')).toBe('Alto')
    expect(valorDoHistoricoRisco('tipo', 'BLOQUEIO')).toBe('Bloqueio')
    expect(valorDoHistoricoRisco('prazo', '2026-12-01')).toBe('01/12/2026')
    expect(valorDoHistoricoRisco('prazo', null)).toBe('—')
    expect(valorDoHistoricoRisco('responsavel', 'Ana')).toBe('Ana')
  })
})

describe('validarRisco: pede decisão da diretoria', () => {
  it('sem o marcador do campo, não mexe (ausente)', () => {
    const r = validarRisco(fd(valido))
    expect(r.ok && 'pedeAjuda' in r.dados).toBe(false)
  })
  it('com o marcador, caixa marcada = true e desmarcada = false', () => {
    const marcada = validarRisco(fd({ ...valido, pedeAjudaCampo: '1', pedeAjuda: 'on' }))
    expect(marcada.ok && marcada.dados.pedeAjuda).toBe(true)
    const desmarcada = validarRisco(fd({ ...valido, pedeAjudaCampo: '1' }))
    expect(desmarcada.ok && desmarcada.dados.pedeAjuda).toBe(false)
  })
})
