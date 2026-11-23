import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
function token(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`--${nome}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${nome} não encontrado`)
  return m[1]
}
const claro = css.slice(css.indexOf(':root'), css.indexOf('.dark'))
const escuro = css.slice(css.indexOf('.dark'), css.indexOf('@theme inline {'))

describe('contraste do texto "faint"', () => {
  for (const [nome, bloco] of [['claro', claro], ['escuro', escuro]] as const) {
    it(`≥ 4,5:1 sobre bg, surface e borderSoft no modo ${nome}`, () => {
      const faint = token(bloco, 'text-faint')
      for (const fundo of ['bg', 'surface', 'border-soft']) {
        expect(contraste(faint, token(bloco, fundo)), `${fundo} (${nome})`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

describe('sinal do projeto: atenção e ícones', () => {
  const realizado = (css.match(/--color-realizado:\s*(#[0-9A-Fa-f]{6})/) ?? [])[1]
  for (const [nome, bloco] of [['claro', claro], ['escuro', escuro]] as const) {
    // borderSoft fica de fora de propósito: a célula do Sinal só fica sobre
    // `surface` (a linha da tabela) e `bg`; nunca sobre borderSoft.
    it(`--atencao passa 4,5:1 sobre surface e bg (${nome})`, () => {
      for (const fundo of ['bg', 'surface']) {
        expect(contraste(token(bloco, 'atencao'), token(bloco, fundo)), `atencao/${fundo}`).toBeGreaterThanOrEqual(4.5)
      }
    })
    it(`bolinha e ícone do sinal passam 3:1 sobre surface (${nome})`, () => {
      const cores = { warn: token(bloco, 'warn'), atencao: token(bloco, 'atencao'), faint: token(bloco, 'text-faint'), realizado }
      for (const [rotulo, cor] of Object.entries(cores)) {
        expect(contraste(cor, token(bloco, 'surface')), `${rotulo} (${nome})`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})

describe('estilo Workspace (Dashboards)', () => {
  const claroWs = css.slice(css.indexOf('.tema-workspace {'), css.indexOf('.dark .tema-workspace {'))
  const escuroWs = css.slice(css.indexOf('.dark .tema-workspace {'), css.indexOf('.tema-workspace h1'))
  for (const [nome, ws, base] of [['claro', claroWs, claro], ['escuro', escuroWs, escuro]] as const) {
    it(`o azul de controle passa 4,5:1 e o de volume 3:1 sobre surface, bg e borderSoft (${nome})`, () => {
      for (const fundo of ['bg', 'surface', 'border-soft']) {
        expect(contraste(token(ws, 'accent'), token(base, fundo)), `accent/${fundo}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(token(ws, 'magnitude'), token(base, fundo)), `magnitude/${fundo}`).toBeGreaterThanOrEqual(3)
      }
      expect(contraste(token(ws, 'on-accent'), token(ws, 'accent'))).toBeGreaterThanOrEqual(4.5)
    })
    it(`o azul de controle não é o azul de Previsto (${nome})`, () => {
      expect(token(ws, 'accent').toLowerCase()).not.toBe('#2563eb')
      expect(token(ws, 'magnitude').toLowerCase()).not.toBe('#2563eb')
    })
  }
})

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? arquivos(p) : /\.(tsx|css)$/.test(n) ? [p] : []
  })
}

describe('tipografia', () => {
  const fontes = arquivos(join(process.cwd(), 'src')).map((p) => [p, readFileSync(p, 'utf8')] as const)

  it('o piso do tema é 13 px', () => {
    expect(css).toMatch(/--text-xs:\s*0\.8125rem/)
  })
  it('nenhum tamanho fixo abaixo de 13 px', () => {
    for (const [p, txt] of fontes) {
      expect(txt, p).not.toMatch(/text-\[(\d|1[0-2])px\]/)
      for (const m of txt.matchAll(/font-size:\s*([\d.]+)rem/g)) expect(Number(m[1]) * 16, p).toBeGreaterThanOrEqual(13) // CSS solto
    }
  })
  it('sem caixa-alta nem espaçamento de letras', () => {
    for (const [p, txt] of fontes) {
      if (p.endsWith('tipografia.test.ts')) continue
      expect(txt, p).not.toMatch(/\buppercase\b|text-transform\s*:\s*uppercase|tracking-wide/)
    }
  })
})
