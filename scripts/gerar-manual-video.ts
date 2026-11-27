/**
 * Gera o manual narrado em HTML de um roteiro em `docs/Manual do Usuário/video/<nome>/`.
 *
 *   npm run gerar:manual-video -- primeiros-passos
 *
 * Lê `roteiro.json`, as capturas em `telas/*.jpg` e, se existirem, os MP3 em
 * `audio/<id>.mp3` (um por trecho, gerados no Claude web). Grava:
 *   - `pedido-narracao.md`  o texto a colar no Claude web;
 *   - `<nome>.html`         a página (sem áudio, vira só o manual lido, com o botão desligado).
 * Não toca em banco nem em rede.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  duracaoMp3,
  htmlManualNarrado,
  juntarMp3,
  pedidoDeNarracao,
  temposDosTrechos,
  validarRoteiro,
  type Roteiro,
} from '../src/lib/manual-video'

const nome = process.argv[2]
if (!nome) {
  console.error('Uso: npm run gerar:manual-video -- <nome-da-pasta>')
  process.exit(1)
}
const pasta = join('docs', 'Manual do Usuário', 'video', nome)
const roteiro = JSON.parse(readFileSync(join(pasta, 'roteiro.json'), 'utf8')) as Roteiro

const erros = validarRoteiro(roteiro)
if (erros.length > 0) {
  console.error(erros.join('\n'))
  process.exit(1)
}

// Capturas de tela em data URI (JPEG ou PNG).
const telas: Record<string, string> = {}
for (const b of roteiro.blocos) {
  if (!b.tela) continue
  const jpg = join(pasta, 'telas', `${b.tela.arquivo}.jpg`)
  const png = join(pasta, 'telas', `${b.tela.arquivo}.png`)
  const arquivo = existsSync(jpg) ? jpg : existsSync(png) ? png : null
  if (!arquivo) {
    console.warn(`Sem captura para "${b.id}" (telas/${b.tela.arquivo}.jpg): o bloco sai sem imagem.`)
    continue
  }
  const tipo = arquivo.endsWith('.jpg') ? 'jpeg' : 'png'
  telas[b.tela.arquivo] = `data:image/${tipo};base64,${readFileSync(arquivo).toString('base64')}`
}

// Áudio: todos os trechos ou nenhum.
const pastaAudio = join(pasta, 'audio')
const presentes = roteiro.blocos.filter((b) => existsSync(join(pastaAudio, `${b.id}.mp3`)))
let audio: { dataUri: string; tempos: ReturnType<typeof temposDosTrechos> } | null = null
if (presentes.length === roteiro.blocos.length) {
  const buffers = roteiro.blocos.map((b) => readFileSync(join(pastaAudio, `${b.id}.mp3`)))
  const duracoes = buffers.map((b) => duracaoMp3(b))
  const faltando = roteiro.blocos.filter((_, i) => duracoes[i] < 0.5).map((b) => b.id)
  if (faltando.length > 0) {
    console.error(`MP3 ilegível ou vazio: ${faltando.join(', ')}`)
    process.exit(1)
  }
  const tempos = temposDosTrechos(duracoes)
  audio = { dataUri: `data:audio/mpeg;base64,${Buffer.from(juntarMp3(buffers)).toString('base64')}`, tempos }
  console.log(`Áudio: ${roteiro.blocos.length} trechos, ${tempos[tempos.length - 1].t1.toFixed(1)} s.`)
} else {
  const falta = roteiro.blocos.length - presentes.length
  console.log(`Sem áudio completo (faltam ${falta} de ${roteiro.blocos.length}): gerando a página só com o texto.`)
  if (existsSync(pastaAudio) && readdirSync(pastaAudio).length > 0) console.warn('Há MP3 na pasta, mas faltam trechos.')
}

writeFileSync(join(pasta, 'pedido-narracao.md'), pedidoDeNarracao(roteiro), 'utf8')
const arquivoHtml = join(pasta, `${nome}.html`)
writeFileSync(arquivoHtml, htmlManualNarrado({ roteiro, telas, audio }), 'utf8')
console.log(`Gravado: ${arquivoHtml} e pedido-narracao.md`)
