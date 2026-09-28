import { describe, expect, it } from 'vitest'

import { conferirImportacao, type EntradaConferencia } from './validacao-card-win'

const alvo = {
  id: 'p1',
  nome: 'Fabiano Santos Garcia',
  area: 'AGP',
  clerkUserId: 'user_1',
  cards: 1,
}

const base: EntradaConferencia = {
  nomeNaPlanilha: 'Fabiano Garcia',
  areaNaPlanilha: 'AGP',
  atividadeNaPlanilha: 'Mapeamento de Processos',
  ano: 2026,
  semana: 40,
  winsEsperados: [
    { ordem: 1, descricao: 'Elicitação de requisitos', suporte: 'André', status: 'EM_ANDAMENTO', aparicoesAnteriores: 3 },
    { ordem: 2, descricao: 'Analisar tela de NFs', suporte: null, status: 'NAO_FEITO', aparicoesAnteriores: 0 },
  ],
  colaboradores: [alvo],
  idAlvo: 'p1',
  cardGravado: { area: 'AGP', atividade: 'Mapeamento de Processos' },
  winsGravados: [
    { ordem: 1, descricao: 'Elicitação de requisitos', suporte: 'André', status: 'EM_ANDAMENTO', aparicoesAnteriores: 3, desfecho: 'NO_CARD' },
    { ordem: 2, descricao: 'Analisar tela de NFs', suporte: null, status: 'NAO_FEITO', aparicoesAnteriores: 0, desfecho: 'NO_CARD' },
  ],
}

const erros = (e: EntradaConferencia) =>
  conferirImportacao(e).filter((d) => d.gravidade === 'ERRO').map((d) => d.mensagem)
const avisos = (e: EntradaConferencia) =>
  conferirImportacao(e).filter((d) => d.gravidade === 'AVISO').map((d) => d.mensagem)

describe('conferirImportacao', () => {
  it('não reclama de uma importação correta', () => {
    expect(conferirImportacao(base)).toEqual([])
  })

  /**
   * O estado de produção depois de uma importação sem `--colaborador`: o
   * cadastro original com a conta do Clerk e zero cards, e uma linha nova com
   * o nome da planilha e o card.
   *
   * Tem de ser acusado pelos DOIS caminhos, porque quem confere pode ou não
   * passar a flag — e sem ela a conferência resolve para a mesma linha errada
   * que a importação criou.
   */
  const partido = [
    { ...alvo, cards: 0 },
    { id: 'p2', nome: 'Fabiano Garcia', area: 'AGP', clerkUserId: null, cards: 1 },
  ]

  it('acusa a duplicata quando a conferência recebe --colaborador', () => {
    const e = { ...base, colaboradores: partido, idAlvo: 'p1' }
    expect(erros(e)[0]).toContain('Duas pessoas para a mesma planilha')
  })

  it('acusa a duplicata também sem a flag, pela conta órfã', () => {
    const e = { ...base, colaboradores: partido, idAlvo: 'p2' }
    expect(erros(e).join()).toContain('partida em duas')
  })

  it('avisa, sem acusar erro, quando ninguém vinculou conta ainda', () => {
    const e = { ...base, colaboradores: [{ ...alvo, clerkUserId: null }] }
    expect(erros(e)).toEqual([])
    expect(avisos(e).join()).toContain('ainda não tem conta vinculada')
  })

  it('acusa quando não gravou nada', () => {
    expect(erros({ ...base, idAlvo: null })[0]).toContain('não gravou')
  })

  it('acusa card ausente na semana', () => {
    expect(erros({ ...base, cardGravado: null })[0]).toContain('2026/S40')
  })

  /**
   * O contador é o que faz a regra das 3 semanas disparar. Errado, ela dispara
   * na hora errada — ou nunca.
   */
  it('acusa contador de aparições diferente do da planilha', () => {
    const e = {
      ...base,
      winsGravados: [{ ...base.winsGravados[0], aparicoesAnteriores: 0 }, base.winsGravados[1]],
    }
    expect(erros(e)[0]).toContain('contador errado')
  })

  it('acusa descrição diferente', () => {
    const e = {
      ...base,
      winsGravados: [{ ...base.winsGravados[0], descricao: 'Outra coisa' }, base.winsGravados[1]],
    }
    expect(erros(e)[0]).toContain('descrição diferente')
  })

  it('acusa WIN da planilha que não foi gravado', () => {
    expect(erros({ ...base, winsGravados: [base.winsGravados[0]] })[0]).toContain(
      'WIN 02 da planilha não foi gravado',
    )
  })

  /**
   * O caso que o índice parcial permite: uma aparição resolvida não ocupa
   * vaga, então uma recriada cabe ao lado dela. `/wins` mostraria 3 e
   * `/dashboards` contaria 4.
   */
  it('acusa mais de três WINs ocupando vaga', () => {
    const e = {
      ...base,
      winsGravados: [
        ...base.winsGravados,
        { ordem: 3, descricao: 'c', suporte: null, status: 'PENDENTE', aparicoesAnteriores: 0, desfecho: 'NO_CARD' },
        { ordem: 1, descricao: 'd', suporte: null, status: 'PENDENTE', aparicoesAnteriores: 0, desfecho: 'NO_CARD' },
      ],
    }
    expect(erros(e).join()).toContain('4 WINs ocupando vaga')
  })

  // Promover depois da importação é uso normal, não defeito.
  it('trata WIN promovido depois como aviso, não erro', () => {
    const e = {
      ...base,
      winsGravados: [{ ...base.winsGravados[0], desfecho: 'PROMOVIDO' }, base.winsGravados[1]],
    }
    expect(erros(e)).toEqual([])
    expect(avisos(e).join()).toContain('não está mais no card')
  })

  // A área do cadastro é semeada, não espelhada — divergir é o comportamento
  // documentado, e só vira aviso quando está vazia.
  it('avisa cadastro sem área, e não reclama quando difere da planilha', () => {
    expect(avisos({ ...base, colaboradores: [{ ...alvo, area: null }] }).join()).toContain(
      'sem área no cadastro',
    )
    expect(conferirImportacao({ ...base, colaboradores: [{ ...alvo, area: 'ACT' }] })).toEqual([])
  })

  it('avisa WIN no card que a planilha não tem', () => {
    const e = {
      ...base,
      winsGravados: [
        ...base.winsGravados,
        { ordem: 3, descricao: 'digitado na tela', suporte: null, status: 'PENDENTE', aparicoesAnteriores: 0, desfecho: 'NO_CARD' },
      ],
    }
    expect(erros(e)).toEqual([])
    expect(avisos(e).join()).toContain('não na planilha desta semana')
  })

  it('trata vazio e ausente como iguais em área e suporte', () => {
    const e = {
      ...base,
      areaNaPlanilha: null,
      cardGravado: { area: null, atividade: 'Mapeamento de Processos' },
    }
    expect(conferirImportacao(e)).toEqual([])
  })
})
