import { describe, expect, it } from 'vitest'
import { StatusAcao } from '../generated/prisma/enums'
import type { AcaoImportada, ProjetoImportado, ResultadoImportacao } from './importacao-planilha'
import {
  type ProjetoGravado,
  chaveProjeto,
  normalizarTexto,
  validarImportacao,
} from './validacao-importacao'

function acao(numero: number, descricao: string): AcaoImportada {
  return {
    numero,
    descricao,
    status: StatusAcao.NAO_INICIADO,
    previstoInicio: null,
    previstoTermino: null,
    realizadoInicio: null,
    realizadoTermino: null,
    duracaoDiasUteis: null,
  }
}

function projeto(
  nome: string,
  referencia: string | null,
  descricoes: string[],
): ProjetoImportado {
  return {
    referencia,
    nome,
    equipe: null,
    natureza: null,
    categoria: null,
    responsavel: null,
    apoio: null,
    setorEnvolvido: null,
    comentario: null,
    prioridade: null,
    acoes: descricoes.map((d, i) => acao(i + 1, d)),
  }
}

function planilha(
  projetos: ProjetoImportado[],
  extra: Partial<ResultadoImportacao> = {},
): ResultadoImportacao {
  const acoes = projetos.reduce((total, p) => total + p.acoes.length, 0)
  return {
    projetos,
    linhaCabecalho: 3,
    linhasLidas: acoes * 2, // cada ação ocupa Previsto + Realizado
    linhasIgnoradas: 0,
    avisos: [],
    ...extra,
  }
}

function gravado(p: ProjetoImportado): ProjetoGravado {
  return {
    referencia: p.referencia,
    nome: p.nome,
    acoes: p.acoes.map((a) => ({ numero: a.numero, descricao: a.descricao })),
  }
}

const PLA = [
  projeto('Portal do Associado', 'PLA-001', ['Levantar requisitos', 'Homologar']),
  projeto('Revisão de processos', 'PLA-002', ['Mapear AS-IS']),
]

describe('chaveProjeto', () => {
  it('usa a referência quando existe, ignorando caixa', () => {
    expect(chaveProjeto({ referencia: 'CRO-DEP-2026-001', nome: 'X' })).toBe(
      chaveProjeto({ referencia: 'cro-dep-2026-001', nome: 'Y' }),
    )
  })

  it('cai no nome normalizado quando não há referência', () => {
    expect(chaveProjeto({ referencia: null, nome: 'Revisão  de Processos' })).toBe(
      chaveProjeto({ referencia: '   ', nome: 'revisao de processos' }),
    )
  })
})

describe('normalizarTexto', () => {
  it('remove acento, caixa e espaço repetido', () => {
    expect(normalizarTexto('  Homologar   com  Usuário ')).toBe('homologar com usuario')
  })
})

describe('validarImportacao', () => {
  it('não acusa nada quando o banco reflete a planilha', () => {
    const relatorio = validarImportacao(planilha(PLA), PLA.map(gravado), 3 + 6)

    expect(relatorio.ok).toBe(true)
    expect(relatorio.divergencias).toEqual([])
    expect(relatorio.planilha).toEqual({
      projetos: 2,
      acoes: 3,
      linhasLidas: 6,
      linhasIgnoradas: 0,
    })
    expect(relatorio.banco).toEqual({ projetos: 2, acoes: 3 })
    expect(relatorio.resumo).toContain('Conferência OK')
  })

  it('acusa projeto da planilha que não chegou ao banco', () => {
    const relatorio = validarImportacao(planilha(PLA), [gravado(PLA[0])])

    expect(relatorio.ok).toBe(false)
    expect(relatorio.divergencias.map((d) => d.tipo)).toEqual([
      'TOTAL_PROJETOS',
      'TOTAL_ACOES',
      'PROJETO_FALTANDO',
    ])
    expect(relatorio.resumo).toContain('PLA-002')
  })

  it('acusa projeto que existe só no banco (importação anterior)', () => {
    const orfao = gravado(projeto('Projeto antigo', 'PLA-099', ['Algo']))
    const relatorio = validarImportacao(planilha(PLA), [...PLA.map(gravado), orfao])

    expect(relatorio.divergencias.map((d) => d.tipo)).toContain('PROJETO_EXCEDENTE')
  })

  it('acusa contagem de ações divergente dentro do projeto', () => {
    const banco = PLA.map(gravado)
    banco[0].acoes = banco[0].acoes.slice(0, 1)

    const relatorio = validarImportacao(planilha(PLA), banco)
    const tipos = relatorio.divergencias.map((d) => d.tipo)

    expect(tipos).toContain('CONTAGEM_ACOES')
    expect(tipos).toContain('ACAO_FALTANDO')
    expect(tipos).toContain('TOTAL_ACOES')
  })

  it('acusa ação que só existe no banco', () => {
    const banco = PLA.map(gravado)
    banco[1].acoes.push({ numero: 2, descricao: 'Ação inventada' })

    const relatorio = validarImportacao(planilha(PLA), banco)

    expect(relatorio.divergencias.map((d) => d.tipo)).toContain('ACAO_EXCEDENTE')
  })

  it('compara descrição ignorando acento, caixa e espaço — mas acusa texto diferente', () => {
    const iguais = PLA.map(gravado)
    iguais[0].acoes[0].descricao = '  LEVANTAR   REQUISITOS '
    expect(validarImportacao(planilha(PLA), iguais).ok).toBe(true)

    const diferentes = PLA.map(gravado)
    diferentes[0].acoes[0].descricao = 'Levantar requisitos (revisado)'
    const relatorio = validarImportacao(planilha(PLA), diferentes)

    expect(relatorio.divergencias.map((d) => d.tipo)).toEqual(['DESCRICAO_DIVERGENTE'])
  })

  it('acusa linha da aba que não virou ação nem foi declarada ignorada', () => {
    // 20 linhas na aba, mas só 3 + 6 + 0 = 9 explicadas.
    const relatorio = validarImportacao(planilha(PLA), PLA.map(gravado), 20)

    expect(relatorio.divergencias.map((d) => d.tipo)).toEqual(['LINHAS_NAO_CONTABILIZADAS'])
    expect(relatorio.divergencias[0].mensagem).toContain('20 linhas')
  })

  it('não acusa cobertura quando o total da aba não é informado', () => {
    expect(validarImportacao(planilha(PLA), PLA.map(gravado)).ok).toBe(true)
  })

  it('acusa mais de duas linhas de dados caindo na mesma ação', () => {
    const relatorio = validarImportacao(
      planilha(PLA, { linhasLidas: 9 }),
      PLA.map(gravado),
      3 + 9,
    )

    expect(relatorio.divergencias.map((d) => d.tipo)).toEqual(['LINHAS_NAO_CONTABILIZADAS'])
    expect(relatorio.divergencias[0].mensagem).toContain('mesma ação')
  })

  it('leva os avisos de mapeamento para o resumo', () => {
    const relatorio = validarImportacao(
      planilha(PLA, { avisos: ['Linha 12 ignorada: sem Ação e sem Assunto.'] }),
      PLA.map(gravado),
    )

    expect(relatorio.resumo).toContain('Avisos de mapeamento: 1')
  })
})
