/**
 * Escreve uma `TabelaExportacao` em .xlsx. Só formato — o conteúdo vem pronto de
 * `exportacao.ts`. O texto do usuário entra como string, nunca como fórmula:
 * uma descrição começando com "=" aparece como texto na célula.
 */

import ExcelJS from 'exceljs'

import type { TabelaExportacao } from './exportacao'

const FORMATOS = {
  data: 'dd/mm/yyyy',
  inteiro: '0',
  percentual: '0%',
} as const

export async function gerarXlsx(tabela: TabelaExportacao): Promise<Buffer> {
  const livro = new ExcelJS.Workbook()
  livro.creator = 'Cronograma CTCEA'
  const aba = livro.addWorksheet(tabela.titulo.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  aba.columns = tabela.colunas.map((c) => ({
    header: c.titulo,
    width: c.largura,
    style: c.tipo ? { numFmt: FORMATOS[c.tipo] } : {},
  }))
  aba.getRow(1).font = { bold: true }
  aba.getRow(1).alignment = { vertical: 'middle', wrapText: true }

  for (const linha of tabela.linhas) aba.addRow(linha)
  if (tabela.linhas.length > 0) {
    aba.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: tabela.colunas.length },
    }
  }

  return Buffer.from(await livro.xlsx.writeBuffer())
}
