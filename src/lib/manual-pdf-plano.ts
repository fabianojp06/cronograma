/**
 * Plano dos PDFs do manual — módulo puro: o que existe, com que nome e qual o
 * hash do HTML de cada um. O script de geração desenha o PDF; este módulo diz
 * QUAIS são e permite conferir, por hash, se os arquivos estão em dia.
 */

import { createHash } from 'node:crypto'
import {
  htmlManualDaSecao,
  htmlManualDoGuia,
  htmlManualDoPerfil,
  slugDoTitulo,
  type EntradaHtml,
} from './manual-html'
import { secoesParaPerfil } from './manual'

export type ItemPdf = {
  /** Caminho relativo à pasta `pdf/`, com `/`. */
  arquivo: string
  titulo: string
  html: string
  /** Primeiros 16 caracteres do SHA-256 do HTML. */
  hash: string
}

export const PASTA_PDF = 'pdf'

function hashDe(html: string): string {
  return createHash('sha256').update(html).digest('hex').slice(0, 16)
}

function item(arquivo: string, titulo: string, html: string): ItemPdf {
  return { arquivo, titulo, html, hash: hashDe(html) }
}

export function planoDosPdfs(entrada: EntradaHtml): ItemPdf[] {
  const itens: ItemPdf[] = []
  itens.push(
    item(
      'perfil/manual-colaborador.pdf',
      'Manual do Usuário — Colaborador',
      htmlManualDoPerfil('Colaborador', { ...entrada, secoes: secoesParaPerfil(entrada.secoes, false) }),
    ),
    item(
      'perfil/manual-administrador.pdf',
      'Manual do Usuário — Administrador',
      htmlManualDoPerfil('Administrador', { ...entrada, secoes: secoesParaPerfil(entrada.secoes, true) }),
    ),
  )
  const dois = (n: number) => String(n).padStart(2, '0')
  entrada.secoes.forEach((s, i) => {
    itens.push(item(`funcionalidades/${dois(i + 1)}-${slugDoTitulo(s.titulo)}.pdf`, s.titulo, htmlManualDaSecao(s)))
  })
  itens.push(
    item(
      `funcionalidades/${dois(entrada.secoes.length + 1)}-guia-dos-relatorios.pdf`,
      'Guia dos relatórios dos Dashboards',
      htmlManualDoGuia(entrada.relatorios, entrada.guia),
    ),
  )
  return itens
}

/** O que o manifesto guarda: arquivo → hash. */
export function manifestoDe(itens: readonly ItemPdf[]): Record<string, string> {
  return Object.fromEntries(itens.map((i) => [i.arquivo, i.hash]))
}
