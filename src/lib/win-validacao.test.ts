import { describe, expect, it } from 'vitest'

import {
  MAXIMO_WINS_POR_SEMANA,
  ROTULO_STATUS_WIN,
  ehConcluido,
  podeAdicionarWin,
  proximaOrdemLivre,
  validarCard,
  validarWin,
} from './win-validacao'
import { StatusWin } from '../generated/prisma/enums'

const SEMANA_39 = { ano: 2026, semana: 39 } // 20/09/2026 a 26/09/2026

describe('validarWin', () => {
  it('aceita o mínimo — só a descrição', () => {
    const r = validarWin({ descricao: 'Finalizar documentação do SGO' }, SEMANA_39)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dados.descricao).toBe('Finalizar documentação do SGO')
    expect(r.dados.suporte).toBeNull()
    expect(r.dados.prazo).toBeNull()
    expect(r.dados.status).toBe(StatusWin.PENDENTE)
  })

  it('exige descrição', () => {
    const r = validarWin({ descricao: '   ' }, SEMANA_39)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros.descricao).toBe('Descreva o WIN.')
  })

  it('status vazio vira PENDENTE — é o que a planilha deixa em branco', () => {
    const r = validarWin({ descricao: 'x', status: '' }, SEMANA_39)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dados.status).toBe(StatusWin.PENDENTE)
  })

  it('aceita os quatro status e recusa qualquer outro', () => {
    for (const status of Object.values(StatusWin)) {
      expect(validarWin({ descricao: 'x', status }, SEMANA_39).ok).toBe(true)
    }
    expect(validarWin({ descricao: 'x', status: 'CONCLUIDO' }, SEMANA_39).ok).toBe(false)
  })

  it('aceita prazo dentro da semana, nas duas pontas', () => {
    for (const prazo of ['2026-09-20', '2026-09-23', '2026-09-26']) {
      const r = validarWin({ descricao: 'x', prazo }, SEMANA_39)
      expect([prazo, r.ok]).toEqual([prazo, true])
    }
  })

  it('recusa prazo fora da semana do card', () => {
    // A planilha tem esse erro: WINs da S33 com prazo em 14/08, que é semana 34.
    for (const prazo of ['2026-09-19', '2026-09-27', '2026-08-14']) {
      const r = validarWin({ descricao: 'x', prazo }, SEMANA_39)
      expect([prazo, r.ok]).toEqual([prazo, false])
      if (!r.ok) expect(r.erros.prazo).toContain('dentro da semana')
    }
  })

  it('recusa data inválida', () => {
    const r = validarWin({ descricao: 'x', prazo: '2026-13-45' }, SEMANA_39)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros.prazo).toBe('Data inválida.')
  })

  it('limita o tamanho da descrição e do suporte', () => {
    expect(validarWin({ descricao: 'a'.repeat(301) }, SEMANA_39).ok).toBe(false)
    expect(
      validarWin({ descricao: 'x', suporte: 'b'.repeat(121) }, SEMANA_39).ok,
    ).toBe(false)
  })

  it('funciona com FormData', () => {
    const dados = new FormData()
    dados.set('descricao', 'Alinhamento com a GFIN')
    dados.set('status', StatusWin.EM_ANDAMENTO)
    const r = validarWin(dados, SEMANA_39)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dados.status).toBe(StatusWin.EM_ANDAMENTO)
  })
})

describe('validarCard', () => {
  it('aceita card totalmente vazio — os campos são opcionais', () => {
    const r = validarCard({})
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.dados).toEqual({
        area: null,
        atividade: null,
        alertaRiscos: null,
        pedidoAjuda: null,
      })
    }
  })

  it('guarda riscos e pedido de ajuda', () => {
    const r = validarCard({
      area: 'AGP - Gerenciamento de Programa & Projetos',
      alertaRiscos: 'Possível cancelamento da agenda com o André.',
      pedidoAjuda: 'Obter arquivo da gestão STI.',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.dados.alertaRiscos).toContain('André')
  })

  it('recusa texto longo demais', () => {
    const r = validarCard({ alertaRiscos: 'a'.repeat(2001) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erros.alertaRiscos).toBeDefined()
  })
})

describe('podeAdicionarWin — o limite rígido de 3', () => {
  it('aceita enquanto há vaga', () => {
    expect(podeAdicionarWin([], 1)).toEqual({ ok: true })
    expect(podeAdicionarWin([1], 2)).toEqual({ ok: true })
    expect(podeAdicionarWin([1, 2], 3)).toEqual({ ok: true })
  })

  it('recusa o quarto WIN da semana', () => {
    const r = podeAdicionarWin([1, 2, 3], 1)
    expect(r).toEqual({ ok: false, erro: 'LIMITE_ATINGIDO' })
  })

  it('recusa posição fora de 1 a 3', () => {
    for (const ordem of [0, 4, -1, 1.5]) {
      expect(podeAdicionarWin([], ordem)).toEqual({ ok: false, erro: 'ORDEM_INVALIDA' })
    }
  })

  it('recusa posição já ocupada', () => {
    expect(podeAdicionarWin([2], 2)).toEqual({ ok: false, erro: 'ORDEM_OCUPADA' })
  })

  it('o máximo é o mesmo que a planilha impõe pelo formato', () => {
    expect(MAXIMO_WINS_POR_SEMANA).toBe(3)
  })
})

describe('proximaOrdemLivre', () => {
  it('devolve a primeira vaga', () => {
    expect(proximaOrdemLivre([])).toBe(1)
    expect(proximaOrdemLivre([1])).toBe(2)
    expect(proximaOrdemLivre([1, 3])).toBe(2)
  })

  it('é nula com a semana cheia', () => {
    expect(proximaOrdemLivre([1, 2, 3])).toBeNull()
  })
})

describe('ehConcluido / rótulos', () => {
  it('só FEITO conta como concluído', () => {
    expect(ehConcluido(StatusWin.FEITO)).toBe(true)
    for (const status of [StatusWin.PENDENTE, StatusWin.EM_ANDAMENTO, StatusWin.NAO_FEITO]) {
      expect(ehConcluido(status)).toBe(false)
    }
  })

  it('todo status tem rótulo em pt-BR', () => {
    for (const status of Object.values(StatusWin)) {
      expect(ROTULO_STATUS_WIN[status].trim()).not.toBe('')
    }
  })
})
