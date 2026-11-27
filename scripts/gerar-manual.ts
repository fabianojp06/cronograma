/**
 * Gera `docs/Manual do Usuário/manual-do-usuario.md` a partir do manual do sistema.
 *
 *   npm run gerar:manual            grava o arquivo
 *   npm run gerar:manual -- --conferir   só confere se está em dia (sai com 1 se não)
 *
 * Não toca em banco nem em rede.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RELATORIOS } from '../src/lib/dashboard-catalogo'
import { GUIA_RELATORIOS } from '../src/lib/guia-relatorios'
import { GLOSSARIO, SECOES_MANUAL } from '../src/lib/manual-conteudo'
import { manualEmMarkdown } from '../src/lib/manual-markdown'

export const ARQUIVO_MANUAL = join('docs', 'Manual do Usuário', 'manual-do-usuario.md')

const texto = manualEmMarkdown({
  secoes: SECOES_MANUAL,
  glossario: GLOSSARIO,
  relatorios: RELATORIOS,
  guia: GUIA_RELATORIOS,
})

if (process.argv.includes('--conferir')) {
  const atual = existsSync(ARQUIVO_MANUAL) ? readFileSync(ARQUIVO_MANUAL, 'utf8') : null
  if (atual !== texto) {
    console.error(`${ARQUIVO_MANUAL} está desatualizado. Rode: npm run gerar:manual`)
    process.exit(1)
  }
  console.log('Manual em Markdown em dia.')
} else {
  writeFileSync(ARQUIVO_MANUAL, texto, 'utf8')
  console.log(`Gravado: ${ARQUIVO_MANUAL} (${texto.split('\n').length} linhas)`)
}
