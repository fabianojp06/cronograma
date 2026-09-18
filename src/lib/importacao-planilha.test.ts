import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import {
  type Celula,
  converterData,
  converterStatus,
  extrairIdentificacaoProjeto,
  importarCroDep,
  importarPlanilha,
  mapearColunas,
  normalizarRotulo,
  totaisImportacao,
} from './importacao-planilha'

/**
 * Cenário mínimo com o formato do PLA-DEP: duas linhas de título antes do
 * cabeçalho, colunas de projeto preenchidas só na primeira linha do bloco
 * (mescladas na planilha) e cada ação em duas linhas, Previsto e Realizado.
 */
const CABECALHO = [
  'N°',
  'Prioridade',
  'Equipe',
  'Natureza',
  'Assunto (Projeto / Iniciativa)',
  'Categoria',
  'Ação',
  'Linha',
  'Início',
  'Término',
  'Responsável',
  'Apoio',
  'Setor Envolvido',
  'Comentário',
  'Progresso',
]

function planilhaExemplo(): Celula[][] {
  return [
    ['PLANO DE AÇÃO 2026 — CTCEA', null, null],
    [],
    CABECALHO,
    [
      'PLA-DEP-2026-001',
      1,
      'STI',
      'Desenvolvimento',
      'Sistema Cronograma',
      'Interno',
      'Levantar requisitos',
      'Previsto',
      '05/01/2026',
      '09/01/2026',
      'Fabiano',
      'Ana',
      'GIA',
      'Prioridade da diretoria',
      1,
    ],
    [
      null, null, null, null, null, null,
      'Levantar requisitos',
      'Realizado',
      '05/01/2026',
      '12/01/2026',
      null, null, null, null, null,
    ],
    [
      null, null, null, null, null, null,
      'Desenhar o schema',
      'Previsto',
      '12/01/2026',
      '16/01/2026',
      null, null, null, null,
      0.5,
    ],
    [
      null, null, null, null, null, null,
      'Desenhar o schema',
      'Realizado',
      null,
      null,
      null, null, null, null, null,
    ],
    [],
    [
      'PLA-DEP-2026-002',
      2,
      'GRH',
      'Iniciativa',
      'Plano de capacitação',
      null,
      'Mapear trilhas',
      'Previsto',
      '02/02/2026',
      '06/02/2026',
      'Marta',
      null, null, null,
      'Não iniciado',
    ],
  ]
}

describe('normalizarRotulo', () => {
  it('remove acento, caixa e pontuação de cabeçalho', () => {
    expect(normalizarRotulo('  Início ')).toBe('inicio')
    expect(normalizarRotulo('N°')).toBe('n')
    expect(normalizarRotulo('Setor  Envolvido')).toBe('setor envolvido')
    expect(normalizarRotulo(null)).toBe('')
  })
})

describe('mapearColunas', () => {
  it('encontra o cabeçalho abaixo das linhas de título', () => {
    const mapa = mapearColunas(planilhaExemplo())
    expect(mapa?.linhaCabecalho).toBe(2)
    expect(mapa?.colunas.acao).toBe(6)
    expect(mapa?.colunas.inicio).toBe(8)
    expect(mapa?.colunas.progresso).toBe(14)
  })

  it('ignora as repetições de "Início" da grade semanal (primeira ocorrência vence)', () => {
    const mapa = mapearColunas([[...CABECALHO, 'Início', 'Término']])
    expect(mapa?.colunas.inicio).toBe(8)
    expect(mapa?.colunas.termino).toBe(9)
  })

  it('devolve null quando nenhuma linha parece cabeçalho', () => {
    expect(mapearColunas([['a', 'b'], ['c', 'd']])).toBeNull()
  })
})

describe('converterData', () => {
  it('lê dd/mm/aaaa como meia-noite UTC', () => {
    expect(converterData('05/01/2026')?.toISOString()).toBe('2026-01-05T00:00:00.000Z')
  })

  it('lê o serial do Excel', () => {
    // 45658 = 01/01/2025 no sistema de datas 1900 do Excel.
    expect(converterData(45658)?.toISOString()).toBe('2025-01-01T00:00:00.000Z')
  })

  it('normaliza um Date já convertido pelo leitor, sem escorregar de dia', () => {
    expect(converterData(new Date(2026, 0, 5, 23, 30))?.toISOString()).toBe(
      '2026-01-05T00:00:00.000Z',
    )
  })

  it('devolve null para vazio, lixo e data inexistente', () => {
    expect(converterData(null)).toBeNull()
    expect(converterData('')).toBeNull()
    expect(converterData('a definir')).toBeNull()
    expect(converterData('31/02/2026')).toBeNull()
  })
})

describe('converterStatus', () => {
  it('mapeia percentuais para a faixa imediatamente abaixo', () => {
    expect(converterStatus(0)).toBe(StatusAcao.NAO_INICIADO)
    expect(converterStatus(0.25)).toBe(StatusAcao.EM_CURSO_25)
    expect(converterStatus('60%')).toBe(StatusAcao.EM_CURSO_50)
    expect(converterStatus(75)).toBe(StatusAcao.EM_CURSO_75)
    expect(converterStatus(1)).toBe(StatusAcao.CONCLUIDO)
    expect(converterStatus('100%')).toBe(StatusAcao.CONCLUIDO)
  })

  it('mapeia o texto usado na planilha', () => {
    expect(converterStatus('Concluído')).toBe(StatusAcao.CONCLUIDO)
    expect(converterStatus('Em curso')).toBe(StatusAcao.EM_CURSO_50)
    expect(converterStatus('Não iniciado')).toBe(StatusAcao.NAO_INICIADO)
    expect(converterStatus(null)).toBe(StatusAcao.NAO_INICIADO)
  })
})

describe('importarPlanilha', () => {
  it('agrupa as ações no projeto e junta as linhas Previsto e Realizado', () => {
    const resultado = importarPlanilha(planilhaExemplo())

    expect(resultado.projetos).toHaveLength(2)
    const [projeto] = resultado.projetos
    expect(projeto).toMatchObject({
      referencia: 'PLA-DEP-2026-001',
      nome: 'Sistema Cronograma',
      equipe: 'STI',
      natureza: 'Desenvolvimento',
      categoria: 'Interno',
      responsavel: 'Fabiano',
      apoio: 'Ana',
      setorEnvolvido: 'GIA',
      comentario: 'Prioridade da diretoria',
      prioridade: 1,
    })

    expect(projeto.acoes).toHaveLength(2)
    const [primeira, segunda] = projeto.acoes
    expect(primeira.numero).toBe(1)
    expect(primeira.previstoInicio?.toISOString()).toBe('2026-01-05T00:00:00.000Z')
    expect(primeira.previstoTermino?.toISOString()).toBe('2026-01-09T00:00:00.000Z')
    expect(primeira.realizadoTermino?.toISOString()).toBe('2026-01-12T00:00:00.000Z')
    expect(primeira.status).toBe(StatusAcao.CONCLUIDO)

    expect(segunda.numero).toBe(2)
    expect(segunda.status).toBe(StatusAcao.EM_CURSO_50)
    expect(segunda.realizadoInicio).toBeNull()
    expect(segunda.realizadoTermino).toBeNull()
  })

  it('calcula a duração em dias úteis do Previsto (intervalo fechado)', () => {
    const [projeto] = importarPlanilha(planilhaExemplo()).projetos
    // 05/01 a 09/01/2026 = segunda a sexta = 5 dias úteis.
    expect(projeto.acoes[0].duracaoDiasUteis).toBe(5)
  })

  it('conta linhas lidas e ignoradas e reporta a linha do cabeçalho', () => {
    const resultado = importarPlanilha(planilhaExemplo())
    expect(resultado.linhaCabecalho).toBe(3) // base 1, como a planilha mostra
    expect(resultado.linhasLidas).toBe(5)
    expect(resultado.linhasIgnoradas).toBe(1) // a linha em branco entre os projetos
    expect(totaisImportacao(resultado)).toEqual({ projetos: 2, acoes: 3 })
  })

  it('avisa em vez de lançar quando a ação aparece antes de qualquer projeto', () => {
    const matriz = planilhaExemplo()
    matriz.splice(3, 0, [null, null, null, null, null, null, 'Ação órfã', 'Previsto', '05/01/2026'])

    const resultado = importarPlanilha(matriz)
    expect(resultado.projetos).toHaveLength(2)
    expect(resultado.avisos.some((a) => a.includes('Ação órfã'))).toBe(true)
  })

  it('usa a referência padrão quando a planilha não traz a coluna N° (caso CRO-DEP)', () => {
    const matriz = planilhaExemplo().map((linha) => linha.slice(1))
    const resultado = importarPlanilha(matriz, { referenciaPadrao: 'CRO-DEP-2026-001' })
    expect(resultado.projetos[0].referencia).toBe('CRO-DEP-2026-001')
  })

  it('devolve aviso e nenhum projeto quando não há cabeçalho reconhecível', () => {
    const resultado = importarPlanilha([['relatório'], ['sem tabela']])
    expect(resultado.projetos).toEqual([])
    expect(resultado.avisos).toHaveLength(1)
  })
})

/**
 * Cenário do CRO-DEP: um projeto só, identificado nas linhas de título (não há
 * coluna "Assunto"), com as ações em duas linhas (Previsto / Realizado).
 */
const CABECALHO_CRO = [
  'N°',
  'Ação',
  'Linha',
  'Início',
  'Término',
  'Responsável',
  'Equipe',
  'Progresso',
]

function planilhaCroDep(): Celula[][] {
  return [
    ['CRO-DEP-2026-001', null, null],
    ['Projeto: Implantação do novo portal', null, null],
    [],
    CABECALHO_CRO,
    [1, 'Levantar requisitos', 'Previsto', '02/03/2026', '06/03/2026', 'Ana', 'STI', '100%'],
    [1, 'Levantar requisitos', 'Realizado', '03/03/2026', '09/03/2026', null, null, null],
    [2, 'Homologar', 'Previsto', '10/03/2026', '13/03/2026', 'Bruno', 'STI', 0.5],
    [2, 'Homologar', 'Realizado', null, null, null, null, null],
  ]
}

describe('extrairIdentificacaoProjeto', () => {
  it('lê referência e nome das linhas de título acima do cabeçalho', () => {
    expect(extrairIdentificacaoProjeto(planilhaCroDep(), 3)).toEqual({
      referencia: 'CRO-DEP-2026-001',
      nome: 'Implantação do novo portal',
    })
  })

  it('aceita o rótulo e o valor em células vizinhas', () => {
    const matriz: Celula[][] = [['Projeto', 'Reforma da sede'], ['CRO-DEP-2026-007']]
    expect(extrairIdentificacaoProjeto(matriz, 2)).toEqual({
      referencia: 'CRO-DEP-2026-007',
      nome: 'Reforma da sede',
    })
  })

  it('sem rótulo, usa o título removendo a referência', () => {
    const matriz: Celula[][] = [['CRO-DEP-2026-002 — Modernização do parque de TI']]
    expect(extrairIdentificacaoProjeto(matriz, 1)).toEqual({
      referencia: 'CRO-DEP-2026-002',
      nome: 'Modernização do parque de TI',
    })
  })

  it('devolve nulos quando não há nada acima do cabeçalho', () => {
    expect(extrairIdentificacaoProjeto([[]], 1)).toEqual({ referencia: null, nome: null })
  })
})

describe('importarCroDep', () => {
  it('monta um único projeto com todas as ações da planilha', () => {
    const resultado = importarCroDep(planilhaCroDep())

    expect(resultado.avisos).toEqual([])
    expect(totaisImportacao(resultado)).toEqual({ projetos: 1, acoes: 2 })

    const projeto = resultado.projetos[0]
    expect(projeto.referencia).toBe('CRO-DEP-2026-001')
    expect(projeto.nome).toBe('Implantação do novo portal')
    // Campos que no CRO-DEP só existem por ação: adota o da primeira linha.
    expect(projeto.equipe).toBe('STI')
    expect(projeto.responsavel).toBe('Ana')
  })

  it('casa as linhas Previsto e Realizado da mesma ação', () => {
    const [acao] = importarCroDep(planilhaCroDep()).projetos[0].acoes

    expect(acao.descricao).toBe('Levantar requisitos')
    expect(acao.status).toBe(StatusAcao.CONCLUIDO)
    expect(acao.previstoInicio).toEqual(new Date(Date.UTC(2026, 2, 2)))
    expect(acao.previstoTermino).toEqual(new Date(Date.UTC(2026, 2, 6)))
    expect(acao.realizadoInicio).toEqual(new Date(Date.UTC(2026, 2, 3)))
    expect(acao.realizadoTermino).toEqual(new Date(Date.UTC(2026, 2, 9)))
    expect(acao.duracaoDiasUteis).toBe(5)
  })

  it('nome e referência informados vencem os da planilha', () => {
    const resultado = importarCroDep(planilhaCroDep(), {
      nome: 'Portal CTCEA',
      referencia: 'CRO-DEP-2026-999',
    })

    expect(resultado.projetos[0].nome).toBe('Portal CTCEA')
    expect(resultado.projetos[0].referencia).toBe('CRO-DEP-2026-999')
  })

  it('avisa quando a planilha não identifica nome nem referência', () => {
    const matriz: Celula[][] = [
      CABECALHO_CRO,
      [1, 'Levantar requisitos', 'Previsto', '02/03/2026', '06/03/2026', null, null, null],
    ]
    const resultado = importarCroDep(matriz)

    expect(resultado.avisos).toHaveLength(2)
    expect(resultado.avisos[0]).toContain('Nome do projeto não encontrado')
    expect(resultado.avisos[1]).toContain('Referência')
    // Ainda assim importa a ação, para o operador conferir antes de gravar.
    expect(totaisImportacao(resultado)).toEqual({ projetos: 1, acoes: 1 })
  })

  it('avisa quando o arquivo é, na verdade, um PLA-DEP multi-projeto', () => {
    const resultado = importarCroDep(planilhaExemplo())

    expect(resultado.avisos.some((a) => a.includes('parece um PLA-DEP'))).toBe(true)
  })

  it('reporta cabeçalho ausente sem lançar', () => {
    const resultado = importarCroDep([['Cronograma'], ['sem cabeçalho aqui']])

    expect(resultado.projetos).toEqual([])
    expect(resultado.avisos[0]).toContain('Cabeçalho não encontrado')
  })
})

describe('importarPlanilha — layout real do PLA-DEP (sem Assunto)', () => {
  const cabecalho = ['N°', 'PRIORIDADE', 'EQUIPE', 'NATUREZA', 'ASSUNTO\r\n(Projeto /  Iniciativa)', 'STATUS', 'AÇÃO', 'RESPONSÁVEL', 'APOIO', 'SETOR ENVOLVIDO', 'COMENTÁRIO', 'CRONOGRAMA', 'CATEGORIA', 'PROGRESSO', 'INÍCIO', 'TÉRMINO']
  const linha = (n: number, acao: string, marcador: string, inicio: number | string, termino: number | string, status = '') =>
    [n, 1, 'STI', 'Desenvolvimento', '', status, acao, 'Giovanne', 'Agustin', 'STI', '', '', marcador, '', inicio, termino]
  const matriz = [
    [], [], cabecalho, [],
    linha(1, 'Helpdesk', 'Previsto', 46188, 46373, 'Em Progresso'),
    linha(1, 'Helpdesk', 'Realizado', 46188, '', 'Em Progresso'),
    linha(2, 'Portal RH', 'Previsto', '', ''),
    linha(2, 'Portal RH', 'Realizado', '', ''),
  ]
  const r = importarPlanilha(matriz, { prefixoItem: 'PLA-DEP-2026-001' })

  it('cria um projeto por N°, nomeado pela ação', () => {
    expect(r.projetos.map((p) => [p.referencia, p.nome, p.acoes.length])).toEqual([
      ['PLA-DEP-2026-001/1', 'Helpdesk', 1],
      ['PLA-DEP-2026-001/2', 'Portal RH', 1],
    ])
    expect(r.linhasLidas).toBe(4)
  })

  it('lê Previsto/Realizado da coluna CATEGORIA sem gravá-lo como categoria', () => {
    const [p] = r.projetos
    expect(p.categoria).toBeNull()
    expect(p.acoes[0].previstoTermino).not.toBeNull()
    expect(p.acoes[0].realizadoInicio).not.toBeNull()
    expect(p.acoes[0].realizadoTermino).toBeNull()
  })

  it('reconhece "Em Progresso" como em curso', () => {
    expect(r.projetos[0].acoes[0].status).toBe(StatusAcao.EM_CURSO_50)
  })
})
