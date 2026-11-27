/**
 * Gera os PDFs do manual em `docs/Manual do Usuário/pdf/` (um por perfil e um por
 * funcionalidade), pelo Chromium do Playwright, a partir do mesmo conteúdo da tela
 * `/manual`. Não toca em banco nem em rede.
 *
 *   npm run gerar:manual-pdf               gera tudo e grava o manifesto
 *   npm run gerar:manual-pdf -- --conferir só confere o manifesto (sai com 1 se velho)
 *
 * O PDF não é determinístico, então o "em dia" é provado pelo hash do HTML de
 * origem, guardado em `manifest.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { chromium } from '@playwright/test'
import { RELATORIOS } from '../src/lib/dashboard-catalogo'
import { GUIA_RELATORIOS } from '../src/lib/guia-relatorios'
import { GLOSSARIO, SECOES_MANUAL } from '../src/lib/manual-conteudo'
import { manifestoDe, PASTA_PDF, planoDosPdfs } from '../src/lib/manual-pdf-plano'

const RAIZ = join('docs', 'Manual do Usuário', PASTA_PDF)
const MANIFESTO = join(RAIZ, 'manifest.json')

const itens = planoDosPdfs({
  secoes: SECOES_MANUAL,
  glossario: GLOSSARIO,
  relatorios: RELATORIOS,
  guia: GUIA_RELATORIOS,
})
const esperado = manifestoDe(itens)

async function main() {
  if (process.argv.includes('--conferir')) {
    const atual = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, 'utf8')) : null
    const emDia =
      atual !== null &&
      JSON.stringify(atual) === JSON.stringify(esperado) &&
      itens.every((i) => existsSync(join(RAIZ, i.arquivo)))
    if (!emDia) {
      console.error('Os PDFs do manual estão desatualizados. Rode: npm run gerar:manual-pdf')
      process.exit(1)
    }
    console.log(`PDFs do manual em dia (${itens.length} arquivos).`)
    return
  }

  const navegador = await chromium.launch()
  try {
    const pagina = await navegador.newPage()
    for (const i of itens) {
      await pagina.setContent(i.html, { waitUntil: 'load' })
      const destino = join(RAIZ, i.arquivo)
      mkdirSync(dirname(destino), { recursive: true })
      await pagina.pdf({
        path: destino,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="width:100%;font-size:9px;color:#5B6B76;padding:0 18mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif">' +
          '<span>Manual do Usuário — Sistema Cronograma CTCEA</span>' +
          '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
        margin: { top: '20mm', bottom: '22mm', left: '18mm', right: '18mm' },
      })
      console.log(`Gerado: ${i.arquivo}`)
    }
  } finally {
    await navegador.close()
  }
  writeFileSync(MANIFESTO, JSON.stringify(esperado, null, 2) + '\n', 'utf8')
  console.log(`Manifesto gravado (${itens.length} PDFs).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
