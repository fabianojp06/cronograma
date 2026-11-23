import { describe, expect, it, vi } from 'vitest'

import {
  CAMPOS_DATA,
  ehColisaoDeNumero,
  lerDataISO,
  lerMacroetapaId,
  lerResponsavelId,
  proximoNumero,
  ROTULOS_STATUS,
  refazerNaColisao,
  STATUS_ACAO,
  TENTATIVAS_NUMERO,
  validarDadosAcao,
} from './acao-validacao'

function valido(extra: Record<string, string> = {}) {
  return { descricao: 'Levantar inventário', ...extra }
}

describe('validarDadosAcao', () => {
  it('aceita apenas a descrição e assume status NAO_INICIADO', () => {
    const resultado = validarDadosAcao(valido())
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.descricao).toBe('Levantar inventário')
    expect(resultado.dados.status).toBe('NAO_INICIADO')
    for (const campo of CAMPOS_DATA) {
      expect(resultado.dados[campo]).toBeNull()
    }
  })

  it('exige descrição', () => {
    const resultado = validarDadosAcao({ descricao: '   ' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.descricao).toBeDefined()
  })

  it('recusa descrição acima de 500 caracteres', () => {
    const resultado = validarDadosAcao({ descricao: 'x'.repeat(501) })
    expect(resultado.ok).toBe(false)
  })

  it('aceita todos os valores do enum StatusAcao', () => {
    for (const status of STATUS_ACAO) {
      const resultado = validarDadosAcao(valido({ status }))
      expect(resultado.ok).toBe(true)
      if (resultado.ok) expect(resultado.dados.status).toBe(status)
    }
  })

  it('recusa status fora do enum', () => {
    const resultado = validarDadosAcao(valido({ status: 'EM_CURSO_90' }))
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.status).toBeDefined()
  })

  it('converte datas para meia-noite UTC', () => {
    const resultado = validarDadosAcao(valido({ previstoInicio: '2026-03-01' }))
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.previstoInicio?.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    )
  })

  it('recusa data malformada e data inexistente', () => {
    for (const valor of ['01/03/2026', '2026-02-31', '2026-13-01']) {
      const resultado = validarDadosAcao(valido({ previstoInicio: valor }))
      expect(resultado.ok, valor).toBe(false)
      if (resultado.ok) continue
      expect(resultado.erros.previstoInicio).toBeDefined()
    }
  })

  it('recusa término previsto anterior ao início previsto', () => {
    const resultado = validarDadosAcao(
      valido({ previstoInicio: '2026-03-10', previstoTermino: '2026-03-01' }),
    )
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.previstoTermino).toBeDefined()
  })

  it('recusa término realizado anterior ao início realizado', () => {
    const resultado = validarDadosAcao(
      valido({ realizadoInicio: '2026-03-10', realizadoTermino: '2026-03-09' }),
    )
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.realizadoTermino).toBeDefined()
  })

  it('aceita início e término no mesmo dia', () => {
    const resultado = validarDadosAcao(
      valido({ previstoInicio: '2026-03-10', previstoTermino: '2026-03-10' }),
    )
    expect(resultado.ok).toBe(true)
  })

  it('lê FormData igual a objeto simples', () => {
    const form = new FormData()
    form.set('descricao', 'Com FormData')
    form.set('status', 'CONCLUIDO')
    form.set('realizadoTermino', '2026-04-02')
    const resultado = validarDadosAcao(form)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.descricao).toBe('Com FormData')
    expect(resultado.dados.status).toBe('CONCLUIDO')
    expect(resultado.dados.realizadoTermino?.toISOString()).toBe(
      '2026-04-02T00:00:00.000Z',
    )
  })
})

describe('lerDataISO', () => {
  it('string vazia é ausência de data, não erro', () => {
    expect(lerDataISO('')).toBeNull()
  })
})

describe('ROTULOS_STATUS', () => {
  it('cobre todos os valores do enum', () => {
    for (const status of STATUS_ACAO) {
      expect(ROTULOS_STATUS[status]).toBeTruthy()
    }
  })
})

describe('proximoNumero', () => {
  it('começa em 1 quando o projeto não tem ações', () => {
    expect(proximoNumero(null)).toBe(1)
    expect(proximoNumero(undefined)).toBe(1)
  })

  it('incrementa o maior número existente', () => {
    expect(proximoNumero(1)).toBe(2)
    expect(proximoNumero(7)).toBe(8)
  })
})

describe('ehColisaoDeNumero', () => {
  // Vive em `src/lib` porque os DOIS caminhos que criam uma Ação — o
  // formulário e a promoção de um WIN — leem o maior número e só depois
  // gravam. A promoção nasceu sem o laço de nova tentativa e estourava com
  // P2002 sob concorrência, deixando o WIN sem o item do plano de ação.
  it('reconhece a violação de unicidade do Prisma', () => {
    expect(ehColisaoDeNumero({ code: 'P2002' })).toBe(true)
  })

  it('não confunde com outros erros do Prisma', () => {
    expect(ehColisaoDeNumero({ code: 'P2025' })).toBe(false)
  })

  it('aguenta erro comum, null e undefined sem estourar', () => {
    expect(ehColisaoDeNumero(new Error('qualquer'))).toBe(false)
    expect(ehColisaoDeNumero(null)).toBe(false)
    expect(ehColisaoDeNumero(undefined)).toBe(false)
    expect(ehColisaoDeNumero('P2002')).toBe(false)
  })

  it('o limite de tentativas é finito — o laço nunca pode ser infinito', () => {
    expect(TENTATIVAS_NUMERO).toBeGreaterThan(1)
    expect(Number.isFinite(TENTATIVAS_NUMERO)).toBe(true)
  })
})

describe('refazerNaColisao', () => {
  const colisao = Object.assign(new Error('unique'), { code: 'P2002' })

  it('devolve o resultado quando não há colisão, sem repetir', async () => {
    const operacao = vi.fn(async () => 'pronto')
    expect(await refazerNaColisao(operacao)).toBe('pronto')
    expect(operacao).toHaveBeenCalledTimes(1)
  })

  it('refaz a operação INTEIRA na colisão, e não só o trecho que falhou', async () => {
    // É a diferença que motivou o helper: dentro da transação, repetir só o
    // `create` não adianta — a transação já está abortada. De fora, a operação
    // toda recomeça.
    let chamadas = 0
    const operacao = vi.fn(async () => {
      chamadas += 1
      if (chamadas < 3) throw colisao
      return chamadas
    })
    expect(await refazerNaColisao(operacao)).toBe(3)
    expect(operacao).toHaveBeenCalledTimes(3)
  })

  it('devolve null quando esgota as tentativas, em vez de estourar', async () => {
    const operacao = vi.fn(async () => {
      throw colisao
    })
    expect(await refazerNaColisao(operacao, 4)).toBeNull()
    expect(operacao).toHaveBeenCalledTimes(4)
  })

  it('propaga qualquer erro que não seja colisão de número', async () => {
    const operacao = vi.fn(async () => {
      throw new Error('banco fora do ar')
    })
    await expect(refazerNaColisao(operacao)).rejects.toThrow('banco fora do ar')
    expect(operacao).toHaveBeenCalledTimes(1)
  })
})

describe('lerResponsavelId', () => {
  function fd(campos: Record<string, string>) {
    const f = new FormData()
    for (const [k, v] of Object.entries(campos)) f.set(k, v)
    return f
  }

  it('devolve o id escolhido', () => {
    expect(lerResponsavelId(fd({ responsavelId: 'colab-1' }))).toBe('colab-1')
  })

  it('trata vazio como "sem responsável"', () => {
    expect(lerResponsavelId(fd({ responsavelId: '' }))).toBeNull()
    expect(lerResponsavelId(fd({ responsavelId: '  ' }))).toBeNull()
  })

  // Uma aba aberta antes desta versão não traz o campo; ler isso como "sem
  // responsável" apagaria o de quem já tinha, em silêncio.
  it('trata campo ausente como "não mexer"', () => {
    expect(lerResponsavelId(fd({ descricao: 'x' }))).toBeUndefined()
    expect(lerResponsavelId({})).toBeUndefined()
  })
})

describe('lerMacroetapaId', () => {
  function fd(campos: Record<string, string>) {
    const f = new FormData()
    for (const [k, v] of Object.entries(campos)) f.set(k, v)
    return f
  }

  it('devolve o id escolhido', () => {
    expect(lerMacroetapaId(fd({ macroetapaId: 'mac-1' }))).toBe('mac-1')
  })

  it('trata vazio como "sem macroetapa"', () => {
    expect(lerMacroetapaId(fd({ macroetapaId: '' }))).toBeNull()
    expect(lerMacroetapaId(fd({ macroetapaId: '  ' }))).toBeNull()
  })

  it('trata campo ausente como "não mexer"', () => {
    expect(lerMacroetapaId(fd({ descricao: 'x' }))).toBeUndefined()
    expect(lerMacroetapaId({})).toBeUndefined()
  })
})
