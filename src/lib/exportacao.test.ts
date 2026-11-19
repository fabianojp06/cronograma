import { describe, expect, it } from 'vitest'

import { StatusAcao } from '../generated/prisma/enums'
import {
  ehRelatorioExportavel,
  nomeDoArquivo,
  tabelaDeAcoes,
  tabelaDeProjetos,
  type AcaoParaExportar,
} from './exportacao'
import { gerarXlsx } from './exportacao-xlsx'
import { resumirAcoes } from './projeto-resumo'

const HOJE = new Date('2026-11-16T00:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)

function acao(extra: Partial<AcaoParaExportar> = {}): AcaoParaExportar {
  return {
    numero: 1,
    descricao: 'Levantar requisitos',
    status: StatusAcao.EM_CURSO_50,
    previstoInicio: d('2026-10-01'),
    previstoTermino: d('2026-11-10'),
    realizadoInicio: null,
    realizadoTermino: null,
    projeto: { nome: 'Portal', referencia: 'PLA-1', equipe: 'STI' },
    responsavel: { nome: 'Ana' },
    ...extra,
  }
}

describe('tabelaDeAcoes', () => {
  it('mantém datas como data e deixa vazio quem não está atrasado', () => {
    const t = tabelaDeAcoes(
      [acao(), acao({ numero: 2, previstoTermino: d('2026-12-01') })],
      HOJE,
    )
    expect(t.linhas[0][8]).toEqual(d('2026-11-10'))
    expect(t.linhas[0][11]).toBe(6)
    expect(t.linhas[1][11]).toBeNull()
    expect(t.linhas[0]).toHaveLength(t.colunas.length)
  })

  it('"atrasadas" filtra pela regra do painel e põe a mais atrasada primeiro', () => {
    const t = tabelaDeAcoes(
      [
        acao({ numero: 1, previstoTermino: d('2026-11-14') }),
        acao({ numero: 2, status: StatusAcao.CONCLUIDO }),
        acao({ numero: 3, previstoTermino: d('2026-10-01') }),
        acao({ numero: 4, previstoTermino: d('2026-12-01') }),
      ],
      HOJE,
      true,
    )
    expect(t.titulo).toBe('Ações atrasadas')
    expect(t.linhas.map((l) => l[3])).toEqual([3, 1])
  })
})

describe('tabelaDeProjetos', () => {
  it('traz o percentual como fração e o status por extenso', () => {
    const resumo = resumirAcoes(
      [
        { status: StatusAcao.CONCLUIDO, previstoTermino: d('2026-11-01'), realizadoTermino: d('2026-11-01') },
        { status: StatusAcao.NAO_INICIADO, previstoTermino: d('2026-11-02'), realizadoTermino: null },
      ],
      HOJE,
    )
    const t = tabelaDeProjetos([
      { id: 'p', referencia: 'PLA-1', nome: 'Portal', equipe: 'STI', categoria: null, responsavel: 'Ana', prioridade: 1, resumo },
    ])
    expect(t.linhas[0][9]).toBe(0.5)
    expect(t.linhas[0][10]).toBe('Atrasado')
    expect(t.linhas[0]).toHaveLength(t.colunas.length)
  })
})

describe('nomeDoArquivo e relatórios', () => {
  it('tira acento e espaço e leva a data', () => {
    const t = tabelaDeAcoes([], HOJE, true)
    expect(nomeDoArquivo(t, HOJE)).toBe('acoes-atrasadas-2026-11-16.xlsx')
  })

  it('só aceita os relatórios conhecidos', () => {
    expect(ehRelatorioExportavel('acoes')).toBe(true)
    expect(ehRelatorioExportavel('../etc')).toBe(false)
  })
})

describe('gerarXlsx', () => {
  it('gera um arquivo .xlsx válido, com o texto "=" guardado como texto', async () => {
    const t = tabelaDeAcoes([acao({ descricao: '=SOMA(1;2)' })], HOJE)
    const arquivo = await gerarXlsx(t)
    // Um .xlsx é um zip: começa com "PK".
    expect(arquivo.subarray(0, 2).toString()).toBe('PK')

    const ExcelJS = (await import('exceljs')).default
    const livro = new ExcelJS.Workbook()
    await livro.xlsx.load(arquivo as unknown as ArrayBuffer)
    const celula = livro.worksheets[0].getCell('E2')
    expect(celula.value).toBe('=SOMA(1;2)')
    expect(celula.type).toBe(ExcelJS.ValueType.String)
  })
})
