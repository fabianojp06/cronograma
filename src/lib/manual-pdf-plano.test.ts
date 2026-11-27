import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELATORIOS } from './dashboard-catalogo'
import { GUIA_RELATORIOS } from './guia-relatorios'
import { GLOSSARIO, SECOES_MANUAL } from './manual-conteudo'
import { slugDoTitulo } from './manual-html'
import { manifestoDe, PASTA_PDF, planoDosPdfs } from './manual-pdf-plano'

const entrada = { secoes: SECOES_MANUAL, glossario: GLOSSARIO, relatorios: RELATORIOS, guia: GUIA_RELATORIOS }
const itens = planoDosPdfs(entrada)
const RAIZ = join(process.cwd(), 'docs', 'Manual do Usuário', PASTA_PDF)

describe('plano dos PDFs do manual', () => {
  it('tem um PDF por perfil, um por funcionalidade e o guia dos relatórios', () => {
    expect(itens.map((i) => i.arquivo).filter((a) => a.startsWith('perfil/'))).toEqual([
      'perfil/manual-colaborador.pdf',
      'perfil/manual-administrador.pdf',
    ])
    expect(itens.filter((i) => i.arquivo.startsWith('funcionalidades/'))).toHaveLength(SECOES_MANUAL.length + 1)
  })

  it('nomes de arquivo únicos e sem acento nem espaço', () => {
    const nomes = itens.map((i) => i.arquivo)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const n of nomes) expect(n, n).toMatch(/^[a-z0-9/_.-]+$/)
  })

  it('o manual do colaborador não traz as seções só do administrador; o do administrador traz tudo', () => {
    const colaborador = itens[0].html
    const administrador = itens[1].html
    for (const s of SECOES_MANUAL) {
      expect(administrador, s.id).toContain(`id="${s.id}"`)
      if (s.perfil === 'administrador') expect(colaborador, s.id).not.toContain(`id="${s.id}"`)
      else expect(colaborador, s.id).toContain(`id="${s.id}"`)
    }
  })

  it('o PDF de cada funcionalidade traz os passos dela', () => {
    for (const s of SECOES_MANUAL) {
      const i = itens.find((x) => x.arquivo.includes(`-${slugDoTitulo(s.titulo)}.pdf`))
      expect(i, s.id).toBeDefined()
      expect(i!.html, s.id).toContain(s.titulo.replace(/&/g, '&amp;'))
    }
  })

  it('o HTML é determinístico (sem data de geração)', () => {
    expect(manifestoDe(planoDosPdfs(entrada))).toEqual(manifestoDe(itens))
  })

  it('os PDFs da pasta estão em dia com o manual (rode npm run gerar:manual-pdf)', () => {
    const manifesto = JSON.parse(readFileSync(join(RAIZ, 'manifest.json'), 'utf8'))
    expect(manifesto).toEqual(manifestoDe(itens))
    for (const i of itens) expect(existsSync(join(RAIZ, i.arquivo)), i.arquivo).toBe(true)
  })
})
