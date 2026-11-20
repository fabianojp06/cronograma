import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { MENU, MENU_ADMIN, ROTA_ADMINISTRACAO } from './menu'
import {
  GRUPOS_MANUAL,
  ROTAS_SEM_MANUAL,
  agruparPorGrupo,
  buscarNoManual,
  novidades,
  rotaDoArquivo,
  secoesParaPerfil,
} from './manual'
import { GLOSSARIO, SECOES_MANUAL } from './manual-conteudo'

const raizApp = path.join(process.cwd(), 'src', 'app')

function paginasDoApp(dir = raizApp): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) return paginasDoApp(caminho)
    return nome === 'page.tsx' ? [rotaDoArquivo(path.relative(raizApp, caminho))] : []
  })
}

const rotasDoManual = new Set(SECOES_MANUAL.flatMap((s) => s.rotas))

describe('cobertura do manual', () => {
  it('toda tela (page.tsx) tem seção no manual ou justificativa', () => {
    const sem = paginasDoApp().filter((r) => !rotasDoManual.has(r) && !(r in ROTAS_SEM_MANUAL))
    expect(
      sem,
      `Telas sem manual: ${sem.join(', ')}. Acrescente a rota a uma seção de src/lib/manual-conteudo.ts (ou crie uma).`,
    ).toEqual([])
  })

  it('nenhuma rota do manual aponta para tela que não existe mais', () => {
    const existentes = new Set(paginasDoApp())
    const orfas = [...rotasDoManual].filter((r) => !existentes.has(r))
    expect(orfas, `Rotas do manual sem tela: ${orfas.join(', ')}`).toEqual([])
  })

  it('todo item do menu está coberto', () => {
    for (const item of MENU) {
      expect(rotasDoManual.has(item.href), `menu ${item.href} sem seção no manual`).toBe(true)
    }
  })

  it('todo item da administração e a página da área estão cobertos', () => {
    for (const item of MENU_ADMIN) {
      expect(rotasDoManual.has(item.href), `administração ${item.href} sem seção no manual`).toBe(true)
    }
    expect(rotasDoManual.has(ROTA_ADMINISTRACAO)).toBe(true)
  })

  it('justificativas de rotas sem manual não ficam vazias', () => {
    for (const [rota, motivo] of Object.entries(ROTAS_SEM_MANUAL)) {
      expect(motivo.trim().length, rota).toBeGreaterThan(3)
    }
  })
})

describe('conteúdo do manual', () => {
  it('ids únicos, no formato de âncora', () => {
    const ids = SECOES_MANUAL.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('toda seção tem grupo válido, passos, resumo e data', () => {
    for (const s of SECOES_MANUAL) {
      expect(GRUPOS_MANUAL, s.id).toContain(s.grupo)
      expect(s.passos.length, `${s.id} sem passos`).toBeGreaterThan(0)
      expect(s.resumo.length, `${s.id} sem resumo`).toBeGreaterThan(10)
      expect(s.desde, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(s.desde)), s.id).toBe(false)
    }
  })

  it('cada rota pertence a uma seção só', () => {
    const todas = SECOES_MANUAL.flatMap((s) => s.rotas)
    expect(new Set(todas).size).toBe(todas.length)
  })

  it('glossário sem termo repetido', () => {
    const termos = GLOSSARIO.map((g) => g.termo.toLowerCase())
    expect(new Set(termos).size).toBe(termos.length)
  })
})

describe('regras do manual', () => {
  it('busca ignora acento e caixa e exige todas as palavras', () => {
    expect(buscarNoManual(SECOES_MANUAL, 'DEPENDENCIA liberar').map((s) => s.id)).toContain('acao-dependencias')
    expect(buscarNoManual(SECOES_MANUAL, 'zzzinexistente')).toEqual([])
    expect(buscarNoManual(SECOES_MANUAL, null)).toHaveLength(SECOES_MANUAL.length)
  })

  it('agrupa na ordem dos grupos e não perde seção', () => {
    const grupos = agruparPorGrupo(SECOES_MANUAL)
    expect(grupos.flatMap((g) => g.secoes)).toHaveLength(SECOES_MANUAL.length)
    expect(grupos.map((g) => g.grupo)).toEqual(GRUPOS_MANUAL.filter((g) => grupos.some((x) => x.grupo === g)))
  })

  it('novidades vêm da mais recente para a mais antiga', () => {
    const n = novidades(SECOES_MANUAL, 3)
    expect(n[0].desde).toBe('2026-11-20')
    expect(n.map((s) => s.desde)).toEqual([...n.map((s) => s.desde)].sort().reverse())
  })

  it('quem não administra não recebe as seções só de administrador', () => {
    const comum = secoesParaPerfil(SECOES_MANUAL, false)
    expect(comum.some((s) => s.perfil === 'administrador')).toBe(false)
    expect(comum.length).toBeLessThan(SECOES_MANUAL.length)
    expect(secoesParaPerfil(SECOES_MANUAL, true)).toHaveLength(SECOES_MANUAL.length)
  })

  it('rotaDoArquivo converte o caminho do page.tsx', () => {
    expect(rotaDoArquivo('page.tsx')).toBe('/')
    expect(rotaDoArquivo('projetos/[id]/lote/page.tsx')).toBe('/projetos/[id]/lote')
    expect(rotaDoArquivo('entrar/[[...entrar]]/page.tsx')).toBe('/entrar/[[...entrar]]')
  })
})
