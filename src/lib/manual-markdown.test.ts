import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELATORIOS } from './dashboard-catalogo'
import { GUIA_RELATORIOS } from './guia-relatorios'
import { GLOSSARIO, SECOES_MANUAL } from './manual-conteudo'
import { manualEmMarkdown } from './manual-markdown'

const gerado = manualEmMarkdown({
  secoes: SECOES_MANUAL,
  glossario: GLOSSARIO,
  relatorios: RELATORIOS,
  guia: GUIA_RELATORIOS,
})

describe('manual em Markdown', () => {
  it('traz todas as seções, todos os relatórios do guia e o glossário', () => {
    for (const s of SECOES_MANUAL) expect(gerado, s.id).toContain(`### ${s.titulo}`)
    for (const r of RELATORIOS) expect(gerado, r.id).toContain(`#### ${r.titulo}`)
    for (const t of GLOSSARIO) expect(gerado, t.termo).toContain(`**${t.termo}**`)
  })

  it('é determinístico (sem data de geração)', () => {
    expect(
      manualEmMarkdown({ secoes: SECOES_MANUAL, glossario: GLOSSARIO, relatorios: RELATORIOS, guia: GUIA_RELATORIOS }),
    ).toBe(gerado)
  })

  it('o arquivo da pasta "Manual do Usuário" está em dia (rode npm run gerar:manual)', () => {
    const arquivo = readFileSync(join(process.cwd(), 'docs', 'Manual do Usuário', 'manual-do-usuario.md'), 'utf8')
    expect(arquivo === gerado).toBe(true)
  })
})
