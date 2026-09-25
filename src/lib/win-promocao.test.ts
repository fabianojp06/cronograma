import { describe, expect, it } from 'vitest'

import {
  APARICOES_PARA_PROMOVER,
  contarAparicoesAte,
  aparicoesRestantes,
  deveSerPromovido,
  mensagemDaSituacao,
  situacaoDoWin,
  totalDeAparicoes,
  validarPromocao,
  type WinContavel,
} from './win-promocao'

function win(campos: Partial<WinContavel> = {}): WinContavel {
  return {
    aparicoesAnteriores: 0,
    registros: 1,
    promovidoEm: null,
    encerradoEm: null,
    ...campos,
  }
}

const EM = new Date('2026-09-25T12:00:00.000Z')

describe('o caso real da planilha', () => {
  it('"elicitação de requisitos" — semanas 37, 38 e 39 — deve ser promovido', () => {
    // O WIN que na planilha atravessou três semanas e continuou no card.
    const real = win({ registros: 3 })
    expect(situacaoDoWin(real)).toBe('DEVE_PROMOVER')
    expect(deveSerPromovido(real)).toBe(true)
  })

  it('importado da planilha já com 3 aparições, dispara no primeiro dia', () => {
    // É o motivo de `aparicoesAnteriores` existir: sem semear o contador, o
    // WIN recomeçaria do zero justamente quando a promoção é devida.
    const importado = win({ aparicoesAnteriores: 2, registros: 1 })
    expect(totalDeAparicoes(importado)).toBe(3)
    expect(deveSerPromovido(importado)).toBe(true)
  })
})

describe('totalDeAparicoes', () => {
  it('soma as de fora com as de dentro do sistema', () => {
    expect(totalDeAparicoes(win({ aparicoesAnteriores: 2, registros: 3 }))).toBe(5)
  })

  it('trata número negativo como zero, sem baixar o total', () => {
    expect(totalDeAparicoes(win({ aparicoesAnteriores: -5, registros: 2 }))).toBe(2)
  })

  it('é zero quando não há nenhuma aparição', () => {
    expect(totalDeAparicoes(win({ registros: 0 }))).toBe(0)
  })
})

describe('situacaoDoWin', () => {
  it('primeira semana é NOVO', () => {
    expect(situacaoDoWin(win({ registros: 1 }))).toBe('NOVO')
  })

  it('segunda semana é REPETINDO', () => {
    expect(situacaoDoWin(win({ registros: 2 }))).toBe('REPETINDO')
  })

  it('na terceira dispara a regra', () => {
    expect(situacaoDoWin(win({ registros: APARICOES_PARA_PROMOVER }))).toBe(
      'DEVE_PROMOVER',
    )
  })

  it('continua pedindo promoção depois da terceira', () => {
    expect(situacaoDoWin(win({ registros: 7 }))).toBe('DEVE_PROMOVER')
  })

  it('promovido vence a contagem', () => {
    expect(situacaoDoWin(win({ registros: 9, promovidoEm: EM }))).toBe('PROMOVIDO')
  })

  it('encerrado vence a contagem, mas não a promoção', () => {
    expect(situacaoDoWin(win({ registros: 9, encerradoEm: EM }))).toBe('ENCERRADO')
    expect(situacaoDoWin(win({ registros: 9, promovidoEm: EM, encerradoEm: EM }))).toBe(
      'PROMOVIDO',
    )
  })

  it('um WIN sem nenhuma aparição ainda é NOVO, não DEVE_PROMOVER', () => {
    expect(situacaoDoWin(win({ registros: 0 }))).toBe('NOVO')
  })
})

describe('aparicoesRestantes', () => {
  it('conta quantas faltam', () => {
    expect(aparicoesRestantes(win({ registros: 1 }))).toBe(2)
    expect(aparicoesRestantes(win({ registros: 2 }))).toBe(1)
  })

  it('nunca é negativa depois que a regra dispara', () => {
    expect(aparicoesRestantes(win({ registros: 3 }))).toBe(0)
    expect(aparicoesRestantes(win({ registros: 10 }))).toBe(0)
  })
})

describe('mensagemDaSituacao', () => {
  it('diz o que fazer quando a regra dispara, não só que disparou', () => {
    const mensagem = mensagemDaSituacao(win({ registros: 3 }))
    expect(mensagem).toContain('3ª semana')
    expect(mensagem).toContain('plano de ação')
  })

  it('avisa quantas faltam enquanto repete', () => {
    expect(mensagemDaSituacao(win({ registros: 2 }))).toContain('Mais 1')
  })

  it('tem texto próprio para promovido e encerrado', () => {
    expect(mensagemDaSituacao(win({ promovidoEm: EM }))).toContain('plano de ação')
    expect(mensagemDaSituacao(win({ encerradoEm: EM }))).toContain('Encerrado')
  })
})

describe('validarPromocao', () => {
  const aberto = { promovidoEm: null }

  it('aceita projeto novo sem exigir projetoId', () => {
    expect(validarPromocao(aberto, { destino: 'PROJETO', projetoId: null })).toEqual({
      ok: true,
    })
  })

  it('aceita ação quando o projeto foi escolhido', () => {
    expect(validarPromocao(aberto, { destino: 'ACAO', projetoId: 'p1' })).toEqual({
      ok: true,
    })
  })

  it('recusa ação sem projeto', () => {
    const r = validarPromocao(aberto, { destino: 'ACAO', projetoId: null })
    expect(r).toEqual({ ok: false, erro: 'PROJETO_OBRIGATORIO' })
  })

  it('recusa projeto vazio ou só espaços como escolha de projeto', () => {
    expect(validarPromocao(aberto, { destino: 'ACAO', projetoId: '' }).ok).toBe(false)
  })

  it('recusa destino desconhecido', () => {
    const r = validarPromocao(aberto, {
      destino: 'OUTRO' as 'PROJETO',
      projetoId: null,
    })
    expect(r).toEqual({ ok: false, erro: 'DESTINO_INVALIDO' })
  })

  it('recusa promover duas vezes', () => {
    const r = validarPromocao({ promovidoEm: EM }, { destino: 'PROJETO', projetoId: null })
    expect(r).toEqual({ ok: false, erro: 'JA_PROMOVIDO' })
  })

  it('permite promover antes da terceira semana — o contador lembra, não impede', () => {
    expect(validarPromocao(aberto, { destino: 'PROJETO', projetoId: null }).ok).toBe(true)
  })
})

describe('contarAparicoesAte — contador da semana exibida', () => {
  const aparicoes = [
    { ano: 2026, semana: 37 },
    { ano: 2026, semana: 38 },
    { ano: 2026, semana: 39 },
  ]

  it('congela a contagem na semana que está sendo vista', () => {
    // Abrir a S37 precisa mostrar o que era verdade lá, não o total de hoje:
    // senão uma semana antiga exibiria "3ª semana" e o alerta de promoção
    // para um WIN que ali estava na primeira aparição.
    expect(contarAparicoesAte(0, aparicoes, { ano: 2026, semana: 37 })).toBe(1)
    expect(contarAparicoesAte(0, aparicoes, { ano: 2026, semana: 38 })).toBe(2)
    expect(contarAparicoesAte(0, aparicoes, { ano: 2026, semana: 39 })).toBe(3)
  })

  it('inclui a própria semana', () => {
    expect(contarAparicoesAte(0, [{ ano: 2026, semana: 39 }], { ano: 2026, semana: 39 })).toBe(1)
  })

  it('soma as aparições anteriores ao sistema', () => {
    expect(contarAparicoesAte(2, aparicoes, { ano: 2026, semana: 37 })).toBe(3)
  })

  it('compara ano antes de semana, sem confundir a virada', () => {
    const cruzando = [
      { ano: 2026, semana: 52 },
      { ano: 2027, semana: 1 },
    ]
    expect(contarAparicoesAte(0, cruzando, { ano: 2026, semana: 52 })).toBe(1)
    expect(contarAparicoesAte(0, cruzando, { ano: 2027, semana: 1 })).toBe(2)
    // A semana 1 de 2027 vem DEPOIS da 52 de 2026, embora o número seja menor.
    expect(contarAparicoesAte(0, [{ ano: 2027, semana: 1 }], { ano: 2026, semana: 52 })).toBe(0)
  })

  it('é zero quando não há aparição até ali', () => {
    expect(contarAparicoesAte(0, aparicoes, { ano: 2026, semana: 36 })).toBe(0)
  })

  it('trata aparicoesAnteriores negativo como zero', () => {
    expect(contarAparicoesAte(-5, aparicoes, { ano: 2026, semana: 39 })).toBe(3)
  })
})
