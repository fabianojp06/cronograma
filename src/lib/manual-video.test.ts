import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  duracaoMp3,
  htmlManualNarrado,
  juntarMp3,
  pedidoDeNarracao,
  quadrosMp3,
  temposDosTrechos,
  validarRoteiro,
  type Roteiro,
} from './manual-video'

/** MP3 mudo sintético: MPEG1 Layer III, 128 kbps, 44,1 kHz → quadros de 417 bytes e 26,12 ms. */
export function mp3Mudo(quadros: number, { xing = false, id3 = false } = {}): Uint8Array {
  const partes: number[] = []
  if (id3) partes.push(0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10, ...new Array(10).fill(0))
  const q = (marca?: string) => {
    const f = new Array(417).fill(0)
    f[0] = 0xff
    f[1] = 0xfb
    f[2] = 0x90
    f[3] = 0x00
    if (marca) for (let i = 0; i < marca.length; i++) f[36 + i] = marca.charCodeAt(i)
    return f
  }
  if (xing) partes.push(...q('Info'))
  for (let i = 0; i < quadros; i++) partes.push(...q())
  return Uint8Array.from(partes)
}
const SEG = 1152 / 44100 // duração de um quadro

const roteiro: Roteiro = {
  titulo: 'T',
  subtitulo: 'S',
  resumo: 'R',
  secoes: [
    { id: 'a', titulo: 'A' },
    { id: 'b', titulo: 'B' },
  ],
  blocos: [
    { id: 'abertura', secao: 'a', titulo: 'Abertura', fala: 'Olá, este é o começo do manual narrado.' },
    { id: 'um', secao: 'b', titulo: 'Um', fala: 'Primeiro trecho, falado com calma para quem ouve.', passos: ['x', 'y'] },
  ],
}

describe('MP3', () => {
  it('mede a duração pelos quadros, sem contar o cabeçalho Xing/Info nem o ID3', () => {
    expect(duracaoMp3(mp3Mudo(100))).toBeCloseTo(100 * SEG, 3)
    expect(duracaoMp3(mp3Mudo(100, { xing: true, id3: true }))).toBeCloseTo(100 * SEG, 3)
    expect(quadrosMp3(mp3Mudo(3, { xing: true })).filter((q) => q.info)).toHaveLength(1)
  })
  it('junta arquivos somando as durações', () => {
    const a = mp3Mudo(50, { xing: true, id3: true })
    const b = mp3Mudo(70, { xing: true })
    expect(duracaoMp3(juntarMp3([a, b]))).toBeCloseTo(120 * SEG, 3)
  })
  it('lixo não vira quadro', () => {
    expect(duracaoMp3(Uint8Array.from([1, 2, 3, 4, 5, 6]))).toBe(0)
  })
})

describe('tempos', () => {
  it('cada trecho começa onde o anterior termina', () => {
    expect(temposDosTrechos([2, 3.5, 1])).toEqual([
      { t0: 0, t1: 2 },
      { t0: 2, t1: 5.5 },
      { t0: 5.5, t1: 6.5 },
    ])
  })
})

describe('roteiro', () => {
  it('valida id repetido, seção inexistente e fala curta', () => {
    const ruim: Roteiro = { ...roteiro, blocos: [{ ...roteiro.blocos[0], fala: 'oi' }, { ...roteiro.blocos[0], secao: 'zz' }] }
    const erros = validarRoteiro(ruim).join(' | ')
    expect(erros).toMatch(/fala curta/)
    expect(erros).toMatch(/repetido/)
    expect(erros).toMatch(/seção "zz"/)
    expect(validarRoteiro(roteiro)).toEqual([])
  })
  it('o pedido para o Claude web lista um arquivo por trecho', () => {
    const p = pedidoDeNarracao(roteiro)
    expect(p).toContain('`abertura.mp3`')
    expect(p).toContain('`um.mp3`')
    expect(p).toContain(roteiro.blocos[1].fala)
  })
})

describe('HTML narrado', () => {
  it('sem áudio: lê o manual e deixa o botão desligado', () => {
    const h = htmlManualNarrado({ roteiro, telas: {}, audio: null })
    expect(h).toContain('id="nb-um"')
    expect(h).toContain('Narração em preparação')
    expect(h).not.toContain('<audio')
  })
  it('com áudio: embute o MP3, o player e os tempos de cada trecho', () => {
    const h = htmlManualNarrado({
      roteiro,
      telas: {},
      audio: { dataUri: 'data:audio/mpeg;base64,AAAA', tempos: temposDosTrechos([4, 6]) },
    })
    expect(h).toContain('<audio id="narr-audio"')
    expect(h).toContain('"id":"um"')
    expect(h).toContain('"t0":4')
    expect(h).toContain('00:10')
  })
  it('escapa HTML do conteúdo', () => {
    const r: Roteiro = { ...roteiro, blocos: [roteiro.blocos[0], { ...roteiro.blocos[1], titulo: '<b>x</b>', passos: ['<i>y</i>'] }] }
    const h = htmlManualNarrado({ roteiro: r, telas: {}, audio: null })
    expect(h).not.toContain('<b>x</b>')
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('piloto "primeiros-passos"', () => {
  const pasta = join(process.cwd(), 'docs', 'Manual do Usuário', 'video', 'primeiros-passos')
  const r = JSON.parse(readFileSync(join(pasta, 'roteiro.json'), 'utf8')) as Roteiro
  it('o roteiro é válido e cada captura citada existe', () => {
    expect(validarRoteiro(r)).toEqual([])
    for (const b of r.blocos) if (b.tela) expect(existsSync(join(pasta, 'telas', `${b.tela.arquivo}.jpg`)), b.id).toBe(true)
  })
  it('o pedido de narração da pasta está em dia com o roteiro (rode npm run gerar:manual-video -- primeiros-passos)', () => {
    expect(readFileSync(join(pasta, 'pedido-narracao.md'), 'utf8')).toBe(pedidoDeNarracao(r))
  })
})
