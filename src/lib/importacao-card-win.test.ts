import { describe, expect, it } from 'vitest'

import {
  chaveDeComparacao,
  contarAparicoesAnteriores,
  lerAba,
  prepararImportacao,
  traduzirStatus,
  type CardLido,
} from './importacao-card-win'

/** Aba no layout real do arquivo, com as referências que o módulo lê. */
function aba(nome: string, semana: number, wins: [string, string?][], extras = {}) {
  const celulas: Record<string, string> = {
    AD4: String(semana),
    H6: 'AGP - Gerenciamento de Programa & Projetos',
    R6: 'Mapeamento de Processos',
    AB6: 'Fabiano Garcia',
    ...extras,
  }
  const linhas = [20, 21, 22]
  wins.forEach(([descricao, status], i) => {
    celulas[`H${linhas[i]}`] = descricao
    if (status) celulas[`AD${linhas[i]}`] = status
  })
  return { nome, celulas }
}

describe('lerAba', () => {
  it('lê cabeçalho e WINs da semana atual', () => {
    const card = lerAba(
      aba('S39', 39, [['Desenvolvimento do documento de elicitação', 'EM ANDAMENTO']], {
        Z20: 'André - GFIN',
        AB20: '46290',
        D25: 'Agenda com André, alerta para possível cancelamento.',
        R25: 'Obter arquivo da gestão STI.',
      }),
    )
    expect(card).not.toBeNull()
    if (!card) return
    expect(card.semana).toBe(39)
    expect(card.colaborador).toBe('Fabiano Garcia')
    expect(card.atividade).toBe('Mapeamento de Processos')
    expect(card.alertaRiscos).toContain('cancelamento')
    expect(card.pedidoAjuda).toContain('STI')
    expect(card.wins).toHaveLength(1)
    expect(card.wins[0]).toMatchObject({
      ordem: 1,
      suporte: 'André - GFIN',
      prazoSerial: 46290,
      statusBruto: 'EM ANDAMENTO',
    })
  })

  it('ignora linhas de WIN vazias e numera na ordem do card', () => {
    const card = lerAba(aba('S31', 31, [['Primeiro'], ['Segundo'], ['Terceiro']]))
    expect(card?.wins.map((w) => [w.ordem, w.descricao])).toEqual([
      [1, 'Primeiro'],
      [2, 'Segundo'],
      [3, 'Terceiro'],
    ])
  })

  it('devolve null quando a aba não tem número de semana', () => {
    expect(lerAba({ nome: 'Referências', celulas: {} })).toBeNull()
  })

  it('trata célula só com espaços como vazia', () => {
    const card = lerAba(aba('S39', 39, [['x']], { Z20: '   ' }))
    expect(card?.wins[0].suporte).toBeNull()
  })
})

describe('traduzirStatus', () => {
  it('mapeia o vocabulário da planilha', () => {
    expect(traduzirStatus('FEITO')).toBe('FEITO')
    expect(traduzirStatus('NÃO FEITO')).toBe('NAO_FEITO')
    expect(traduzirStatus('EM ANDAMENTO')).toBe('EM_ANDAMENTO')
  })

  it('célula vazia vira PENDENTE — é o caso mais comum na planilha', () => {
    expect(traduzirStatus(null)).toBe('PENDENTE')
  })

  it('tolera caixa e espaços', () => {
    expect(traduzirStatus('  feito  ')).toBe('FEITO')
    expect(traduzirStatus('Em Andamento')).toBe('EM_ANDAMENTO')
  })

  it('texto desconhecido vira PENDENTE em vez de quebrar', () => {
    expect(traduzirStatus('QUASE LÁ')).toBe('PENDENTE')
  })
})

describe('chaveDeComparacao', () => {
  it('iguala as três grafias do mesmo WIN na planilha', () => {
    const a = 'Desenvolvimento do documento de elicitação de requisitos - relatórios orçamentários'
    const b = 'Desenvolvimento do documento de elicitação de requisitos - relatórios orçamentários () '
    const c = 'Desenvolvimento do documento de elicitação de requisitos - relatórios orçamentários ()  - SGO'
    expect(chaveDeComparacao(a)).toBe(chaveDeComparacao(b))
    expect(chaveDeComparacao(a)).toBe(chaveDeComparacao(c))
  })

  it('não iguala WINs realmente diferentes', () => {
    expect(chaveDeComparacao('Criar apresentação do projeto')).not.toBe(
      chaveDeComparacao('Finalização da documentação do módulo'),
    )
  })

  it('ignora acento, caixa e pontuação', () => {
    expect(chaveDeComparacao('Ação: revisão!')).toBe(chaveDeComparacao('acao revisao'))
  })
})

describe('contarAparicoesAnteriores', () => {
  const cards: CardLido[] = [
    { ...lerAba(aba('S37', 37, [['Elicitação de requisitos - relatórios orçamentários']]))! },
    { ...lerAba(aba('S38', 38, [['Elicitação de requisitos - relatórios orçamentários ()']]))! },
    { ...lerAba(aba('S39', 39, [['Elicitação de requisitos - relatórios orçamentários () - SGO']]))! },
  ]

  it('conta as semanas anteriores em que o mesmo WIN apareceu', () => {
    expect(
      contarAparicoesAnteriores(
        'Elicitação de requisitos - relatórios orçamentários () - SGO',
        cards,
        39,
      ),
    ).toBe(2)
  })

  it('não conta a própria semana nem as posteriores', () => {
    expect(contarAparicoesAnteriores('Elicitação de requisitos - relatórios orçamentários', cards, 37)).toBe(0)
  })

  it('é zero para um WIN inédito', () => {
    expect(contarAparicoesAnteriores('Assunto totalmente novo', cards, 39)).toBe(0)
  })

  it('conta a semana uma vez só, mesmo se o WIN se repetir na mesma aba', () => {
    const duplicado = [lerAba(aba('S38', 38, [['Mesmo item'], ['Mesmo item']]))!]
    expect(contarAparicoesAnteriores('Mesmo item', duplicado, 39)).toBe(1)
  })
})

describe('prepararImportacao — o caso real da semana 39', () => {
  const cards: CardLido[] = [
    lerAba(aba('S37', 37, [['Elicitação de requisitos - relatórios orçamentários']]))!,
    lerAba(aba('S38', 38, [['Elicitação de requisitos - relatórios orçamentários ()']]))!,
    lerAba(
      aba('S39', 39, [
        ['Elicitação de requisitos - relatórios orçamentários () - SGO', 'EM ANDAMENTO'],
        ['Alinhamento Módulos Autenticação - SGO', 'FEITO'],
      ]),
    )!,
  ]

  it('semeia o contador para que a regra das 3 dispare no primeiro dia', () => {
    const resumo = prepararImportacao(cards, 39)
    expect(resumo).not.toBeNull()
    if (!resumo) return

    const [repetido, novo] = resumo.wins
    expect(repetido.aparicoesAnteriores).toBe(2)
    expect(repetido.aparicoesTotais).toBe(3) // dispara a promoção
    expect(repetido.status).toBe('EM_ANDAMENTO')

    expect(novo.aparicoesAnteriores).toBe(0)
    expect(novo.aparicoesTotais).toBe(1)
    expect(novo.status).toBe('FEITO')
  })

  it('devolve null quando a semana pedida não existe no arquivo', () => {
    expect(prepararImportacao(cards, 34)).toBeNull()
  })
})

describe('traduzirStatus não depende da forma Unicode', () => {
  // O Excel entrega "NÃO FEITO" ora com o til composto (U+00C3), ora
  // decomposto (A + U+0303). São strings diferentes para o `Record`, e sem
  // normalizar a segunda caía calada em PENDENTE: um WIN não feito voltaria
  // como pendente, sem nenhum erro para denunciar.
  const composto = 'NÃO FEITO'.normalize('NFC')
  const decomposto = 'NÃO FEITO'.normalize('NFD')

  it('as duas formas são de fato strings diferentes', () => {
    expect(decomposto).not.toBe(composto)
  })

  it.each([composto, decomposto])('traduz %j para NAO_FEITO', (bruto) => {
    expect(traduzirStatus(bruto)).toBe('NAO_FEITO')
  })

  it('traduz também em minúsculas e com espaços sobrando', () => {
    expect(traduzirStatus('  não feito '.normalize('NFD'))).toBe('NAO_FEITO')
  })

  it('texto desconhecido continua caindo em PENDENTE', () => {
    expect(traduzirStatus('talvez')).toBe('PENDENTE')
  })
})
