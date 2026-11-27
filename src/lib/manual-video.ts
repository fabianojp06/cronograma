/**
 * Manual narrado em HTML — módulo puro, sem Prisma e sem Next.
 *
 * É uma PÁGINA de manual que se lê sozinha: um MP3 embutido e uma lista de trechos
 * (`SEGS`) com o instante de início e fim de cada um. Ao tocar, o bloco da página
 * que está sendo falado é destacado, a página rola até ele e a legenda acompanha.
 *
 * A voz NÃO é gerada aqui: o roteiro vai para o Claude web, que devolve um MP3 por
 * trecho (`audio/<id>.mp3`). Este módulo só mede cada MP3, junta os arquivos e
 * calcula os tempos. `scripts/gerar-manual-video.ts` faz a leitura dos arquivos.
 */

export type Bloco = {
  /** Único no roteiro; é o nome do arquivo de áudio (`audio/<id>.mp3`) e da captura. */
  id: string
  /** `id` de uma seção do roteiro (agrupa no sumário). */
  secao: string
  titulo: string
  /** O que será FALADO (e mostrado como legenda). Escrito para ser ouvido. */
  fala: string
  /** O que a página mostra: passos numerados, ou um parágrafo. */
  passos?: string[]
  paragrafo?: string
  /** Quadro "Regra" ou "Nota" ao pé do bloco. */
  nota?: { rotulo: string; texto: string }
  /** Nome do arquivo em `telas/` (sem extensão) e a legenda da captura. */
  tela?: { arquivo: string; legenda: string }
  /** Tabela simples (perfis, por exemplo). */
  tabela?: { cabecalho: string[]; linhas: string[][] }
}

export type Roteiro = {
  titulo: string
  subtitulo: string
  resumo: string
  secoes: { id: string; titulo: string }[]
  /** O primeiro bloco é sempre a abertura (cabeçalho da página). */
  blocos: Bloco[]
}

export function validarRoteiro(r: Roteiro): string[] {
  const erros: string[] = []
  const ids = new Set<string>()
  const secoes = new Set(r.secoes.map((s) => s.id))
  if (r.blocos.length === 0) erros.push('O roteiro não tem blocos.')
  for (const b of r.blocos) {
    if (!/^[a-z0-9-]+$/.test(b.id)) erros.push(`Bloco "${b.id}": id só com letras minúsculas, números e hífen.`)
    if (ids.has(b.id)) erros.push(`Bloco "${b.id}": id repetido.`)
    ids.add(b.id)
    if (b.fala.trim().length < 20) erros.push(`Bloco "${b.id}": fala curta demais.`)
    if (!secoes.has(b.secao)) erros.push(`Bloco "${b.id}": seção "${b.secao}" não existe.`)
  }
  return erros
}

// ───────────────────────── MP3 ─────────────────────────

export type QuadroMp3 = { inicio: number; tamanho: number; amostras: number; taxa: number; info: boolean }

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const TAXAS_V1 = [44100, 48000, 32000]

function tamanhoDoId3v2(b: Uint8Array): number {
  if (b.length >= 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    return 10 + ((b[6] & 0x7f) << 21) + ((b[7] & 0x7f) << 14) + ((b[8] & 0x7f) << 7) + (b[9] & 0x7f)
  }
  return 0
}

/** Lê os quadros MPEG Layer III do arquivo. Ignora o que não for quadro válido. */
export function quadrosMp3(b: Uint8Array): QuadroMp3[] {
  const quadros: QuadroMp3[] = []
  let i = tamanhoDoId3v2(b)
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) {
      i++
      continue
    }
    const versaoBits = (b[i + 1] >> 3) & 0x03 // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const camada = (b[i + 1] >> 1) & 0x03 // 1 = Layer III
    const brIdx = (b[i + 2] >> 4) & 0x0f
    const srIdx = (b[i + 2] >> 2) & 0x03
    const padding = (b[i + 2] >> 1) & 0x01
    if (versaoBits === 1 || camada !== 1 || brIdx === 0 || brIdx === 15 || srIdx === 3) {
      i++
      continue
    }
    const v1 = versaoBits === 3
    const bitrate = (v1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[brIdx] * 1000
    const taxa = TAXAS_V1[srIdx] / (v1 ? 1 : versaoBits === 2 ? 2 : 4)
    const amostras = v1 ? 1152 : 576
    const tamanho = Math.floor(((v1 ? 144 : 72) * bitrate) / taxa) + padding
    if (tamanho < 5 || i + tamanho > b.length + 1) break
    const trecho = Buffer.from(b.subarray(i + 4, Math.min(i + 4 + 40, b.length))).toString('latin1')
    quadros.push({ inicio: i, tamanho: Math.min(tamanho, b.length - i), amostras, taxa, info: /Xing|Info/.test(trecho) })
    i += tamanho
  }
  return quadros
}

/** Duração em segundos, sem contar o quadro de cabeçalho Xing/Info. */
export function duracaoMp3(b: Uint8Array): number {
  return quadrosMp3(b)
    .filter((q) => !q.info)
    .reduce((s, q) => s + q.amostras / q.taxa, 0)
}

/** Junta MP3s: tira o ID3 e o quadro Xing/Info de cada um, para emendar sem estalo. */
export function juntarMp3(arquivos: readonly Uint8Array[]): Uint8Array {
  const partes: Uint8Array[] = []
  for (const a of arquivos) {
    for (const q of quadrosMp3(a)) if (!q.info) partes.push(a.subarray(q.inicio, q.inicio + q.tamanho))
  }
  const total = partes.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let o = 0
  for (const p of partes) {
    saida.set(p, o)
    o += p.length
  }
  return saida
}

export type Tempo = { t0: number; t1: number }

/** Início e fim de cada trecho no MP3 já emendado (sem silêncio entre eles). */
export function temposDosTrechos(duracoes: readonly number[]): Tempo[] {
  let t = 0
  return duracoes.map((d) => {
    const tempo = { t0: Math.round(t * 100) / 100, t1: Math.round((t + d) * 100) / 100 }
    t += d
    return tempo
  })
}

// ───────────────────────── Texto para o Claude web ─────────────────────────

/** O pedido que se cola no Claude web: um áudio por trecho, nomeado pelo id. */
export function pedidoDeNarracao(r: Roteiro): string {
  const l: string[] = []
  l.push(`# Pedido de narração — ${r.titulo}`, '')
  l.push(
    'Gere **um arquivo MP3 por trecho**, na mesma voz (português do Brasil, tom claro e calmo, ritmo de manual de treinamento), ' +
      'sem música e sem pausa longa no começo e no fim. Nomeie cada arquivo exatamente como o `id` do trecho: `<id>.mp3`. ' +
      'Entregue todos para download e me devolva a pasta.',
    '',
  )
  l.push('Leia o texto exatamente como está escrito. Leia a sigla CTCEA como letras (cê, tê, cê, é, á) e "Card WIN" como "card uin".', '')
  r.blocos.forEach((b, i) => {
    l.push(`## ${String(i + 1).padStart(2, '0')} — \`${b.id}.mp3\` — ${b.titulo}`, '', b.fala, '')
  })
  return l.join('\n')
}

// ───────────────────────── HTML ─────────────────────────

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function jsonSeguro(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function htmlBloco(b: Bloco, telas: Record<string, string>, abertura: boolean, r: Roteiro): string {
  if (abertura) {
    return `<div class="nb" id="nb-${b.id}"><p class="kicker">${esc(r.subtitulo)}</p><h1 class="title">${esc(r.titulo)}</h1><p class="dek">${esc(r.resumo)}</p></div>`
  }
  const partes: string[] = [`<div class="nb" id="nb-${b.id}"><h3>${esc(b.titulo)}</h3>`]
  if (b.paragrafo) partes.push(`<p>${esc(b.paragrafo)}</p>`)
  if (b.passos?.length) partes.push(`<ol>${b.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>`)
  if (b.tabela) {
    partes.push(
      `<div class="table-wrap"><table><thead><tr>${b.tabela.cabecalho.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${b.tabela.linhas
        .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`,
    )
  }
  if (b.nota) partes.push(`<div class="nota"><span class="nota-rotulo">${esc(b.nota.rotulo)}</span><p>${esc(b.nota.texto)}</p></div>`)
  if (b.tela) {
    const src = telas[b.tela.arquivo]
    if (src) partes.push(`<figure class="shot"><img src="${src}" alt="${esc(b.tela.legenda)}"><figcaption>${esc(b.tela.legenda)}</figcaption></figure>`)
  }
  partes.push('</div>')
  return partes.join('')
}

const ESTILO = `
:root{color-scheme:light dark;--bg:#F5F7FA;--surface:#fff;--line:#E3E8EC;--text:#16212B;--muted:#5B6B76;--accent:#0F766E;--accent-soft:#E2F2F0;--on-accent:#fff;--warn:#E76F51;--hl:#E2F2F0;--ring:rgba(15,118,110,.3);--serif:"Manrope","Segoe UI","Helvetica Neue",Arial,sans-serif;--sans:"Public Sans","Segoe UI","Helvetica Neue",Arial,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0B1418;--surface:#121C21;--line:#1E2B31;--text:#EAF1F0;--muted:#8FA3A0;--accent:#2DD4BF;--accent-soft:#12302E;--on-accent:#0B1418;--warn:#F3866A;--hl:#12302E;--ring:rgba(45,212,191,.35)}}
*{box-sizing:border-box}html{scroll-padding-bottom:150px}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
.shell{max-width:1120px;margin:0 auto;padding:0 20px 220px}
header.masthead{padding:48px 0 32px;border-bottom:1px solid var(--line);margin-bottom:36px}
.kicker{font-size:14px;font-weight:600;color:var(--accent);margin:0 0 10px}
h1.title{font:700 clamp(2rem,4vw,2.7rem)/1.15 var(--serif);margin:0 0 12px;max-width:20ch;text-wrap:balance}
.dek{font-size:1.05rem;color:var(--muted);max-width:62ch;margin:0}
.cta{margin-top:24px;display:inline-flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:8px 22px 8px 8px;cursor:pointer;font:inherit;color:var(--text)}
.cta:hover,.cta:focus-visible{border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft);outline:none}
.cta[disabled]{opacity:.6;cursor:not-allowed}
.cta-icon{width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;flex:none}
.cta-text{text-align:left;line-height:1.3}.cta-text strong{display:block}.cta-text span{font-size:13px;color:var(--muted)}
.layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px;align-items:start}
nav.toc{position:sticky;top:24px;display:flex;flex-direction:column;gap:4px;padding:18px 16px;background:var(--surface);border:1px solid var(--line);border-radius:10px}
.toc-label{font-size:13px;font-weight:700;color:var(--muted);margin:0 0 8px}
nav.toc a{color:var(--muted);text-decoration:none;font-size:14px;padding:6px 8px;border-radius:6px}
nav.toc a:hover,nav.toc a:focus-visible,nav.toc a.is-current{background:var(--accent-soft);color:var(--accent);outline:none}
nav.toc a.is-current{font-weight:600}
main{min-width:0}
section.doc-section{margin-bottom:48px;scroll-margin-top:24px}
.section-head{display:flex;align-items:baseline;gap:12px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid var(--accent)}
.section-num{font-size:14px;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:2px 9px}
h2.section-title{font:700 1.6rem/1.25 var(--serif);margin:0}
h3{font:700 1.15rem/1.3 var(--serif);margin:0 0 10px}
p{max-width:68ch;margin:0 0 12px}
ol,ul{max-width:66ch;padding-left:1.3em;margin:0 0 14px}li{margin-bottom:8px}
.nota{margin:14px 0 18px;padding:12px 16px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;max-width:64ch}
.nota p{margin:0;font-size:.95rem}.nota-rotulo{display:block;font-size:13px;font-weight:700;color:var(--accent);margin-bottom:4px}
.table-wrap{overflow-x:auto;margin:0 0 20px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:480px;font-size:.92rem}
th{text-align:left;font-size:13px;color:var(--muted);font-weight:700;padding:10px 14px;border-bottom:1px solid var(--line)}
td{padding:10px 14px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--muted)}td:first-child{color:var(--text);font-weight:600}tr:last-child td{border-bottom:none}
figure.shot{margin:6px 0 22px;max-width:760px}figure.shot img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:10px}
figcaption{font-size:13px;color:var(--muted);margin-top:6px}
footer.colophon{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
.nb{position:relative;border-radius:12px;transition:background-color .4s,box-shadow .4s,opacity .4s}.nb+.nb{margin-top:8px}
body.narrating main .nb{opacity:.5}body.narrating main .nb.narr-on,body.narrating header .nb{opacity:1}
.nb.narr-on{background:var(--hl);box-shadow:0 0 0 14px var(--hl),0 0 0 15px var(--ring)}
.nb.narr-on::before{content:"";position:absolute;left:-24px;top:6px;bottom:6px;width:3px;border-radius:3px;background:var(--accent)}
header .nb.narr-on::before{display:none}
.player{position:fixed;left:50%;bottom:16px;transform:translate(-50%,140%);width:min(1080px,calc(100% - 24px));z-index:50;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);transition:transform .4s;overflow:hidden}
.player.is-visible{transform:translate(-50%,0)}
.p-track{position:relative;height:6px;background:var(--line);cursor:pointer}.p-fill{position:absolute;inset:0 auto 0 0;width:0;background:var(--accent)}
.p-tick{position:absolute;top:0;bottom:0;width:2px;background:var(--surface)}
.p-body{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;padding:12px 16px 14px}
.p-play{width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;background:var(--accent);color:var(--on-accent);display:grid;place-items:center}
.p-play:focus-visible,.p-btn:focus-visible{outline:3px solid var(--ring);outline-offset:2px}.p-play svg{width:18px;height:18px}
.p-kicker{font-size:13px;font-weight:700;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-caption{font-size:.92rem;color:var(--muted);line-height:1.45;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.p-caption.is-hidden{display:none}
.p-ctrls{display:flex;align-items:center;gap:6px}.p-time{font-size:13px;color:var(--muted);margin-right:6px;white-space:nowrap;font-variant-numeric:tabular-nums}
.p-btn{font:600 13px var(--sans);color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap}
.p-btn:hover{border-color:var(--accent);color:var(--accent)}.p-btn[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.pill{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:51;font:600 14px var(--sans);color:var(--on-accent);background:var(--accent);border:none;border-radius:999px;padding:9px 16px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.25);display:none}.pill.is-visible{display:inline-block}
@media (max-width:860px){.layout{grid-template-columns:1fr;gap:28px}nav.toc{position:static}.nb.narr-on::before{display:none}.p-body{grid-template-columns:auto minmax(0,1fr)}.p-ctrls{grid-column:1/-1;justify-content:space-between}}
@media (prefers-reduced-motion:reduce){.nb,.player{transition:none}}
`

const SCRIPT = `
(function(){
var SEGS=window.__SEGS__,audio=document.getElementById('narr-audio');if(!SEGS||!audio)return;
var $=function(i){return document.getElementById(i)},player=$('player'),btnPlay=$('p-play'),icoPlay=$('ico-play'),icoPause=$('ico-pause'),kicker=$('p-kicker'),caption=$('p-caption'),timeEl=$('p-time'),track=$('p-track'),fill=$('p-fill'),pill=$('pill'),btnSpeed=$('p-speed'),btnCc=$('p-cc');
var toc=[].slice.call(document.querySelectorAll('nav.toc a')),reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var total=SEGS[SEGS.length-1].t1,cur=-1,follow=true,auto=false,autoT=null,speeds=[1,1.25,1.5,.85],si=0;
function fmt(s){s=Math.max(0,Math.floor(s));var m=Math.floor(s/60),r=s%60;return(m<10?'0':'')+m+':'+(r<10?'0':'')+r}
var last=null;SEGS.forEach(function(s){if(s.sec!==last&&s.t0>1){var t=document.createElement('div');t.className='p-tick';t.style.left=(s.t0/total*100)+'%';track.appendChild(t)}last=s.sec});
function segAt(t){for(var i=SEGS.length-1;i>=0;i--){if(t>=SEGS[i].t0-.05)return i}return 0}
function scrollTo_(el){var r=el.getBoundingClientRect(),room=innerHeight-160,top=r.height>room*.85?scrollY+r.top-40:scrollY+r.top-(room-r.height)/2;auto=true;clearTimeout(autoT);scrollTo({top:Math.max(0,top),behavior:reduce?'auto':'smooth'});autoT=setTimeout(function(){auto=false},1100)}
function setCur(i,force){if(i===cur&&!force)return;if(cur>=0){var p=$('nb-'+SEGS[cur].id);if(p)p.classList.remove('narr-on')}cur=i;var s=SEGS[i],el=$('nb-'+s.id);if(el){el.classList.add('narr-on');if(follow||force)scrollTo_(el)}
kicker.textContent=(i+1<10?'0':'')+(i+1)+'/'+SEGS.length+' · '+s.titulo;caption.textContent=s.fala;toc.forEach(function(a){a.classList.toggle('is-current',a.getAttribute('href')==='#'+s.sec)})}
function ui(pl){icoPlay.style.display=pl?'none':'';icoPause.style.display=pl?'':'none';btnPlay.setAttribute('aria-label',pl?'Pausar':'Reproduzir');document.body.classList.toggle('narrating',pl||audio.currentTime>.2)}
function play(){player.classList.add('is-visible');var p=audio.play();if(p&&p.catch)p.catch(function(){ui(false)})}
function seek(t,sc){audio.currentTime=Math.max(0,Math.min(total-.1,t));follow=true;pill.classList.remove('is-visible');setCur(segAt(audio.currentTime),sc!==false);update()}
function update(){var t=audio.currentTime;fill.style.width=(t/total*100)+'%';timeEl.textContent=fmt(t)+' / '+fmt(total);if(!audio.paused||t>.2)setCur(segAt(t),false)}
$('cta').addEventListener('click',function(){if(audio.ended)audio.currentTime=0;follow=true;pill.classList.remove('is-visible');play()});
btnPlay.addEventListener('click',function(){audio.paused?play():audio.pause()});
$('p-prev').addEventListener('click',function(){var i=cur<0?0:cur,t=(audio.currentTime-SEGS[i].t0>2||i===0)?i:i-1;seek(SEGS[t].t0+.01)});
$('p-next').addEventListener('click',function(){var i=cur<0?0:cur+1;if(i<SEGS.length)seek(SEGS[i].t0+.01)});
btnSpeed.addEventListener('click',function(){si=(si+1)%speeds.length;audio.playbackRate=speeds[si];btnSpeed.textContent=String(speeds[si]).replace('.',',')+'×'});
btnCc.addEventListener('click',function(){var on=btnCc.getAttribute('aria-pressed')!=='true';btnCc.setAttribute('aria-pressed',String(on));caption.classList.toggle('is-hidden',!on)});
$('p-close').addEventListener('click',function(){audio.pause();player.classList.remove('is-visible');document.body.classList.remove('narrating');var e=cur>=0&&$('nb-'+SEGS[cur].id);if(e)e.classList.remove('narr-on');cur=-1});
track.addEventListener('click',function(e){var r=track.getBoundingClientRect();seek((e.clientX-r.left)/r.width*total)});
pill.addEventListener('click',function(){follow=true;pill.classList.remove('is-visible');if(cur>=0)setCur(cur,true)});
['wheel','touchmove'].forEach(function(ev){addEventListener(ev,function(){if(!auto&&!audio.paused){follow=false;pill.classList.add('is-visible')}},{passive:true})});
audio.addEventListener('play',function(){ui(true)});audio.addEventListener('pause',function(){ui(false)});
audio.addEventListener('ended',function(){ui(false);document.body.classList.remove('narrating');var e=cur>=0&&$('nb-'+SEGS[cur].id);if(e)e.classList.remove('narr-on')});
audio.addEventListener('timeupdate',update);
})();`

export type EntradaHtmlNarrado = {
  roteiro: Roteiro
  /** nome do arquivo de tela (sem extensão) → data URI da imagem. */
  telas: Record<string, string>
  /** MP3 já emendado, em data URI, e o tempo de cada bloco (mesma ordem de `blocos`). */
  audio: { dataUri: string; tempos: Tempo[] } | null
}

export function htmlManualNarrado({ roteiro: r, telas, audio }: EntradaHtmlNarrado): string {
  const [abertura, ...resto] = r.blocos
  const total = audio ? audio.tempos[audio.tempos.length - 1].t1 : 0
  const mm = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const comBlocos = r.secoes.filter((s) => resto.some((b) => b.secao === s.id))
  const secoes = comBlocos
    .map((s, i) => {
      const doGrupo = resto.filter((b) => b.secao === s.id)
      return `<section class="doc-section" id="${s.id}"><div class="section-head"><span class="section-num">${String(i + 1).padStart(2, '0')}</span><h2 class="section-title">${esc(s.titulo)}</h2></div>${doGrupo.map((b) => htmlBloco(b, telas, false, r)).join('')}</section>`
    })
    .join('')
  const toc = comBlocos
    .map((s, i) => `<a href="#${s.id}">${String(i + 1).padStart(2, '0')} ${esc(s.titulo)}</a>`)
    .join('')
  const segs = audio
    ? r.blocos.map((b, i) => ({ id: b.id, sec: b.secao, titulo: b.titulo, fala: b.fala, t0: audio.tempos[i].t0, t1: audio.tempos[i].t1 }))
    : null
  const cta = audio
    ? `<button class="cta" id="cta" type="button" aria-label="Ouvir o manual narrado"><span class="cta-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14z"/></svg></span><span class="cta-text"><strong>Ouvir o manual narrado</strong><span>Narração guiada · ${mm(total)}</span></span></button>`
    : `<button class="cta" id="cta" type="button" disabled><span class="cta-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14z"/></svg></span><span class="cta-text"><strong>Narração em preparação</strong><span>O texto já pode ser lido abaixo</span></span></button>`
  const player = audio
    ? `<audio id="narr-audio" preload="auto" src="${audio.dataUri}"></audio>
<div class="player" id="player" role="region" aria-label="Narração do manual"><div class="p-track" id="p-track"><div class="p-fill" id="p-fill"></div></div><div class="p-body"><button class="p-play" id="p-play" type="button" aria-label="Reproduzir"><svg id="ico-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14z"/></svg><svg id="ico-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button><div><div class="p-kicker" id="p-kicker">Narração guiada</div><div class="p-caption" id="p-caption" aria-live="off">Clique em reproduzir para ouvir o manual.</div></div><div class="p-ctrls"><span class="p-time" id="p-time">00:00 / ${mm(total)}</span><button class="p-btn" id="p-prev" type="button" aria-label="Trecho anterior" title="Trecho anterior">Anterior</button><button class="p-btn" id="p-next" type="button" aria-label="Próximo trecho" title="Próximo trecho">Próximo</button><button class="p-btn" id="p-speed" type="button" title="Velocidade">1×</button><button class="p-btn" id="p-cc" type="button" aria-pressed="true" title="Legenda">Legenda</button><button class="p-btn" id="p-close" type="button" aria-label="Fechar narração" title="Fechar narração">Fechar</button></div></div></div>
<button class="pill" id="pill" type="button">Voltar para a narração</button>
<script>window.__SEGS__=${jsonSeguro(segs)};</script><script>${SCRIPT}</script>`
    : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.titulo)} — Manual do Usuário</title><style>${ESTILO}</style></head><body><div class="shell"><header class="masthead">${htmlBloco(abertura, telas, true, r)}${cta}</header><div class="layout"><nav class="toc" aria-label="Sumário"><p class="toc-label">Neste manual</p>${toc}</nav><main>${secoes}</main></div><footer class="colophon">Sistema Cronograma CTCEA — Manual do Usuário. Gerado a partir do roteiro em docs/Manual do Usuário/video.</footer></div>${player}</body></html>`
}
